# Borrower Copilot

A personal assistant that helps an Indian borrower answer four questions before they walk into a lender: *Should I borrow at all? How much am I really eligible for? What's a fair rate for me? What EMI should I agree to?* — then hands them a one-page Negotiation Card.

## Run it (under a minute)

No install, no build step, no backend, no login. Just open the file:

```
open index.html
```
(or double-click `index.html` in a file browser, or drag it into a browser tab)

`index.html` is fully self-contained — `rules.js`, `questions.js`, `engine.js`, and the UI are all inlined directly into it, so opening it with a plain `file://` double-click always works. (An earlier version loaded these as separate external files via `<script src="src/...">`, which some browsers block over `file://` for Babel-transformed scripts — hence the blank page some people hit. That's fixed now.)

**Requires an internet connection once**, to load React, Babel, and the fonts from public CDNs (no data is sent anywhere — these are read-only script/font loads, same as any normal webpage). Nothing you type into the app is stored, transmitted, or persisted.

The `src/*.js` files still exist separately, with **byte-identical content** to what's inlined in `index.html` — they're there so the rules engine reads as standalone, reviewable files (per the brief's "rules separated from the UI" requirement) and so `node test/run.js` can exercise the same logic outside a browser. `test/verify_index_html.mjs` checks automatically that nothing has drifted between the two.

## What's in this repo

```
index.html              — entry point, self-contained (rules/questions/engine/UI all inlined),
                           double-click to run, no server needed
src/rules.js             — the rules engine: rate bands, FOIR ceilings, expense cap,
                            need-relative cap, APR solver, product routing, verdict logic.
                            Pure functions, no UI.
src/questions.js          — the question bank (10–11 must + additional, branching + NA options)
src/engine.js             — orchestrates rules.js + questions.js into the four outputs
src/app.jsx               — the UI (wizard + results screen + negotiation card)
.build/head.html           — the HTML head + stylesheet; assemble.sh inlines src/* into it → index.html
test/run.js                — prints full engine output for Priya, Ravi, Anita
test/smoke*.mjs            — render smoke tests (see below)
test/verify_index_html.mjs — confirms index.html's inlined code matches src/*.js exactly
RULES.md                  — every rule, threshold, and assumption, with sources/judgement
docs/RUNTHROUGHS.md        — the three required run-throughs, generated from real engine output
docs/WALKTHROUGH.md        — five-minute walkthrough: what's built, what's next, what I'd cut
```

**Rules are deliberately separated from the UI.** `src/rules.js` and `src/questions.js` have zero DOM/React code in them — they run standalone in Node (see `test/`), which is also how the numbers in `docs/RUNTHROUGHS.md` were generated (not hand-typed).

## Testing without a browser

If you have Node installed:

```bash
node test/run.js                 # prints full JSON output for all three borrowers
node test/smoke_needcap.mjs      # asserts the need-relative cap invariant (RULES.md §1b)
npx tsx test/smoke.mjs           # renders the intro screen, catches reference/syntax errors
npx tsx test/smoke_questions.mjs # renders every question in the bank once
npx tsx test/smoke_results.mjs   # renders the results screen for all three borrowers
node test/verify_index_html.mjs  # confirms index.html's inlined code matches src/*.js exactly
```
(`tsx` will be fetched on first `npx` run if not already available; everything else needs no dependencies beyond Node itself.)

## Quick tour of the app

1. **Start**, or load one of the three sample borrowers from the intro screen (useful for demoing without re-typing answers).
2. Answer the **must-set** questions (10–11, adaptive to income type and purpose). Every question that can't always be answered has a **"not applicable / don't know"** button — nothing is silently treated as zero.
3. Keep going through **additional** questions to tighten your numbers, or click **"See my results now"** at any point — ranges widen and the confidence score drops if you stop early. A **← Back** button lets you fix any earlier answer.
4. The **results screen** shows O1–O4 plus a **Negotiation Card** at the bottom, meant to be read out or shown to a lender directly.

### The four outputs

| | | |
|---|---|---|
| **O1** | Borrow / Borrow less / Don't borrow | a verdict with a one-sentence reason; "Don't" is reachable and fires for Anita |
| **O2** | How much you're eligible for | two ceilings — what a lender will sanction, what you can safely carry — **both measured against what you asked for**, never shown running more than 25% past it (RULES.md §1b) |
| **O3** | A fair rate band | plus the all-in APR including the processing fee, so a lender's quote can be compared honestly |
| **O4** | The EMI to agree to | a monthly ceiling, the shortest sensible tenure, the full tenure trade-off, and a combined income-down / rate-up stress case |

See `docs/WALKTHROUGH.md` for what changed since the last iteration, what I'd build next, and what I'd cut. `RULES.md` is the one to read carefully — every number the app shows has a row there.
