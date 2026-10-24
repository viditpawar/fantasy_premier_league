"use client";

import { useState } from "react";
import Link from "next/link";
import type { SquadPlayer } from "@/lib/types";
import type { TickerFixture, TickerTeam } from "@/lib/queries";
import { fixturesForTeam, playableCount } from "@/lib/planning";
import { PlayerKit } from "./PlayerKit";
import { FDRCell } from "./ui/FDRCell";
import { SegmentedControl } from "./ui/SegmentedControl";

export function SquadOutlook({ squad, teams, fixtures, gameweeks }: { squad: SquadPlayer[]; teams: TickerTeam[]; fixtures: TickerFixture[]; gameweeks: number[] }) {
  const [horizon, setHorizon] = useState(5);
  const [startersOnly, setStartersOnly] = useState(false);
  const weeks = gameweeks.slice(0, horizon);
  const names = new Map(teams.map(t => [t.id, t.shortName]));
  const players = [...squad].filter(p => !startersOnly || p.squadPosition <= 11).sort((a, b) => a.squadPosition - b.squadPosition);
  return <section className="mt-8 space-y-5" aria-labelledby="squad-outlook-title">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="section-label">A little foresight</p><h2 id="squad-outlook-title" className="mt-2 text-xl font-medium tracking-tight">Your squad, a few weeks ahead.</h2></div><div className="flex flex-wrap items-center gap-3"><SegmentedControl ariaLabel="Squad outlook window" value={horizon} onChange={v => setHorizon(Number(v))} options={[3, 5, 8].map(n => ({ label: `${n} weeks`, value: n }))} size="sm" /><button className="button-secondary" aria-pressed={startersOnly} onClick={() => setStartersOnly(!startersOnly)}>{startersOnly ? "Starting XI" : "All fifteen"}</button></div></div>
    {weeks.length ? <div className="card overflow-x-auto"><table className="w-full text-center text-[11px]"><caption className="sr-only">Upcoming fixtures for the saved squad, including blanks and double gameweeks</caption><thead><tr className="border-b border-border text-fg-muted"><th className="sticky left-0 z-10 min-w-36 bg-surface-1 p-4 text-left">Player</th>{weeks.map(gw => <th key={gw} className="min-w-24 p-3">GW{gw}</th>)}</tr></thead><tbody>
      {players.map(p => <tr key={p.playerCode} className="border-b border-border last:border-0"><th scope="row" className="sticky left-0 z-10 bg-surface-1 p-3 text-left"><Link href={`/players/${p.playerCode}`} className="flex items-center gap-2"><PlayerKit code={p.teamCode} goalkeeper={p.position === "GKP"} className="h-7 w-7" /><span>{p.player}<span className="mt-1 block text-[8px] font-normal text-fg-subtle">{p.position} · {p.squadPosition > 11 ? "Bench" : "Starting"}{p.status !== "a" ? " · Check fitness" : ""}</span></span></Link></th>
        {weeks.map(gw => { const entries = fixturesForTeam(fixtures, p.teamId, gw); return <td key={gw} className="p-2">{entries.length ? <div className="flex flex-col gap-1">{entries.map((f, i) => <FDRCell key={i} opponent={names.get(f.opponentId) ?? "?"} wasHome={f.home} difficulty={f.difficulty} />)}{entries.length > 1 && <span className="text-[8px] text-accent">DOUBLE</span>}</div> : <span className="text-[9px] text-warning">BLANK</span>}</td>; })}</tr>)}
    </tbody><tfoot><tr className="border-t border-border bg-surface-0/50"><th className="sticky left-0 bg-surface-1 p-4 text-left font-medium">XI coverage<span className="mt-1 block text-[8px] font-normal text-fg-muted">Across all fifteen</span></th>{weeks.map(gw => {
      const fit = squad.filter(p => p.status === "a" && fixturesForTeam(fixtures, p.teamId, gw).length > 0);
      const count = playableCount(fit.map(p => p.position));
      return <td key={gw} className={`p-3 font-medium ${count < 11 ? "text-warning" : "text-accent"}`}>{count} / 11<span className="mt-1 block text-[8px] font-normal text-fg-muted">available with fixtures</span></td>;
    })}</tr></tfoot></table></div> : <p className="card p-6 text-xs text-fg-muted">No future gameweeks are available.</p>}
    <p className="text-[11px] leading-6 text-fg-muted">Coverage respects FPL formation limits and today&apos;s availability flags. It uses your saved squad, not a prediction of future minutes. Blank means no fixture currently assigned; rescheduling and team news can change this view.</p>
    <Link href="/planner" className="text-link">Explore a transfer plan →</Link>
  </section>;
}
