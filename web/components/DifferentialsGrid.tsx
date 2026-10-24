"use client";

import { useRouter } from "next/navigation";
import type { PlayerSeasonRow } from "@/lib/types";
import { money, positionColor } from "@/lib/format";
import { PlayerKit } from "./PlayerKit";

export function DifferentialsGrid({ players }: { players: PlayerSeasonRow[] }) {
  const router = useRouter();
  if (players.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {players.map((p) => (
        <button
          key={p.playerCode}
          onClick={() => router.push(`/players/${p.playerCode}`)}
          className="card card-hover relative overflow-hidden px-3 py-3 text-left"
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
            style={{ background: positionColor(p.position) }}
          />
          <div className="mb-1.5 flex items-center justify-between">
            <PlayerKit code={p.teamCode} goalkeeper={p.position === "GKP"} className="h-9 w-9" />
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-fg-muted">
              {p.ownership != null ? `${p.ownership.toFixed(1)}%` : "—"}
            </span>
          </div>
          <div className="truncate text-sm font-bold text-fg">{p.player}</div>
          <div className="text-[11px] text-fg-subtle">
            {p.team} · {money(p.nowCost)}
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-lg font-extrabold tabular-nums text-fg">{p.totalPoints}</span>
            <span className="text-[10px] text-fg-subtle">pts</span>
          </div>
          {p.inSquad && <span className="mt-2 block text-[9px] text-accent">In your squad</span>}
          {p.status !== "a" && <span className="mt-2 block text-[9px] text-warning">Check availability</span>}
        </button>
      ))}
    </div>
  );
}
