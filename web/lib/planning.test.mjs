import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

async function load(name) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(name, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const { simulatePlan, squadErrors, parseMillions, fixtureRun, fixturesForTeam, playableCount } = await load("./planning.ts");
const { matchweekTotals } = await load("./matchweek.ts");

function setup() {
  const positions = ["GKP", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "FWD", "FWD", "FWD", "GKP", "DEF", "DEF", "MID"];
  const players = positions.map((position, i) => ({ playerCode: i + 1, playerId: i + 1, player: `Player ${i + 1}`, teamId: i % 5 + 1, position, nowCost: 50, status: "a", chanceOfPlaying: 100, news: "" }));
  players.push({ ...players[1], playerCode: 100, player: "New defender", teamId: 6 });
  const picks = players.slice(0, 15).map((p, i) => ({ code: p.playerCode, slot: i + 1, sellingPrice: 50 }));
  return { players, picks };
}
const week = (gameweek, moves = []) => ({ gameweek, moves });

test("ordinary moves spend the available FT and roll one into the next deadline", () => {
  const { picks, players } = setup();
  players[15].nowCost = 60;
  const results = simulatePlan(picks, players, 10, 1, [week(9, [{ out: 2, in: 100 }]), week(10)]);
  assert.deepEqual(results.map(r => [r.bank, r.freeBefore, r.freeAfter, r.hitCost]), [[0, 1, 0, 0], [0, 1, 1, 0]]);
  assert.equal(results[1].squad.find(p => p.slot === 2).code, 100);
  assert.equal(picks[1].code, 2, "simulation must not mutate the confirmed baseline");
});
test("a move after all free transfers were used incurs four points", () => {
  const { picks, players } = setup();
  const [result] = simulatePlan(picks, players, 0, 0, [week(9, [{ out: 2, in: 100 }])]);
  assert.equal(result.hitCost, 4);
  assert.equal(result.freeAfter, 0);
  assert.equal(result.errors.length, 0);
});
test("rolling unused transfers never exceeds five", () => {
  const { picks, players } = setup();
  const results = simulatePlan(picks, players, 0, 5, [week(9), week(10), week(11)]);
  assert.ok(results.every(r => r.freeBefore === 5 && r.freeAfter === 5));
});
test("affordability uses real selling proceeds, including one-tenth boundaries", () => {
  const { picks, players } = setup();
  picks[1].sellingPrice = 48;
  assert.ok(simulatePlan(picks, players, 1, 1, [week(9, [{ out: 2, in: 100 }])])[0].errors.some(e => e.includes("exceeds")));
  const valid = simulatePlan(picks, players, 2, 1, [week(9, [{ out: 2, in: 100 }])])[0];
  assert.equal(valid.bank, 0); assert.equal(valid.errors.length, 0);
});
test("unknown sale values are not silently replaced by market prices", () => {
  const { picks, players } = setup(); picks[1].sellingPrice = null;
  const [result] = simulatePlan(picks, players, 10, 1, [week(9, [{ out: 2, in: 100 }])]);
  assert.ok(result.errors.some(e => e.includes("actual selling")));
  assert.equal(result.bank, null);
});
test("club limits are checked on the complete simultaneous bundle", () => {
  const { picks, players } = setup();
  players[15].teamId = 1;
  players.push({ ...players[5], playerCode: 101, teamId: 6 });
  const bad = simulatePlan(picks, players, 0, 2, [week(9, [{ out: 2, in: 100 }])])[0];
  assert.ok(bad.errors.some(e => e.includes("three players")));
  const good = simulatePlan(picks, players, 0, 2, [week(9, [{ out: 2, in: 100 }, { out: 6, in: 101 }])])[0];
  assert.deepEqual(good.errors, []);
});
test("an existing excess-club squad can make a corrective transfer", () => {
  const { picks, players } = setup(); players[13].teamId = 1;
  const [result] = simulatePlan(picks, players, 0, 1, [week(9, [{ out: 14, in: 100 }])]);
  assert.deepEqual(result.errors, []);
});
for (const [name, changes, moves, match] of [
  ["position mismatch", p => { p[15].position = "MID"; }, [{ out: 2, in: 100 }], "FPL position"],
  ["already owned player", () => {}, [{ out: 2, in: 3 }], "already in"],
  ["repeated outgoing player", () => {}, [{ out: 2, in: 100 }, { out: 2, in: 100 }], "only once"],
  ["non-owned outgoing player", () => {}, [{ out: 100, in: 2 }], "owned outgoing"],
  ["unselected incoming player", () => {}, [{ out: 2, in: 0 }], "incoming player"],
]) test(`rejects ${name}`, () => {
  const { picks, players } = setup(); changes(players);
  assert.ok(simulatePlan(picks, players, 50, 2, [week(9, moves)])[0].errors.some(e => e.includes(match)));
});
test("a resale chain cannot masquerade as a simultaneous bundle", () => {
  const { picks, players } = setup(); players.push({ ...players[15], playerCode: 101 });
  assert.ok(simulatePlan(picks, players, 0, 2, [week(9, [{ out: 2, in: 100 }, { out: 100, in: 101 }])])[0].errors.some(e => e.includes("owned outgoing")));
});
test("future steps remain unverified until an earlier invalid week is fixed", () => {
  const { picks, players } = setup(); players[15].nowCost = 60;
  const results = simulatePlan(picks, players, 0, 1, [week(9, [{ out: 2, in: 100 }]), week(10)]);
  assert.equal(results[1].bank, null);
  assert.ok(results[1].errors.some(e => e.includes("earlier gameweek")));
});
test("unknown bank or free transfers cannot produce verified figures", () => {
  const { picks, players } = setup();
  const [result] = simulatePlan(picks, players, null, null, [week(9)]);
  assert.equal(result.bank, null); assert.equal(result.freeAfter, null);
  assert.equal(result.errors.length, 2);
});
test("skipping a calendar week cannot silently skip transfer accrual", () => {
  const { picks, players } = setup();
  assert.ok(simulatePlan(picks, players, 0, 1, [week(9), week(11)])[1].errors.some(e => e.includes("consecutive")));
});
test("bad starting formation is rejected even with a valid squad distribution", () => {
  const { picks, players } = setup(); [picks[0].slot, picks[12].slot] = [13, 1];
  assert.ok(squadErrors(picks, new Map(players.map(p => [p.playerCode, p]))).some(e => e.includes("starting XI")));
});
test("bought players can be sold next week at today's unchanged scenario price", () => {
  const { picks, players } = setup(); players[15].nowCost = 60;
  const results = simulatePlan(picks, players, 10, 1, [week(9, [{ out: 2, in: 100 }]), week(10, [{ out: 100, in: 2 }])]);
  assert.equal(results[1].bank, 10); assert.deepEqual(results[1].errors, []);
});
test("availability doubts surface as warnings, not invented certainty", () => {
  const { picks, players } = setup(); players[15].status = "d"; players[15].news = "Fitness test";
  const [result] = simulatePlan(picks, players, 0, 1, [week(9, [{ out: 2, in: 100 }])]);
  assert.equal(result.errors.length, 0); assert.ok(result.warnings[0].includes("Fitness test"));
});
test("money parsing permits real FPL increments and rejects implicit rounding", () => {
  for (const [input, expected] of [["0", 0], ["0.1", 1], ["5.2", 52], ["10.1", 101]]) assert.equal(parseMillions(input), expected);
  for (const input of ["", "-1", "5.25", "1e2", "NaN", "Infinity"]) assert.equal(parseMillions(input), null);
});
test("fixture average excludes blanks, counts doubles per match and preserves unknown ratings", () => {
  const run = fixtureRun([{ entries: [] }, { entries: [{ difficulty: 2 }, { difficulty: 4 }] }, { entries: [{ difficulty: null }] }]);
  assert.deepEqual(run, { average: 3, fixtures: 3, blanks: 1, doubles: 1, unknown: 1 });
  assert.equal(fixtureRun([{ entries: [] }]).average, null);
});
test("fixture grouping includes every fixture in a double and uses the correct home rating", () => {
  const fixtures = [{ gameweek: 9, teamH: 1, teamA: 2, diffH: 2, diffA: 4 }, { gameweek: 9, teamH: 3, teamA: 1, diffH: 3, diffA: 5 }, { gameweek: 8, teamH: 1, teamA: 2, diffH: 2, diffA: 4 }];
  assert.deepEqual(fixturesForTeam(fixtures, 1, 9).map(f => [f.opponentId, f.home, f.difficulty]), [[2, true, 2], [3, false, 5]]);
  assert.deepEqual(fixturesForTeam(fixtures, 1, 10), []);
});
test("squad coverage respects goalkeeper and legal outfield capacity", () => {
  assert.equal(playableCount(["GKP", "GKP", ...Array(5).fill("MID"), ...Array(3).fill("FWD")]), 8);
  assert.equal(playableCount(["GKP", ...Array(5).fill("DEF"), ...Array(5).fill("MID"), ...Array(3).fill("FWD")]), 11);
});
test("match total counts autosubs and captain fallback, never a zero multiplier as one", () => {
  const total = matchweekTotals([
    { player: "Captain", squadPosition: 1, livePoints: 0, multiplier: 0, isCaptain: true },
    { player: "Vice", squadPosition: 2, livePoints: 6, multiplier: 2, isViceCaptain: true },
    { player: "Sub", squadPosition: 13, livePoints: 5, multiplier: 1 },
    { player: "Unused", squadPosition: 14, livePoints: 8, multiplier: 0 },
  ]);
  assert.equal(total.liveTotal, 17); assert.equal(total.captain, "Vice"); assert.equal(total.benchPoints, 13);
});
test("saved triple-captain and Bench Boost multipliers count exactly once", () => {
  assert.equal(matchweekTotals([{ player: "TC", livePoints: 10, multiplier: 3, squadPosition: 1 }, { player: "BB", livePoints: 4, multiplier: 1, squadPosition: 12 }]).liveTotal, 34);
});
