const Engine = require("../src/engine.js");

const priya = {
  purpose: "wedding",
  requestedAmount: 800000,
  loanTypeRequested: "personal_loan",
  incomeType: "salaried",
  documentedMonthlyIncome: 110000,
  existingMonthlyEmi: 14000,
  householdExpenses: 28000 + 20000,
  age: 29,
  creditScore: 780,
  jobTenureYears: 5,
  existingOffers: "14%",
  collateralType: "none",
  coApplicantIncome: 0,
  recentBounce: false,
  emergencySavingsMonths: 3,
  cardUtilizationPct: 20,
  upcomingExpense: "",
};

const ravi = {
  purpose: "business_growth",
  requestedAmount: 1500000,
  loanTypeRequested: "business_loan",
  incomeType: "self_employed_formal",
  documentedMonthlyIncome: 35000, // ITR ~4.2L/yr
  selfReportedMonthlyIncome: 60000, // midpoint of 40k-80k cash
  existingMonthlyEmi: 0,
  householdExpenses: 30000,
  age: 42,
  creditScore: "", // no credit score
  businessAgeYears: 14,
  variableIncomeSharePct: 40,
  collateralType: "property",
  collateralValue: 4500000,
  coApplicantIncome: 18000,
  recentBounce: false,
  emergencySavingsMonths: 2,
  expectedIncomeUpliftPct: 15,
  existingOffers: "",
};

const anita = {
  purpose: "vehicle_purchase",
  requestedAmount: 150000,
  loanTypeRequested: "two_wheeler_loan",
  incomeType: "gig_informal",
  documentedMonthlyIncome: 0,
  selfReportedMonthlyIncome: 28000,
  existingMonthlyEmi: 5000, // approx monthly service on the 3 app loans
  householdExpenses: 20000,
  age: 35,
  creditScore: "",
  businessAgeYears: 0,
  variableIncomeSharePct: 50,
  collateralType: "none",
  coApplicantIncome: 0,
  existingLoansDetail: "3 app loans, Rs 35,000 outstanding, 30%+ rate",
  recentBounce: true,
  emergencySavingsMonths: 0,
  existingOffers: "",
};

for (const [name, answers] of [["Priya", priya], ["Ravi", ravi], ["Anita", anita]]) {
  console.log("=".repeat(20), name, "=".repeat(20));
  const out = Engine.evaluate(answers);
  console.log(JSON.stringify(out, null, 2));
}
