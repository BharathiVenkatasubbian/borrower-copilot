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
const { Results, SAMPLE_BORROWERS } = global.__components;

for (const [name, b] of Object.entries(SAMPLE_BORROWERS)) {
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Results, { answers: b.answers, onAnswerMore: () => {}, onRestart: () => {} })
  );
  console.log(`--- ${name} ---`);
  console.log("length:", html.length, "| has stamp:", html.includes("stamp"), "| has Negotiation Card:", html.includes("Negotiation Card"));
}
console.log("RESULTS SMOKE TEST OK");
