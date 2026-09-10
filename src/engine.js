/**
 * engine.js — orchestration layer.
 * Takes raw `answers` (from the wizard) + the applicable question list,
 * and returns the full evaluation object the UI renders.
 * No UI code. No DOM. Safe to run in Node for testing (see /docs generation script).
 */
(function (global) {
  "use strict";

  const R = typeof module !== "undefined" && module.exports ? require("./rules.js") : global.Rules;
  const QB = typeof module !== "undefined" && module.exports ? require("./questions.js") : global.QuestionBank;

  function applicableQuestions(answersSoFar) {
    return QB.QUESTIONS.filter((q) => q.appliesIf(answersSoFar));
  }

  function nextQuestion(answers) {
    const applicable = applicableQuestions(answers);
    for (const q of applicable) {
      if (answers[q.id] === undefined) return q;
    }
    return null;
  }

  function progress(answers) {
    const applicable = applicableQuestions(answers);
    const answered = applicable.filter((q) => answers[q.id] !== undefined).length;
    return { answered, total: applicable.length };
  }

  function evaluate(answers) {
    const a = normalize(answers);

    // ---- routing -------------------------------------------------------
    const routing = R.recommendProduct(a);
    const product = R.PRODUCTS[routing.suggested];
    const tier = R.scoreTier(a.creditScore);

    // ---- confidence ------------------------------------------------------
    const applicable = applicableQuestions(a);
    const additional = applicable.filter((q) => q.tier === "additional");
    const answeredAdditional = additional.filter((q) => a[q.id] !== undefined && a[q.id] !== "" ).length;
    const confidence = R.computeConfidence(answeredAdditional, additional.length);
    const widthMult = R.bandWidthMultiplier(confidence);

    // ---- incomes -----------------------------------------------------
    // Co-applicant income is formally documented and joins the application,
    // so a lender counts it too — unlike informal family expense support,
    // which only strengthens the borrower's own safe-carry view (below).
    const lenderIncome = R.lenderViewIncome(a) + (Number(a.coApplicantIncome) || 0);
    const safeIncome =
      R.safeCarryIncome(a) + (Number(a.coApplicantIncome) || 0) + (a.financiallyDependent ? Number(a.monthlySupportAmount) || 0 : 0);

    // ---- rate band (O3) -------------------------------------------------
    let band = product.rateBands[tier].slice();
    if (a.cardUtilizationPct && Number(a.cardUtilizationPct) >= 60) {
      band = [band[0] + 0.5, band[1] + 0.5]; // nudge down a notch (worse) — documented signal
    }
    band = R.widenBand(band, widthMult);
    const nominalRateForSizing = band[1]; // conservative: use the top of the band for affordability sizing

    // ---- existing FOIR -----------------------------------------------
    const incomeForFoirCheck = Math.max(safeIncome, 1);
    const existingFoirPct = (Number(a.existingMonthlyEmi) || 0) / incomeForFoirCheck;

    // ---- O2: two sanction numbers --------------------------------------
    const tenure = Math.min(product.maxTenureMonths, tenureCapForAge(a.age));

    // Lender-view sanction: FOIR-based on documented income, then capped by
    // income-multiple (unsecured) or LTV (secured) — whichever binds first.
    const lenderCeiling = R.lenderFoirCeiling(product, tier);
    const lenderMaxEmi = Math.max(lenderCeiling * lenderIncome - (Number(a.existingMonthlyEmi) || 0), 0);
    let lenderSanction = R.maxPrincipalForEmi(lenderMaxEmi, nominalRateForSizing, tenure);
    let lenderCapReason = "your income and existing obligations (FOIR-based)";
    if (product.secured && a.collateralValue) {
      const ltvCap = Number(a.collateralValue) * product.ltvCap;
      if (ltvCap < lenderSanction) {
        lenderSanction = ltvCap;
        lenderCapReason = `${Math.round(product.ltvCap * 100)}% of your collateral's value`;
      }
    } else if (!product.secured && product.incomeMultipleCap) {
      const multipleCap = lenderIncome * product.incomeMultipleCap;
      if (multipleCap < lenderSanction) {
        lenderSanction = multipleCap;
        lenderCapReason = `a lender's typical income-multiple cap for unsecured loans`;
      }
    }

    // Safe-carry: FOIR-based on the borrower's real (blended, haircut) income.
    let safeCeiling = R.safeCarryFoirCeiling(a);
    if (a.purpose === "business_growth" && a.expectedIncomeUpliftPct) {
      safeCeiling = R.clamp(safeCeiling + Math.min(Number(a.expectedIncomeUpliftPct), 20) / 400, 0.2, 0.55);
    }
    // FOIR-based safe EMI, then a second sanity cap against actual household
    // expenses (see RULES.md §5) — the tighter of the two binds.
    const foirSafeMaxEmi = Math.max(safeCeiling * safeIncome - (Number(a.existingMonthlyEmi) || 0), 0);
    const safeMaxEmi = Math.min(foirSafeMaxEmi, R.expenseCappedEmi(a, safeIncome));
    const safeEmiBoundBy = safeMaxEmi < foirSafeMaxEmi ? "expenses" : "foir";
    let safeCarryAmount = R.maxPrincipalForEmi(safeMaxEmi, nominalRateForSizing, tenure);
    if (product.secured && a.collateralValue) {
      safeCarryAmount = Math.min(safeCarryAmount, Number(a.collateralValue) * product.ltvCap);
    }

    // ---- full underlying capacity (uncapped) --------------------------
    const rawLenderSanction = Math.max(0, Math.round(lenderSanction));
    const rawSafeCarryAmount = Math.max(0, Math.round(safeCarryAmount));

    // ---- need-relative cap (see RULES.md §1b) -------------------------
    // The numbers we PUT IN FRONT of the borrower never run more than 25% past
    // what they came to borrow. Underlying capacity is kept for the explanation.
    const cap = R.needCap(a.requestedAmount);
    lenderSanction = Math.min(rawLenderSanction, cap);
    safeCarryAmount = Math.min(rawSafeCarryAmount, cap);
    const requested = Number(a.requestedAmount) || 0;
    const cappedToNeed = cap !== Infinity && (rawLenderSanction > cap || rawSafeCarryAmount > cap);
    const withinBothCeilings = requested > 0 && rawLenderSanction >= requested && rawSafeCarryAmount >= requested;

    // ---- O1: verdict -----------------------------------------------------
    // Checked against BOTH ceilings — a lender won't sanction more than it can
    // verify, and the borrower shouldn't carry more than they can safely afford.
    // Verdict and recommendedAmount must agree on which ceiling binds, or the
    // app ends up saying "go ahead and borrow" next to an amount of ₹0.
    // Verdict is judged on FULL underlying capacity, not the need-capped display
    // number — otherwise the cap itself could never let "borrow less" fire.
    const verdictResult = R.computeVerdict(
      a,
      existingFoirPct,
      rawSafeCarryAmount,
      rawLenderSanction,
      requested,
      product.secured
    );

    // ---- O4: EMI ceiling + tenure trade-off + stress case -----------------
    // The recommended amount is the ask, clamped to true capacity — it can only
    // ever be <= what the borrower asked for, never more.
    const practicalCeiling = Math.min(rawSafeCarryAmount, rawLenderSanction);
    const recommendedAmount = verdictResult.verdict === "dont" ? 0 : Math.min(requested, practicalCeiling);

    // Tenure ladder reflects each product's real range — LAP runs to 15–20 years,
    // a personal or two-wheeler loan does not.
    const tenureOptions = [12, 24, 36, 48, 60, 84, 120, 180].filter((t) => t <= tenure);

    // Stress case: income down 20% AND rate up 2pp — combined shock.
    const stressIncome = safeIncome * 0.8;
    const stressMaxEmi = Math.max(safeCeiling * stressIncome - (Number(a.existingMonthlyEmi) || 0), 0);
    const stressRate = nominalRateForSizing + 2;

    // Recommend the SHORTEST tenure that still survives the stress test — a longer
    // tenure lowers the EMI but costs more interest overall, so we don't stretch
    // it further than the borrower's safety margin needs. Fall back to the
    // shortest tenure that at least fits the normal ceiling, then to the longest.
    const tenureThatSurvivesStress = tenureOptions.find(
      (t) => R.emiForLoan(recommendedAmount, stressRate, t) <= stressMaxEmi
    );
    const tenureThatFitsCeiling = tenureOptions.find(
      (t) => R.emiForLoan(recommendedAmount, nominalRateForSizing, t) <= safeMaxEmi
    );
    const recommendedTenure =
      tenureThatSurvivesStress || tenureThatFitsCeiling || tenureOptions[tenureOptions.length - 1] || tenure;
    const tenureReason = tenureThatSurvivesStress
      ? "stress"
      : tenureThatFitsCeiling
      ? "ceiling"
      : "maxed";
    const recommendedEmi = R.emiForLoan(recommendedAmount, nominalRateForSizing, recommendedTenure);

    const tenureTradeoff = tenureOptions.map((t) => ({
      months: t,
      emiForRecommendedAmount: Math.round(R.emiForLoan(recommendedAmount, nominalRateForSizing, t)),
      maxAmountAtSafeEmi: Math.round(R.maxPrincipalForEmi(safeMaxEmi, nominalRateForSizing, t)),
    }));

    const stressEmiAtRecommended = R.emiForLoan(recommendedAmount, stressRate, recommendedTenure);
    const stressSurvives = stressEmiAtRecommended <= stressMaxEmi;

    // ---- APR (O3 all-in cost) --------------------------------------------
    const feeAmount = recommendedAmount * (product.processingFeePct / 100);
    const apr = recommendedAmount > 0 ? R.solveAPR(recommendedAmount, feeAmount, nominalRateForSizing, recommendedTenure) : nominalRateForSizing;

    // ---- assemble outputs --------------------------------------------
    const outputs = {
      confidence,
      product: {
        key: product.key,
        label: product.label,
        routingNote: routing.note,
        requestedDiffers: routing.requestedDiffers,
        borrowerUnsure: routing.borrowerUnsure,
      },
      O1: {
        verdict: verdictResult.verdict, // "borrow" | "borrow_less" | "dont"
        reasons: verdictResult.reasons,
      },
      O2: {
        requestedAmount: requested,
        lenderSanction,
        lenderCapReason,
        safeCarryAmount,
        rawLenderSanction,
        rawSafeCarryAmount,
        cappedToNeed,
        withinBothCeilings,
        headroomMultiple: R.NEED_HEADROOM_MULTIPLE,
        useThisOne: safeCarryAmount <= lenderSanction ? "safeCarryAmount" : "lenderSanction",
        why: buildO2Why({
          requested,
          safeIncome,
          lenderCapReason,
          rawLenderSanction,
          rawSafeCarryAmount,
          cappedToNeed,
          withinBothCeilings,
          headroomMultiple: R.NEED_HEADROOM_MULTIPLE,
          safeEmiBoundBy,
        }),
      },
      O3: {
        rateBandPct: band,
        aprPct: R.round1(apr),
        feeAmount: Math.round(feeAmount),
        tier,
        why: `Your rate band reflects a ${tier === "unknown" ? "credit score you don't yet know (treated as a middle, not worst-case, tier)" : tier + " credit tier"} on a ${product.label}${confidence < 70 ? ", widened because you've answered only the essentials so far" : ""}.`,
      },
      O4: {
        recommendedAmount,
        recommendedTenureMonths: recommendedTenure,
        maxTenureMonths: tenure,
        recommendedEmi: Math.round(recommendedEmi),
        maxSafeEmi: Math.round(safeMaxEmi),
        tenureTradeoff,
        stress: {
          scenario: "Income drops 20% or your rate rises 2 percentage points",
          survives: stressSurvives,
          stressMaxEmi: Math.round(stressMaxEmi),
          stressEmiAtRecommended: Math.round(stressEmiAtRecommended),
        },
        emiCeilingBoundBy: safeEmiBoundBy,
        why: buildO4Why({
          recommendedEmi,
          recommendedAmount,
          rate: R.round1(nominalRateForSizing),
          recommendedTenure,
          safeMaxEmi,
          safeEmiBoundBy,
          tenureReason,
        }),
      },
    };

    outputs.card = buildCard(a, outputs, product, tier);
    return outputs;
  }

  function inr(n) {
    return "₹" + Math.round(n).toLocaleString("en-IN");
  }

  // One-sentence "why" for O2, per RULES.md rule 4 ("every number has a why").
  function buildO2Why(x) {
    if (x.rawSafeCarryAmount <= 0) {
      return `There's no room for a new EMI right now without cutting into essentials — see the verdict above. This isn't a permanent no; clearing existing debt or rebuilding a savings buffer changes it.`;
    }
    const incomeNote = x.safeEmiBoundBy === "expenses"
      ? `what's actually left after your essential expenses and existing EMIs`
      : `what you actually take home each month (${inr(x.safeIncome)}), after existing EMIs`;

    if (x.withinBothCeilings && x.cappedToNeed) {
      return `You asked for ${inr(x.requested)}, and both a lender's likely sanction and your own safe capacity are comfortably above that — so your ask is the number that matters. We don't headline more than ${Math.round((x.headroomMultiple - 1) * 100)}% over what you came for; your underlying safe capacity is roughly ${inr(x.rawSafeCarryAmount)}, sized off ${incomeNote}.`;
    }
    if (x.rawSafeCarryAmount <= x.rawLenderSanction) {
      return `A lender will look mainly at ${x.lenderCapReason} and may offer more. Your safe number is sized off ${incomeNote}, so it still holds in a slow month — use this lower number.`;
    }
    return `Your real repayment capacity (${inr(x.safeIncome)}/month, including income a lender can't fully verify) is higher than what a lender will sanction on ${x.lenderCapReason}. The lender's number is your real ceiling — you likely can't get more even though you could afford it.`;
  }

  function buildO4Why(x) {
    if (!x.recommendedAmount || x.recommendedAmount <= 0) {
      return `No EMI is sized while the verdict above stands — there is no amount this app will point you toward borrowing right now.`;
    }
    const cost = `₹${Math.round(x.recommendedEmi).toLocaleString("en-IN")}/month is what a ₹${x.recommendedAmount.toLocaleString("en-IN")} loan costs at ${x.rate}% over ${x.recommendedTenure} months`;
    const ceil = `Your safe EMI ceiling is ₹${Math.round(x.safeMaxEmi).toLocaleString("en-IN")}/month${x.safeEmiBoundBy === "expenses" ? " (set by what's left after your household expenses, not FOIR)" : ""}`;
    if (x.tenureReason === "stress") {
      return `${cost} — the shortest tenure that still holds up under the stress test below. ${ceil}; a shorter tenure would fit that ceiling but leave no room if your income dips or the rate rises.`;
    }
    if (x.tenureReason === "ceiling") {
      return `${cost} — the shortest tenure that fits your safe EMI ceiling. ${ceil}. It does not pass the combined stress test below, so treat this as the ceiling, not a comfortable EMI.`;
    }
    return `${cost}, the longest tenure available for this product. ${ceil}, and even at full tenure this EMI is tight against it — a smaller amount would be the safer move.`;
  }

  function buildCard(a, outputs, product, tier) {
    const O = outputs;
    const productTag = O.product.requestedDiffers
      ? " (recommended instead of what you first picked)"
      : O.product.borrowerUnsure
      ? " (recommended for you)"
      : "";
    const rateStr = `${O.O3.rateBandPct[0]}% – ${O.O3.rateBandPct[1]}%`;

    // Structured key/value rows for the card UI, plus a flat `lines` array kept
    // for the plain-text run-throughs and the smoke tests.
    let fields;
    if (O.O1.verdict === "dont") {
      fields = [
        { k: "Product", v: product.label + productTag },
        { k: "Verdict", v: labelForVerdict(O.O1.verdict) },
        { k: "Requested", v: `₹${O.O2.requestedAmount.toLocaleString("en-IN")} — not fundable safely yet` },
        { k: "Fair rate (for later)", v: `${rateStr} (APR ≈ ${O.O3.aprPct}%)` },
      ];
    } else {
      const askV =
        O.O4.recommendedAmount < O.O2.requestedAmount
          ? `₹${O.O4.recommendedAmount.toLocaleString("en-IN")} over ${O.O4.recommendedTenureMonths} mo (less than the ₹${O.O2.requestedAmount.toLocaleString("en-IN")} you came for)`
          : `₹${O.O4.recommendedAmount.toLocaleString("en-IN")} over ${O.O4.recommendedTenureMonths} months`;
      fields = [
        { k: "Product", v: product.label + productTag },
        { k: "Verdict", v: labelForVerdict(O.O1.verdict) },
        { k: "Ask for", v: askV },
        { k: "Fair rate for your profile", v: rateStr },
        { k: "All-in APR (incl. fee)", v: `≈ ${O.O3.aprPct}%` },
        { k: "EMI ceiling — never exceed", v: `₹${O.O4.maxSafeEmi.toLocaleString("en-IN")}/month` },
      ];
      if (a.existingOffers) fields.push({ k: "Lender's quote so far", v: String(a.existingOffers) });
    }

    const whyLine = O.O1.verdict === "dont" ? O.O1.reasons[0] : O.O2.why;
    const lines = fields.map((f) => `${f.k}: ${f.v}`).concat(`Why: ${whyLine}`);
    return { lines, fields, whyLine, confidence: O.confidence };
  }

  function labelForVerdict(v) {
    if (v === "dont") return "Don't borrow right now";
    if (v === "borrow_less") return "Borrow less than you asked for";
    return "Go ahead and borrow";
  }

  function tenureCapForAge(age) {
    const yearsToSixty = Math.max(60 - (Number(age) || 30), 1);
    return yearsToSixty * 12;
  }

  function normalize(answers) {
    // Fill safe defaults for anything genuinely unanswered so the engine never
    // divides by zero or treats "blank" as a false negative signal. This is
    // ONLY arithmetic safety — it never narrows a range (see rules.js comments).
    const a = Object.assign({}, answers);
    if (a.creditScore === "" || a.creditScore === undefined) a.creditScore = null;
    if (a.collateralType === undefined) a.collateralType = "none";
    return a;
  }

  const api = { applicableQuestions, nextQuestion, progress, evaluate };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.Engine = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
