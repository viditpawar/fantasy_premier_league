import type { Metadata } from "next";
import Link from "next/link";
import { getWorkspace } from "@/lib/workspace";
import { getGameweekMeta, getLeagueRivals, getLiveGameweek, getManagerLeagues } from "@/lib/queries";
import type { LivePlayer } from "@/lib/types";
import { Hero } from "@/components/ui/Hero";
import { EmptyState } from "@/components/ui/EmptyState";
import { AutoRefresh } from "@/components/AutoRefresh";
import { PlayerKit } from "@/components/PlayerKit";
import { IconArrowRight, IconBolt, IconClock, IconTrophy } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Match centre" };
function ScoreRows({ players, bench = false }: { players: LivePlayer[]; bench?: boolean }) {
  return <div>{players.map((player) => <div key={player.playerCode} className="flex items-center gap-3 border-t border-border px-5 py-3.5"><PlayerKit code={player.teamCode} goalkeeper={player.position === "GKP"} className="h-9 w-9 shrink-0" /><span className="hidden w-7 text-[9px] text-fg-subtle sm:block">{player.position}</span><div className="min-w-0 flex-1"><Link href={`/players/${player.playerCode}`} className="block truncate text-[12px] font-medium hover:text-accent">{player.player}{player.isCaptain && <span className="ml-2 rounded bg-accent/10 px-1.5 py-0.5 text-[8px] text-accent">C</span>}{player.isViceCaptain && <span className="ml-2 text-[9px] text-fg-subtle">VC</span>}</Link><span className="text-[9px] text-fg-subtle">{player.team}</span></div><span className="flex shrink-0 items-center gap-1.5 text-[9px] text-fg-muted"><span className={`h-1 w-1 rounded-full ${player.hasFixture && !player.fixtureFinished && player.minutes > 0 ? "bg-good" : "bg-fg-subtle"}`} />{!player.hasFixture ? "No fixture" : player.fixtureFinished ? "Full time" : player.minutes > 0 ? `${player.minutes}′` : "To play"}</span><strong className="ml-3 w-8 text-right text-lg font-medium tracking-tight">{bench ? player.livePoints : player.livePoints * player.multiplier}</strong></div>)}</div>;
}
export default async function LivePage() {
  const { sb, season, teamId } = await getWorkspace();
  const [live, { current }, leagues] = await Promise.all([getLiveGameweek(sb, teamId, season), getGameweekMeta(sb, season), getManagerLeagues(sb, teamId, season)]);
  if (!live) return <main className="page-container animate-fade-in"><Hero title="The matchday picture." eyebrow="Match centre" icon={<IconBolt />} /><EmptyState title="Waiting for the first whistle.">Your matchday view will appear when gameweek selections and scores are available.</EmptyState></main>;
  const classic = leagues.find((league) => league.leagueType === "classic" && /entrada/i.test(league.leagueName)) ?? leagues.find((league) => league.leagueType === "classic");
  const rivals = classic ? await getLeagueRivals(sb, classic.leagueId, season, teamId, classic.leagueName).catch(() => null) : null;
  const starting = live.players.filter((player) => player.squadPosition <= 11).sort((a, b) => a.squadPosition - b.squadPosition);
  const bench = live.players.filter((player) => player.squadPosition > 11).sort((a, b) => a.squadPosition - b.squadPosition);
  const captain = starting.find((player) => player.isCaptain);
  const finished = current?.id === live.gameweek ? current.finished : live.finished;
  return <main className="page-container animate-fade-in"><Hero title="The matchday picture." eyebrow={`Gameweek ${live.gameweek} · ${finished ? "Final scores" : "Latest snapshot"}`} icon={<IconBolt />} subtitle="Follow every contribution. See the points behind your gameweek." action={<AutoRefresh seconds={60} />} stats={[{ label: "Gameweek points", value: live.liveTotal, accent: true }, { label: "Gameweek average", value: live.averageEntryScore ?? "—" }, { label: "Yet to play", value: live.playersYetToPlay }, { label: "Bench points", value: live.benchPoints }]} />
    <div className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-surface-1 px-4 py-3 text-[10px] leading-5 text-fg-muted"><IconClock className="h-3.5 w-3.5 shrink-0" />{finished ? "This gameweek is finished. These are the scores in your latest saved snapshot." : "Scores follow your warehouse updates, approximately every two hours. This page reloads the saved snapshot every minute."}</div>
    <div className="overview-grid"><div className="flex min-w-0 flex-col gap-6"><section className="card overflow-hidden"><div className="panel-heading !pb-5"><div><h2>On the pitch</h2><p className="panel-subtitle">Your starting eleven · Captain multiplier included</p></div><span className="text-[9px] text-fg-subtle">Points</span></div><ScoreRows players={starting} /></section><section className="card overflow-hidden"><div className="panel-heading !pb-5"><div><h2>Ready on the bench</h2><p className="panel-subtitle">In substitution order</p></div></div><ScoreRows players={bench} bench /></section></div>
      <aside className="flex min-w-0 flex-col gap-6">{captain && <section className="card insight-card"><div className="insight-eyebrow"><span className="insight-icon"><IconBolt /></span>Wearing the armband</div><div className="mt-5 flex items-center gap-4"><PlayerKit code={captain.teamCode} className="h-16 w-16" /><div><h2 className="!mt-0">{captain.player}</h2><p className="mt-2 text-[11px] text-fg-muted">{captain.livePoints} × {captain.multiplier} = <span className="font-semibold text-accent">{captain.livePoints * captain.multiplier} points</span></p></div></div><Link href={`/players/${captain.playerCode}`} className="text-link mt-5">View player profile<IconArrowRight /></Link></section>}
      {rivals && rivals.nearby.length > 0 && <section className="card overflow-hidden"><div className="panel-heading"><div><h2>How the rivals are doing</h2><p className="panel-subtitle">{rivals.leagueName}</p></div><IconTrophy className="h-4 w-4 text-fg-subtle" /></div><div className="mt-4">{rivals.nearby.map((rival) => <div key={rival.entryTeamId} className={`flex items-center gap-3 border-t border-border px-5 py-4 ${rival.isMe ? "bg-accent/5" : ""}`}><span className="w-5 text-[11px] text-fg-subtle">{rival.rank}</span><div className="min-w-0 flex-1"><strong className={`block truncate text-[11px] font-medium ${rival.isMe ? "text-accent" : ""}`}>{rival.entryName}{rival.isMe ? " · You" : ""}</strong><span className="text-[9px] text-fg-muted">{rival.playerName}</span></div><span className="text-[12px] font-medium">{rival.total}</span></div>)}</div><Link href={`/leagues/${rivals.leagueId}`} className="text-link m-5">Full standings<IconArrowRight /></Link></section>}
      </aside>
    </div>
  </main>;
}
