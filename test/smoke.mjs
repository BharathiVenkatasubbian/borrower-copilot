import { createRequire } from "module";
const require = createRequire(import.meta.url);

const React = require("react");
const ReactDOMServer = require("react-dom/server");

global.React = React;
global.Rules = require("../src/rules.js");
global.QuestionBank = require("../src/questions.js");
global.Engine = require("../src/engine.js");

let rendered = null;
global.document = { getElementById: () => ({}) };
global.ReactDOM = {
  createRoot: () => ({
    render: (element) => {
      rendered = ReactDOMServer.renderToStaticMarkup(element);
    },
  }),
};

// app.jsx is JSX — tsx's loader transforms .jsx on require/import.
await import("../src/app.jsx");

if (!rendered) throw new Error("App never called render()");
console.log("SMOKE TEST OK — initial intro screen rendered,", rendered.length, "chars");
console.log(/Borrower\s*<em>Copilot/.test(rendered) || rendered.includes("Borrower") ? "Brand text found ✓" : "MISSING brand text ✗");
console.log(rendered.includes("Ravi, 42") ? "Sample borrower cards found ✓" : "MISSING sample cards ✗");
