import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const { outputText } = ts.transpileModule(readFileSync(new URL("./advisor.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { advisorStatus } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const now = Date.parse("2026-10-25T12:00:00Z");
const deadline = "2026-10-31T11:00:00Z";
const validation = { version: 2, state_verified: true, state_captured_at: "2026-10-25T11:00:00Z", data_refreshed_at: "2026-10-25T11:30:00Z" };

test("only fresh advice from the current model is featured", () => {
  assert.equal(advisorStatus(validation, deadline, 9, now).isCurrent, true);
  const legacy = advisorStatus({ ...validation, version: 1 }, deadline, 9, now);
  assert.equal(legacy.isCurrent, false);
  assert.match(legacy.reviewNote, /predates the current decision model/);
});

test("fresh squad confirmation cannot make stale warehouse data current", () => {
  const stale = advisorStatus({ ...validation, data_refreshed_at: "2026-10-25T05:00:00Z" }, deadline, 9, now);
  assert.equal(stale.isCurrent, false);
  assert.match(stale.reviewNote, /older than six hours/);
});

test("expired deadlines, missing deadlines and stale or future snapshots cannot be current", () => {
  assert.equal(advisorStatus(validation, null, 9, now).isCurrent, false);
  assert.equal(advisorStatus(validation, "2026-10-23T17:30:00Z", 8, now).isCurrent, false);
  for (const timestamp of ["2026-10-24T10:00:00Z", "2026-10-25T12:06:00Z", "invalid"]) {
    assert.equal(advisorStatus({ ...validation, state_captured_at: timestamp }, deadline, 9, now).isCurrent, false);
  }
});
