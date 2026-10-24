"use client";
import type { PlayerSeasonRow } from "@/lib/types";
import { Sparkline } from "./ui/Sparkline";
import { PlayerKit } from "./PlayerKit";
import { WatchlistButton } from "./WatchlistButton";
import { money, positionColor } from "@/lib/format";

export function PlayerTile({ player, season, selected, onToggleSelect, onOpen }: { player: PlayerSeasonRow; season: string; selected: boolean; onToggleSelect: () => void; onOpen: () => void }) {
  const accent = positionColor(player.position);
  return <article className={`card card-hover relative overflow-hidden p-5 ${selected ? "ring-2 ring-accent" : ""}`}>
    <div className="flex items-center justify-between"><div className="flex items-center gap-1"><button onClick={onToggleSelect} aria-pressed={selected} aria-label={`${selected ? "Remove" : "Add"} ${player.player} ${selected ? "from" : "to"} compare`} className={`grid h-6 w-6 place-items-center rounded-lg border ${selected ? "border-accent bg-accent text-accent-contrast" : "border-border-strong text-transparent hover:border-accent"}`}><svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4 10-10" /></svg></button><WatchlistButton code={player.playerCode} name={player.player} season={season} compact /></div><span className="rounded-md px-2 py-1 text-[9px] font-medium" style={{ background: `color-mix(in srgb, ${accent} 10%, transparent)`, color: accent }}>{player.position}</span></div>
    <button onClick={onOpen} aria-label={`Open ${player.player}'s profile`} className="mt-2 block w-full text-center"><PlayerKit code={player.teamCode} goalkeeper={player.position === "GKP"} className="mx-auto mb-3 h-16 w-16" /><strong className="block truncate text-[13px] font-medium">{player.player}</strong><span className="mt-1 block text-[10px] text-fg-muted">{player.team} · {money(player.nowCost)}</span></button>
    <div className="mt-4 flex items-end justify-between border-t border-border pt-3"><div><strong className="text-xl font-medium tracking-tight">{player.totalPoints}</strong><span className="ml-1 text-[9px] text-fg-muted">pts</span></div>{player.formSeries.length > 1 && <Sparkline data={player.formSeries} width={42} height={19} stroke="var(--accent)" />}<span className="text-[10px] text-fg-muted">{player.ownership != null ? `${player.ownership.toFixed(1)}%` : "—"}</span></div>
    <div className="mt-3 flex justify-between text-[8px]"><span className={player.status === "a" ? "text-good" : "text-warning"}>{player.status === "a" ? "Available" : "Check availability"}</span>{player.inSquad && <span className="text-accent">In your squad</span>}</div>
  </article>;
}
