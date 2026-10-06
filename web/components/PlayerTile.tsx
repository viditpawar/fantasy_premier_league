"use client";

import type { PlayerSeasonRow } from "@/lib/types";
import { Sparkline } from "./ui/Sparkline";
import { money, positionColor } from "@/lib/format";

const SHIRT_URL = (code: number) =>
  `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}-66.png`;

const STATUS_DOT: Record<string, string> = {
  a: "var(--good)",
  d: "var(--warning)",
  i: "var(--critical)",
  s: "var(--critical)",
  u: "var(--fg-subtle)",
  n: "var(--fg-subtle)",
};

export function PlayerTile({
  player: p,
  selected,
  onToggleSelect,
  onOpen,
}: {
  player: PlayerSeasonRow;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
}) {
  const accent = positionColor(p.position);
  return (
    <div
      className={`card card-hover relative cursor-pointer overflow-hidden px-3.5 py-3.5 transition-shadow ${
        selected ? "ring-2 ring-accent" : ""
      }`}
      onClick={onOpen}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{ background: `radial-gradient(90% 90% at 100% 0%, ${accent}, transparent 60%)` }}
      />
      <div className="relative flex items-start justify-between">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
            selected ? "border-accent bg-accent text-white" : "border-border-strong text-transparent hover:border-accent"
          }`}
          aria-label={selected ? `Remove ${p.player} from compare` : `Add ${p.player} to compare`}
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
          style={{ background: accent }}
        >
          {p.position}
        </span>
      </div>

      <div className="relative -mt-1 mb-1 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SHIRT_URL(p.teamCode)} alt="" className="h-14 w-14 object-contain drop-shadow-md" />
        <span
          className="absolute bottom-0 right-1/2 h-2 w-2 translate-x-6 rounded-full ring-2 ring-surface-1"
          style={{ background: STATUS_DOT[p.status] ?? "var(--fg-subtle)" }}
        />
      </div>

      <div className="relative text-center">
        <div className="flex items-center justify-center gap-1">
          <span className="truncate text-sm font-bold text-fg">{p.player}</span>
          {p.inSquad && (
            <span className="shrink-0 rounded bg-accent/15 px-1 py-0.5 text-[9px] font-extrabold text-accent">
              OWN
            </span>
          )}
        </div>
        <div className="text-[11px] text-fg-subtle">
          {p.team} · {money(p.nowCost)}
        </div>
      </div>

      <div className="relative mt-2.5 flex items-center justify-between border-t border-border pt-2">
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-extrabold tabular-nums text-fg">{p.totalPoints}</span>
          <span className="text-[10px] text-fg-subtle">pts</span>
        </div>
        {p.formSeries.length > 1 && (
          <Sparkline data={p.formSeries} width={40} height={16} stroke={accent} />
        )}
        <span className="text-[11px] font-semibold text-fg-muted">
          {p.ownership != null ? `${p.ownership.toFixed(1)}%` : "—"}
        </span>
      </div>

    </div>
  );
}
