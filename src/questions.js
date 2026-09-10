/**
 * questions.js — the question bank.
 *
 * Each question has:
 *   id            — key stored in the answers object
 *   tier          — "must" or "additional"
 *   appliesIf(a)  — predicate on answers-so-far; if false, the question is skipped
 *   narrows       — human-readable note on which output(s) this tightens (for RULES.md /
 *                   for the UI's "why am I being asked this" affordance)
 *   type          — "select" | "number" | "boolean" | "text"
 *   options       — for "select"
 *   allowNA       — if true, the UI shows a "not applicable / don't know" button
 *   naValue       — the value stored when the borrower presses that button
 *   naLabel       — the label on that button
 *   help          — optional one-line helper text shown under the question
 *
 * IMPORTANT: this file has zero UI code in it. The wizard component just
 * walks this array in order, skipping questions whose appliesIf() is false.
 */
(function (global) {
  "use strict";

  const QUESTIONS = [
    // ---------------------------------------------------------------- MUST
    {
      id: "purpose",
      tier: "must",
      type: "select",
      text: "What do you want to borrow for?",
      options: [
        { value: "wedding", label: "Wedding or family celebration" },
        { value: "medical", label: "Medical expense" },
        { value: "education", label: "Education" },
        { value: "home_renovation", label: "Home renovation" },
        { value: "debt_consolidation", label: "Paying off other debt" },
        { value: "vehicle_purchase", label: "Buying a two-wheeler / EV" },
        { value: "business_growth", label: "Business — stock, equipment or a vehicle for the business" },
        { value: "other", label: "Something else" },
      ],
      appliesIf: () => true,
      narrows: "Drives product routing (O2/O3) and the productive-vs-discretionary check (O1).",
    },
    {
      id: "requestedAmount",
      tier: "must",
      type: "number",
      text: "How much do you want to borrow (₹)?",
      help: "Your best estimate of the actual need. Every output below is measured against this.",
      appliesIf: () => true,
      narrows: "The number O1–O4 are all measured against. The amounts shown never run more than 25% past this.",
    },
    {
      id: "loanTypeRequested",
      tier: "must",
      type: "select",
      text: "Which loan type are you looking at — or has a lender already offered you one?",
      options: [
        { value: "unsure", label: "Not sure — recommend the right one for me" },
        { value: "personal_loan", label: "Personal loan (unsecured)" },
        { value: "gold_loan", label: "Gold loan" },
        { value: "lap", label: "Loan against property" },
        { value: "business_loan", label: "Business loan" },
        { value: "two_wheeler_loan", label: "Two-wheeler / EV loan" },
      ],
      appliesIf: () => true,
      narrows: "O2/O3 — compared against what we'd actually recommend; a mismatch changes the rate band shown.",
    },
    {
      id: "age",
      tier: "must",
      type: "number",
      text: "Your age?",
      appliesIf: () => true,
      narrows: "Caps usable tenure in O4 (most lenders stop tenure at 60–65 years of age at maturity).",
    },
    {
      id: "incomeType",
      tier: "must",
      type: "select",
      text: "What best describes your occupation / main income?",
      options: [
        { value: "salaried", label: "Salaried" },
        { value: "self_employed_formal", label: "Self-employed, with ITR / bank statements" },
        { value: "self_employed_informal", label: "Self-employed, mostly cash" },
        { value: "gig_informal", label: "Gig / platform work, informal" },
        { value: "part_time", label: "Part-time work" },
        { value: "pension", label: "Retired, living on pension" },
        { value: "student", label: "Student, no independent income" },
        { value: "unemployed", label: "Not currently working" },
      ],
      appliesIf: () => true,
      narrows: "Sets which additional questions appear next, and the income haircut used for safe-carry (O2/O4).",
    },
    {
      id: "documentedMonthlyIncome",
      tier: "must",
      type: "number",
      text: (a) => {
        if (a.incomeType === "salaried") return "What's your net monthly take-home pay (₹)?";
        if (a.incomeType === "pension") return "What's your monthly pension amount (₹)?";
        if (a.incomeType === "student" || a.incomeType === "unemployed")
          return "Do you have any income of your own right now — stipend, part-time work, freelance (₹/month)?";
        return "What does your ITR / bank statement show as average monthly income (₹)?";
      },
      allowNA: true,
      naValue: 0,
      naLabel: "No documented income",
      appliesIf: () => true,
      narrows: "This is the income a lender can verify — it drives the lender-view sanction number in O2.",
    },
    {
      id: "selfReportedMonthlyIncome",
      tier: "must",
      type: "number",
      text: "What actually comes in each month on average, including cash (₹)?",
      allowNA: true,
      naValue: null,
      naLabel: "Same as my documented figure",
      appliesIf: (a) => a.incomeType !== "salaried" && a.incomeType !== "pension",
      narrows: "Drives the safe-carry (borrower-view) number in O2 — this is often higher than the documented figure.",
    },
    {
      id: "existingMonthlyEmi",
      tier: "must",
      type: "number",
      text: "What do you pay every month across all existing loans/EMIs right now (₹)?",
      allowNA: true,
      naValue: 0,
      naLabel: "No existing loans / EMIs",
      appliesIf: () => true,
      narrows: "Existing FOIR — directly gates O1's hard-stop check and reduces headroom in O2/O4.",
    },
    {
      id: "householdExpenses",
      tier: "must",
      type: "number",
      text: "What are your essential monthly household expenses — rent, food, utilities, school fees (₹)?",
      appliesIf: () => true,
      narrows: "Caps the safe EMI in O4 at 60% of what's actually left after essentials, and shown on the card.",
    },
    {
      id: "dependentsCount",
      tier: "must",
      type: "number",
      text: "How many people — besides yourself — depend on your income (children, parents, spouse)?",
      allowNA: true,
      naValue: 0,
      naLabel: "Nobody depends on my income",
      appliesIf: () => true,
      narrows: "Each dependent tightens the safe-carry FOIR ceiling in O2/O4 (more of your income is already committed).",
    },
    {
      id: "creditScore",
      tier: "must",
      type: "number",
      text: "Do you know your credit score (CIBIL etc.)?",
      help: "Enter it if you know it. If you don't, that's fine — it's treated as a middle tier, never a low one.",
      allowNA: true,
      naValue: "",
      naLabel: "I don't know my score",
      appliesIf: () => true,
      narrows: "Sets the rate-tier band in O3. Unknown is treated as its own middle tier, never as a low score.",
    },

    // ---------------------------------------------------------- ADDITIONAL
    {
      id: "jobTenureYears",
      tier: "additional",
      type: "number",
      text: "How many years have you been in your current job?",
      allowNA: true,
      naValue: 0,
      naLabel: "Prefer not to say",
      appliesIf: (a) => a.incomeType === "salaried",
      narrows: "3+ years tightens the lender-view FOIR ceiling upward slightly in O2 (income stability).",
    },
    {
      id: "existingOffers",
      tier: "additional",
      type: "text",
      text: "Have any lenders already quoted you a rate? If so, what rate?",
      allowNA: true,
      naValue: "",
      naLabel: "No offers yet",
      appliesIf: () => true,
      narrows: "Feeds the Negotiation Card's direct comparison line.",
    },
    {
      id: "businessAgeYears",
      tier: "additional",
      type: "number",
      text: "How many years has the business been operating?",
      allowNA: true,
      naValue: 0,
      naLabel: "Not sure",
      appliesIf: (a) => a.incomeType === "self_employed_formal" || a.incomeType === "self_employed_informal",
      narrows: "5+ years operating tightens the safe-carry FOIR ceiling upward slightly in O2/O4.",
    },
    {
      id: "variableIncomeSharePct",
      tier: "additional",
      type: "number",
      text: "Roughly what % of your income swings month to month rather than being steady?",
      allowNA: true,
      naValue: 0,
      naLabel: "It's fairly steady",
      appliesIf: (a) => a.incomeType !== "salaried" && a.incomeType !== "pension",
      narrows: "Directly reduces safe-carry income and tightens the FOIR ceiling in O2/O4.",
    },
    {
      id: "collateralType",
      tier: "additional",
      type: "select",
      text: "Do you own property or gold you could offer as collateral?",
      options: [
        { value: "none", label: "No — nothing to pledge" },
        { value: "property", label: "Property (land, shop, house) — unencumbered" },
        { value: "gold", label: "Gold" },
      ],
      appliesIf: () => true,
      narrows: "Can change the product routing entirely in O2/O3 (e.g. business loan → LAP, or personal → gold loan).",
    },
    {
      id: "collateralValue",
      tier: "additional",
      type: "number",
      text: "Roughly what is that collateral worth (₹)?",
      allowNA: true,
      naValue: 0,
      naLabel: "Not sure of the value",
      appliesIf: (a) => a.collateralType === "property" || a.collateralType === "gold",
      narrows: "Sets the LTV cap on the lender-view sanction number in O2 for secured products.",
    },
    {
      id: "coApplicantIncome",
      tier: "additional",
      type: "number",
      text: "Will anyone else's income formally count toward this loan (spouse, co-applicant)? Enter their monthly income.",
      allowNA: true,
      naValue: 0,
      naLabel: "No co-applicant",
      appliesIf: () => true,
      narrows: "Adds to both the lender-view and safe-carry income base used for O2/O4.",
    },
    {
      id: "financiallyDependent",
      tier: "additional",
      type: "boolean",
      text: "Aside from a formal co-applicant, does a parent or spouse regularly cover a meaningful part of your day-to-day expenses?",
      appliesIf: () => true,
      narrows: "If yes, their support is added to your safe-carry income base in O2/O4 — separate from a formal co-applicant.",
    },
    {
      id: "monthlySupportAmount",
      tier: "additional",
      type: "number",
      text: "Roughly how much do they contribute toward your expenses each month (₹)?",
      allowNA: true,
      naValue: 0,
      naLabel: "Don't know",
      appliesIf: (a) => a.financiallyDependent === true,
      narrows: "Directly added to the safe-carry income base used for O2/O4 — this is what makes a student or non-earning borrower's numbers realistic.",
    },
    {
      id: "existingLoansDetail",
      tier: "additional",
      type: "text",
      text: "Briefly, what are your existing loans (type, outstanding, rate)?",
      allowNA: true,
      naValue: "",
      naLabel: "Skip",
      appliesIf: (a) => Number(a.existingMonthlyEmi) > 0,
      narrows: "Shown in the Negotiation Card as context; flags very high-cost existing debt (e.g. 30%+ app loans).",
    },
    {
      id: "recentBounce",
      tier: "additional",
      type: "boolean",
      text: "Has any EMI or bill payment bounced in the last 6 months?",
      appliesIf: () => true,
      narrows: "A hard-stop trigger for O1's \"Don't borrow\" verdict when paired with low savings.",
    },
    {
      id: "emergencySavingsMonths",
      tier: "additional",
      type: "number",
      text: "If your income stopped today, how many months of expenses could you cover from savings?",
      allowNA: true,
      naValue: 0,
      naLabel: "Almost nothing saved",
      appliesIf: () => true,
      narrows: "Tightens or relaxes the safe-carry FOIR ceiling in O2/O4, and feeds the O1 hard-stop check.",
    },
    {
      id: "cardUtilizationPct",
      tier: "additional",
      type: "number",
      text: "On average, what % of your credit card limit do you carry as a balance?",
      allowNA: true,
      naValue: 0,
      naLabel: "I don't use a credit card",
      appliesIf: (a) => a.incomeType === "salaried" || a.incomeType === "pension",
      narrows: "Above ~60% nudges the rate band up half a point in O3 (a widely-used underwriting signal).",
    },
    {
      id: "upcomingExpense",
      tier: "additional",
      type: "text",
      text: "Any large expense coming up in the next 12 months (school fee, medical, festival)?",
      allowNA: true,
      naValue: "",
      naLabel: "Nothing major coming up",
      appliesIf: () => true,
      narrows: "Shown as a caution note in O4's stress case; doesn't change the number but changes the warning.",
    },
    {
      id: "expectedIncomeUpliftPct",
      tier: "additional",
      type: "number",
      text: "If this loan is for your business, roughly how much could it grow your monthly income (%)?",
      allowNA: true,
      naValue: 0,
      naLabel: "Can't estimate",
      appliesIf: (a) => a.purpose === "business_growth",
      narrows: "A productive loan gets a slightly more generous safe-carry ceiling in O2, documented and capped at +5pp.",
    },
  ];

  const api = { QUESTIONS };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.QuestionBank = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
