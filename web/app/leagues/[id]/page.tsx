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
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconArrowLeft, IconTrophy } from "@/components/icons";

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
      <PageHeader
        icon={<IconTrophy className="h-5 w-5" />}
        title={league.leagueName}
        subtitle={`${season} · ${league.leagueType === "classic" ? "Classic league" : "Head-to-head"}`}
        accent="var(--warning)"
      />

      {standings.length === 0 ? (
        <EmptyState title="No standings snapshot yet">
          They&apos;ll show up after the next ingest run.
        </EmptyState>
      ) : (
        <>
          {rivals && rivals.podium.length > 0 && (
            <div className="mb-5 grid grid-cols-3 items-end gap-2.5">
              {rivals.podium.map((p, i) => (
                <div
                  key={p.entryTeamId}
                  className={`card card-hover relative overflow-hidden px-3 text-center ${
                    i === 0 ? "py-4" : "py-3"
                  } ${p.isMe ? "ring-2 ring-accent" : ""}`}
                  style={{ order: [1, 0, 2][i] ?? i }}
                >
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-1"
                    style={{ background: MEDAL[i] }}
                  />
                  <div
                    className="mx-auto mb-1.5 flex items-center justify-center rounded-full text-sm font-extrabold text-white shadow-sm"
                    style={{
                      background: `linear-gradient(135deg, ${MEDAL[i]}, color-mix(in oklab, ${MEDAL[i]} 60%, black))`,
                      width: i === 0 ? "2.25rem" : "2rem",
                      height: i === 0 ? "2.25rem" : "2rem",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div className="truncate text-sm font-bold text-fg">{p.entryName}</div>
                  <div className="truncate text-[11px] text-fg-subtle">{p.playerName}</div>
                  <div className="mt-1 text-lg font-extrabold tabular-nums text-fg">{p.total}</div>
                </div>
              ))}
            </div>
          )}

          {rivals?.me && (
            <div className="card card-hover mb-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white"
                  style={{ background: "linear-gradient(135deg, var(--accent), var(--brand-purple-bright))" }}
                >
                  #{rivals.me.rank}
                </span>
                <div>
                  <span className="section-label">Your position</span>
                  <div className="text-xl font-extrabold text-fg">{rivals.me.total} pts</div>
                </div>
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
                {!rivals.gapToFirst && !rivals.gapToPodium && !rivals.gapToNextRank && (
                  <div className="font-bold text-accent">Leading! 🏆</div>
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
