import type { Metadata } from "next";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import {
  getCurrentSeason,
  getFixtureTickerData,
  getGameweekMeta,
  getLatestGameweek,
  getSquad,
  getTeamId,
} from "@/lib/queries";
import { FixtureTicker } from "@/components/FixtureTicker";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PageHeader } from "@/components/ui/PageHeader";
import { FDRCell } from "@/components/ui/FDRCell";
import { IconCalendar } from "@/components/icons";
import { CREST_URL } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fixtures" };

export default async function FixturesPage(props: PageProps<"/fixtures">) {
  const { team } = await props.searchParams;
  const teamFilter = team ? Number(team) : null;

  const sb = getSupabase();
  const season = await getCurrentSeason(sb);
  const teamId = await getTeamId(sb).catch(() => null);
  const { current, next } = await getGameweekMeta(sb, season);
  const fromGw = (current && !current.finished ? current.id : next?.id) ?? 1;

  let ownedTeamIds: number[] = [];
  if (teamId) {
    const gw = await getLatestGameweek(sb, teamId, season).catch(() => null);
    if (gw) {
      const squad = await getSquad(sb, teamId, season, gw).catch(() => []);
      ownedTeamIds = [...new Set(squad.map((p) => p.teamId))];
    }
  }

  const ticker = await getFixtureTickerData(sb, season, fromGw, ownedTeamIds);

  const teamDetail =
    teamFilter != null
      ? {
          team: ticker.teams.find((t) => t.id === teamFilter) ?? null,
          fixtures: ticker.fixtures
            .filter((f) => f.teamH === teamFilter || f.teamA === teamFilter)
            .slice(0, 10),
        }
      : null;

  return (
    <main className="animate-fade-in mx-auto w-full max-w-5xl px-4 py-6">
      <PageHeader
        icon={<IconCalendar className="h-5 w-5" />}
        title="Fixture ticker"
        subtitle={`Difficulty from GW${fromGw} onward`}
        accent="var(--cyan)"
      />

      {teamDetail?.team && (
        <section className="mb-6">
          <SectionHeader
            title={
              <span className="inline-flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={CREST_URL(teamDetail.team.code)} alt="" className="h-5 w-5 object-contain" />
                {teamDetail.team.shortName} — next fixtures
              </span>
            }
            action={
              <Link href="/fixtures" className="text-xs font-semibold text-accent">
                Clear
              </Link>
            }
          />
          <div className="card divide-y divide-border overflow-hidden">
            {teamDetail.fixtures.map((f, i) => {
              const home = f.teamH === teamFilter;
              const oppId = home ? f.teamA : f.teamH;
              const opp = ticker.teams.find((t) => t.id === oppId);
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="w-12 shrink-0 text-xs font-bold text-fg-subtle">GW{f.gameweek}</span>
                  <span className="flex-1">
                    <FDRCell
                      opponent={opp?.shortName ?? "?"}
                      wasHome={home}
                      difficulty={home ? f.diffH : f.diffA}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <FixtureTicker
        teams={ticker.teams}
        fixtures={ticker.fixtures}
        gameweeks={ticker.gameweeks}
        owned={ticker.owned}
      />

      <p className="mt-4 text-center text-[11px] text-fg-subtle">
        Difficulty data refreshes with the pipeline ingest.
      </p>
    </main>
  );
}
