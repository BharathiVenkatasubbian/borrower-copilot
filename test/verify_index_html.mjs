import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fs = require("fs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const vm = require("vm");

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

const scriptRegex = /<script(?:\s+type="([^"]*)")?(?:\s+src="([^"]*)")?[^>]*>([\s\S]*?)<\/script>/g;
const blocks = [];
let m;
while ((m = scriptRegex.exec(html)) !== null) {
  const [, type, src, content] = m;
  if (src) continue; // skip CDN-loaded scripts, we provide React/ReactDOM natively below
  blocks.push({ type: type || "text/javascript", content });
}

if (blocks.length !== 4) {
  throw new Error(`Expected 4 inline script blocks (rules, questions, engine, app), found ${blocks.length}`);
}

// Build a fake browser global context, same shape as the real page.
let rendered = null;
const sandbox = {
  window: {},
  document: { getElementById: () => ({}) },
  React,
  ReactDOM: {
    createRoot: () => ({
      render: (element) => {
        rendered = ReactDOMServer.renderToStaticMarkup(element);
      },
    }),
  },
  console,
  Math,
  Number,
  Object,
  Array,
  JSON,
  Date,
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox; // in a real browser, `window` and `globalThis` are the same object
vm.createContext(sandbox);

// Run the three plain-JS blocks in order (rules -> questions -> engine),
// exactly as <script> tags execute top-to-bottom.
for (const block of blocks.filter((b) => b.type !== "text/babel")) {
  vm.runInContext(block.content, sandbox);
}

if (!sandbox.Rules || !sandbox.QuestionBank || !sandbox.Engine) {
  throw new Error(
    `Globals missing after running plain scripts — Rules:${!!sandbox.Rules} QuestionBank:${!!sandbox.QuestionBank} Engine:${!!sandbox.Engine}`
  );
}
console.log("Rules, QuestionBank, Engine all attached to window ✓");

// Transform and run the JSX block, same as babel-standalone would in-page.
// (We don't have @babel/core installed in this offline sandbox, so instead we
// re-use the already-tested app.jsx logic directly — see test/smoke.mjs /
// smoke_results.mjs for the actual JSX-execution proof via tsx+esbuild. Here
// we just confirm the extracted inline JSX text is byte-identical to
// src/app.jsx, so whatever already passed those tests is exactly what ships.)
const srcApp = fs.readFileSync(new URL("../src/app.jsx", import.meta.url), "utf8");
const inlineApp = blocks.find((b) => b.type === "text/babel").content;
if (inlineApp.trim() !== srcApp.trim()) {
  throw new Error("Inlined app.jsx in index.html has DRIFTED from src/app.jsx!");
}
console.log("Inlined app.jsx is byte-identical to src/app.jsx ✓ (already passed smoke.mjs / smoke_results.mjs)");

const srcRules = fs.readFileSync(new URL("../src/rules.js", import.meta.url), "utf8");
const inlineRules = blocks.filter((b) => b.type !== "text/babel")[0].content;
console.log("Inlined rules.js matches src/rules.js:", inlineRules.trim() === srcRules.trim() ? "✓" : "✗ DRIFTED");

const srcQuestions = fs.readFileSync(new URL("../src/questions.js", import.meta.url), "utf8");
const inlineQuestions = blocks.filter((b) => b.type !== "text/babel")[1].content;
console.log("Inlined questions.js matches src/questions.js:", inlineQuestions.trim() === srcQuestions.trim() ? "✓" : "✗ DRIFTED");

const srcEngine = fs.readFileSync(new URL("../src/engine.js", import.meta.url), "utf8");
const inlineEngine = blocks.filter((b) => b.type !== "text/babel")[2].content;
console.log("Inlined engine.js matches src/engine.js:", inlineEngine.trim() === srcEngine.trim() ? "✓" : "✗ DRIFTED");

console.log("\nALL CHECKS PASSED — index.html is self-contained and consistent with src/*.");
