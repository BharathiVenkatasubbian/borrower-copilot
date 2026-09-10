import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Engine = require("../src/engine.js");

// Invariant: the numbers the app PUTS IN FRONT of the borrower never run more
// than 25% past what they asked for, and the recommended amount is never more
// than the ask. (RULES.md §1b)

const cases = [
  { name: "tiny ask, high income", a: { purpose: "medical", requestedAmount: 20000, loanTypeRequested: "personal_loan", age: 35, incomeType: "salaried", documentedMonthlyIncome: 200000, existingMonthlyEmi: 0, householdExpenses: 40000, dependentsCount: 0, creditScore: 800 } },
  { name: "Priya", a: { purpose: "wedding", requestedAmount: 800000, loanTypeRequested: "personal_loan", age: 29, incomeType: "salaried", documentedMonthlyIncome: 110000, existingMonthlyEmi: 14000, householdExpenses: 48000, dependentsCount: 0, creditScore: 780 } },
  { name: "Ravi", a: { purpose: "business_growth", requestedAmount: 1500000, loanTypeRequested: "business_loan", age: 42, incomeType: "self_employed_formal", documentedMonthlyIncome: 35000, selfReportedMonthlyIncome: 60000, existingMonthlyEmi: 0, householdExpenses: 30000, dependentsCount: 0, creditScore: "", collateralType: "property", collateralValue: 4500000, coApplicantIncome: 18000 } },
  { name: "modest ask, modest income (borrow less expected)", a: { purpose: "medical", requestedAmount: 900000, loanTypeRequested: "personal_loan", age: 50, incomeType: "salaried", documentedMonthlyIncome: 45000, existingMonthlyEmi: 8000, householdExpenses: 25000, dependentsCount: 2, creditScore: 690 } },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const o = Engine.evaluate(c.a);
  const cap = c.a.requestedAmount * 1.25;
  const checks = [
    ["O2 lender ≤ 1.25× ask", o.O2.lenderSanction <= cap + 1],
    ["O2 safe-carry ≤ 1.25× ask", o.O2.safeCarryAmount <= cap + 1],
    ["O4 recommended ≤ ask", o.O4.recommendedAmount <= c.a.requestedAmount],
  ];
  for (const [label, ok] of checks) {
    if (ok) pass++;
    else { fail++; console.log(`FAIL [${c.name}] ${label} — got O2 ${o.O2.lenderSanction}/${o.O2.safeCarryAmount}, O4 ${o.O4.recommendedAmount}`); }
  }
}
console.log(`need-cap invariant: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
