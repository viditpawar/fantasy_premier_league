import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";
import {
  getCurrentSeason,
  getManagerAnalytics,
  getSquadCodes,
  getLatestGameweek,
  getTeamId,
  getTopScorers,
} from "@/lib/queries";
import { StatTile } from "@/components/ui/StatTile";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { RankChart } from "@/components/charts/RankChart";
import { PointsVsAverageChart } from "@/components/charts/PointsVsAverageChart";
import { AreaTrend } from "@/components/charts/AreaTrend";
import { TopScorersTable } from "@/components/TopScorersTable";
import { rankDelta } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const sb = getSupabase();
  const season = await getCurrentSeason(sb);
  const teamId = await getTeamId(sb);
  const gameweek = await getLatestGameweek(sb, teamId, season);

  const [analytics, topScorers, squadCodes] = await Promise.all([
    getManagerAnalytics(sb, teamId, season),
    getTopScorers(sb, season, 25),
    getSquadCodes(sb, teamId, season, gameweek),
  ]);

  const rd = rankDelta(analytics.currentRank, analytics.startRank);
  const pointsSeries = analytics.rows.map((r) => r.points);

  return (
    <main className="animate-fade-in mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-fg">Analytics</h1>
        <span className="text-sm text-fg-muted">
          {season} · {analytics.rows.length} gameweeks
        </span>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile
          label="Avg points / GW"
          value={analytics.averagePoints}
          numberStyle="decimal1"
          spark={pointsSeries}
        />
        <StatTile
          label="Best gameweek"
          value={analytics.bestGameweek?.points ?? 0}
          hint={analytics.bestGameweek ? `GW${analytics.bestGameweek.gameweek}` : undefined}
        />
        <StatTile label="Green arrows" value={analytics.greenArrows} accent="var(--good)" />
        <StatTile label="Red arrows" value={analytics.redArrows} accent="var(--critical)" />
        <StatTile
          label="Points on bench"
          value={analytics.totalBenchPoints}
          accent="var(--warning)"
          hint="Left on the bench this season"
        />
        <StatTile
          label="Hits taken"
          value={analytics.totalHitCost}
          prefix="-"
          accent="var(--critical)"
          hint="Points spent on transfers"
        />
        <StatTile
          label="Overall rank"
          value={analytics.currentRank ?? 0}
          numberStyle="compact"
          delta={rd ? { value: rd.value, direction: rd.direction, label: "since GW1" } : undefined}
        />
      </div>

      <section className="mb-6">
        <SectionHeader title="Overall rank progression" hint="Lower is better" />
        <div className="card px-3 py-4">
          <RankChart data={analytics.rows.map((r) => ({ gameweek: r.gameweek, overallRank: r.overallRank }))} />
        </div>
      </section>

      <section className="mb-6">
        <SectionHeader title="Your points vs the global average" />
        <div className="card px-3 py-4">
          <PointsVsAverageChart
            data={analytics.rows.map((r) => ({
              gameweek: r.gameweek,
              points: r.points,
              averageEntryScore: r.averageEntryScore,
            }))}
          />
        </div>
      </section>

      {analytics.teamValueSeries.length > 1 && (
        <section className="mb-6">
          <SectionHeader title="Squad value" />
          <div className="card px-3 py-4">
            <AreaTrend
              data={analytics.teamValueSeries as unknown as Record<string, number>[]}
              dataKey="value"
              label="Squad value"
              format="money"
              color="var(--cyan)"
            />
          </div>
        </section>
      )}

      <section>
        <SectionHeader title="Top scorers this season" hint="Tap a row for the full profile" />
        <TopScorersTable rows={topScorers} squadCodes={[...squadCodes]} />
      </section>
    </main>
  );
}
