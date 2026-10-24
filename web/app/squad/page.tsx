import type { Metadata } from "next";
import Link from "next/link";
import { getWorkspace } from "@/lib/workspace";
import { getBudget, getGameweekMeta, getLatestGameweek, getLiveGameweek, getSquad } from "@/lib/queries";
import { money } from "@/lib/format";
import { SquadView } from "@/components/SquadView";
import { PlayerKit } from "@/components/PlayerKit";
import { Hero } from "@/components/ui/Hero";
import { FDRCell } from "@/components/ui/FDRCell";
import { IconArrowRight, IconBolt, IconPitch, IconShield } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My squad" };
export default async function SquadPage() {
  const { sb, season, teamId, team } = await getWorkspace();
  const gameweek = await getLatestGameweek(sb, teamId, season);
  const [squad, budget, meta, live] = await Promise.all([getSquad(sb, teamId, season, gameweek), getBudget(sb, teamId, season, gameweek), getGameweekMeta(sb, season), getLiveGameweek(sb, teamId, season).catch(() => null)]);
  const starting = squad.filter((p) => p.squadPosition <= 11);
  const bench = squad.filter((p) => p.squadPosition > 11).sort((a, b) => a.squadPosition - b.squadPosition);
  const captain = squad.find((p) => p.isCaptain);
  const vice = squad.find((p) => p.isViceCaptain);
  const flags = squad.filter((p) => p.status !== "a");
  const isLive = !!meta.current && !meta.current.finished && live?.gameweek === meta.current.id;
  return <main className="page-container animate-fade-in">
    <Hero title="Your fifteen. Your game." eyebrow={`${season} · Gameweek ${gameweek}`} icon={<IconPitch />} subtitle={`${team}. Every player, every fixture, every possibility.`} action={<Link href="/live" className="button-secondary"><IconBolt />Match centre<IconArrowRight /></Link>} stats={[{ label: "Season points", value: budget.totalPoints.toLocaleString("en-GB"), accent: true }, { label: "Overall rank", value: budget.overallRank ? `#${budget.overallRank.toLocaleString("en-GB")}` : "—" }, { label: "Squad value", value: money(budget.teamValue) }, { label: "In the bank", value: money(budget.bank) }]} />
    <div className="overview-grid">
      <div className="min-w-0"><SquadView starting={starting} bench={bench} liveByCode={isLive && live ? new Map(live.players.map((p) => [p.playerCode, p.livePoints])) : undefined} /><p className="mt-4 text-[10px] leading-6 text-fg-muted">This is your saved GW{gameweek} selection. Make changes to your starting XI on the official FPL website.</p><a href="https://fantasy.premierleague.com/my-team" target="_blank" rel="noreferrer" className="text-link mt-1">Manage team on FPL ↗</a></div>
      <div className="flex min-w-0 flex-col gap-5">
        {captain && <section className="card insight-card"><div className="insight-eyebrow"><span className="insight-icon"><IconShield /></span>Leading the way</div><div className="mt-6 flex items-center gap-4"><PlayerKit code={captain.teamCode} className="h-20 w-20" /><div><span className="section-label">Your captain</span><h2 className="!mt-1">{captain.player}</h2><p className="mt-1 text-[11px] text-fg-muted">{captain.team} · {money(captain.nowCost)}</p></div></div><div className="mt-5 flex flex-wrap gap-2">{captain.upcomingFixtures.map((fixture, i) => <FDRCell key={i} {...fixture} />)}</div>{vice && <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-[11px]"><span className="text-fg-muted">Vice-captain</span><Link href={`/players/${vice.playerCode}`} className="text-accent">{vice.player}</Link></div>}<Link href="/transfers" className="text-link mt-5">Explore captaincy advice<IconArrowRight /></Link></section>}
        <section className="card insight-card"><div className="flex items-center justify-between"><h2 className="!mt-0 !text-[13px]">Squad availability</h2><span className={`rounded-md px-2 py-1 text-[9px] ${flags.length ? "bg-warning/10 text-warning" : "bg-good/10 text-good"}`}>{flags.length ? `${flags.length} to check` : "All clear"}</span></div>{flags.length ? <div className="mt-4">{flags.map((p) => <Link href={`/players/${p.playerCode}`} key={p.playerCode} className="block border-t border-border py-3 first:border-0"><strong className="text-[11px] font-medium">{p.player}</strong><p className="mt-1 text-[10px] leading-5 text-fg-muted">{p.news || ({ d: "Doubtful for the next fixture", i: "Injured", s: "Suspended", u: "Unavailable" }[p.status] ?? "Check player status")}</p></Link>)}</div> : <p className="insight-copy mt-4">All fifteen players are marked available in the latest snapshot. Check team news again before the deadline.</p>}</section>
        <section className="rounded-2xl border border-border px-5 py-5"><p className="section-label">A little perspective</p><p className="mt-3 text-[12px] leading-6 text-fg-muted">A strong bench matters. Your substitutes appear in the order they would enter your team.</p><Link href="/fixtures" className="text-link mt-4">Plan the fixtures ahead<IconArrowRight /></Link></section>
      </div>
    </div>
  </main>;
}
