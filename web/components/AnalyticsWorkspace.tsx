"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { ManagerAnalytics, ManagerGameweekRow } from "@/lib/types";
import {
  gameweekCsv,
  gameweekRankChanges,
  selectGameweeks,
  summarizePeriod,
  type AnalyticsPeriod,
} from "@/lib/analytics";
import { compactNumber, signed } from "@/lib/format";
import { Hero } from "./ui/Hero";
import { DataTable, type Column } from "./ui/DataTable";
import { EmptyState } from "./ui/EmptyState";
import { IconArrowRight, IconChart, IconClock, IconSparkles } from "./icons";
import { PointsVsAverageChart } from "./charts/PointsVsAverageChart";
import { RankChart } from "./charts/RankChart";
import { AreaTrend } from "./charts/AreaTrend";
import { AdvantageChart } from "./charts/AdvantageChart";

type ChartMode = "points" | "rank" | "advantage";

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint: ReactNode;
  tone?: string;
}) {
  return (
    <div className="card metric-card">
      <p className="metric-label">{label}</p>
      <div className="metric-value" style={{ color: tone }}>
        {value}
      </div>
      <div className="metric-hint">{hint}</div>
    </div>
  );
}

export function AnalyticsWorkspace({
  analytics,
  season,
}: {
  analytics: ManagerAnalytics;
  season: string;
}) {
  const [period, setPeriod] = useState<AnalyticsPeriod>("season");
  const [includeUnfinished, setIncludeUnfinished] = useState(false);
  const [chart, setChart] = useState<ChartMode>("points");
  const rows = useMemo(
    () => selectGameweeks(analytics.rows, period, includeUnfinished),
    [analytics.rows, period, includeUnfinished],
  );
  const summary = useMemo(
    () => summarizePeriod(analytics, rows),
    [analytics, rows],
  );
  const changes = useMemo(
    () => gameweekRankChanges(analytics.rows),
    [analytics.rows],
  );
  const valueSeries = analytics.teamValueSeries.filter(
    (point) =>
      rows.some((row) => row.gameweek === point.gameweek) && point.value > 0,
  );
  const unfinished = rows.filter((row) => row.finished === false).length;
  const unconfirmed = analytics.rows.filter(
    (row) => row.finished == null,
  ).length;
  const excluded = analytics.rows.filter((row) => row.finished !== true).length;
  const from = rows[0]?.gameweek;
  const to = rows.at(-1)?.gameweek;
  const scope = rows.length
    ? from === to
      ? `GW${from}`
      : `GW${from}–${to}`
    : "No gameweeks selected";
  const chartMeta = {
    points: {
      title: "Your points in context",
      description:
        "Reported gameweek points alongside the global average. Transfer costs are shown separately.",
    },
    rank: {
      title: "The climb, gameweek by gameweek",
      description:
        "A lower rank is better. Each point is your saved overall rank after that gameweek.",
    },
    advantage: {
      title: "Building an advantage",
      description:
        "A running sum of your gameweek points minus the global average, starting at zero for this period. Missing averages are omitted.",
    },
  }[chart];

  function exportCsv() {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", gameweekCsv(rows)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `fpl-${season}-${from ?? "empty"}-${to ?? "empty"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const columns: Column<ManagerGameweekRow>[] = [
    {
      key: "gameweek",
      header: "Gameweek",
      sortValue: (row) => row.gameweek,
      render: (row) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap font-medium">
          GW{row.gameweek}
          {row.finished !== true && (
            <span className="rounded bg-warning/10 px-1.5 py-0.5 text-[8px] text-warning">
              {row.finished === false ? "Open" : "Unconfirmed"}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "points",
      header: "Points",
      align: "right",
      sortValue: (row) => row.points,
      render: (row) => <strong className="font-semibold">{row.points}</strong>,
    },
    {
      key: "average",
      header: "Average",
      align: "right",
      hideBelow: "sm",
      sortValue: (row) => row.averageEntryScore ?? -Infinity,
      render: (row) => (
        <span className="text-fg-muted">{row.averageEntryScore ?? "—"}</span>
      ),
    },
    {
      key: "difference",
      header: "vs avg",
      align: "right",
      sortValue: (row) =>
        row.averageEntryScore == null
          ? -Infinity
          : row.points - row.averageEntryScore,
      render: (row) =>
        row.averageEntryScore == null ? (
          <span className="text-fg-subtle">—</span>
        ) : (
          <span
            className={
              row.points >= row.averageEntryScore
                ? "text-good"
                : "text-critical"
            }
          >
            {signed(row.points - row.averageEntryScore)}
          </span>
        ),
    },
    {
      key: "rank",
      header: "Rank",
      align: "right",
      sortValue: (row) =>
        row.overallRank && row.overallRank > 0 ? row.overallRank : Infinity,
      render: (row) => {
        const change = changes.get(row.gameweek);
        return (
          <span
            className="inline-flex flex-wrap items-center justify-end gap-1.5"
            title={row.overallRank?.toLocaleString("en-GB")}
          >
            <span>
              {row.overallRank && row.overallRank > 0
                ? compactNumber(row.overallRank)
                : "—"}
            </span>
            {change != null && change !== 0 && (
              <span
                className={`text-[9px] ${change > 0 ? "text-good" : "text-critical"}`}
                aria-label={change > 0 ? "Rank improved" : "Rank declined"}
              >
                {change > 0 ? "↑" : "↓"}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: "bench",
      header: "Bench",
      align: "right",
      hideBelow: "sm",
      sortValue: (row) => row.pointsOnBench,
      render: (row) => (
        <span className="text-fg-muted">{row.pointsOnBench}</span>
      ),
    },
    {
      key: "cost",
      header: "Hit cost",
      align: "right",
      hideBelow: "sm",
      sortValue: (row) => row.transferCost,
      render: (row) => (
        <span
          className={row.transferCost > 0 ? "text-warning" : "text-fg-subtle"}
        >
          {row.transferCost > 0 ? `−${row.transferCost}` : "—"}
        </span>
      ),
    },
  ];

  return (
    <>
      <Hero
        title="The story behind the points."
        eyebrow={`${season} · Your analytics`}
        icon={<IconChart />}
        subtitle="Understand the patterns. Give your next decision a little more perspective."
      />
      <div className="card analytics-toolbar">
        <div
          className="analytics-period"
          role="group"
          aria-label="Analytics period"
        >
          {(
            [
              { value: "season", label: "Full season" },
              { value: "5", label: "Last 5 GWs" },
              { value: "10", label: "Last 10 GWs" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              aria-pressed={period === option.value}
              onClick={() => setPeriod(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[11px] text-fg-muted">
          <input
            type="checkbox"
            checked={includeUnfinished}
            onChange={(event) => setIncludeUnfinished(event.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--accent)]"
          />
          Include unfinished weeks
        </label>
        <button
          className="button-secondary"
          onClick={exportCsv}
          disabled={!rows.length}
        >
          <IconArrowRight className="rotate-90" />
          Export CSV
        </button>
      </div>
      <div className="analytics-scope" aria-live="polite">
        <span>
          {rows.length} gameweek{rows.length === 1 ? "" : "s"}
          <span className="mx-2 text-border-strong">·</span>
          {scope}
        </span>
        <span>
          {includeUnfinished
            ? `${unfinished} unfinished${unconfirmed ? ` · ${unconfirmed} unconfirmed in season` : ""} · Results can change`
            : excluded
              ? `${excluded} unfinished or unconfirmed ${excluded === 1 ? "week" : "weeks"} excluded`
              : "Finished gameweeks only"}
        </span>
      </div>
      <div className="overview-stats">
        <Metric
          label="Average gameweek"
          value={summary.averagePoints?.toFixed(1) ?? "—"}
          hint={
            summary.count
              ? `${summary.totalPoints} reported gameweek points`
              : "Waiting for a finished gameweek"
          }
        />
        <Metric
          label="Versus global average"
          value={summary.advantage != null ? signed(summary.advantage) : "—"}
          tone={
            summary.advantage != null
              ? summary.advantage >= 0
                ? "var(--good)"
                : "var(--critical)"
              : undefined
          }
          hint={
            summary.comparedWeeks
              ? `Across ${summary.comparedWeeks} comparable gameweeks`
              : "No comparable gameweeks yet"
          }
        />
        <Metric
          label="Beat the average"
          value={
            summary.beatRate != null ? `${Math.round(summary.beatRate)}%` : "—"
          }
          hint={
            summary.comparedWeeks
              ? `${summary.wins} of ${summary.comparedWeeks} gameweeks`
              : "Needs an available global average"
          }
        />
        <Metric
          label="Latest rank in period"
          value={compactNumber(summary.latestRank)}
          hint={
            summary.rankChange ? (
              <span
                className={
                  summary.rankChange.delta >= 0 ? "text-good" : "text-critical"
                }
              >
                {summary.rankChange.delta > 0
                  ? "↑"
                  : summary.rankChange.delta < 0
                    ? "↓"
                    : "→"}{" "}
                {compactNumber(Math.abs(summary.rankChange.delta))} since GW
                {summary.rankChange.fromGameweek}
              </span>
            ) : (
              "Rank movement needs two snapshots"
            )
          }
        />
      </div>

      {!rows.length ? (
        <EmptyState title="Give the gameweek a little time.">
          Your finished gameweeks will build the picture here.
          {excluded > 0 && (
            <button
              className="button-primary mt-4"
              onClick={() => setIncludeUnfinished(true)}
            >
              Explore unfinished weeks
              <IconArrowRight />
            </button>
          )}
        </EmptyState>
      ) : (
        <>
          {unfinished > 0 && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 text-[11px] leading-5 text-fg-muted">
              <IconClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              This view includes an unfinished gameweek. Scores, averages and
              ranks are provisional.
            </div>
          )}
          <div className="analytics-main-grid">
            <section className="card min-w-0 p-5 sm:p-6">
              <div className="analytics-chart-heading">
                <div>
                  <h2>{chartMeta.title}</h2>
                  <p className="panel-subtitle">{scope}</p>
                </div>
                <div
                  className="chart-tabs"
                  role="group"
                  aria-label="Analytics chart"
                >
                  {(["points", "rank", "advantage"] as const).map((value) => (
                    <button
                      key={value}
                      aria-pressed={chart === value}
                      onClick={() => setChart(value)}
                    >
                      {value === "points"
                        ? "Points"
                        : value === "rank"
                          ? "Rank"
                          : "Advantage"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="analytics-primary-chart mt-5" key={chart}>
                {chart === "points" ? (
                  <PointsVsAverageChart data={rows} />
                ) : chart === "rank" ? (
                  <RankChart data={rows} />
                ) : (
                  <AdvantageChart rows={rows} />
                )}
              </div>
              {chart === "points" && (
                <div className="mt-3 flex justify-center gap-5 text-[10px] text-fg-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    Your points
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 border-t border-dashed border-fg-subtle" />
                    Global average
                  </span>
                </div>
              )}
              <p className="mt-5 border-t border-border pt-4 text-[10px] leading-5 text-fg-muted">
                {chartMeta.description}
              </p>
            </section>
            <aside className="card analytics-observations">
              <div className="insight-eyebrow">
                <span className="insight-icon">
                  <IconSparkles />
                </span>
                What stands out
              </div>
              <div className="analytics-observation">
                <p>Your strongest return</p>
                <strong>
                  {summary.best?.points}{" "}
                  <span>points · GW{summary.best?.gameweek}</span>
                </strong>
                <small>
                  {summary.best?.averageEntryScore != null
                    ? `${signed(summary.best.points - summary.best.averageEntryScore)} against that week’s average.`
                    : "Your highest-scoring gameweek in this period."}
                </small>
              </div>
              <div className="analytics-observation">
                <p>The rank picture</p>
                <strong>
                  {summary.greenArrows} <span>green arrows</span>
                  <span className="mx-2 text-border-strong">/</span>
                  {summary.redArrows} <span>red</span>
                </strong>
                <small>Each compares with the preceding saved gameweek.</small>
              </div>
              <div className="analytics-observation">
                <p>On your bench</p>
                <strong>
                  {summary.benchPoints} <span>points scored</span>
                </strong>
                <small>
                  A useful rotation check. Legal substitutions determine how
                  many could have counted.
                </small>
                <Link href="/squad" className="text-link mt-3">
                  Review your squad
                  <IconArrowRight />
                </Link>
              </div>
              <div className="analytics-observation">
                <p>Transfer hit costs</p>
                <strong>
                  {summary.hitCost}{" "}
                  <span>
                    points · {summary.hitWeeks} gameweek
                    {summary.hitWeeks === 1 ? "" : "s"}
                  </span>
                </strong>
                <small>
                  Recorded separately from the gameweek scores above.
                </small>
              </div>
            </aside>
          </div>
          <div className="analytics-secondary-grid">
            <section className="card min-w-0 p-5 sm:p-6">
              <div className="analytics-chart-heading">
                <div>
                  <h2>The value of your squad</h2>
                  <p className="panel-subtitle">
                    {summary.latestValue != null
                      ? `£${summary.latestValue.toFixed(1)}m · latest selected snapshot`
                      : "No valuation snapshots available"}
                  </p>
                </div>
                {summary.valueChange != null && (
                  <span
                    className={`rounded-lg px-2 py-1 text-[10px] ${summary.valueChange >= 0 ? "bg-good/10 text-good" : "bg-critical/10 text-critical"}`}
                  >
                    {summary.valueChange >= 0 ? "+" : "−"}£
                    {Math.abs(summary.valueChange).toFixed(1)}m
                  </span>
                )}
              </div>
              <div className="mt-5">
                <AreaTrend
                  data={valueSeries}
                  dataKey="value"
                  label="Squad value"
                  format="money"
                  height={170}
                  color="var(--cyan)"
                />
              </div>
            </section>
            <section className="card p-5 sm:p-6">
              <h2 className="text-[14px] font-semibold">
                The consistency picture
              </h2>
              <p className="panel-subtitle">
                How often did you come out ahead?
              </p>
              <div className="mt-6 flex items-baseline gap-2">
                <strong className="text-4xl font-medium tracking-[-.06em]">
                  {summary.beatRate != null
                    ? `${Math.round(summary.beatRate)}%`
                    : "—"}
                </strong>
                <span className="text-[11px] text-fg-muted">
                  of comparable gameweeks
                </span>
              </div>
              <div className="analytics-consistency-track" aria-hidden="true">
                <span
                  style={{
                    width: `${summary.comparedWeeks ? (summary.wins / summary.comparedWeeks) * 100 : 0}%`,
                    background: "var(--accent)",
                  }}
                />
                <span
                  style={{
                    width: `${summary.comparedWeeks ? (summary.ties / summary.comparedWeeks) * 100 : 0}%`,
                    background: "var(--surface-3)",
                  }}
                />
                <span
                  style={{
                    width: `${summary.comparedWeeks ? ((summary.comparedWeeks - summary.wins - summary.ties) / summary.comparedWeeks) * 100 : 0}%`,
                    background: "var(--critical)",
                  }}
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  ["Above", summary.wins, "var(--accent)"],
                  ["Level", summary.ties, "var(--fg-subtle)"],
                  [
                    "Below",
                    summary.comparedWeeks - summary.wins - summary.ties,
                    "var(--critical)",
                  ],
                ].map(([label, count, color]) => (
                  <div key={label}>
                    <span className="flex items-center gap-1.5 text-[10px] text-fg-muted">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: String(color) }}
                      />
                      {label}
                    </span>
                    <strong className="mt-1 block text-xl font-medium">
                      {count}
                    </strong>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-[10px] leading-5 text-fg-muted">
                Only gameweeks with an available global average are counted. A
                level score is not counted as a win.
              </p>
            </section>
          </div>
          <section className="mt-7">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold">
                  A gameweek at a time
                </h2>
                <p className="panel-subtitle">
                  Your selected period. Select a column heading to sort.
                </p>
              </div>
              <span className="text-[10px] text-fg-subtle">
                {rows.length} snapshots · {scope}
              </span>
            </div>
            <DataTable
              data={rows}
              columns={columns}
              rowKey={(row) => row.gameweek}
              initialSort={{ key: "gameweek", dir: "desc" }}
              dense
            />
            <p className="mt-3 text-[10px] leading-5 text-fg-muted">
              Scores match the warehouse’s reported gameweek totals. Bench
              points and transfer hit costs are listed separately and included
              in the CSV.
            </p>
          </section>
        </>
      )}
    </>
  );
}
