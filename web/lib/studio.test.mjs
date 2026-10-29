import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const { outputText } = ts.transpileModule(readFileSync(new URL("./studio.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { initialStudioLineup, lineupIssues, swapLineup, rehearseLineup, fixtureWindow, captainIndex, suggestLineup, parsePrep, parseStudio, deadlineCalendar, csvCell } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const players = ["GKP", "GKP", "DEF", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "MID", "FWD", "FWD", "FWD"].map((position, i) => ({ code: i + 1, name: `Player ${i + 1}`, position, teamId: i + 1, teamCode: i + 1, team: "TEST", price: 50, status: "a", chance: 100, minutes: 450, games: 5, ppg: 5, form: 25, lastPoints: 5 }));
const xi = () => ({ starters: [1, 3, 4, 5, 8, 9, 10, 11, 13, 14, 15], bench: [12, 6, 7, 2], captain: 13, vice: 8 });

test("a complete legal XI accounts for all 15 players", () => assert.deepEqual(lineupIssues(players, xi()), []));
test("missing or benched armbands get distinct starting fallbacks", () => {
  const lineup = xi();
  const saved = [...lineup.starters, ...lineup.bench].map((code, i) => ({ playerCode: code, position: players.find(p => p.code === code).position, squadPosition: i + 1, isCaptain: false, isViceCaptain: false }));
  const initial = initialStudioLineup(saved);
  assert.notEqual(initial.captain, initial.vice);
  assert.deepEqual(lineupIssues(players, initial), []);
  saved.find(p => p.playerCode === 12).isViceCaptain = true;
  assert.ok(initialStudioLineup(saved).starters.includes(initialStudioLineup(saved).vice));
});
test("illegal formation, duplicate player and bench captain are rejected", () => {
  const bad = xi(); bad.starters[1] = 12; bad.bench[0] = 3;
  assert.ok(lineupIssues(players, bad).some(s => s.includes("defenders")));
  assert.ok(lineupIssues(players, { ...xi(), bench: [3, 6, 7, 2] }).length);
  assert.ok(lineupIssues(players, { ...xi(), captain: 12 }).length);
  assert.ok(lineupIssues(players, { ...xi(), vice: 13 }).length);
});
test("safe swaps preserve captain assignment, all players and reserve goalkeeper position", () => {
  const next = swapLineup(players, xi(), 13, 12);
  assert.equal(next.captain, 12);
  assert.equal(next.bench[3], 2);
  assert.deepEqual(lineupIssues(players, next), []);
  assert.equal(swapLineup(players, xi(), 3, 12), null);
  assert.equal(swapLineup(players, xi(), 13, 2), null);
});
test("reserve keeper replaces only a zero-minute goalkeeper", () => {
  const next = rehearseLineup(players, xi(), { 1: 0 });
  assert.deepEqual(next.substitutions, [{ out: 1, in: 2 }]);
  assert.equal(next.fielded.length, 11);
  const both = rehearseLineup(players, xi(), { 1: 0, 2: 0 });
  assert.equal(both.fielded.length, 10);
  assert.equal(both.substitutions.length, 0);
});
test("minimum defender count overrides higher-priority midfield substitute", () => {
  const next = rehearseLineup(players, xi(), { 3: 0 });
  assert.deepEqual(next.substitutions, [{ out: 3, in: 6 }]);
  assert.ok(!next.fielded.includes(12));
});
test("a cameo, including in one match of a double, blocks an automatic substitute", () => {
  const next = rehearseLineup(players, xi(), { 13: 1 });
  assert.equal(next.substitutions.length, 0);
  assert.equal(next.captain, 13);
});
test("multiple absences preserve legal formation and use the earliest eligible substitutes", () => {
  const next = rehearseLineup(players, xi(), { 3: 0, 13: 0 });
  assert.equal(next.fielded.length, 11);
  assert.deepEqual(new Set(next.substitutions.map(s => s.in)), new Set([12, 6]));
});
test("an absent first substitute is skipped and captain fallback uses actual hypothetical minutes", () => {
  const next = rehearseLineup(players, xi(), { 13: 0, 12: 0 });
  assert.equal(next.substitutions[0].in, 6);
  assert.equal(next.captain, 8);
  assert.equal(rehearseLineup(players, xi(), { 13: 0, 8: 0 }).captain, null);
});
test("malformed lineups cannot manufacture simulation totals", () => {
  const next = rehearseLineup(players, { ...xi(), starters: [1] }, {});
  assert.ok(next.issues.length);
  assert.deepEqual(next.fielded, []);
});
test("fixture windows count doubles, preserve blanks and exclude unknown ratings", () => {
  const fixtures = [{ gameweek: 9, teamH: 1, teamA: 2, diffH: 2, diffA: 4 }, { gameweek: 9, teamH: 3, teamA: 1, diffH: 3, diffA: 4 }, { gameweek: 11, teamH: 1, teamA: 4, diffH: null, diffA: 3 }];
  assert.deepEqual(fixtureWindow(fixtures, 1, 9, 3), { average: 3, fixtures: 3, blanks: 1, doubles: 1, unknown: 1 });
  assert.equal(fixtureWindow(fixtures, 1, 39, 3).fixtures, 0);
});
test("captain shortlist indices respect absence, explicit zero chance and target blanks", () => {
  const f = [{ gameweek: 9, teamH: 1, teamA: 2, diffH: 3, diffA: 3 }];
  assert.equal(captainIndex(players[0], f, 9), 5);
  assert.equal(captainIndex({ ...players[0], chance: 0 }, f, 9), 0);
  assert.equal(captainIndex({ ...players[0], status: "i" }, f, 9), 0);
  assert.equal(captainIndex(players[0], f, 10), 0);
});
test("suggested XI and bench are legal and do not mutate the source squad", () => {
  const before = JSON.stringify(players);
  const fixtures = players.map(p => ({ gameweek: 9, teamH: p.teamId, teamA: 99, diffH: 3, diffA: 3 }));
  const next = suggestLineup(players, fixtures, 9);
  assert.deepEqual(lineupIssues(players, next), []);
  assert.equal(JSON.stringify(players), before);
  assert.equal(suggestLineup(players, [], 9), null);
});
test("corrupt preparation and lineup storage is bounded and cannot add arbitrary tasks", () => {
  assert.deepEqual(parsePrep({ checked: ["squad", "squad", "unknown"], notes: "x".repeat(5000) }).checked, ["squad"]);
  assert.equal(parsePrep({ notes: "x".repeat(5000) }).notes.length, 4000);
  assert.deepEqual(parsePrep(null), { checked: [], notes: "" });
  assert.deepEqual(parseStudio({ starters: "bad" }, xi()), xi());
});
test("calendar export uses UTC, CRLF and a two-hour reminder without executing a calendar action", () => {
  const ics = deadlineCalendar("2026-10-31T11:00:00Z", 9, "2026-27");
  assert.ok(ics.includes("DTSTART:20261031T110000Z\r\n"));
  assert.ok(ics.includes("TRIGGER:-PT2H\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.throws(() => deadlineCalendar("bad", 9, "2026-27"));
  assert.throws(() => deadlineCalendar("2026-10-31T11:00:00Z", 39, "2026-27"));
});
test("CSV escapes embedded quotes, commas and spreadsheet formulas", () => {
  assert.equal(csvCell('A, "B"'), '"A, ""B"""');
  assert.equal(csvCell("=1+2"), '"\'=1+2"');
  assert.equal(csvCell(null), '""');
});
