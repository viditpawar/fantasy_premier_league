import Link from "next/link";
import type { ReactNode } from "react";
import { getPlanningWorkspace } from "@/lib/planning-workspace";
import { getAdvisorSuggestion, getBudget, getGameweekMeta, getLiveGameweek, getManagerAnalytics, getManagerLeagues } from "@/lib/queries";
import { compactNumber, money, rankDelta } from "@/lib/format";
import { SquadView, FieldLines } from "./SquadView";
import { PerformanceChart } from "./charts/PerformanceChart";
import { GameweekPrep } from "./GameweekPrep";
import { Deadline } from "./Deadline";
import { PlayerKit } from "./PlayerKit";
import { WatchlistButton } from "./WatchlistButton";
import { IconArrowRight, IconBolt, IconChart, IconClock, IconFlask, IconPitch, IconShield, IconSparkles, IconSwap, IconTarget, IconTrendingUp, IconTrophy, IconWallet } from "./icons";

function Metric({ label, value, hint, icon, accent = false }: { label: string; value: ReactNode; hint: ReactNode; icon: ReactNode; accent?: boolean }) {
  return <div className={`card metric-card ${accent ? "metric-accent" : ""}`}><div className="metric-label">{label}<span>{icon}</span></div><div className="metric-value">{value}</div><div className="metric-hint">{hint}</div></div>;
}

export async function HomeOverview() {
  const ws = await getPlanningWorkspace();
  const { sb, season, teamId, squad, sourceGameweek: gameweek, target, manager } = ws;
  const [budget, analytics, meta, live, suggestion, leagues] = await Promise.all([
    getBudget(sb, teamId, season, gameweek), getManagerAnalytics(sb, teamId, season),
    getGameweekMeta(sb, season), getLiveGameweek(sb, teamId, season).catch(() => null),
    getAdvisorSuggestion(sb, teamId, season).catch(() => null), getManagerLeagues(sb, teamId, season).catch(() => []),
  ]);
  const latest = analytics.rows.at(-1), previous = analytics.rows.at(-2);
  const delta = rankDelta(latest?.overallRank, previous?.overallRank);
  const isLive = !!meta.current && !meta.current.finished && live?.gameweek === meta.current.id;
  const score = isLive ? live!.liveTotal : latest?.points;
  const average = isLive ? live!.averageEntryScore : latest?.averageEntryScore;
  const advantage = score != null && average != null ? score - average : null;
  const classic = leagues.filter(l => l.leagueType === "classic").slice(0, 3);
  const transfer = suggestion?.isCurrent ? suggestion.recommendedTransfers[0] : undefined;
  const flags = squad.filter(p => p.status !== "a");
  const ownedClubs = [...new Map(squad.map(p => [p.teamId, p])).values()].slice(0, 6);
  const radar = ws.players.filter(p => !p.inSquad && p.status === "a" && (p.chanceOfPlaying == null || p.chanceOfPlaying === 100) && p.minutes >= 270).sort((a, b) => b.form5 - a.form5 || a.nowCost - b.nowCost).slice(0, 3);
  return <main className="page-container overview-v2 animate-fade-in">
    <div className="overview-kicker"><span><span className="status-dot" />YOUR SEASON. A CLEARER PICTURE.</span><span>{season} <i>/</i> {target ? `GW ${String(target).padStart(2, "0")} IN FOCUS` : "SEASON REVIEW"}</span></div>
    <div className="overview-intro"><header><p className="welcome-line">Welcome back, {manager.split(" ")[0]} <span>↗</span></p><h1 className="overview-title">Make your<br />next move <em>count.</em></h1><p className="overview-description">Your squad. The numbers. The next deadline.<br className="hidden sm:block" /> A little more clarity for every gameweek.</p><div className="overview-hero-actions"><Link href="/gameweek" className="button-primary">Open gameweek HQ <IconArrowRight /></Link><Link href="/lab" className="button-secondary"><IconFlask />Research lab</Link></div><div className="hero-source-note"><span className="status-dot" />Real FPL data <span>·</span> Your decisions, supported</div></header>
      <section className="matchday-feature" aria-label="Latest gameweek result"><FieldLines className="matchday-lines" /><div className="matchday-top"><span className="section-label">GAMEWEEK {String(isLive ? live!.gameweek : gameweek).padStart(2, "0")}</span><span className="matchday-status"><span className="status-dot" />{isLive ? "IN PROGRESS" : latest?.finished ? "FULL TIME" : "SAVED SNAPSHOT"}</span></div><div className="matchday-score"><strong>{score ?? "—"}</strong><div><span>POINTS</span><p>{advantage == null ? "Your latest snapshot" : `${advantage >= 0 ? "+" : ""}${advantage} vs average`} {advantage != null && advantage >= 0 && <IconTrendingUp />}</p></div></div><div className="matchday-stats"><div><strong>{average ?? "—"}</strong><span>GW average</span></div><div><strong>{isLive ? live!.playersYetToPlay : latest?.pointsOnBench ?? "—"}</strong><span>{isLive ? "Yet to play" : "Bench points"}</span></div><div><strong>{isLive ? live!.captain ?? "—" : squad.find(p => p.isCaptain)?.player ?? "—"}</strong><span>Captain</span></div></div><Link href="/gameweek" className="matchday-deadline"><span className="matchday-clock"><IconClock /></span><span><small>{target ? `GW${target} DEADLINE` : "NEXT DEADLINE"}</small><strong><Deadline deadline={ws.deadline} /></strong></span><IconArrowRight className="ml-auto h-5 w-5" /></Link></section>
    </div>

    <div className="overview-stats">
      <Metric accent label="Season points" value={budget.totalPoints?.toLocaleString("en-GB") ?? "—"} icon={<IconChart />} hint={<><span className="metric-dot" />{analytics.rows.length} recorded gameweeks</>} />
      <Metric label="Overall rank" value={budget.overallRank ? compactNumber(budget.overallRank) : "—"} icon={<IconTrophy />} hint={delta && delta.direction !== "same" ? <span className={delta.direction === "up" ? "text-good" : "text-critical"}>{delta.direction === "up" ? "↗ Up" : "↘ Down"} {compactNumber(delta.value)} since last GW</span> : "Your place in the global standings"} />
      <Metric label="Squad value" value={money(budget.teamValue)} icon={<IconWallet />} hint={`Market value · GW${gameweek} snapshot`} />
      <Metric label="Bank snapshot" value={money(budget.bank)} icon={<IconSwap />} hint={suggestion?.isCurrent && suggestion.freeTransfers != null ? `${suggestion.freeTransfers} free transfer${suggestion.freeTransfers === 1 ? "" : "s"} in confirmed advice` : `GW${gameweek} · check current funds in FPL`} />
    </div>

    <div className="workspace-section-heading"><div><span className="section-label">THE BIGGER PICTURE</span><h2>A season is built one gameweek at a time.</h2></div><Link href="/dashboard" className="text-link">All analytics <IconArrowRight /></Link></div>
    <div className="command-grid"><div className="command-primary"><PerformanceChart rows={analytics.rows} /><SquadView starting={squad.filter(p => p.squadPosition <= 11)} bench={squad.filter(p => p.squadPosition > 11).sort((a, b) => a.squadPosition - b.squadPosition)} liveByCode={isLive && live ? new Map(live.players.map(p => [p.playerCode, p.livePoints])) : undefined} /><Link href="/lineup" className="lineup-callout"><span className="tool-link-icon"><IconPitch /></span><span><strong>A new shape for the next gameweek?</strong><small>Draft your XI, set the armbands and test your bench.</small></span><IconArrowRight className="ml-auto h-5 w-5" /></Link></div>
    <aside className="command-aside"><GameweekPrep season={season} teamId={teamId} gameweek={target} compact />
      <section className="card next-move-card"><div className="flex items-center justify-between"><span className="section-label">THE NEXT MOVE</span><span className="workspace-badge"><IconSparkles />ADVISOR</span></div><h2>{transfer ? "An option worth considering." : suggestion?.isCurrent ? "Patience is a decision, too." : "A considered second opinion."}</h2><p className="workspace-copy">{suggestion?.reviewNote || suggestion?.summary || "Bring your current squad, budget and fixture run together before deciding on a transfer."}</p>{transfer && <div className="transfer-mini"><div><small>Out</small><strong>{transfer.player_out}</strong></div><IconSwap className="h-4 w-4 text-fg-muted" /><div><small>In</small><strong className="text-accent">{transfer.player_in}</strong></div></div>}{flags.length > 0 && <p className="availability-note"><IconShield />{flags.length} player{flags.length === 1 ? " needs" : "s need"} a team-news check.</p>}<Link href="/transfers" className="text-link mt-5">Review your saved advice <IconArrowRight /></Link></section>
      <section className="card fixture-preview"><div className="panel-heading"><div><span className="section-label">ON THE HORIZON</span><h2 className="mt-2">Your next opponents</h2></div><Link href="/fixtures" aria-label="Open fixture ticker" className="icon-button"><IconArrowRight /></Link></div><div className="fixture-preview-list">{ownedClubs.map(p => { const fixtures = p.upcomingFixtures.filter(f => f.gameweek === target); return <Link key={p.teamId} href={`/fixtures?team=${p.teamId}`}><span className="fixture-club"><PlayerKit code={p.teamCode} className="h-8 w-8" /><strong>{p.team}</strong></span><span>{fixtures.length ? fixtures.map(f => `${f.opponent} (${f.wasHome ? "H" : "A"})`).join(" / ") : "No assigned match"}</span><IconArrowRight className="h-3 w-3" /></Link>; })}</div></section>
    </aside></div>

    <div className="workspace-section-heading"><div><span className="section-label">EXPLORE THE POSSIBILITIES</span><h2>Good research gives you options.</h2></div><Link href="/lab" className="text-link">Open the lab <IconArrowRight /></Link></div>
    <div className="research-home-grid">{radar.map((p, i) => <article className="card radar-card" key={p.playerCode}><div className="radar-card-top"><span className="section-label">RECENT FORM · 0{i + 1}</span><WatchlistButton compact code={p.playerCode} name={p.player} season={season} /></div><Link href={`/players/${p.playerCode}`} className="radar-card-player"><PlayerKit code={p.teamCode} goalkeeper={p.position === "GKP"} className="h-16 w-16" /><div><span>{p.team} · {p.position}</span><h3>{p.player}</h3><p>{money(p.nowCost)} <i>·</i> {p.ownership == null ? "Ownership unknown" : `${p.ownership}% owned`}</p></div></Link><div className="radar-card-bottom"><span><strong>{p.form5}</strong> points / last 5 saved GWs</span><Link href={`/players/${p.playerCode}`} aria-label={`Explore ${p.player}`}><IconArrowRight /></Link></div></article>)}</div>
    <p className="workspace-footnote mt-3">A research shortlist ranked by recent recorded points, with at least 270 season minutes. It may include an unfinished gameweek and is not a transfer recommendation.</p>
    <div className="home-bottom-grid"><section className="card workspace-panel"><div className="flex items-center justify-between"><div><span className="section-label">A LITTLE HEALTHY COMPETITION</span><h2 className="mt-2 text-lg font-semibold">The leagues that matter to you</h2></div><IconTrophy className="h-5 w-5 text-accent" /></div><div className="league-preview !mx-0 !mb-0">{classic.map(l => { const change = rankDelta(l.entryRank, l.entryLastRank); return <Link key={l.leagueId} href={`/leagues/${l.leagueId}`}><span className="league-rank">{l.entryRank ?? "—"}</span><span className="min-w-0 flex-1"><strong>{l.leagueName}</strong><small>Classic league</small></span>{change && change.direction !== "same" && <span className={change.direction === "up" ? "text-good text-xs" : "text-critical text-xs"}>{change.direction === "up" ? "↑" : "↓"} {change.value}</span>}<IconArrowRight className="h-4 w-4 text-fg-muted" /></Link>; })}{!classic.length && <p className="workspace-copy py-5">Your classic league standings will appear after ingestion.</p>}</div><Link href="/leagues" className="text-link mt-4">All leagues & cups <IconArrowRight /></Link></section><section className="tools-spotlight"><span className="section-label">YOUR WORKSPACE, EXPANDED</span><h2>More ways to find<br />your advantage.</h2><p>Turn the research into a shortlist. Turn the shortlist into a plan.</p><div className="spotlight-links"><Link href="/lab"><IconFlask />Research lab <IconArrowRight /></Link><Link href="/lineup"><IconPitch />Lineup studio <IconArrowRight /></Link><Link href="/planner"><IconSwap />Transfer planner <IconArrowRight /></Link><Link href="/gameweek"><IconTarget />Gameweek HQ <IconArrowRight /></Link><Link href="/live"><IconBolt />Match centre <IconArrowRight /></Link></div></section></div>
  </main>;
}
