import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getCurrentSeason, getLeagueStandings, getManagerLeagues, getTeamId } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LeagueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const ownRow = standings.find((r) => r.entryTeamId === teamId);
  const inTable = Boolean(ownRow);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <Link href="/leagues" className="mb-3 inline-block text-sm text-[var(--text-secondary)] hover:text-white">
        ← Leagues & Cups
      </Link>
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">{league.leagueName}</h1>
        <span className="text-sm text-[var(--text-secondary)]">Season {season}</span>
      </header>

      <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
        <span className="section-label">Your position</span>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-extrabold text-white">
            {league.entryRank ? `#${league.entryRank.toLocaleString()}` : "Unranked"}
          </span>
          {!inTable && league.entryRank && (
            <span className="text-xs text-[var(--text-muted)]">(outside the table below)</span>
          )}
        </div>
      </div>

      {standings.length === 0 ? (
        <div className="card px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
          No standings snapshot yet. They'll show up after the next ingest run.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 border-b border-[var(--border-hairline)] px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            <span>Rank</span>
            <span>Team</span>
            <span className="text-right">Points</span>
          </div>
          {standings.map((r, i) => {
            const isMe = r.entryTeamId === teamId;
            return (
              <div
                key={r.entryTeamId}
                className={`grid grid-cols-[auto_1fr_auto] items-center gap-x-3 px-4 py-2.5 text-sm ${
                  isMe ? "bg-[var(--accent-green)]/10" : i % 2 === 1 ? "bg-white/[0.02]" : ""
                }`}
                style={isMe ? { boxShadow: "inset 3px 0 0 var(--accent-green)" } : undefined}
              >
                <span className="tabular-nums font-extrabold text-white">{r.rank}</span>
                <span className="truncate">
                  <span className="font-semibold text-white">{r.entryName}</span>{" "}
                  <span className="text-[var(--text-muted)]">{r.playerName}</span>
                </span>
                <span className="text-right font-extrabold tabular-nums text-white">{r.total}</span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
