"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TickerFixture, TickerTeam } from "@/lib/queries";
import { SegmentedControl } from "./ui/SegmentedControl";
import { CREST_URL, fdrColor, fdrLabel } from "@/lib/format";
import { IconSearch, IconStar } from "./icons";

type Mode = "overall" | "attack" | "defence";
type Win = 3 | 5 | 8;

interface Cell {
  gameweek: number;
  entries: { opp: string; home: boolean; diff: number }[];
}

const LEGEND: { diff: number; label: string }[] = [
  { diff: 1, label: "Very easy" },
  { diff: 2, label: "Easy" },
  { diff: 3, label: "Average" },
  { diff: 4, label: "Hard" },
  { diff: 5, label: "Very hard" },
];

/** Map a raw opponent-strength number (~1000–1400) onto the 1–5 FDR scale. */
function strengthToFdr(strength: number): number {
  if (strength >= 1320) return 5;
  if (strength >= 1230) return 4;
  if (strength >= 1140) return 3;
  if (strength >= 1060) return 2;
  return 1;
}

export function FixtureTicker({
  teams,
  fixtures,
  gameweeks,
  owned,
}: {
  teams: TickerTeam[];
  fixtures: TickerFixture[];
  gameweeks: number[];
  owned: number[];
}) {
  const [win, setWin] = useState<Win>(5);
  const [mode, setMode] = useState<Mode>("overall");
  const [sortBy, setSortBy] = useState<"fdr" | "name">("fdr");
  const [query, setQuery] = useState("");

  const ownedSet = useMemo(() => new Set(owned), [owned]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const window = gameweeks.slice(0, win);
  const windowSet = useMemo(() => new Set(window), [window]);

  const rows = useMemo(() => {
    const byTeam = new Map<number, Cell[]>();
    for (const t of teams) byTeam.set(t.id, window.map((gw) => ({ gameweek: gw, entries: [] })));

    const diffFor = (oppId: number, meHome: boolean, fplDiff: number | null): number => {
      const opp = teamById.get(oppId);
      if (mode === "overall" || !opp) return fplDiff ?? 3;
      if (mode === "attack") {
        // how hard is it to score → opponent's defensive strength
        return strengthToFdr(meHome ? opp.strengthDefenceAway : opp.strengthDefenceHome);
      }
      // defence: how hard is it to keep a clean sheet → opponent's attacking strength
      return strengthToFdr(meHome ? opp.strengthAttackAway : opp.strengthAttackHome);
    };

    for (const f of fixtures) {
      if (!windowSet.has(f.gameweek)) continue;
      const h = byTeam.get(f.teamH);
      const a = byTeam.get(f.teamA);
      const hCell = h?.find((c) => c.gameweek === f.gameweek);
      const aCell = a?.find((c) => c.gameweek === f.gameweek);
      if (hCell)
        hCell.entries.push({
          opp: teamById.get(f.teamA)?.shortName ?? "?",
          home: true,
          diff: diffFor(f.teamA, true, f.diffH),
        });
      if (aCell)
        aCell.entries.push({
          opp: teamById.get(f.teamH)?.shortName ?? "?",
          home: false,
          diff: diffFor(f.teamH, false, f.diffA),
        });
    }

    const result = teams.map((t) => {
      const cells = byTeam.get(t.id)!;
      const playedCells = cells.filter((c) => c.entries.length > 0);
      const total = cells.reduce(
        (s, c) => s + (c.entries.length ? c.entries.reduce((x, e) => x + e.diff, 0) : 3),
        0,
      );
      const avg = playedCells.length ? total / playedCells.length : 3;
      return { team: t, cells, score: total, avg, owned: ownedSet.has(t.id) };
    });

    const filtered = query.trim()
      ? result.filter((r) => r.team.shortName.toLowerCase().includes(query.trim().toLowerCase()))
      : result;

    filtered.sort((x, y) =>
      sortBy === "name" ? x.team.shortName.localeCompare(y.team.shortName) : x.score - y.score,
    );
    return filtered;
  }, [teams, fixtures, window, windowSet, teamById, mode, sortBy, ownedSet, query]);

  const scores = rows.map((r) => r.score);
  const minScore = scores.length ? Math.min(...scores) : 0;
  const maxScore = scores.length ? Math.max(...scores) : 1;
  const scoreRange = Math.max(1, maxScore - minScore);

  const easiest = useMemo(
    () => [...rows].sort((a, b) => a.avg - b.avg)[0],
    [rows],
  );
  const hardest = useMemo(
    () => [...rows].sort((a, b) => b.avg - a.avg)[0],
    [rows],
  );
  const ownedRows = rows.filter((r) => r.owned);
  const ownedAvg = ownedRows.length
    ? ownedRows.reduce((s, r) => s + r.avg, 0) / ownedRows.length
    : null;

  return (
    <div>
      {(easiest || hardest || ownedAvg != null) && (
        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {easiest && (
            <div className="card card-hover flex items-center gap-3 px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CREST_URL(easiest.team.code)} alt="" className="h-8 w-8 object-contain" />
              <div className="min-w-0">
                <div className="section-label">Easiest run</div>
                <div className="truncate font-bold text-fg">{easiest.team.shortName}</div>
              </div>
              <span
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                style={{ background: fdrColor(Math.round(easiest.avg)) }}
              >
                {easiest.avg.toFixed(1)}
              </span>
            </div>
          )}
          {hardest && (
            <div className="card card-hover flex items-center gap-3 px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CREST_URL(hardest.team.code)} alt="" className="h-8 w-8 object-contain" />
              <div className="min-w-0">
                <div className="section-label">Hardest run</div>
                <div className="truncate font-bold text-fg">{hardest.team.shortName}</div>
              </div>
              <span
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                style={{ background: fdrColor(Math.round(hardest.avg)) }}
              >
                {hardest.avg.toFixed(1)}
              </span>
            </div>
          )}
          {ownedAvg != null && (
            <div className="card card-hover flex items-center gap-3 px-4 py-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ background: "color-mix(in oklab, var(--accent) 18%, transparent)" }}
              >
                <IconStar className="h-4 w-4 text-accent" />
              </span>
              <div className="min-w-0">
                <div className="section-label">Your squad avg</div>
                <div className="truncate font-bold text-fg">{ownedRows.length} clubs</div>
              </div>
              <span
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                style={{ background: fdrColor(Math.round(ownedAvg)) }}
              >
                {ownedAvg.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SegmentedControl
          size="sm"
          ariaLabel="Gameweek window"
          value={win}
          onChange={(v) => setWin(v as Win)}
          options={[
            { label: "Next 3", value: 3 },
            { label: "Next 5", value: 5 },
            { label: "Next 8", value: 8 },
          ]}
        />
        <SegmentedControl
          size="sm"
          ariaLabel="Difficulty type"
          value={mode}
          onChange={(v) => setMode(v as Mode)}
          options={[
            { label: "Overall", value: "overall" },
            { label: "Attack", value: "attack" },
            { label: "Defence", value: "defence" },
          ]}
        />
        <SegmentedControl
          size="sm"
          ariaLabel="Sort"
          value={sortBy}
          onChange={(v) => setSortBy(v as "fdr" | "name")}
          options={[
            { label: "Easiest", value: "fdr" },
            { label: "A–Z", value: "name" },
          ]}
        />
        <div className="relative ml-auto">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter club…"
            className="w-36 rounded-full border border-border bg-surface-1 py-1.5 pl-8 pr-3 text-xs text-fg outline-none transition-colors focus:border-accent sm:w-44"
          />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-center text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wide text-fg-subtle">
              <th className="sticky left-0 top-0 z-20 bg-surface-1 px-3 py-2.5 text-left">Club</th>
              {window.map((gw) => (
                <th key={gw} className="sticky top-0 z-10 bg-surface-1 px-1 py-2.5">
                  GW{gw}
                </th>
              ))}
              <th className="sticky top-0 z-10 bg-surface-1 px-2 py-2.5">Run</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ team, cells, score, owned }, i) => (
              <tr
                key={team.id}
                className={`border-b border-border/60 transition-colors last:border-0 hover:bg-surface-2/70 ${
                  owned
                    ? "bg-[color-mix(in_oklab,var(--accent)_7%,transparent)]"
                    : i % 2 === 1
                      ? "bg-surface-2/25"
                      : ""
                }`}
              >
                <td
                  className={`sticky left-0 z-10 px-3 py-2 text-left font-bold ${
                    owned ? "bg-[color-mix(in_oklab,var(--accent)_7%,var(--surface-1))]" : i % 2 === 1 ? "bg-surface-2/25" : "bg-surface-1"
                  }`}
                >
                  <Link
                    href={`/fixtures?team=${team.id}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={CREST_URL(team.code)} alt="" className="h-5 w-5 shrink-0 object-contain" />
                    <span className={owned ? "text-accent" : "text-fg"}>{team.shortName}</span>
                    {owned && <IconStar className="h-3 w-3 shrink-0 text-accent" />}
                  </Link>
                </td>
                {cells.map((c) => (
                  <td key={c.gameweek} className="px-1 py-1.5">
                    {c.entries.length === 0 ? (
                      <span className="block rounded bg-surface-2 py-1 text-fg-subtle">—</span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {c.entries.map((e, i) => (
                          <span
                            key={i}
                            className="block rounded py-1 font-semibold text-white"
                            style={{ background: fdrColor(e.diff) }}
                            title={`${e.opp} (${e.home ? "H" : "A"}) — ${fdrLabel(e.diff)}`}
                          >
                            {e.opp} {e.home ? "(H)" : "(A)"}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                ))}
                <td className="px-2 py-1.5">
                  <div className="mx-auto flex w-16 flex-col items-center gap-1">
                    <span className="font-extrabold tabular-nums text-fg-muted">{score}</span>
                    <span className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                      <span
                        className="block h-full rounded-full transition-all"
                        style={{
                          width: `${100 - ((score - minScore) / scoreRange) * 100}%`,
                          background: fdrColor(Math.round(score / (window.length || 1))),
                        }}
                      />
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={window.length + 2} className="px-4 py-8 text-fg-subtle">
                  No clubs match &ldquo;{query}&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {LEGEND.map((l) => (
          <span key={l.diff} className="inline-flex items-center gap-1.5 text-[11px] text-fg-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: fdrColor(l.diff) }} />
            {l.label}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-fg-subtle">
        Overall uses FPL&apos;s fixture difficulty. Attack / Defence are derived from opponent
        strength ratings and estimate how hard it is to return attacking points / keep a clean sheet.
        Lower run score = easier fixtures over the window.
      </p>
    </div>
  );
}
