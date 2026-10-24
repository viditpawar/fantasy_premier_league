import type { Metadata } from "next";
import Link from "next/link";
import { getWorkspace } from "@/lib/workspace";
import { getManagerLeagues } from "@/lib/queries";
import type { ManagerLeague } from "@/lib/types";
import { Hero } from "@/components/ui/Hero";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconArrowRight, IconShield, IconTrophy } from "@/components/icons";
import { compactNumber, rankDelta } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leagues & cups" };
function LeagueCard({ league }: { league: ManagerLeague }) {
  const change = rankDelta(league.entryRank, league.entryLastRank);
  const content = <><div className="mb-5 flex items-center justify-between"><span className="insight-icon"><IconTrophy /></span><span className="rounded-md border border-border px-2 py-1 text-[9px] text-fg-muted">{league.leagueType === "classic" ? "Classic" : "Head to head"}</span></div><h3 className="truncate text-[14px] font-medium">{league.leagueName}</h3><div className="mt-5 flex items-end justify-between gap-2"><div><span className="block text-[9px] text-fg-muted">Your position</span><strong className="mt-1 block text-3xl font-medium tracking-[-0.05em]">{league.entryRank != null ? <><span className="mr-1 text-xl text-fg-subtle">#</span>{compactNumber(league.entryRank)}</> : "—"}</strong></div>{change && change.direction !== "same" ? <span className={`mb-1 text-[10px] ${change.direction === "up" ? "text-good" : "text-critical"}`}>{change.direction === "up" ? "↑" : "↓"} {compactNumber(change.value)} places</span> : <span className="mb-1 text-[9px] text-fg-subtle">{league.entryRank == null ? "Not ranked yet" : "Holding steady"}</span>}</div><div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-[10px] text-accent">{league.leagueType === "classic" ? <>View the standings<IconArrowRight className="h-3.5 w-3.5" /></> : <span className="text-fg-muted">Head-to-head standings available on FPL</span>}</div></>;
  return league.leagueType === "classic" ? <Link href={`/leagues/${league.leagueId}`} className="card card-hover block min-w-0 p-6">{content}</Link> : <div className="card min-w-0 p-6">{content}</div>;
}
export default async function LeaguesPage() {
  const { sb, season, teamId } = await getWorkspace();
  const leagues = await getManagerLeagues(sb, teamId, season);
  const classic = leagues.filter((l) => l.leagueType === "classic");
  const h2h = leagues.filter((l) => l.leagueType === "h2h");
  const improving = leagues.filter((l) => l.entryRank != null && l.entryLastRank != null && l.entryRank < l.entryLastRank).length;
  return <main className="page-container animate-fade-in"><Hero title="The friendly rivalries." eyebrow={`${season} · Leagues & cups`} icon={<IconTrophy />} subtitle="The race to the top is better with a little company. Here’s where you stand." stats={[{ label: "Classic leagues", value: classic.length, accent: true }, { label: "Head to head", value: h2h.length }, { label: "Leagues moving up", value: improving }]} />{leagues.length === 0 ? <EmptyState title="The competition will be here soon.">Your leagues and standings will appear after your next data update.</EmptyState> : <>{classic.length > 0 && <section><SectionHeader title="The season-long races" hint="Classic leagues · ranked by total points" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{classic.map((league) => <LeagueCard key={league.leagueId} league={league} />)}</div></section>}{h2h.length > 0 && <section className="mt-8"><SectionHeader title="A new opponent, every gameweek" hint="Your head-to-head competitions" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{h2h.map((league) => <LeagueCard key={league.leagueId} league={league} />)}</div><a href="https://fantasy.premierleague.com/leagues" target="_blank" rel="noreferrer" className="text-link mt-5"><IconShield className="h-3.5 w-3.5" />Open competitions on FPL ↗</a></section>}</>}</main>;
}
