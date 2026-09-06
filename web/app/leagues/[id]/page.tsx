import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import {
  getCurrentSeason,
  getLeagueRivals,
  getLeagueStandings,
  getManagerLeagues,
  getTeamId,
} from "@/lib/queries";
import { LeagueStandingsTable } from "@/components/LeagueStandingsTable";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconArrowLeft } from "@/components/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/leagues/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const sb = getSupabase();
  const season = await getCurrentSeason(sb).catch(() => null);
  if (!season) return { title: "League" };
  const teamId = await getTeamId(sb).catch(() => null);
  if (!teamId) return { title: "League" };
  const leagues = await getManagerLeagues(sb, teamId, season).catch(() => []);
  return { title: leagues.find((l) => l.leagueId === Number(id))?.leagueName ?? "League" };
}

const MEDAL = ["#f5c542", "#c7cad1", "#d99358"];

export default async function LeagueDetailPage(props: PageProps<"/leagues/[id]">) {
  const { id } = await props.params;
  const leagueId = Number(id);
  if (!Number.isFinite(leagueId)) notFound();

  const sb = getSupabase();
  const season = await getCurrentSeason(sb);
  const teamId = await getTeamId(sb);
  const [leagues, standings] = await Promise.all([
    getManagerLeagues(sb, teamId, season),
    getLeagueStandings(sb, leagueId, season),
  ]);

  const league = leagues.find((l) => l.leagueId === leagueId);
  if (!league) notFound();

  const rivals = await getLeagueRivals(sb, leagueId, season, teamId, league.leagueName).catch(
    () => null,
  );

  return (
    <main className="animate-fade-in mx-auto w-full max-w-3xl px-4 py-6">
      <Link
        href="/leagues"
        className="mb-3 inline-flex items-center gap-1 text-sm text-fg-muted transition-colors hover:text-fg"
      >
        <IconArrowLeft className="h-4 w-4" /> Leagues &amp; Cups
      </Link>
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-fg">{league.leagueName}</h1>
        <span className="text-sm text-fg-muted">{season}</span>
      </header>

      {standings.length === 0 ? (
        <EmptyState title="No standings snapshot yet">
          They&apos;ll show up after the next ingest run.
        </EmptyState>
      ) : (
        <>
          {rivals && rivals.podium.length > 0 && (
            <div className="mb-5 grid grid-cols-3 gap-2.5">
              {rivals.podium.map((p, i) => (
                <div key={p.entryTeamId} className="card px-3 py-3 text-center">
                  <div className="text-lg" style={{ color: MEDAL[i] }}>
                    ●
                  </div>
                  <div className="truncate text-sm font-bold text-fg">{p.entryName}</div>
                  <div className="truncate text-[11px] text-fg-subtle">{p.playerName}</div>
                  <div className="mt-1 text-lg font-extrabold tabular-nums text-fg">{p.total}</div>
                </div>
              ))}
            </div>
          )}

          {rivals?.me && (
            <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <div>
                <span className="section-label">Your position</span>
                <div className="text-xl font-extrabold text-fg">#{rivals.me.rank}</div>
              </div>
              <div className="text-right text-xs text-fg-muted">
                {rivals.gapToFirst != null && rivals.gapToFirst > 0 && (
                  <div>{rivals.gapToFirst} pts behind 1st</div>
                )}
                {rivals.gapToPodium != null && rivals.gapToPodium > 0 && (
                  <div>{rivals.gapToPodium} pts off the podium</div>
                )}
                {rivals.gapToNextRank != null && rivals.gapToNextRank > 0 && (
                  <div>{rivals.gapToNextRank} pts to the place above</div>
                )}
              </div>
            </div>
          )}

          <SectionHeader title="Standings" hint="Tap a column to sort" />
          <LeagueStandingsTable rows={standings} teamId={teamId} />
        </>
      )}
    </main>
  );
}
