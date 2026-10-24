"use client";
import { useState } from "react";
import Link from "next/link";
import type { SquadPlayer } from "@/lib/types";
import { PlayerSheetProvider, usePlayerSheet } from "./PlayerSheetProvider";
import { PlayerCard } from "./PlayerCard";
import { PlayerKit } from "./PlayerKit";
import { SegmentedControl } from "./ui/SegmentedControl";
import { FDRCell } from "./ui/FDRCell";
import { IconArrowRight } from "./icons";
import { money } from "@/lib/format";

export function FieldLines({ className = "pitch-lines" }: { className?: string }) {
  return <svg viewBox="0 0 400 440" preserveAspectRatio="none" className={className} fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true"><rect x="1" y="1" width="398" height="438" rx="3" /><path d="M0 220h400M120 0v64h160V0M157 0v25h86V0M120 440v-64h160v64M157 440v-25h86v25" /><ellipse cx="200" cy="220" rx="49" ry="45" /><path d="M165 64a40 40 0 0 0 70 0M165 376a40 40 0 0 1 70 0" /><circle cx="200" cy="220" r="2" fill="currentColor" /></svg>;
}
interface ViewProps { starting: SquadPlayer[]; bench: SquadPlayer[]; liveByCode?: Map<number, number>; compact?: boolean; }
function ListRows({ players, liveByCode }: { players: SquadPlayer[]; liveByCode?: Map<number, number> }) {
  const { open } = usePlayerSheet();
  return <div className="mx-4 overflow-hidden rounded-xl border border-border"><div className="flex justify-between bg-surface-0 px-4 py-2 text-[9px] text-fg-muted"><span>Player</span><span>Price / Points</span></div>{players.map((p) => <button key={p.playerCode} onClick={() => open(p)} className="flex w-full items-center gap-3 border-t border-border px-3 py-3 text-left transition-colors hover:bg-surface-0"><PlayerKit code={p.teamCode} className="h-8 w-8 shrink-0" goalkeeper={p.position === "GKP"} /><div className="min-w-0 flex-1"><strong className="block truncate text-[11px] font-medium">{p.player} {p.isCaptain ? "(C)" : p.isViceCaptain ? "(V)" : ""}</strong><span className="text-[9px] text-fg-muted">{p.team} · {p.position}</span></div>{p.upcomingFixtures[0] && <span className="hidden sm:inline-flex"><FDRCell {...p.upcomingFixtures[0]} size="sm" /></span>}<span className="text-[10px] text-fg-muted">{money(p.nowCost)}</span><span className="w-7 text-right text-[12px] font-semibold">{(liveByCode?.get(p.playerCode) ?? p.lastGameweekPoints) * (p.multiplier || 1)}</span></button>)}</div>;
}
export function SquadView({ starting, bench, liveByCode, compact = false }: ViewProps) {
  const [view, setView] = useState<"pitch" | "list">("pitch");
  const rows = (["GKP", "DEF", "MID", "FWD"] as const).map((position) => starting.filter((p) => p.position === position).sort((a, b) => a.squadPosition - b.squadPosition)).filter((row) => row.length);
  const formation = rows.filter((row) => row[0].position !== "GKP").map((row) => row.length).join("–");
  return <PlayerSheetProvider><section className="card overflow-hidden" aria-label="Squad formation">
    <div className="pitch-toolbar"><div><h2>{compact ? "Your starting eleven" : "Your matchday squad"}</h2><p className="panel-subtitle">{formation ? `${formation} formation` : "Your squad"}<span className="mx-1.5 text-border-strong">·</span>Select a player for details</p></div><SegmentedControl size="sm" ariaLabel="Squad view" value={view} onChange={setView} options={[{ label: "Pitch", value: "pitch" }, { label: "List", value: "list" }]} /></div>
    {starting.length === 0 ? <p className="px-6 py-16 text-center text-xs text-fg-muted">Your squad will appear when your next snapshot is available.</p> : view === "pitch" ? <>
      <div className="pitch-surface"><FieldLines />{rows.map((row, i) => <div key={i} className="pitch-row">{row.map((p) => <PlayerCard key={p.playerCode} player={p} live={liveByCode?.get(p.playerCode)} />)}</div>)}</div>
      {!compact && bench.length > 0 && <><div className="section-label mx-6 mt-5">On the bench · in substitution order</div><div className="bench-grid">{bench.map((p) => <PlayerCard key={p.playerCode} player={p} live={liveByCode?.get(p.playerCode)} />)}</div></>}
    </> : <ListRows players={compact ? starting : [...starting, ...bench]} liveByCode={liveByCode} />}
    <div className="squad-footer"><span><span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent/10 text-[7px] text-accent">C</span> Captain<span className="mx-2 text-border-strong">·</span>Points include captain multiplier</span><Link href={compact ? "/squad" : "/players"} className="text-link">{compact ? "Full squad" : "Explore players"}<IconArrowRight /></Link></div>
  </section></PlayerSheetProvider>;
}
