import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { getCurrentSeason, getManagerLeagues, getTeamId } from "@/lib/queries";
import { ManagerLeague } from "@/lib/types";

export const dynamic = "force-dynamic";

function RankDelta({ league }: { league: ManagerLeague }) {
  if (league.entryRank == null) {
    return <span className="text-sm text-[var(--text-muted)]">Unranked</span>;
  }
  if (!league.entryLastRank || league.entryLastRank === 0) {
    return <span className="text-lg font-extrabold text-white">#{league.entryRank.toLocaleString()}</span>;
  }

  const delta = league.entryLastRank - league.entryRank;
  const color = delta > 0 ? "var(--status-good)" : delta < 0 ? "var(--status-critical)" : "var(--text-muted)";
  const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "–";

  return (
    <div className="flex items-baseline gap-2">
      <span className="text-lg font-extrabold text-white">#{league.entryRank.toLocaleString()}</span>
      {delta !== 0 && (
        <span className="text-xs font-bold" style={{ color }}>
          {arrow} {Math.abs(delta).toLocaleString()}
        </span>
      )}
    </div>
  );
}

function LeagueRow({ league }: { league: ManagerLeague }) {
  const content = (
    <div className="card flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:border-[var(--border-hairline-strong)]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-white">{league.leagueName}</span>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
            style={{ background: "linear-gradient(90deg, var(--accent-purple), var(--accent-purple-bright))" }}
          >
            {league.leagueType === "classic" ? "Classic" : "H2H"}
          </span>
        </div>
        {league.leagueType === "h2h" && (
          <div className="mt-1 text-xs text-[var(--text-muted)]">Standings not shown yet for head-to-head leagues</div>
        )}
      </div>
      <RankDelta league={league} />
    </div>
  );

  if (league.leagueType !== "classic") {
    return content;
  }
  return (
    <Link href={`/leagues/${league.leagueId}`} className="block">
      {content}
    </Link>
  );
}

export default async function LeaguesPage() {
  const sb = getSupabase();
  const season = await getCurrentSeason(sb);
  const teamId = await getTeamId(sb);
  const leagues = await getManagerLeagues(sb, teamId, season);

  const classic = leagues.filter((l) => l.leagueType === "classic");
  const h2h = leagues.filter((l) => l.leagueType === "h2h");

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Leagues & Cups</h1>
        <span className="text-sm text-[var(--text-secondary)]">Season {season}</span>
      </header>

      {leagues.length === 0 ? (
        <div className="card px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
          No leagues found yet. They'll show up after the next ingest run.
        </div>
      ) : (
        <>
          {classic.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-2 section-label">Classic leagues</h2>
              <div className="flex flex-col gap-2.5">
                {classic.map((l) => (
                  <LeagueRow key={l.leagueId} league={l} />
                ))}
              </div>
            </section>
          )}

          {h2h.length > 0 && (
            <section>
              <h2 className="mb-2 section-label">Head-to-head leagues</h2>
              <div className="flex flex-col gap-2.5">
                {h2h.map((l) => (
                  <LeagueRow key={l.leagueId} league={l} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
