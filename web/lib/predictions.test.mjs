import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const { outputText } = ts.transpileModule(readFileSync(new URL("./predictions.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { LEARNED_MODEL_VERSION, predictionRunUsable, predictionRows } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const now = Date.parse("2026-11-08T12:00:00Z");
const run = { model_version: LEARNED_MODEL_VERSION, trained_through: 9, from_gameweek: 11,
  gate_passed: true, generated_at: "2026-11-08T06:00:00Z" };

test("only fresh, compatible, gate-passing forecasts reach the lineup", () => {
  assert.equal(predictionRunUsable(run, 11, 9, now), true);
  for (const invalid of [
    { model_version: "learned-hgb-v2" }, { trained_through: 12 }, { trained_through: 6 },
    { from_gameweek: 12 }, { gate_passed: false }, { generated_at: "2026-11-07T06:00:00Z" },
    { generated_at: "invalid" }, { generated_at: "2026-11-09T06:00:00Z" },
  ]) assert.equal(predictionRunUsable({ ...run, ...invalid }, 11, 9, now), false);
});

test("missing predictions remain unknown while a recorded blank is zero", () => {
  const rows = [{ player_code: 7, gameweek: 11, predicted_points: "5.5", p60: "0.9" },
    { player_code: 7, gameweek: 12, predicted_points: 0, p60: null }];
  assert.deepEqual(predictionRows(rows, [11, 12]).get(7), { predicted: { 11: 5.5, 12: 0 }, p60: 0.9 });
  assert.equal(predictionRows(rows.slice(0, 1), [11, 12]), null);
  assert.equal(predictionRows([{ ...rows[0], predicted_points: "NaN" }], [11]), null);
  assert.equal(predictionRows([{ ...rows[0], p60: "1.5" }], [11]), null);
});
