/**
 * rules.js — Borrower Copilot rules engine
 *
 * PURE LOGIC ONLY. No DOM, no React, no I/O.
 * Every constant here has a matching row in RULES.md — if you change a
 * number here, change it there too (and vice versa).
 *
 * Runs in the browser (attaches to window.Rules) and in Node (module.exports)
 * so the same file can be unit-tested and used to generate the run-throughs.
 */
(function (global) {
  "use strict";

  // ---------------------------------------------------------------------
  // 1. PRODUCTS
  // ---------------------------------------------------------------------
  // Rate bands are annual, reducing-balance, indicative bands for the Indian
  // market as of early 2026 (documented judgement, not a live rate feed —
  // see RULES.md "source" column). "unknown" tier is NOT the worst tier —
  // it sits in the middle, wider, per the "unknown is never zero" rule.
  const PRODUCTS = {
    personal_loan: {
      key: "personal_loan",
      label: "Personal Loan",
      secured: false,
      maxTenureMonths: 60,
      processingFeePct: 2.0,
      rateBands: {
        high: [10.5, 12.5],
        good: [12.5, 15],
        fair: [15, 18],
        low: [18, 24],
        unknown: [13, 17],
      },
      lenderFoirCeiling: 0.5,
      incomeMultipleCap: 20, // lenders typically cap unsecured sanction near ~20x net monthly income
    },
    gold_loan: {
      key: "gold_loan",
      label: "Gold Loan",
      secured: true,
      maxTenureMonths: 36,
      processingFeePct: 0.75,
      rateBands: {
        high: [9, 11],
        good: [10, 12],
        fair: [11, 13.5],
        low: [12, 15],
        unknown: [11, 14],
      },
      lenderFoirCeiling: 0.55,
      ltvCap: 0.75, // RBI ceiling on gold-loan LTV
    },
    lap: {
      key: "lap",
      label: "Loan Against Property",
      secured: true,
      maxTenureMonths: 180,
      processingFeePct: 1.0,
      rateBands: {
        high: [9, 10.5],
        good: [10, 11.5],
        fair: [11, 13],
        low: [12.5, 15],
        unknown: [10.5, 13],
      },
      lenderFoirCeiling: 0.55,
      ltvCap: 0.6,
    },
    business_loan: {
      key: "business_loan",
      label: "Business Loan (unsecured)",
      secured: false,
      maxTenureMonths: 60,
      processingFeePct: 2.0,
      rateBands: {
        high: [11, 13],
        good: [13, 15],
        fair: [15, 18],
        low: [18, 22],
        unknown: [14, 17],
      },
      lenderFoirCeiling: 0.5,
      incomeMultipleCap: 15,
    },
    two_wheeler_loan: {
      key: "two_wheeler_loan",
      label: "Two-Wheeler / EV Loan",
      secured: true,
      maxTenureMonths: 48,
      processingFeePct: 2.5,
      rateBands: {
        high: [11, 13],
        good: [13, 15],
        fair: [15, 17],
        low: [17, 20],
        unknown: [14, 16],
      },
      lenderFoirCeiling: 0.5,
      ltvCap: 0.85,
    },
  };

  // ---------------------------------------------------------------------
  // 1b. NEED-RELATIVE CAP
  // ---------------------------------------------------------------------
  // A borrower who walks in asking for ₹2,00,000 and is shown a "safe" ₹9,00,000
  // is being nudged toward debt they never came for — and the headline number
  // stops being useful for the one decision in front of them. So the amounts we
  // PUT IN FRONT of the borrower (O2's two ceilings, and therefore O4's
  // recommended amount) are never shown running far past the stated need.
  //
  // We still COMPUTE full underlying capacity (it drives the "you could actually
  // afford more / less" explanation, and the stress test), but the number on the
  // card is capped at 25% over what they asked for — enough headroom for the
  // processing fee, a modest cost overrun, and rounding, and nothing more.
  const NEED_HEADROOM_MULTIPLE = 1.25;

  function needCap(requestedAmount) {
    const r = Number(requestedAmount) || 0;
    return r > 0 ? Math.round(r * NEED_HEADROOM_MULTIPLE) : Infinity;
  }

  // ---------------------------------------------------------------------
  // 2. CREDIT SCORE TIERS
  // ---------------------------------------------------------------------
  function scoreTier(score) {
    if (score === null || score === undefined || score === "unknown") return "unknown";
    const s = Number(score);
    if (s >= 750) return "high";
    if (s >= 700) return "good";
    if (s >= 650) return "fair";
    return "low";
  }

  // ---------------------------------------------------------------------
  // 3. ROUTING — which product actually fits, not just what the borrower typed
  // ---------------------------------------------------------------------
  function recommendProduct(a) {
    const requested = a.loanTypeRequested;
    const borrowerUnsure = !requested || requested === "unsure";
    let suggested = borrowerUnsure ? null : requested;
    let note = null;

    const hasProperty = a.collateralType === "property" && Number(a.collateralValue) > 0;
    const hasGold = a.collateralType === "gold" && Number(a.collateralValue) > 0;

    if (a.purpose === "business_growth") {
      if (hasProperty) {
        suggested = "lap";
        note =
          "You have unencumbered property. A Loan Against Property is usually 4-6 points cheaper than an unsecured business loan for the same amount.";
      } else if (hasGold) {
        suggested = "gold_loan";
        note = "Pledging gold usually beats an unsecured business loan by several points.";
      } else {
        suggested = "business_loan";
      }
    } else if (a.purpose === "vehicle_purchase") {
      suggested = "two_wheeler_loan";
    } else {
      // wedding, medical, education, home_renovation, debt_consolidation, other
      if (hasGold) {
        suggested = "gold_loan";
        note = "Pledging gold you already hold is typically 3-5 points cheaper than an unsecured personal loan.";
      } else {
        suggested = "personal_loan";
      }
    }

    // If the borrower said "not sure", we're recommending, not overriding —
    // surface the pick as a positive suggestion, not a correction.
    if (borrowerUnsure && !note) {
      note = `Based on your purpose${hasProperty || hasGold ? " and the collateral you hold" : ""}, a ${PRODUCTS[suggested].label} is the right fit.`;
    }

    return {
      suggested,
      note,
      requestedDiffers: !borrowerUnsure && suggested !== requested,
      borrowerUnsure,
    };
  }

  // ---------------------------------------------------------------------
  // 4. INCOME MODEL
  // ---------------------------------------------------------------------
  // Two views of income, on purpose:
  //  - "lender view": only what can be documented (ITR / bank statement / payslip).
  //    This is what a lender will actually underwrite against for an UNSECURED product.
  //  - "borrower view" (safe-carry income): what the borrower actually has access to
  //    each month, including undocumented cash, haircut for volatility/unverifiability.
  // This divergence is *why* O2's two numbers differ for the self-employed/informal cases.
  function lenderViewIncome(a) {
    return Number(a.documentedMonthlyIncome || 0);
  }

  function safeCarryIncome(a) {
    const base = a.selfReportedMonthlyIncome != null ? Number(a.selfReportedMonthlyIncome) : lenderViewIncome(a);
    let haircut = 0;
    // Cash-based / unverifiable / hours-variable income is real but less reliable than
    // documented salary or pension — same treatment across these three income types.
    if (["self_employed_informal", "gig_informal", "part_time"].includes(a.incomeType)) haircut += 0.2;
    // A student's or unemployed person's own reported income (stipend, odd jobs) is
    // thinner and less predictable still than a part-timer's — a steeper haircut.
    if (["student", "unemployed"].includes(a.incomeType)) haircut += 0.3;
    if (a.variableIncomeSharePct) haircut += (Number(a.variableIncomeSharePct) / 100) * 0.15;
    haircut = Math.min(haircut, 0.4);
    return Math.round(base * (1 - haircut));
  }

  // ---------------------------------------------------------------------
  // 5. FOIR CEILINGS (Fixed Obligation to Income Ratio)
  // ---------------------------------------------------------------------
  function safeCarryFoirCeiling(a) {
    let ceiling = 0.4; // base: a widely-used affordability convention
    if (["self_employed_informal", "gig_informal", "part_time", "student", "unemployed"].includes(a.incomeType)) {
      ceiling -= 0.05;
    }
    if (a.variableIncomeSharePct && Number(a.variableIncomeSharePct) >= 40) ceiling -= 0.05;
    if (a.emergencySavingsMonths != null && Number(a.emergencySavingsMonths) < 1) ceiling -= 0.05;
    if (a.recentBounce) ceiling -= 0.05;
    // Each dependent is a claim on income that already exists before a new EMI does —
    // 2 percentage points per dependent, capped at 10pp (5+ dependents) so it can never
    // alone drive the ceiling to its floor.
    const dependents = Number(a.dependentsCount) || 0;
    ceiling -= Math.min(dependents * 0.02, 0.1);
    const income = safeCarryIncome(a);
    if (income > 150000) ceiling += 0.05;
    return clamp(ceiling, 0.2, 0.5);
  }

  // Household-expense sanity check on the safe EMI. FOIR works off gross-ish
  // income; this makes sure that after essential spending AND existing EMIs,
  // the new EMI still leaves a real cushion. No more than 60% of what is
  // genuinely left over after essentials should go to the new EMI — the rest
  // is the borrower's buffer against a bad month. Only applied when the
  // borrower actually gave an expenses figure.
  function expenseCappedEmi(a, blendedIncome) {
    const expenses = Number(a.householdExpenses);
    if (!expenses || expenses <= 0) return Infinity;
    const existingEmi = Number(a.existingMonthlyEmi) || 0;
    const leftover = blendedIncome - expenses - existingEmi;
    return Math.max(0, leftover * 0.6);
  }

  function lenderFoirCeiling(product, tier) {
    let c = product.lenderFoirCeiling;
    if (tier === "high") c += 0.03;
    if (tier === "low") c -= 0.05;
    return clamp(c, 0.3, 0.6);
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  // ---------------------------------------------------------------------
  // 6. EMI / AMORTIZATION MATH
  // ---------------------------------------------------------------------
  function emiForLoan(principal, annualRatePct, tenureMonths) {
    const r = annualRatePct / 1200;
    if (principal <= 0 || tenureMonths <= 0) return 0;
    if (r === 0) return principal / tenureMonths;
    const f = Math.pow(1 + r, tenureMonths);
    return (principal * r * f) / (f - 1);
  }

  function maxPrincipalForEmi(maxEmi, annualRatePct, tenureMonths) {
    const r = annualRatePct / 1200;
    if (maxEmi <= 0 || tenureMonths <= 0) return 0;
    if (r === 0) return maxEmi * tenureMonths;
    const f = Math.pow(1 + r, tenureMonths);
    return (maxEmi * (f - 1)) / (r * f);
  }

  // All-in APR: the fee reduces what's actually disbursed, but the borrower
  // still pays EMI calculated on the *full* principal at the nominal rate.
  // APR is the flat rate that would produce the SAME EMI if it were charged
  // on the (principal - fee) actually received. Solved by bisection —
  // there's no closed form once a fee is involved.
  function solveAPR(principal, feeAmount, nominalAnnualRatePct, tenureMonths) {
    const emi = emiForLoan(principal, nominalAnnualRatePct, tenureMonths);
    const netDisbursed = Math.max(principal - feeAmount, 1);
    let lo = nominalAnnualRatePct;
    let hi = nominalAnnualRatePct + 20; // fee impact is bounded; 20pp headroom is always enough at realistic fee levels
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      const testEmi = emiForLoan(netDisbursed, mid, tenureMonths);
      if (testEmi > emi) hi = mid;
      else lo = mid;
    }
    return (lo + hi) / 2;
  }

  // ---------------------------------------------------------------------
  // 7. CONFIDENCE
  // ---------------------------------------------------------------------
  // Confidence starts modest on the must-set alone, and rises with every
  // ADDITIONAL question answered that actually applies to this borrower.
  // Never narrows a range from an unanswered question.
  function computeConfidence(answeredAdditionalCount, applicableAdditionalCount) {
    const base = 45;
    if (applicableAdditionalCount === 0) return base;
    const gained = Math.round((answeredAdditionalCount / applicableAdditionalCount) * 55);
    return clamp(base + gained, 45, 100);
  }

  // Width multiplier applied to rate bands / amount ranges. Low confidence => wider.
  function bandWidthMultiplier(confidence) {
    // confidence 45 -> 1.6x width, confidence 100 -> 1.0x width
    return 1 + ((100 - confidence) / 55) * 0.6;
  }

  function widenBand(band, multiplier) {
    const mid = (band[0] + band[1]) / 2;
    const halfWidth = ((band[1] - band[0]) / 2) * multiplier;
    return [round1(Math.max(0, mid - halfWidth)), round1(mid + halfWidth)];
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  // ---------------------------------------------------------------------
  // 8. VERDICT (O1)
  // ---------------------------------------------------------------------
  // Rules fire top-down; first match wins. "Don't borrow" MUST be reachable —
  // rules 1 and 2 below are the hard stops that make it reachable.
  function computeVerdict(a, existingFoirPct, safeCarryAmount, lenderSanction, requestedAmount, productSecured) {
    const reasons = [];

    if (a.recentBounce && (a.emergencySavingsMonths == null || Number(a.emergencySavingsMonths) < 1)) {
      reasons.push(
        "You've had a bounced payment in the last 6 months and no savings cushion behind you. A new EMI on top of that raises real risk of another default."
      );
      return { verdict: "dont", reasons };
    }

    if (existingFoirPct >= 0.45) {
      reasons.push(
        `Your existing EMIs already take up about ${Math.round(existingFoirPct * 100)}% of your income. That's already at or past a safe ceiling — a new loan makes this worse, not better.`
      );
      return { verdict: "dont", reasons };
    }

    if (safeCarryAmount <= 0) {
      reasons.push(
        "Based on what you can safely commit each month, there isn't room for this loan right now without cutting into essentials."
      );
      return { verdict: "dont", reasons };
    }

    // Only a hard-stop for UNSECURED products — a secured product (gold/LAP)
    // can still be sanctioned against collateral even with zero documented
    // income, which this simplified model doesn't otherwise size upward for
    // (see RULES.md limitations).
    if (!productSecured && lenderSanction <= 0) {
      reasons.push(
        "You don't have documented income a lender can verify (no payslip, ITR, or pension credit on file), and no co-applicant is on this loan. A lender won't sanction an unsecured loan against undocumented support alone — add a co-applicant with verifiable income, or bring collateral, before applying."
      );
      return { verdict: "dont", reasons };
    }

    const practicalCeiling = Math.min(safeCarryAmount, lenderSanction);

    // General safety net: whatever the specific cause, a practical ceiling of
    // zero is a "don't borrow" outcome, not a confusing "borrow less down to ₹0."
    // (Rule 4 above already covers the unsecured/no-documented-income case
    // explicitly with a more specific reason; this catches any other route to
    // the same zero, e.g. a secured product whose FOIR-based figure lands at
    // zero even though this model doesn't yet size collateral upward — see
    // RULES.md §12.)
    if (practicalCeiling <= 0) {
      reasons.push(
        "Between your documented income, existing obligations, and collateral, there's currently no amount a lender is likely to sanction for this loan. Strengthening your documentation, adding a co-applicant, or revisiting the collateral offered would change this."
      );
      return { verdict: "dont", reasons };
    }

    const shortfallPct = (requestedAmount - practicalCeiling) / requestedAmount;
    if (shortfallPct > 0.1) {
      reasons.push(
        `What you can realistically get (₹${Math.round(practicalCeiling).toLocaleString("en-IN")}) is meaningfully less than what you asked for (₹${Math.round(requestedAmount).toLocaleString("en-IN")}). Borrowing the full amount isn't realistic right now.`
      );
      return { verdict: "borrow_less", reasons };
    }

    reasons.push("What you can safely carry comfortably covers what you asked for.");
    return { verdict: "borrow", reasons };
  }

  const api = {
    PRODUCTS,
    NEED_HEADROOM_MULTIPLE,
    needCap,
    scoreTier,
    recommendProduct,
    lenderViewIncome,
    safeCarryIncome,
    safeCarryFoirCeiling,
    expenseCappedEmi,
    lenderFoirCeiling,
    emiForLoan,
    maxPrincipalForEmi,
    solveAPR,
    computeConfidence,
    bandWidthMultiplier,
    widenBand,
    computeVerdict,
    clamp,
    round1,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.Rules = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
