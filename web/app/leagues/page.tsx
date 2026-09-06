import type { Metadata } from "next";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { getCurrentSeason, getManagerLeagues, getTeamId } from "@/lib/queries";
import { ManagerLeague } from "@/lib/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { IconShield } from "@/components/icons";
import { fmtInt, rankDelta } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leagues" };

function RankDelta({ league }: { league: ManagerLeague }) {
  if (league.entryRank == null) {
    return <span className="text-sm text-fg-subtle">Unranked</span>;
  }
  const rd = rankDelta(league.entryRank, league.entryLastRank);
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-lg font-extrabold text-fg">#{fmtInt(league.entryRank)}</span>
      {rd && rd.direction !== "same" && (
        <span
          className="text-xs font-bold"
          style={{ color: rd.direction === "up" ? "var(--good)" : "var(--critical)" }}
        >
          {rd.direction === "up" ? "▲" : "▼"} {fmtInt(rd.value)}
        </span>
      )}
    </div>
  );
}

function LeagueRow({ league }: { league: ManagerLeague }) {
  const inner = (
    <div className="card flex items-center gap-3 px-4 py-3.5 transition-all duration-[var(--dur-fast)] hover:-translate-y-0.5 hover:border-border-strong">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "color-mix(in oklab, var(--brand-purple-bright) 16%, transparent)", color: "var(--brand-purple-bright)" }}
      >
        <IconShield className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-fg">{league.leagueName}</span>
          <Badge tone="brand">{league.leagueType === "classic" ? "Classic" : "H2H"}</Badge>
        </div>
        {league.leagueType === "h2h" && (
          <div className="mt-1 text-xs text-fg-subtle">Standings table not shown for head-to-head</div>
        )}
      </div>
      <RankDelta league={league} />
    </div>
  );

  return league.leagueType === "classic" ? (
    <Link href={`/leagues/${league.leagueId}`} className="block">
      {inner}
    </Link>
  ) : (
    inner
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
    <main className="animate-fade-in mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-fg">Leagues &amp; Cups</h1>
        <span className="text-sm text-fg-muted">{season}</span>
      </header>

      {leagues.length === 0 ? (
        <EmptyState title="No leagues found yet">They&apos;ll show up after the next ingest run.</EmptyState>
      ) : (
        <>
          {classic.length > 0 && (
            <section className="mb-6">
              <SectionHeader title="Classic leagues" />
              <div className="flex flex-col gap-2.5">
                {classic.map((l) => (
                  <LeagueRow key={l.leagueId} league={l} />
                ))}
              </div>
            </section>
          )}
          {h2h.length > 0 && (
            <section>
              <SectionHeader title="Head-to-head leagues" />
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
