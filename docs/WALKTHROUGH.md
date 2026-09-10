# Five-minute walkthrough

## The shape of the thing

Borrower Copilot is a rules engine wearing a wizard. The work is in `src/rules.js` (constants + pure functions) and `src/questions.js` (the question schema, zero UI). `src/engine.js` orchestrates the two into the four outputs; `src/app.jsx` just walks the question list and renders numbers. A lending judgement call should be something you can point at in a table, not something buried in an event handler — hence the split, and hence RULES.md sharing section numbers with the code.

## The two ideas the app is built around

**1. A lender's number and a borrower's number come from different inputs, on purpose.** For a salaried person they're the same. For someone self-employed or informal they diverge — sometimes with the *lender's* number tighter (Ravi: his ITR badly understates his real income, so a lender's FOIR maths is stingier than what he can actually afford — his collateral, not his income, is what unlocks the better deal). Routing Ravi to a secured product isn't bolted on; it falls out of the same income model that produces his eligibility numbers.

**2. The numbers shown are measured against what the borrower came for.** The earlier version computed raw FOIR capacity and printed it: a borrower asking for ₹20,000 could be shown a "safe" ₹5,00,000. That's not a helpful answer to "how much should I borrow" — it's an invitation to over-borrow. Now the headline is capped at 1.25× the request (RULES.md §1b). Full capacity is still computed — it drives the "borrow less" test and the "your real capacity is higher" explanation — but it's context, not the number in 48pt type. This is the single most important change from the last iteration.

## Walking through one borrower — Anita

Anita is the "Don't borrow" case, and she's the one that proves the verdict logic has teeth. Her hard-stop (recent bounce + zero savings) fires *before* any amount is sized — O2 and O4 don't compute a number, they zero out and say why, plus the one line that matters: *"This isn't a permanent no."* If the sizing logic ran first it would hand back some small "affordable" number, which is worse advice than "not right now, here's what to fix."

## What changed since the last iteration

- **Need-relative cap** on O2 / O4 (§1b) — the fix described above.
- **Household expenses wired into the maths** (§5) — previously collected and ignored. Now the safe EMI can't exceed 60% of what's genuinely left after essentials and existing EMIs. For Priya this is the *binding* constraint, tighter than FOIR.
- **Tenure is recommended, not fixed** — the shortest tenure on a product-appropriate ladder (personal 12–60, LAP 12–180) that still survives the stress test. Less interest paid, without eating the safety margin.
- **"Not applicable / don't know" on every question that can't always be answered** — credit score, co-applicant, collateral value, card, savings, etc. The ranges widen and the app says so; nothing is silently treated as zero.
- **"Not sure — recommend one for me"** as a loan-type option; routing then frames its pick as a suggestion, not a correction.
- **Back button** in the wizard, and "Answer more questions" now correctly re-surfaces skipped optional questions.
- **Visual system** — cream ground, white panels, a Fraunces serif for headings, IBM Plex Mono for every number, green accent, full dark-mode support. The results screen is now panel-per-output with a verdict banner and a proper Negotiation Card (key/value rows over a gradient). The tiny stylesheet lives at the top of `index.html`; `.build/` holds the head template and the one-line assembly script that inlines `src/*` into it.

## What I'd build next

1. **A second-order suggestion when the verdict is "don't borrow"** — Anita gets an honest "no", but the app stops short of "clear ₹X of app-loan debt, or wait N months for a buffer, then re-run". Same rules-engine shape, genuinely useful.
2. **A "what would change this" explainer** on the results screen — "if your score were 750+ instead of unknown, your rate band would drop to X–Y%". Mechanically easy given the pure-function engine.
3. **Per-product tenure-age ceilings** instead of one uniform 60 (RULES.md §11) — real LAP allows maturity past 60.
4. **Size secured products upward from collateral** against weak documented income (RULES.md §12) — today collateral can only shrink a FOIR figure, never substitute for income proof, which understates a real gold loan.
5. **De-duplicate co-applicant income vs informal support** — ask once and branch, rather than two separately-framed questions that can describe the same rupees.
6. **Purpose-scaled headroom** — a wedding budget flexes more than a two-wheeler price; the 25% cap could vary.

## What I'd cut with 8 hours instead of 12–16

- The tenure trade-off table — the EMI ceiling + stress test alone answer the brief's core question.
- Card-utilisation and job-tenure as separate signals — low-leverage; fold their effect into the unknown-score handling.
- The tenure trade-off table's second column (max loan at safe EMI) — the EMI-at-your-amount column is the one a borrower reads.

## What surprised me

The APR solver (bisection, not a flat fee-annualisation) mattered more than expected — a flat approximation quietly over- or under-states APR depending on tenure, which is exactly the "trust me" number a borrower can't independently check. And wiring in household expenses changed Priya's answer: her FOIR ceiling said ₹30,000/month was fine, but 60% of her actual leftover after rent and her car EMI is ₹28,800 — the more honest ceiling, and the kind of thing a lender's model has no reason to tell her.
