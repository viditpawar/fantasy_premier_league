import type { Metadata } from "next";
import Link from "next/link";
import { getPlanningWorkspace } from "@/lib/planning-workspace";
import { GameweekPrep } from "@/components/GameweekPrep";
import { DeadlineCountdown } from "@/components/DeadlineCountdown";
import { CalendarExport } from "@/components/CalendarExport";
import { PlayerKit } from "@/components/PlayerKit";
import { IconArrowRight, IconPitch, IconShield, IconSparkles, IconUsers } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gameweek HQ" };
export default async function GameweekPage() {
  const ws = await getPlanningWorkspace();
  const risks = ws.studioPlayers.filter(p => p.status !== "a" || (p.chance != null && p.chance < 100));
  const captain = ws.squad.find(p => p.isCaptain);
  return <main className="page-container animate-fade-in">
    <header className="workspace-intro"><div><p className="page-eyebrow">Your preparation, in one place</p><h1 className="large-title">Gameweek HQ<span className="text-accent">.</span></h1><p className="page-description">A clear head. A checked bench. A plan before the deadline.</p></div><span className="edition-tag">{ws.target ? `GAMEWEEK ${String(ws.target).padStart(2, "0")}` : "OFF SEASON"}</span></header>
    <div className="hq-layout"><div className="hq-primary"><section className="deadline-feature"><div className="section-label">{ws.target ? `GW${ws.target} · The clock is ticking` : "The next deadline"}</div><DeadlineCountdown deadline={ws.deadline} /><p>{ws.deadline ? new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "America/Phoenix" }).format(new Date(ws.deadline)) + " MST" : "Your preparation can start before the next calendar arrives."}</p><CalendarExport deadline={ws.deadline} gameweek={ws.target} season={ws.season} /><span className="deadline-feature-orbit" aria-hidden="true" /></section><GameweekPrep season={ws.season} teamId={ws.teamId} gameweek={ws.target} /></div>
    <aside className="hq-aside"><section className="card workspace-panel"><div className="section-label flex items-center gap-2"><IconShield className="h-4 w-4" />Squad pulse</div><div className="pulse-numbers"><div><strong>{ws.squad.length}</strong><span>Players reviewed</span></div><div><strong className={risks.length ? "text-warning" : "text-good"}>{risks.length}</strong><span>Availability flags</span></div></div><p className="workspace-copy">Saved GW{ws.sourceGameweek} squad. Check My Team for moves made since that deadline.</p>{risks.map(p => <Link key={p.code} href={`/players/${p.code}`} className="pulse-player"><PlayerKit code={p.teamCode} className="h-9 w-9" /><span><strong>{p.name}</strong><small>{p.chance == null ? "Check team news" : `${p.chance}% availability flag`}</small></span><IconArrowRight className="ml-auto h-4 w-4" /></Link>)}{!risks.length && <p className="status-positive"><IconShield className="h-4 w-4" />No current availability flags. Minutes can still change.</p>}</section>
      {captain && <section className="card workspace-panel captain-mini"><PlayerKit code={captain.teamCode} className="h-20 w-20" /><div><span className="section-label">Last locked captain</span><h2>{captain.player}</h2><p className="workspace-copy">Try your next armband in the lineup studio.</p></div></section>}
      <section className="card workspace-panel"><span className="section-label">A few useful next steps</span>{[{ href: "/lineup", label: "Rehearse your lineup", sub: "Formation, armbands and automatic subs", icon: IconPitch }, { href: "/lab", label: "Research your next pick", sub: "Value, fixture runs and differentials", icon: IconUsers }, { href: "/transfers", label: "Review saved advice", sub: "Check its gameweek and freshness", icon: IconSparkles }].map(({ href, label, sub, icon: Icon }) => <Link href={href} className="tool-link" key={href}><span className="tool-link-icon"><Icon /></span><span><strong>{label}</strong><small>{sub}</small></span><IconArrowRight className="ml-auto h-4 w-4" /></Link>)}</section>
    </aside></div>
  </main>;
}
