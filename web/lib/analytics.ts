import type { ManagerAnalytics, ManagerGameweekRow } from "./types";

export type AnalyticsPeriod = "season" | "5" | "10";

export function selectGameweeks(
  rows: ManagerGameweekRow[],
  period: AnalyticsPeriod,
  includeUnfinished = false,
): ManagerGameweekRow[] {
  const eligible = rows
    .filter((row) => includeUnfinished || row.finished === true)
    .sort((a, b) => a.gameweek - b.gameweek);
  return period === "season" ? eligible : eligible.slice(-Number(period));
}

const validRank = (rank: number | null) => rank != null && rank > 0;

export function gameweekRankChanges(rows: ManagerGameweekRow[]) {
  const ordered = [...rows].sort((a, b) => a.gameweek - b.gameweek);
  return new Map(
    ordered.map((row, index) => {
      const previous = ordered[index - 1];
      const change =
        previous &&
        validRank(previous.overallRank) &&
        validRank(row.overallRank)
          ? previous.overallRank! - row.overallRank!
          : null;
      return [row.gameweek, change] as const;
    }),
  );
}

export function summarizePeriod(
  analytics: Pick<ManagerAnalytics, "rows" | "teamValueSeries">,
  selected: ManagerGameweekRow[],
) {
  const ordered = [...selected].sort((a, b) => a.gameweek - b.gameweek);
  const count = ordered.length;
  const first = ordered[0];
  const totalPoints = ordered.reduce((sum, row) => sum + row.points, 0);
  const comparable = ordered.filter((row) => row.averageEntryScore != null);
  const advantage = comparable.reduce(
    (sum, row) => sum + row.points - row.averageEntryScore!,
    0,
  );
  const wins = comparable.filter(
    (row) => row.points > row.averageEntryScore!,
  ).length;
  const ranks = ordered.filter((row) => validRank(row.overallRank));
  const previousRank = first
    ? [...analytics.rows]
        .filter(
          (row) => row.gameweek < first.gameweek && validRank(row.overallRank),
        )
        .sort((a, b) => b.gameweek - a.gameweek)[0]
    : undefined;
  const rankStart = previousRank ?? ranks[0];
  const rankEnd = ranks.at(-1);
  const rankChange =
    rankStart && rankEnd && rankStart.gameweek !== rankEnd.gameweek
      ? {
          delta: rankStart.overallRank! - rankEnd.overallRank!,
          from: rankStart.overallRank!,
          to: rankEnd.overallRank!,
          fromGameweek: rankStart.gameweek,
        }
      : null;
  const changes = gameweekRankChanges(analytics.rows);
  const selectedWeeks = new Set(ordered.map((row) => row.gameweek));
  const values = analytics.teamValueSeries
    .filter((row) => selectedWeeks.has(row.gameweek) && row.value > 0)
    .sort((a, b) => a.gameweek - b.gameweek);
  const previousValue = first
    ? [...analytics.teamValueSeries]
        .filter((row) => row.gameweek < first.gameweek && row.value > 0)
        .sort((a, b) => b.gameweek - a.gameweek)[0]
    : undefined;
  const valueStart = previousValue ?? values[0];
  const valueEnd = values.at(-1);
  const valueChange =
    valueStart && valueEnd && valueStart.gameweek !== valueEnd.gameweek
      ? Math.round((valueEnd.value - valueStart.value) * 10) / 10
      : null;

  return {
    count,
    totalPoints,
    averagePoints: count ? totalPoints / count : null,
    comparedWeeks: comparable.length,
    advantage: comparable.length ? advantage : null,
    wins,
    ties: comparable.filter((row) => row.points === row.averageEntryScore)
      .length,
    beatRate: comparable.length ? (wins / comparable.length) * 100 : null,
    best: ordered.reduce<ManagerGameweekRow | null>(
      (best, row) => (!best || row.points > best.points ? row : best),
      null,
    ),
    worst: ordered.reduce<ManagerGameweekRow | null>(
      (worst, row) => (!worst || row.points < worst.points ? row : worst),
      null,
    ),
    benchPoints: ordered.reduce((sum, row) => sum + row.pointsOnBench, 0),
    hitCost: ordered.reduce((sum, row) => sum + row.transferCost, 0),
    hitWeeks: ordered.filter((row) => row.transferCost > 0).length,
    greenArrows: ordered.filter((row) => (changes.get(row.gameweek) ?? 0) > 0)
      .length,
    redArrows: ordered.filter((row) => (changes.get(row.gameweek) ?? 0) < 0)
      .length,
    rankChange,
    latestRank: rankEnd?.overallRank ?? null,
    valueChange,
    latestValue: valueEnd?.value ?? null,
  };
}

export function advantageSeries(rows: ManagerGameweekRow[]) {
  let running = 0;
  return [...rows]
    .sort((a, b) => a.gameweek - b.gameweek)
    .map((row) => {
      if (row.averageEntryScore == null)
        return { gameweek: row.gameweek, advantage: null };
      running += row.points - row.averageEntryScore;
      return { gameweek: row.gameweek, advantage: running };
    });
}

export function gameweekCsv(rows: ManagerGameweekRow[]): string {
  const header =
    "Gameweek,Status,Gameweek points,Global average,Versus average,Overall rank,Bench points,Transfer hit cost,Season total";
  const lines = [...rows]
    .sort((a, b) => a.gameweek - b.gameweek)
    .map((row) =>
      [
        row.gameweek,
        row.finished === true
          ? "Finished"
          : row.finished === false
            ? "Unfinished"
            : "Unconfirmed",
        row.points,
        row.averageEntryScore ?? "",
        row.averageEntryScore != null ? row.points - row.averageEntryScore : "",
        validRank(row.overallRank) ? row.overallRank : "",
        row.pointsOnBench,
        row.transferCost,
        row.totalPoints,
      ].join(","),
    );
  return [header, ...lines].join("\r\n");
}
