import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const { outputText } = ts.transpileModule(readFileSync(new URL("./backup.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { isWorkspaceKey, parseBackup } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const backup = entries => JSON.stringify({ type: "fpl-cockpit-workspace", version: 1, createdAt: "2026-10-28T12:00:00Z", entries });
test("backups preserve season-scoped workspace values and never accept unrelated origin keys", () => {
  assert.equal(isWorkspaceKey("fpl:prep:2026-27:123:9"), true);
  assert.equal(isWorkspaceKey("auth-token"), false);
  assert.deepEqual(parseBackup(backup([["fpl:watchlist:2026-27", "[1,2]"]])).entries, [["fpl:watchlist:2026-27", "[1,2]"]]);
  assert.throws(() => parseBackup(backup([["auth-token", '"secret"']])));
});
test("ambiguous, malformed and oversized backup files are rejected before storage is touched", () => {
  assert.throws(() => parseBackup(backup([["fpl:compare:2026-27", "[]"], ["fpl:compare:2026-27", "[]"]])));
  assert.throws(() => parseBackup(backup([["fpl:lineup:season", "broken json"]])));
  assert.throws(() => parseBackup('{"version":99}'));
  assert.throws(() => parseBackup("x".repeat(2_000_001)));
});
