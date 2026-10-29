import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = readFileSync(new URL("../components/AdvisorEvidence.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
});
const compiled = outputText.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")));
const { AdvisorEvidence } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const players = Array.from({ length: 16 }, (_, index) => ({
  playerId: index === 15 ? 100 : index + 1,
  player: index === 15 ? "Incoming midfielder" : index === 14 ? "Reserve keeper" : `Owned ${index + 1}`,
}));
const before = { formation: "4-4-2", starters: Array.from({ length: 11 }, (_, i) => i + 1), bench: [12, 13, 14, 15] };
const after = { ...before, formation: "3-4-3", starters: [...before.starters.slice(0, 10), 100], reliable_outfield_bench: [12] };
const transfer = { player_out: "Owned 11", player_in: "Incoming midfielder", position: "MID", reasoning: "Improve the XI." };

test("primary panel renders the post-transfer XI and separates goalkeeper from outfield bench", () => {
  const decision = { horizon: 4, lineup: before, transfer_options: [{ ...transfer, lineup: after }] };
  const html = renderToStaticMarkup(AdvisorEvidence({ decision, players, transfers: [transfer] }));
  const primaryPanel = html.split("<details")[0];
  const xi = primaryPanel.match(/<p[^>]*>(.*?)<\/p>/s)[1];
  assert.match(xi, /3-4-3/);
  assert.match(xi, /Incoming midfielder/);
  assert.doesNotMatch(xi, /Owned 11/);
  assert.match(primaryPanel, /Outfield bench, in order/);
  assert.match(primaryPanel, /Reserve goalkeeper:<\/strong> Reserve keeper/);
  assert.match(html, /Compare with keeping your squad/);
  assert.match(html, /brief cameo prevents/);
});

test("saved advice without post-transfer metadata falls back to the complete original squad", () => {
  const decision = { horizon: 4, lineup: before, transfer_options: [] };
  const html = renderToStaticMarkup(AdvisorEvidence({ decision, players, transfers: [transfer] }));
  assert.match(html, /without a transfer/);
  assert.match(html, /Owned 11/);
  assert.doesNotMatch(html, /after Owned 11/);
});
