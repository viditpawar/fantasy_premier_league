import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Compile the pure module with the project's installed compiler; works on Node 20+.
const source = readFileSync(new URL("./analytics.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const { selectGameweeks, summarizePeriod, advantageSeries, gameweekCsv } =
  await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  );

const row = (gameweek, points, extra = {}) => ({
  gameweek,
  points,
  finished: true,
  totalPoints: points,
  overallRank: null,
  pointsOnBench: 0,
  transferCost: 0,
  averageEntryScore: 40,
  vsAverage: points - 40,
  ...extra,
});
const data = (rows, teamValueSeries = []) => ({ rows, teamValueSeries });

test("unfinished and unknown weeks cannot distort completed-week averages; a finished zero counts", () => {
  const rows = [
    row(1, 60),
    row(2, 0),
    row(3, 0, { finished: false }),
    row(4, 10, { finished: null }),
  ];
  const selected = selectGameweeks(rows, "season");
  assert.deepEqual(
    selected.map((r) => r.gameweek),
    [1, 2],
  );
  assert.equal(summarizePeriod(data(rows), selected).averagePoints, 30);
  assert.equal(selectGameweeks(rows, "season", true).length, 4);
});

test("rolling windows select the latest completed weeks and do not mutate source data", () => {
  const rows = [
    row(9, 0, { finished: false }),
    ...Array.from({ length: 8 }, (_, i) => row(8 - i, 50)),
  ];
  assert.deepEqual(
    selectGameweeks(rows, "5").map((r) => r.gameweek),
    [4, 5, 6, 7, 8],
  );
  assert.equal(rows[0].gameweek, 9);
});

test("missing averages are excluded from comparison denominators; a zero average is valid", () => {
  const rows = [
    row(1, 60, { averageEntryScore: 40 }),
    row(2, 30, { averageEntryScore: null }),
    row(3, 10, { averageEntryScore: 0 }),
    row(4, 40),
  ];
  const summary = summarizePeriod(data(rows), rows);
  assert.equal(summary.comparedWeeks, 3);
  assert.equal(summary.advantage, 30);
  assert.equal(summary.wins, 2);
  assert.equal(Math.round(summary.beatRate), 67);
  assert.deepEqual(
    advantageSeries(rows).map((r) => r.advantage),
    [20, null, 30, 30],
  );
});

test("period rank movement includes the baseline before the selected window", () => {
  const rows = [
    row(1, 50, { overallRank: 1000 }),
    row(2, 50, { overallRank: 800 }),
    row(3, 50, { overallRank: 900 }),
  ];
  const summary = summarizePeriod(data(rows), rows.slice(1));
  assert.equal(summary.rankChange.delta, 100);
  assert.equal(summary.rankChange.fromGameweek, 1);
  assert.equal(summary.greenArrows, 1);
  assert.equal(summary.redArrows, 1);
});

test("unknown and zero ranks are not interpreted as number one or an improvement", () => {
  const rows = [
    row(1, 50, { overallRank: 1000 }),
    row(2, 50, { overallRank: 0 }),
    row(3, 50, { overallRank: null }),
  ];
  const summary = summarizePeriod(data(rows), rows.slice(1));
  assert.equal(summary.latestRank, null);
  assert.equal(summary.rankChange, null);
  assert.equal(summary.greenArrows, 0);
});

test("transfer hits remain separate from reported gameweek scores", () => {
  const rows = [
    row(1, 60, { transferCost: 4, pointsOnBench: 12 }),
    row(2, 40, { transferCost: 8, pointsOnBench: 3 }),
  ];
  const summary = summarizePeriod(data(rows), rows);
  assert.equal(summary.totalPoints, 100);
  assert.equal(summary.hitCost, 12);
  assert.equal(summary.hitWeeks, 2);
  assert.equal(summary.benchPoints, 15);
});

test("empty periods expose missing values rather than invented zero averages", () => {
  const summary = summarizePeriod(data([]), []);
  for (const key of [
    "averagePoints",
    "advantage",
    "beatRate",
    "best",
    "worst",
    "rankChange",
    "latestValue",
    "valueChange",
  ])
    assert.equal(summary[key], null);
});

test("squad value movement uses a preceding snapshot and ignores missing zero values", () => {
  const rows = [row(1, 50), row(2, 50), row(3, 50)];
  const summary = summarizePeriod(
    data(rows, [
      { gameweek: 1, value: 100 },
      { gameweek: 2, value: 101.2 },
      { gameweek: 3, value: 0 },
    ]),
    rows.slice(1),
  );
  assert.equal(summary.valueChange, 1.2);
  assert.equal(summary.latestValue, 101.2);
});

test("CSV keeps missing numeric fields empty and includes completion status", () => {
  const csv = gameweekCsv([
    row(2, 0, { finished: false, averageEntryScore: null, overallRank: 0 }),
    row(1, 50),
  ]);
  assert.equal(csv.split("\r\n")[1], "1,Finished,50,40,10,,0,0,50");
  assert.equal(csv.split("\r\n")[2], "2,Unfinished,0,,,,0,0,0");
});
