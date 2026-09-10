const { useState, useMemo, useEffect } = React;

const SAMPLE_BORROWERS = {
  priya: {
    name: "Priya, 29 — salaried",
    desc: "Bengaluru IT employee, ₹1.1L/mo, one car loan, score 780. Wants ₹8L for a wedding.",
    answers: {
      purpose: "wedding", requestedAmount: 800000, loanTypeRequested: "personal_loan",
      age: 29, incomeType: "salaried", documentedMonthlyIncome: 110000, existingMonthlyEmi: 14000,
      householdExpenses: 48000, dependentsCount: 0, creditScore: 780, jobTenureYears: 5,
      existingOffers: "14%", collateralType: "none", coApplicantIncome: 0, financiallyDependent: false,
      recentBounce: false, emergencySavingsMonths: 3, cardUtilizationPct: 20, upcomingExpense: "",
    },
  },
  ravi: {
    name: "Ravi, 42 — kirana owner",
    desc: "Mysuru shopkeeper, cash income, ITR shows ₹35k/mo, owns the shop, no credit score. Wants ₹15L to expand.",
    answers: {
      purpose: "business_growth", requestedAmount: 1500000, loanTypeRequested: "business_loan",
      age: 42, incomeType: "self_employed_formal", documentedMonthlyIncome: 35000, selfReportedMonthlyIncome: 60000,
      existingMonthlyEmi: 0, householdExpenses: 30000, dependentsCount: 0, creditScore: "",
      businessAgeYears: 14, variableIncomeSharePct: 40, collateralType: "property", collateralValue: 4500000,
      coApplicantIncome: 18000, financiallyDependent: false, recentBounce: false, emergencySavingsMonths: 2,
      expectedIncomeUpliftPct: 15, existingOffers: "",
    },
  },
  anita: {
    name: "Anita, 35 — gig + tailoring",
    desc: "Hubballi delivery rider, ₹28k/mo, husband out of work, three app loans, one bounce last month. Wants ₹1.5L for an EV.",
    answers: {
      purpose: "vehicle_purchase", requestedAmount: 150000, loanTypeRequested: "two_wheeler_loan",
      age: 35, incomeType: "gig_informal", documentedMonthlyIncome: 0, selfReportedMonthlyIncome: 28000,
      existingMonthlyEmi: 5000, householdExpenses: 20000, dependentsCount: 3, creditScore: "",
      variableIncomeSharePct: 50, collateralType: "none", coApplicantIncome: 0, financiallyDependent: false,
      existingLoansDetail: "3 app loans, Rs 35,000 outstanding, 30%+ rate", recentBounce: true,
      emergencySavingsMonths: 0, existingOffers: "",
    },
  },
};

// Questions where a leading ₹ affix reads naturally.
const RUPEE_QUESTIONS = new Set([
  "requestedAmount", "documentedMonthlyIncome", "selfReportedMonthlyIncome", "existingMonthlyEmi",
  "householdExpenses", "collateralValue", "coApplicantIncome", "monthlySupportAmount",
]);

function inr(n) {
  if (n === undefined || n === null || isNaN(n)) return "₹0";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function QuestionField({ q, answers, onAnswer }) {
  const text = typeof q.text === "function" ? q.text(answers) : q.text;
  const [val, setVal] = useState(answers[q.id] !== undefined && answers[q.id] !== null ? answers[q.id] : "");

  const submit = (v) => onAnswer(q.id, v);
  const naButton = q.allowNA ? (
    <button type="button" className="btn btn-ghost" onClick={() => submit(q.naValue)}>
      {q.naLabel || "Not applicable / don't know"}
    </button>
  ) : null;

  return (
    <div>
      <div className={`phase-pill${q.tier === "additional" ? " optional" : ""}`}>
        {q.tier === "must" ? "Essential" : "Optional — narrows your numbers"}
      </div>
      <h2 className="q-prompt">{text}</h2>
      {q.help && <p className="q-help">{q.help}</p>}
      {q.tier === "additional" && !q.help && <p className="q-why">Why we ask: {q.narrows}</p>}

      {q.type === "select" && (
        <div className="opts">
          {q.options.map((o) => (
            <button key={o.value} className={`opt${answers[q.id] === o.value ? " selected" : ""}`} onClick={() => submit(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      )}

      {q.type === "boolean" && (
        <div className="opts two-col">
          <button className={`opt${answers[q.id] === true ? " selected" : ""}`} onClick={() => submit(true)}>Yes</button>
          <button className={`opt${answers[q.id] === false ? " selected" : ""}`} onClick={() => submit(false)}>No</button>
        </div>
      )}

      {(q.type === "number" || q.type === "text") && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (q.type === "number" && val === "") return;
            submit(q.type === "number" ? Number(val) : val);
          }}
        >
          <div className="field">
            {q.type === "number" && RUPEE_QUESTIONS.has(q.id) && <span className="affix">₹</span>}
            <input
              autoFocus
              type={q.type === "number" ? "number" : "text"}
              inputMode={q.type === "number" ? "numeric" : undefined}
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder={q.type === "number" ? "Enter an amount" : "Type your answer"}
            />
          </div>
          <div className="btn-row">
            <button type="submit" className="btn btn-primary">Next</button>
            {naButton}
          </div>
        </form>
      )}
    </div>
  );
}

function Wizard({ answers, setAnswers, onFinish }) {
  const applicable = useMemo(() => Engine.applicableQuestions(answers), [answers]);
  const [skipped, setSkipped] = useState(() => new Set());
  const [milestoneShown, setMilestoneShown] = useState(false);

  const current = applicable.find((q) => answers[q.id] === undefined && !skipped.has(q.id));
  const answeredList = applicable.filter((q) => answers[q.id] !== undefined);
  const answeredCount = answeredList.length;
  const mustTotal = applicable.filter((q) => q.tier === "must").length;
  const mustAnswered = applicable.filter((q) => q.tier === "must" && answers[q.id] !== undefined).length;
  const mustDone = mustAnswered >= mustTotal;
  const optionalLeft = applicable.filter(
    (q) => q.tier === "additional" && answers[q.id] === undefined && !skipped.has(q.id)
  ).length;

  useEffect(() => {
    if (!current) onFinish();
  }, [current]);

  if (!current) return null;

  function handleAnswer(id, value) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function goBack() {
    if (!answeredList.length) return;
    const last = answeredList[answeredList.length - 1];
    setAnswers((prev) => {
      const n = { ...prev };
      delete n[last.id];
      return n;
    });
    setSkipped((s) => {
      const n = new Set(s);
      n.delete(last.id);
      return n;
    });
  }

  // Milestone: shown once, the moment the essentials are done and the first
  // optional question is up. A borrower can stop here with wide ranges.
  if (mustDone && !milestoneShown && current.tier === "additional") {
    return (
      <div className="panel milestone">
        <p className="big">The essentials are in.</p>
        <p>
          You can see your four numbers now — with wide ranges and lower confidence —
          or answer {optionalLeft} more optional question{optionalLeft === 1 ? "" : "s"}, each of which tightens something.
        </p>
        <div className="btn-row" style={{ justifyContent: "center" }}>
          <button className="btn btn-primary" onClick={() => setMilestoneShown(true)}>Keep going</button>
          <button className="btn btn-ghost" onClick={onFinish}>See my results now</button>
        </div>
      </div>
    );
  }

  const pct = Math.round((answeredCount / applicable.length) * 100);

  return (
    <div className="panel">
      <div className="progress">
        <span>{mustDone ? "Tightening" : "Essentials"} · {answeredCount}/{applicable.length}</span>
        <div className="bar"><div className="fill" style={{ width: `${pct}%` }} /></div>
      </div>

      <QuestionField key={current.id} q={current} answers={answers} onAnswer={handleAnswer} />

      <div className="wizard-actions">
        <div className="left">
          {answeredCount > 0 && <button className="link" onClick={goBack}>← Back</button>}
          {current.tier === "additional" && (
            <button className="link" onClick={() => setSkipped((s) => new Set(s).add(current.id))}>Skip this one</button>
          )}
        </div>
        {mustDone && (
          <button className="link strong" onClick={onFinish}>
            See my results{optionalLeft ? ` (skip ${optionalLeft})` : ""} →
          </button>
        )}
      </div>
    </div>
  );
}

function confidenceTier(c) {
  return c >= 80 ? "high" : c >= 60 ? "medium" : "low";
}

function Results({ answers, onAnswerMore, onRestart }) {
  const out = useMemo(() => Engine.evaluate(answers), [answers]);
  const { O1, O2, O3, O4, card, confidence, product } = out;
  const verdictLabel = { borrow: "Go ahead and borrow", borrow_less: "Borrow less than you asked for", dont: "Don't borrow right now" }[O1.verdict];
  const cTier = confidenceTier(confidence);
  const cLabel = cTier === "high" ? "High confidence" : cTier === "medium" ? "Medium confidence" : "Low confidence — ranges widened";
  const showRoutingNote = (product.requestedDiffers || product.borrowerUnsure) && product.routingNote;

  return (
    <div>
      <div className={`verdict-banner ${O1.verdict}`}>
        <div className="label">{verdictLabel}</div>
        <p>{O1.reasons[0]}</p>
      </div>

      <div className="confidence-row">
        <span className={`confidence-chip ${cTier}`}>{cLabel}</span>
        <span>{confidence}/100 — {cTier === "high" ? "you answered nearly everything that applies" : "answer more questions to tighten these"}</span>
      </div>

      {showRoutingNote && (
        <div className="panel" style={{ marginBottom: "1rem", background: "var(--accent-soft)", borderColor: "var(--accent)" }}>
          <div className="out-label">{product.borrowerUnsure ? "Product pick" : "Product note"}</div>
          <p style={{ margin: 0, fontSize: ".9rem" }}>{product.routingNote}</p>
        </div>
      )}

      {O1.reasons.length > 1 && (
        <div className="panel">
          <div className="out-label"><span className="o">O1</span>Should you borrow?</div>
          {O1.reasons.map((r, i) => (
            <p key={i} style={{ margin: i ? ".5rem 0 0" : 0, fontSize: ".92rem", color: "var(--muted)" }}>{r}</p>
          ))}
        </div>
      )}

      <div className="panel">
        <div className="out-label"><span className="o">O2</span>How much are you really eligible for?</div>
        <p className="req-line">Your request: <b>{inr(O2.requestedAmount)}</b></p>

        {O2.rawSafeCarryAmount <= 0 ? (
          <div className="num-card dim">
            <div className="num-tag">Amount to ask for right now</div>
            <div className="num-val">₹0 — see the verdict</div>
          </div>
        ) : O2.withinBothCeilings ? (
          <>
            <div className="num-card use">
              <div className="num-tag">Your {inr(O2.requestedAmount)} request clears both ceilings</div>
              <div className="num-val">Ask for {inr(O2.requestedAmount)}</div>
              <span className="use-flag">Use this</span>
            </div>
            <p className="use-line">
              Both a lender's likely sanction and your own safe-carry capacity are above what you
              came for — so <strong>the amount you asked for is the number to use</strong>. No case here for asking a lender for more.
            </p>
          </>
        ) : (
          <>
            <div className="two-num">
              <div className={`num-card${O2.useThisOne === "lenderSanction" ? " use" : " dim"}`}>
                <div className="num-tag">A lender will likely sanction</div>
                <div className="num-val">{inr(O2.lenderSanction)}{O2.cappedToNeed ? "+" : ""}</div>
                {O2.useThisOne === "lenderSanction" && <span className="use-flag">Use this one</span>}
              </div>
              <div className={`num-card${O2.useThisOne === "safeCarryAmount" ? " use" : " dim"}`}>
                <div className="num-tag">You can safely carry</div>
                <div className="num-val">{inr(O2.safeCarryAmount)}{O2.cappedToNeed ? "+" : ""}</div>
                {O2.useThisOne === "safeCarryAmount" && <span className="use-flag">Use this one</span>}
              </div>
            </div>
            <p className="use-line">
              Use the <strong>{O2.useThisOne === "safeCarryAmount" ? "lower, safe-carry" : "lender"}</strong> number — {inr(Math.min(O2.safeCarryAmount, O2.lenderSanction))}.
            </p>
          </>
        )}

        {O2.cappedToNeed && O2.rawSafeCarryAmount > 0 && (
          <p className="cap-note">
            Underlying capacity is higher — about {inr(O2.rawSafeCarryAmount)} safe-carry, and a lender
            could stretch to roughly {inr(O2.rawLenderSanction)}. We cap what we show at 25% over your stated
            need, because borrowing well past what you came for is its own risk.
          </p>
        )}
        <p className="why-line">{O2.why}</p>
      </div>

      <div className="panel">
        <div className="out-label"><span className="o">O3</span>What's a fair rate for you?</div>
        <div className="band-line">{O3.rateBandPct[0]}% – {O3.rateBandPct[1]}%</div>
        <p className="band-sub">all-in APR ≈ {O3.aprPct}% (includes the {inr(O3.feeAmount)} processing fee)</p>
        <p className="why-line">{O3.why}</p>
      </div>

      <div className="panel">
        <div className="out-label"><span className="o">O4</span>What EMI should you agree to?</div>
        <div className="two-num">
          <div className="num-card use">
            <div className="num-tag">Recommended EMI · {O4.recommendedTenureMonths} months</div>
            <div className="num-val">{inr(O4.recommendedEmi)}/mo</div>
          </div>
          <div className="num-card">
            <div className="num-tag">Hard ceiling — do not exceed</div>
            <div className="num-val">{inr(O4.maxSafeEmi)}/mo</div>
          </div>
        </div>
        <p className="why-line">{O4.why}</p>

        {O4.recommendedAmount > 0 && (
          <>
            <table className="trade">
              <thead>
                <tr><th>Tenure</th><th className="num">EMI at your amount</th><th className="num">Max loan at safe EMI</th></tr>
              </thead>
              <tbody>
                {O4.tenureTradeoff.map((t) => (
                  <tr key={t.months} className={t.months === O4.recommendedTenureMonths ? "rec" : ""}>
                    <td>{t.months} mo{t.months === O4.recommendedTenureMonths ? " · recommended" : ""}</td>
                    <td className="num">{inr(t.emiForRecommendedAmount)}</td>
                    <td className="num">{inr(t.maxAmountAtSafeEmi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={`stress-box ${O4.stress.survives ? "ok" : ""}`}>
              <strong>Stress test — {O4.stress.scenario}:</strong>{" "}
              {O4.stress.survives
                ? `still within a safe EMI (₹${O4.stress.stressMaxEmi.toLocaleString("en-IN")}/mo ceiling vs ₹${O4.stress.stressEmiAtRecommended.toLocaleString("en-IN")}/mo owed).`
                : `your EMI (₹${O4.stress.stressEmiAtRecommended.toLocaleString("en-IN")}/mo) would exceed a safe ceiling of ₹${O4.stress.stressMaxEmi.toLocaleString("en-IN")}/mo. Take a smaller amount or longer tenure.`}
            </div>
          </>
        )}
        {O4.recommendedAmount === 0 && (
          <p className="why-line">No amount is sized while the verdict stands. The rate band above is shown for reference only.</p>
        )}
      </div>

      <div className="card">
        <div className="card-eyebrow">Negotiation Card</div>
        <h2>Hold this up to the lender</h2>
        <div className="card-grid">
          {card.fields.map((f, i) => (
            <div className="card-row" key={i}>
              <span className="k">{f.k}</span>
              <span className="v">{f.v}</span>
            </div>
          ))}
        </div>
        <div className="card-line"><strong>Why:</strong> {card.whyLine}</div>
        <div className="card-foot">Confidence {card.confidence}/100 · generated in your browser · nothing stored or sent</div>
      </div>

      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onAnswerMore}>Answer more questions</button>
        <button className="btn btn-ghost" onClick={onRestart}>Start over</button>
      </div>
    </div>
  );
}

function App() {
  const [answers, setAnswers] = useState(null);
  const [screen, setScreen] = useState("intro"); // intro | wizard | results
  const [wizardRun, setWizardRun] = useState(0);

  function start(initial, toResults) {
    setAnswers(initial || {});
    setWizardRun((n) => n + 1);
    setScreen(toResults ? "results" : "wizard");
  }
  function restart() {
    setAnswers(null);
    setScreen("intro");
  }

  return (
    <div className="shell">
      <div className="topbar">
        <div>
          <div className="wordmark">Borrower <em>Copilot</em></div>
          <div className="tag">Know your number before the lender tells you theirs</div>
        </div>
        {screen !== "intro" && <button className="reset-link" onClick={restart}>Start over</button>}
      </div>

      <main aria-live="polite">
        {screen === "intro" && (
          <>
            <div className="panel">
              <h1 className="hero">Before you walk into a lender, walk through this.</h1>
              <p className="lede">
                Answer questions about your income and what you want to borrow. You get a verdict, the two
                eligibility numbers that actually matter, a fair rate band, an EMI ceiling, and a one-page
                card to negotiate with. Anything you can't answer has a "don't know" option — the ranges
                just widen and the app says so.
              </p>
              <div className="privacy">🔒&nbsp; No login, no bureau pull. Nothing you type leaves this browser tab.</div>
              <button className="btn btn-primary btn-block" onClick={() => start({})}>Start</button>
            </div>

            <div className="panel">
              <div className="out-label">Or try a sample borrower</div>
              <div className="samples">
                {Object.entries(SAMPLE_BORROWERS).map(([key, b]) => (
                  <button key={key} className="sample-card" onClick={() => start(b.answers, true)}>
                    <span className="name">{b.name}</span>
                    <span className="desc">{b.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {screen === "wizard" && answers && (
          <Wizard key={wizardRun} answers={answers} setAnswers={setAnswers} onFinish={() => setScreen("results")} />
        )}

        {screen === "results" && answers && (
          <Results
            answers={answers}
            onAnswerMore={() => {
              setWizardRun((n) => n + 1);
              setScreen("wizard");
            }}
            onRestart={restart}
          />
        )}
      </main>
    </div>
  );
}

if (typeof global !== "undefined" && global.__EXPOSE_FOR_TEST__) {
  global.__components = { Wizard, Results, QuestionField, App, SAMPLE_BORROWERS };
} else {
  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
}
