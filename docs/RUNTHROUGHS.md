# Run-throughs — Priya, Ravi, Anita

Real output from the engine (`node test/run.js`, or the three sample-borrower buttons on the intro screen), not hand-written. Where the brief gives something only qualitatively, a stand-in figure is used and called out.

The one thing to notice across all three: **O2's numbers are now measured against the request.** Priya asks for ₹8,00,000 and is shown ₹10,00,000, not ₹19,60,000. The full underlying capacity is still there — it's in the "why" line and the cap note — but the headline number stays useful for the decision in front of her.

---

## Priya, 29 — Bengaluru, salaried

**Stand-ins:** household expenses ₹48,000 (₹28,000 stated rent + ~₹20,000 other essentials); 0 dependents (unmarried, none mentioned); existing-loan detail "car loan".

### Questions asked

10 must-questions (a salaried profile skips the "actual cash income" question), then 10 applicable additional questions — she answers 9 with a value (blank "upcoming expense" doesn't count), giving **confidence 95**.

| # | Question | Answer |
|---|---|---|
| must | Purpose | Wedding |
| must | Amount | ₹8,00,000 |
| must | Loan type | Personal loan |
| must | Age | 29 |
| must | Occupation / income type | Salaried |
| must | Net monthly take-home | ₹1,10,000 |
| must | Existing EMI | ₹14,000 |
| must | Household expenses | ₹48,000 |
| must | Dependents | 0 |
| must | Credit score | 780 |
| add | Job tenure | 5 years |
| add | Lender quote received | 14% |
| add | Collateral | None |
| add | Co-applicant income | 0 |
| add | Informal family support | No |
| add | Existing loan detail | Car loan |
| add | Recent bounce | No |
| add | Emergency savings | 3 months |
| add | Card utilisation | 20% |
| add | Upcoming large expense | — |

### Outputs

- **O1 — Verdict: Borrow.** Safe-carry capacity comfortably covers the ask.
- **O2 — Eligibility:** Her ₹8,00,000 request **clears both ceilings**, so the number to use is her ask. Underlying capacity, shown as context: safe-carry ≈ **₹12,77,228**, a lender could stretch to ≈ **₹19,64,625**. The app caps the headline at ₹10,00,000 (1.25×) and says why.
- **O3 — Fair rate:** **10.4% – 12.6%**, all-in APR ≈ **13.5%** (high tier, personal loan, incl. ₹16,000 fee). **Her 14% quote is above the fair band** — the card calls this out.
- **O4 — EMI:** Recommended **₹18,039/month over 60 months** for the full ₹8,00,000. Hard ceiling **₹28,800/month** — and note this is set by the **expense sanity cap** (60% of what's left after ₹48,000 expenses + ₹14,000 car EMI = ₹28,800), not by FOIR, which would have allowed ₹30,000. Stress test (−20% income / +2pp rate): **survives** (₹18,864 owed vs ₹21,200 stressed ceiling). 60 months is the shortest tenure that survives that stress.

### Negotiation Card
```
Product: Personal Loan
Verdict: Go ahead and borrow
Ask for: ₹8,00,000 over 60 months
Fair rate for your profile: 10.4% - 12.6% (all-in APR ≈ 13.5%)
EMI ceiling: ₹18,039/month — do not agree to more than ₹28,800/month
Lender's quote so far: 14% — use this card to ask them to match the fair band above.
Why: You asked for ₹8,00,000, and both a lender's likely sanction and your own safe
capacity are comfortably above that — so your ask is the number that matters. We don't
headline more than 25% over what you came for; your underlying safe capacity is roughly
₹12,77,228, sized off what's actually left after your essential expenses and existing EMIs.
```

---

## Ravi, 42 — Mysuru, self-employed (kirana owner)

**Stand-ins:** cash income ₹60,000/month (midpoint of the stated ₹40k–80k); household expenses ₹30,000 (not stated); income uplift from the loan 15% (explicitly productive — new stock line + delivery vehicle); 0 dependents (wife earns her own income, entered as a co-applicant).

### Questions asked

11 must-questions (self-employed adds the "actual cash income" question), then a **different** additional set from Priya's — business age, variable-income share, collateral value and expected uplift appear; job tenure and card utilisation do not.

| # | Question | Answer |
|---|---|---|
| must | Purpose | Business growth (stock + vehicle) |
| must | Amount | ₹15,00,000 |
| must | Loan type | Business loan |
| must | Age | 42 |
| must | Occupation / income type | Self-employed, with ITR |
| must | Documented monthly income (ITR) | ₹35,000 |
| must | Actual monthly income incl. cash | ₹60,000 |
| must | Existing EMI | ₹0 |
| must | Household expenses | ₹30,000 |
| must | Dependents | 0 |
| must | Credit score | Don't know |
| add | Lender quote received | — |
| add | Business age | 14 years |
| add | Variable-income share | 40% |
| add | Collateral | Property, unencumbered |
| add | Collateral value | ₹45,00,000 |
| add | Co-applicant income | ₹18,000 (wife) |
| add | Informal family support | No |
| add | Recent bounce | No |
| add | Emergency savings | 2 months |
| add | Upcoming large expense | — |
| add | Expected income uplift | 15% |

### Outputs

- **Product routing:** the app **overrides his "business loan" choice and recommends Loan Against Property** — he has an unencumbered shop worth ₹45,00,000, and a LAP is typically 4–6 points cheaper for the same amount. This is the case the brief is really testing.
- **O1 — Verdict: Borrow.**
- **O2 — Eligibility:** His ₹15,00,000 request **clears both ceilings**. Underlying capacity: safe-carry ≈ **₹20,94,621** (his real cash income, haircut for informality + variability, plus his wife's ₹18,000 as co-applicant), lender ≈ **₹22,91,974** (his ₹35,000 ITR + ₹18,000 co-applicant). Headline capped at ₹18,75,000. The two are close because his wife's documented income now counts on **both** sides (this was a modelling bug in an earlier draft where it counted only on the borrower side — fixed, see RULES.md §4).
- **O3 — Fair rate:** **10.4% – 13.1%** (unknown tier, LAP), all-in APR ≈ **13.3%** (incl. ₹15,000 fee).
- **O4 — EMI:** Recommended **₹19,077/month over 180 months** for the full ₹15,00,000. Hard ceiling **₹26,640/month** (expense cap). 180 months is chosen because no shorter tenure on the LAP ladder survives the stress test; at 180 it does (₹21,097 owed vs ₹23,064 stressed ceiling). The tenure table shows the full trade-off — ₹34,206/month at 60 months down to ₹19,077 at 180.

### Negotiation Card
```
Product: Loan Against Property (recommended instead of what you first picked)
Verdict: Go ahead and borrow
Ask for: ₹15,00,000 over 180 months
Fair rate for your profile: 10.4% - 13.1% (all-in APR ≈ 13.3%)
EMI ceiling: ₹19,077/month — do not agree to more than ₹26,640/month
Why: You asked for ₹15,00,000, and both a lender's likely sanction and your own safe
capacity are comfortably above that — so your ask is the number that matters. We don't
headline more than 25% over what you came for; your underlying safe capacity is roughly
₹20,94,621, sized off what's actually left after your essential expenses and existing EMIs.
```

**The point:** Ravi's unencumbered shop is what unlocks a materially cheaper loan than the unsecured product he asked about — the routing falls out of the same income model that produces his eligibility numbers, not a special case.

---

## Anita, 35 — Hubballi, informal (gig + tailoring)

**Stand-ins:** monthly repayment across her three app loans ≈ ₹5,000 (brief gives total outstanding ₹35,000 and a rate, not an instalment); 3 dependents (two children + her unemployed husband).

### Questions asked

11 must-questions, then the informal-income additional set plus the universal bounce / savings / existing-loan-detail questions (the last triggered because her existing EMI > 0). No business-age or card-utilisation question.

| # | Question | Answer |
|---|---|---|
| must | Purpose | Vehicle purchase (EV scooter) |
| must | Amount | ₹1,50,000 |
| must | Loan type | Two-wheeler loan |
| must | Age | 35 |
| must | Occupation / income type | Gig / informal |
| must | Documented income | ₹0 |
| must | Actual monthly income | ₹28,000 (midpoint of ₹26k–30k) |
| must | Existing EMI | ₹5,000 (est., 3 app loans) |
| must | Household expenses | ₹20,000 |
| must | Dependents | 3 |
| must | Credit score | Don't know |
| add | Variable-income share | 50% |
| add | Existing loan detail | 3 app loans, ₹35,000, 30%+ |
| add | Informal family support | No — she supports others |
| add | Recent bounce | **Yes** — one last month |
| add | Emergency savings | 0 months |

### Outputs

- **O1 — Verdict: Don't borrow right now.** Hard-stop rule 1: a bounced payment in the last 6 months **and** zero savings cushion. This fires *before* any amount is sized.
- **O2 / O4:** deliberately **₹0** — there is no amount the app will point her toward while the verdict stands. O2 says so directly and adds: *"This isn't a permanent no; clearing existing debt or rebuilding a savings buffer changes it."*
- **O3 — Fair rate (reference only):** 13.9% – 16.1% (unknown tier, two-wheeler) — context for later, not a green light.

### Negotiation Card
```
Product: Two-Wheeler / EV Loan
Verdict: Don't borrow right now
Requested: ₹1,50,000 — not fundable safely right now
Fair rate band (for when you come back): 13.9% - 16.1% (all-in APR ≈ 16.1%)
Why: You've had a bounced payment in the last 6 months and no savings cushion behind you.
A new EMI on top of that raises real risk of another default.
```

**What Anita can act on tomorrow:** this is a sequencing answer, not a dead end. Clear or restructure the ₹35,000 of 30%+ app-loan debt and rebuild even a one-month buffer; then the ₹1,50,000 EV loan — which would roughly pay for itself in extra delivery runs — becomes a reasonable conversation. (Turning that into an explicit second-order output is the top item in the walkthrough's "what I'd build next".)

---

## Bonus — occupation types outside the original three

To confirm the pension / student / part-time / unemployed options and the dependency questions actually move numbers:

**A 20-year-old student, no income, wants ₹3,00,000 for education, a parent contributes ₹25,000/month toward her expenses.**

| Scenario | Verdict | Why |
|---|---|---|
| Only informal parent support | **Don't borrow** | Zero documented income, no formal co-applicant — a lender won't sanction an *unsecured* loan on undocumented support, even though her safe-carry capacity would otherwise cover it. |
| Same, but with gold collateral (₹4,00,000) | **Don't borrow** | The model doesn't size a secured product *upward* for collateral against zero documented income (RULES.md §12) — flagged, not silently wrong. |
| Same, but with a formal co-applicant earning ₹40,000/month | **Borrow — full ₹3,00,000** | A co-applicant's documented income counts on *both* sides, so the loan becomes properly fundable. |

This is why the app separates a **formal co-applicant** (a lender counts it) from **informal family support** (real to the borrower, not verifiable) — conflating them would make the app claim a loan is fundable that a lender would decline.
