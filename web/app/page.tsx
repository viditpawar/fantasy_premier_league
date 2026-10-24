import Link from "next/link";
import type { ReactNode } from "react";
import { getWorkspace } from "@/lib/workspace";
import { getAdvisorSuggestion, getBudget, getGameweekMeta, getLatestGameweek, getLiveGameweek, getManagerAnalytics, getManagerLeagues, getSquad } from "@/lib/queries";
import { compactNumber, money, rankDelta } from "@/lib/format";
import { SquadView, FieldLines } from "@/components/SquadView";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { Deadline } from "@/components/Deadline";
import { IconArrowRight, IconCalendar, IconChart, IconClock, IconPiggyBank, IconSparkles, IconSwap, IconTrendingUp, IconTrophy, IconWallet } from "@/components/icons";

export const dynamic = "force-dynamic";
function Metric({ label, value, hint, icon }: { label: string; value: ReactNode; hint: ReactNode; icon: ReactNode }) {
  return <div className="card metric-card"><div className="metric-label">{label}{icon}</div><div className="metric-value">{value}</div><div className="metric-hint">{hint}</div></div>;
}

export default async function OverviewPage() {
  const { sb, season, teamId, manager } = await getWorkspace();
  const gameweek = await getLatestGameweek(sb, teamId, season);
  const [budget, analytics, squad, meta, live, suggestion, leagues] = await Promise.all([
    getBudget(sb, teamId, season, gameweek), getManagerAnalytics(sb, teamId, season),
    getSquad(sb, teamId, season, gameweek), getGameweekMeta(sb, season),
    getLiveGameweek(sb, teamId, season).catch(() => null),
    getAdvisorSuggestion(sb, teamId, season).catch(() => null),
    getManagerLeagues(sb, teamId, season).catch(() => []),
  ]);
  const latest = analytics.rows.at(-1);
  const previous = analytics.rows.at(-2);
  const delta = rankDelta(latest?.overallRank, previous?.overallRank);
  const isLive = !!meta.current && !meta.current.finished && live?.gameweek === meta.current.id;
  const score = isLive ? live!.liveTotal : latest?.points;
  const average = isLive ? live!.averageEntryScore : latest?.averageEntryScore;
  const vsAverage = score != null && average != null ? score - average : null;
  const classic = leagues.filter((league) => league.leagueType === "classic").slice(0, 3);
  const transfer = suggestion?.recommendedTransfers[0];
  const flagged = squad.filter((p) => p.status !== "a");
  const nextFixtures = [...new Map(squad.filter((p) => p.upcomingFixtures.length).map((p) => [p.teamId, p])).values()].slice(0, 5);

  return <main className="page-container animate-fade-in">
    <header className="page-heading"><div><p className="page-eyebrow">YOUR FANTASY, IN FOCUS</p><h1 className="large-title">The bigger picture<span className="text-accent">.</span></h1><p className="page-description">Welcome back, {manager.split(" ")[0]}. A little clarity for your next great gameweek.</p></div><Link href="/fixtures" className="button-secondary" aria-label="View gameweek fixtures"><IconCalendar />{season} season<IconArrowRight /></Link></header>
    <div className="overview-stats">
      <Metric label="Total points" value={budget.totalPoints.toLocaleString("en-GB")} icon={<IconChart />} hint={<>Across {analytics.rows.length} gameweeks</>} />
      <Metric label="Overall rank" value={compactNumber(budget.overallRank)} icon={<IconTrophy />} hint={delta && delta.direction !== "same" ? <span className={`flex items-center gap-1 ${delta.direction === "up" ? "text-good" : "text-critical"}`}><IconTrendingUp className={delta.direction === "down" ? "rotate-90" : ""} />{delta.direction === "up" ? "Up" : "Down"} {compactNumber(delta.value)} <span className="ml-1 text-fg-muted">this gameweek</span></span> : "Your place in the world"} />
      <Metric label="Squad value" value={money(budget.teamValue)} icon={<IconWallet />} hint="Your current squad valuation" />
      <Metric label="In the bank" value={money(budget.bank)} icon={<IconPiggyBank />} hint={suggestion ? `${suggestion.freeTransfers} free transfer${suggestion.freeTransfers === 1 ? "" : "s"} in latest advice` : "Ready for your next move"} />
    </div>
    <div className="overview-grid">
      <div className="overview-column">
        <PerformanceChart rows={analytics.rows} />
        <SquadView compact starting={squad.filter((p) => p.squadPosition <= 11)} bench={[]} liveByCode={isLive && live ? new Map(live.players.map((p) => [p.playerCode, p.livePoints])) : undefined} />
        <section className="card"><div className="panel-heading"><div><h2>On the horizon</h2><p className="panel-subtitle">The next fixtures for clubs in your squad.</p></div><Link href="/fixtures" className="text-link">Fixture ticker<IconArrowRight /></Link></div><div className="px-6 pb-3 pt-3">{nextFixtures.length === 0 ? <p className="py-5 text-[11px] text-fg-muted">The next fixtures have yet to be confirmed.</p> : nextFixtures.map((p) => { const fixture = p.upcomingFixtures[0]; return <Link href={`/fixtures?team=${p.teamId}`} key={p.teamId} className="flex items-center justify-between gap-3 border-t border-border py-3 first:border-0"><span className="text-[11px] font-medium">{p.team}<span className="mx-3 text-[9px] font-normal text-fg-subtle">vs</span>{fixture.opponent}</span><span className="flex items-center gap-2 text-[9px] text-fg-muted"><span className="hidden sm:inline">{fixture.wasHome ? "Home" : "Away"}</span><span className="rounded-md bg-surface-0 px-2 py-1">FDR {fixture.difficulty ?? "—"}</span><IconArrowRight className="h-3 w-3" /></span></Link>; })}</div></section>
      </div>
      <div className="overview-column">
        <section className="gameweek-card" aria-label="Gameweek snapshot"><FieldLines className="hero-field" /><div className="gameweek-top"><span>Gameweek {isLive ? live!.gameweek : gameweek}</span><span className="soft-badge"><span className="status-dot" />{isLive ? "In progress" : "Latest snapshot"}</span></div><div className="gameweek-score"><strong>{score ?? "—"}</strong><span>points</span></div><p className="gameweek-note">{vsAverage != null ? `${Math.abs(vsAverage)} ${vsAverage >= 0 ? "above" : "below"} the gameweek average` : "Your latest gameweek, in one place."}</p><div className="gameweek-divider"><div><strong>{average ?? "—"}</strong><span>Average points</span></div><div><strong>{isLive ? live!.playersYetToPlay : latest?.pointsOnBench ?? "—"}</strong><span>{isLive ? "Yet to play" : "Bench points"}</span></div><div><strong>{isLive ? live!.captain ?? "—" : squad.find((p) => p.isCaptain)?.player ?? "—"}</strong><span>Your captain</span></div></div><div className="deadline-banner"><IconClock /><div><p>{meta.next ? `${meta.next.name} deadline` : "Next gameweek"}</p><strong><Deadline deadline={meta.next?.deadlineTime ?? null} /></strong></div><Link href="/live" className="ml-auto" aria-label="Open match centre"><IconArrowRight className="h-4 w-4" /></Link></div></section>
        <section className="card insight-card"><div className="insight-eyebrow"><span className="insight-icon"><IconSparkles /></span>Your next move<span className="ml-auto rounded-md border border-border px-1.5 py-1 text-[8px] text-accent">AI INSIGHTS</span></div><h2>{transfer ? "A fresh perspective." : suggestion ? "Sometimes, patience wins." : "A more considered gameplan."}</h2><p className="insight-copy line-clamp-3">{suggestion?.summary || "Your squad, recent form and the fixtures ahead. Bring them together for a thoughtful second opinion."}</p>{transfer && <div className="transfer-mini"><div><small>Transfer out</small><strong>{transfer.player_out}</strong></div><IconSwap className="h-4 w-4 text-fg-subtle" /><div><small>Bring in</small><strong className="text-accent">{transfer.player_in}</strong></div></div>}{flagged.length > 0 && <p className="mt-3 text-[10px] text-warning">{flagged.length} player{flagged.length === 1 ? " needs" : "s need"} an availability check.</p>}<Link href="/transfers" className="button-primary mt-5 w-full">Explore your advice<IconArrowRight /></Link>{suggestion && <p className="mt-3 text-center text-[8px] text-fg-subtle">Advice for GW{suggestion.forGameweek} · You make the final call.</p>}</section>
        <section className="card"><div className="panel-heading"><div><h2>A little healthy competition</h2><p className="panel-subtitle">Your classic leagues.</p></div><IconTrophy className="h-4 w-4 text-fg-subtle" /></div><div className="league-preview">{classic.length ? classic.map((league) => { const change = rankDelta(league.entryRank, league.entryLastRank); return <Link key={league.leagueId} href={`/leagues/${league.leagueId}`}><span className="league-rank">{league.entryRank ?? "—"}</span><div className="min-w-0 flex-1"><strong className="truncate">{league.leagueName}</strong><small>Classic league</small></div>{change && change.direction !== "same" && <span className={`text-[9px] ${change.direction === "up" ? "text-good" : "text-critical"}`}>{change.direction === "up" ? "↑" : "↓"} {change.value}</span>}<IconArrowRight className="h-3 w-3 text-fg-subtle" /></Link>; }) : <p className="py-3 text-[11px] text-fg-muted">Your league standings will appear here when available.</p>}<Link href="/leagues" className="text-link !justify-center !pt-4">All leagues & cups<IconArrowRight /></Link></div></section>
      </div>
    </div>
  </main>;
}
