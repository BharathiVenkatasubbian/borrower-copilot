# RULES.md — Borrower Copilot

Every number the app produces traces back to a row in this file. If a rule changes here it must change in `src/rules.js` / `src/engine.js` too — they carry the same section numbers and comments, and are meant to be read side by side.

- **Currency:** INR throughout.
- **Rates:** annual, reducing-balance, indicative bands for the Indian retail market, early 2026. Documented judgement, not a live feed.
- **Format of each rule:** *what · value · why · source* (`judgement` = my call, no external number; `convention` = a widely-used industry norm applied as our own choice).

---

## 1. Products modelled

| Product | Secured? | Tenure ladder (months) | Processing fee | Binding sizing constraint | Source |
|---|---|---|---|---|---|
| Personal Loan | No | 12–60 | 2.0% | FOIR **and** 20× monthly income | convention + judgement |
| Gold Loan | Yes | 12–36 | 0.75% | FOIR **and** 75% LTV | RBI LTV ceiling + judgement |
| Loan Against Property (LAP) | Yes | 12–180 | 1.0% | FOIR **and** 60% LTV | convention + judgement |
| Business Loan (unsecured) | No | 12–60 | 2.0% | FOIR **and** 15× monthly income | convention + judgement |
| Two-Wheeler / EV Loan | Yes | 12–48 | 2.5% | FOIR **and** 85% LTV | convention + judgement |

**Why these five:** they cover all three sample borrowers (personal → Priya's wedding; LAP / gold / business → Ravi's expansion; two-wheeler → Anita's EV) plus the two other most common consumer needs. Home and education loans are out of scope per the brief ("not scored: breadth of loan products beyond what the three borrowers need").

**Tenure ladder:** the app only ever offers 12 / 24 / 36 / 48 / 60 / 84 / 120 / 180-month options, filtered to each product's own ceiling and the borrower's age cap (§11). A personal loan tops out at 60; a LAP can run to 180.

---

## 1b. Need-relative cap — *the amounts shown never run far past what the borrower came for*

| What | Value | Why | Source |
|---|---|---|---|
| Headline cap on O2's two ceilings (and therefore O4's recommended amount) | **1.25 × requested amount** | A borrower who asks for ₹2,00,000 and is shown a "safe" ₹9,00,000 is being nudged toward debt they never came for, and the number stops being useful for the decision in front of them. 25% is enough headroom for the processing fee, a modest cost overrun and rounding — nothing more. | judgement |
| When the cap binds | Both O2 figures display as "₹X+", and a note shows the true underlying capacity | Honesty: the borrower can see their real capacity is higher, and *why* we don't headline it. | judgement |
| If no amount is entered (`requestedAmount` ≤ 0) | Cap is not applied | Nothing to measure against yet. | — |

**What the cap does *not* touch:** the full FOIR/LTV capacity is still computed internally. It drives (a) the verdict's "borrow less" test — which is judged on true capacity, so the cap can never mask a genuine shortfall — (b) the stress test, and (c) the "your underlying capacity is roughly ₹…" explanation. The cap is a **presentation ceiling**, not a change to the affordability model.

**Consequence for O4:** the recommended amount is `min(requested, true practical ceiling)` — it is therefore **always ≤ what the borrower asked for**, never more.

---

## 2. Credit-score tiers → rate bands

| Tier | Score | Personal | Gold | LAP | Business | Two-Wheeler |
|---|---|---|---|---|---|---|
| high | 750+ | 10.5–12.5% | 9–11% | 9–10.5% | 11–13% | 11–13% |
| good | 700–749 | 12.5–15% | 10–12% | 10–11.5% | 13–15% | 13–15% |
| fair | 650–699 | 15–18% | 11–13.5% | 11–13% | 15–18% | 15–17% |
| low | <650 | 18–24% | 12–15% | 12.5–15% | 18–22% | 17–20% |
| **unknown** | not known | 13–17% | 11–14% | 10.5–13% | 14–17% | 14–16% |

**Rule — unknown is never zero (`judgement`, and the app's most important fairness rule):** an unknown score sits as its own **middle** tier, roughly the good/fair borderline — never the worst tier. Most people who don't know their score have never defaulted (a default triggers awareness), so mapping "unknown → bad" would be wrong more often than right. The UI says explicitly that the band is wider because the score is unknown, and O3's "why" line names it.

**Source for the band values:** general knowledge of Indian retail lending rate ranges by product and CIBIL tier, early 2026. `judgement`, not scraped.

---

## 3. Rate-band adjustments

| What | Effect | Why | Source |
|---|---|---|---|
| Credit-card utilisation ≥ 60% (salaried / pension only — the segments that reliably hold a card) | Band shifts **up** 0.5pp both ends | A widely-used near-term-stress signal even when the score itself hasn't moved. | judgement |
| Confidence < 100 | Band widened symmetrically about its midpoint (see §7) | Fewer answers → less basis to narrow. | brief requirement |

---

## 4. Income model — two views, on purpose

This is the mechanism that makes O2's two numbers *actually* different.

| View | Formula | Used for |
|---|---|---|
| **Lender view** | `documentedMonthlyIncome` + `coApplicantIncome` | The "a lender will likely sanction" number for **unsecured** products — a lender underwrites only what it can verify. |
| **Borrower view (safe-carry)** | `selfReportedMonthlyIncome × (1 − haircut)` + `coApplicantIncome` + `monthlySupportAmount` (only if `financiallyDependent` = yes) | The "you can safely carry" number — what the borrower actually receives each month, including cash, because that's what the EMI is paid from. |

**Haircut on `selfReportedMonthlyIncome`** (falls back to `documentedMonthlyIncome` for salaried / pension, who aren't asked the self-reported question):

| Income type | Haircut | Why |
|---|---|---|
| Salaried | 0% | Fully documented, payslip-verified. |
| Retired / pension | 0% | Pension credits are bank-verified and stable. |
| Self-employed (ITR), self-employed (cash), gig/platform, part-time | 20% | Cash-based / unverifiable / hours-variable income is real but less reliable than a payslip. |
| Student, not working | 30% | Self-reported stipend / odd-job income is thinner and less predictable still. |
| *(any of the above)* | + up to 15% more, scaled by `variableIncomeSharePct` | Declared volatility stacks on the type-based haircut. |
| **Total cap** | 40% | The haircut can never wipe out more than a bit under half of self-reported income. |

**Source:** the documented-income gap in India's informal / self-employed / gig segment is a known underwriting feature; the specific haircut percentages are `judgement`.

**Co-applicant vs informal support:** a formal co-applicant's income counts on **both** sides (a lender counts it too). Informal parent/spouse expense support counts only on the safe-carry side (a lender won't verify it). Conflating the two would make the app claim a loan is fundable when a lender would decline it for lack of paperwork. **Known simplification:** if the same person's money is entered as *both* a co-applicant figure and expense support, the app adds both — answer only one of the two questions if they describe the same rupees (see §12).

---

## 5. FOIR ceilings and the expense sanity cap

**Safe-carry FOIR ceiling (borrower-view), base 40%, adjusted:**

| Condition | Adjustment | Source |
|---|---|---|
| Base | 40% | convention (India retail affordability norm), applied as our own conservative call |
| Income type informal / gig / part-time / student / unemployed | −5pp | judgement |
| `variableIncomeSharePct` ≥ 40 | −5pp | judgement |
| Emergency savings < 1 month of expenses | −5pp | judgement |
| Recent bounce (any payment, 6 months) | −5pp | judgement |
| Per financial dependent | −2pp, capped at −10pp (5+) | judgement |
| Safe-carry income > ₹1,50,000/month | +5pp | judgement |
| Purpose = business growth with stated uplift % | up to +5pp (`min(uplift, 20) / 400`) | judgement, capped |
| **Clamp** | [20%, 50%] | judgement |

**Expense sanity cap on the safe EMI (`src/rules.js` → `expenseCappedEmi`):** after essential household spending *and* existing EMIs, no more than **60%** of what is genuinely left over may go to the new EMI — the rest is the borrower's buffer against a bad month.

```
leftover      = safeIncome − householdExpenses − existingEMI
safe EMI ≤ min( FOIR-based ceiling , 0.6 × leftover )
```

Only applied when the borrower actually gave an expenses figure. This is what wires `householdExpenses` into the maths (it was previously collected but unused). For Priya it is the *binding* constraint: her FOIR ceiling would allow ₹30,000/month, but 60% of what's left after ₹48,000 expenses and her ₹14,000 car EMI is ₹28,800 — so ₹28,800 is her real ceiling. **Source:** `judgement` — 60% is a deliberately conservative "don't spend the whole surplus on debt" rule.

**Lender-view FOIR ceiling, per product base, adjusted by score tier:**

| Product base | high tier | low tier |
|---|---|---|
| Personal / Business / Two-wheeler: 50% | +3pp | −5pp |
| Gold / LAP: 55% | +3pp | −5pp |

Clamped to [30%, 60%]. The safe-carry base (40%) is deliberately **below** the lender base (50–55%): the app's job is to protect the borrower, not to maximise what a lender will approve.

---

## 6. Product routing (which product we actually recommend)

| Purpose | Borrower has… | Recommend | Why |
|---|---|---|---|
| Business growth | Unencumbered property | **LAP** | 4–6 points cheaper than an unsecured business loan for the same amount. |
| Business growth | Gold, no property | **Gold loan** | Cheaper than an unsecured business loan. |
| Business growth | Neither | Business loan (unsecured) | No cheaper secured alternative. |
| Vehicle purchase | — | Two-wheeler loan | Product-matched. |
| Wedding / medical / education / renovation / debt consolidation / other | Gold | **Gold loan** | 3–5 points cheaper than a personal loan. |
| Same | No collateral | Personal loan | Default unsecured product for consumption. |

**"Not sure — recommend one for me":** if the borrower picks this for loan type, the routing above still runs, the result is framed as a positive suggestion ("Based on your purpose, a Personal Loan is the right fit"), and it is **not** flagged as overriding their choice. If they picked a concrete product and routing disagrees, the card says "recommended instead of what you first picked" (this is Ravi's case).

---

## 7. Confidence and band-widening

| Rule | Value | Source |
|---|---|---|
| Base confidence (must-set only) | 45 / 100 | judgement |
| Confidence gained | up to +55, proportional to (answered applicable additional Qs ÷ applicable additional Qs) | judgement |
| Band width multiplier at confidence 45 | 1.6× base width | judgement |
| Band width multiplier at confidence 100 | 1.0× | judgement |

**Rule — never narrow from silence:** the multiplier only ever *widens* a band relative to its §2 definition. Confidence counts only *applicable* additional questions, so a salaried borrower isn't penalised for skipping business-only questions. A "not applicable / don't know" answer on a free-text question (offers, loan detail, upcoming expense) is treated as "no signal", not as an answer that narrows anything.

---

## 8. APR — all-in cost (O3)

The EMI is charged on the **full principal** at the nominal rate, but only **principal − processing fee** is disbursed. APR is the rate that would produce the *same EMI* if charged on the amount actually received. No closed form once a fee is involved, so it's solved by bisection (60 iterations).

```
EMI          = emiForLoan(principal, nominalRate, tenure)
netDisbursed = principal − processingFee
APR          = r such that emiForLoan(netDisbursed, r, tenure) == EMI
```

**Why not "nominal + fee/tenure":** a flat fee-annualisation understates APR for long tenures and overstates it for short ones. Solving for the equivalent rate is the RBI-style all-in cost the brief asks for, and is defensible line-by-line. **Source:** method is `judgement`; it's a standard finance calculation.

---

## 9. Verdict (O1) — top-down, first match wins

| # | Condition | Verdict |
|---|---|---|
| 1 | Recent bounce **and** (savings < 1 month or unknown) | **Don't borrow** — bounced payment + no cushion; a new EMI raises real default risk. |
| 2 | Existing EMI ÷ safe-carry income ≥ 45% | **Don't borrow** — existing EMIs already take too much of your income. |
| 3 | True safe-carry capacity ≤ 0 | **Don't borrow** — no room without cutting into essentials. |
| 4 | *(unsecured only)* True lender-view capacity ≤ 0 | **Don't borrow** — no verifiable income and no co-applicant; a lender won't sanction unsecured credit on undocumented support alone. |
| 5 | True practical ceiling (min of the two capacities) is > 10% short of the requested amount | **Borrow less** — recommended amount shown instead. |
| 6 | Otherwise | **Borrow** — the requested amount (never more) is recommended. |

All tests use the **uncapped** capacity (§1b), so the need-relative cap can never turn a real shortfall into a false "borrow".

**Why rule 4 is skipped for secured products:** a gold loan or LAP can legitimately be sanctioned against collateral with zero *documented* income. This model doesn't size a secured product's sanction *upward* for that (see §12); skipping the hard-stop at least avoids wrongly blocking a borrower who has real collateral but no payslip.

---

## 10. EMI ceiling, tenure, and stress test (O4)

| Output | Rule | Source |
|---|---|---|
| **Recommended EMI** | EMI on the recommended amount at the **top** of the fair rate band (size against the worst rate the borrower might actually be offered). | judgement |
| **Recommended tenure** | The **shortest** tenure on the ladder (§1) whose EMI still passes the combined stress test. A longer tenure lowers the EMI but costs more interest overall, so we don't stretch further than the borrower's safety margin needs. Falls back to the shortest tenure that at least fits the normal ceiling, then to the product's max. | judgement |
| **Hard ceiling** | `min(FOIR-based safe EMI, 0.6 × leftover-after-essentials)` — see §5. Do not agree to more than this regardless of what a lender offers. | judgement |
| **Tenure trade-off table** | Every ladder rung: EMI at the recommended amount, and max loan at the safe EMI. Recommended rung is marked. | brief requirement |
| **Stress test** | Recompute the safe EMI ceiling with income −20% **and** rate +2pp simultaneously (combined shock, not either/or). If the recommended EMI would exceed the stressed ceiling, flag it explicitly. | judgement — 20% / 2pp is a common illustrative magnitude, not a mandate |

---

## 11. Tenure cap by age

`maxTenureMonths = min(product's own ceiling, (60 − age) × 12)`, floored at 12 months.

**Why 60:** a common retail-loan maturity-age assumption in India (varies by lender, sometimes 65–70 for secured). `judgement`, kept conservative and uniform across products for simplicity. **Known simplification:** a real LAP often permits maturity past 60 (see §12).

---

## 12. What this app deliberately does NOT model (honesty about limits)

- **No live bureau pull, no real rate feed** — every band is documented judgement, refreshed by hand.
- **No regional cost-of-living adjustment** — ₹20,000 of expenses means the same in Mumbai and Hubballi here.
- **Possible double-count between `coApplicantIncome` and `monthlySupportAmount`** — if the same person's money is described both ways, the app adds both. A real version would ask once and branch.
- **Secured products don't size their lender-sanction figure *upward* for strong collateral against weak / zero documented income.** The model computes the FOIR-income figure first and only lets LTV *shrink* it — it never lets collateral *substitute* for income proof. In reality a gold loan is often sanctioned almost entirely against collateral. Verdict rule 4 (§9) avoids a wrong "Don't borrow" for this case, but the sanction *amount* stays conservative. This is why the parent-supported-student-with-gold scenario in RUNTHROUGHS still returns "Don't borrow".
- **The productive-loan income-uplift adjustment (§5) is a single self-reported %, uncorroborated** — a real system would sanity-check it against the sector.
- **Co-applicant income is added at face value** — no separate haircut for the co-applicant's own income type.
- **Tenure-age cap (§11) is uniform across products** — real lenders vary it.
- **The need-relative cap (§1b) uses a flat 25%** — a real product might scale headroom by purpose (a wedding budget flexes more than a two-wheeler price).
- **Stand-in figures** were needed to run the three sample borrowers where the brief describes something qualitatively (Anita's monthly app-loan repayment; Priya's non-rent expenses). These are listed explicitly in `docs/RUNTHROUGHS.md`.
