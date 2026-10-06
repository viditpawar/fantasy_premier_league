"use client";

import Link from "next/link";
import type { PlayerDetail } from "@/lib/types";
import { FDRCell } from "./ui/FDRCell";
import { money, positionColor } from "@/lib/format";

const PHOTO = (code: number) =>
  `https://resources.premierleague.com/premierleague/photos/players/110x140/p${code}.png`;

interface Row {
  label: string;
  get: (d: PlayerDetail) => number;
  fmt?: (n: number) => string;
  higherIsBetter?: boolean;
}

const ROWS: Row[] = [
  { label: "Price", get: (d) => d.meta.nowCost, fmt: money, higherIsBetter: false },
  { label: "Total points", get: (d) => d.meta.totalPoints },
  { label: "Points / game", get: (d) => d.meta.pointsPerGame, fmt: (n) => n.toFixed(1) },
  { label: "Form (5)", get: (d) => d.meta.form5 },
  { label: "Goals", get: (d) => d.meta.goals },
  { label: "Assists", get: (d) => d.meta.assists },
  { label: "Clean sheets", get: (d) => d.meta.cleanSheets },
  { label: "Bonus", get: (d) => d.meta.bonus },
  { label: "Minutes", get: (d) => d.meta.minutes },
  { label: "ICT index", get: (d) => d.meta.ictIndex, fmt: (n) => n.toFixed(1) },
  { label: "Pts / £m", get: (d) => d.meta.pointsPerMillion, fmt: (n) => n.toFixed(1) },
  {
    label: "Ownership",
    get: (d) => d.meta.ownership ?? 0,
    fmt: (n) => `${n.toFixed(1)}%`,
    higherIsBetter: false,
  },
];

export function ComparePlayers({ details }: { details: PlayerDetail[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="sticky left-0 z-10 w-28 bg-surface-1 px-3 py-3 text-left" />
            {details.map((d) => (
              <th key={d.meta.playerCode} className="px-3 py-3 text-center">
                <Link href={`/players/${d.meta.playerCode}`} className="group inline-flex flex-col items-center gap-1">
                  <div className="relative">
                    <div
                      className="absolute -inset-1 rounded-lg opacity-30 blur-md"
                      style={{ background: positionColor(d.meta.position) }}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={PHOTO(d.meta.playerCode)}
                      alt=""
                      className="relative h-14 w-11 rounded-md bg-surface-2 object-cover object-top"
                    />
                  </div>
                  <span className="max-w-[6rem] truncate text-xs font-bold text-fg group-hover:text-accent">
                    {d.meta.player}
                  </span>
                  <span className="text-[10px] text-fg-subtle">
                    {d.meta.team} · {d.meta.position}
                  </span>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const values = details.map((d) => row.get(d));
            const best = row.higherIsBetter === false ? Math.min(...values) : Math.max(...values);
            return (
              <tr key={row.label} className="border-b border-border/60 last:border-0">
                <td className="sticky left-0 z-10 bg-surface-1 px-3 py-2 text-xs font-semibold text-fg-muted">
                  {row.label}
                </td>
                {details.map((d, i) => {
                  const v = values[i];
                  const isBest = v === best && values.some((x) => x !== best);
                  return (
                    <td key={d.meta.playerCode} className="px-3 py-2 text-center">
                      <span
                        className={`tabular-nums ${isBest ? "font-extrabold text-accent" : "text-fg"}`}
                      >
                        {row.fmt ? row.fmt(v) : v}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr>
            <td className="sticky left-0 z-10 bg-surface-1 px-3 py-2 align-top text-xs font-semibold text-fg-muted">
              Next fixtures
            </td>
            {details.map((d) => (
              <td key={d.meta.playerCode} className="px-3 py-2 align-top">
                <div className="flex flex-col items-center gap-1">
                  {d.upcomingFixtures.slice(0, 3).map((f, i) => (
                    <FDRCell
                      key={i}
                      opponent={f.opponent}
                      wasHome={f.wasHome}
                      difficulty={f.difficulty}
                      size="sm"
                    />
                  ))}
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
