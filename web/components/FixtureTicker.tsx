"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TickerFixture, TickerTeam } from "@/lib/queries";
import { SegmentedControl } from "./ui/SegmentedControl";
import { fdrColor, fdrLabel } from "@/lib/format";

type Mode = "overall" | "attack" | "defence";
type Win = 3 | 5 | 8;

interface Cell {
  gameweek: number;
  entries: { opp: string; home: boolean; diff: number }[];
}

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
      const score = cells.reduce(
        (s, c) => s + (c.entries.length ? c.entries.reduce((x, e) => x + e.diff, 0) : 3),
        0,
      );
      return { team: t, cells, score, owned: ownedSet.has(t.id) };
    });

    result.sort((x, y) =>
      sortBy === "name" ? x.team.shortName.localeCompare(y.team.shortName) : x.score - y.score,
    );
    return result;
  }, [teams, fixtures, window, windowSet, teamById, mode, sortBy, ownedSet]);

  return (
    <div>
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
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-center text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wide text-fg-subtle">
              <th className="sticky left-0 z-10 bg-surface-1 px-3 py-2 text-left">Team</th>
              {window.map((gw) => (
                <th key={gw} className="px-1 py-2">
                  GW{gw}
                </th>
              ))}
              <th className="px-2 py-2">Σ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ team, cells, score, owned }) => (
              <tr key={team.id} className="border-b border-border/60 last:border-0">
                <td
                  className={`sticky left-0 z-10 bg-surface-1 px-3 py-1.5 text-left font-bold ${
                    owned ? "text-accent" : "text-fg"
                  }`}
                >
                  <Link href={`/fixtures?team=${team.id}`} className="hover:underline">
                    {team.shortName}
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
                <td className="px-2 py-1.5 font-extrabold tabular-nums text-fg-muted">{score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-fg-subtle">
        Overall uses FPL&apos;s fixture difficulty. Attack / Defence are derived from opponent
        strength ratings and estimate how hard it is to return attacking points / keep a clean sheet.
      </p>
    </div>
  );
}
