import { createRequire } from "module";
const require = createRequire(import.meta.url);
const React = require("react");
const ReactDOMServer = require("react-dom/server");

global.React = React;
global.Rules = require("../src/rules.js");
global.QuestionBank = require("../src/questions.js");
global.Engine = require("../src/engine.js");
global.document = { getElementById: () => ({}) };
global.ReactDOM = { createRoot: () => ({ render: () => {} }) };
global.__EXPOSE_FOR_TEST__ = true;

await import("../src/app.jsx");
const { QuestionField, Wizard } = global.__components;
const { QUESTIONS } = global.QuestionBank;

let ok = 0, fail = 0;
for (const q of QUESTIONS) {
  try {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(QuestionField, { q, answers: { incomeType: "self_employed_informal", purpose: "business_growth" }, onAnswer: () => {} })
    );
    ok++;
  } catch (e) {
    fail++;
    console.log("FAILED on question:", q.id, e.message);
  }
}
console.log(`QuestionField render: ${ok} ok, ${fail} failed (of ${QUESTIONS.length})`);

// Wizard at empty state
const wizardHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(Wizard, { answers: {}, setAnswers: () => {}, onFinish: () => {} })
);
console.log("Wizard initial render length:", wizardHtml.length, "| shows first question:", wizardHtml.includes("borrow for"));
