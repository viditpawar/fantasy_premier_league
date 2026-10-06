import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";
import {
  getCurrentSeason,
  getDifferentials,
  getManagerAnalytics,
  getSquadCodes,
  getLatestGameweek,
  getTeamId,
  getTopScorers,
  getTransferMomentum,
} from "@/lib/queries";
import { StatTile } from "@/components/ui/StatTile";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Hero } from "@/components/ui/Hero";
import { RankChart } from "@/components/charts/RankChart";
import { PointsVsAverageChart } from "@/components/charts/PointsVsAverageChart";
import { AreaTrend } from "@/components/charts/AreaTrend";
import { TopScorersTable } from "@/components/TopScorersTable";
import { MoversWidget } from "@/components/MoversWidget";
import { DifferentialsGrid } from "@/components/DifferentialsGrid";
import { IconChart } from "@/components/icons";
import { rankDelta } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const sb = getSupabase();
  const season = await getCurrentSeason(sb);
  const teamId = await getTeamId(sb);
  const gameweek = await getLatestGameweek(sb, teamId, season);

  const [analytics, topScorers, squadCodes, movers, differentials] = await Promise.all([
    getManagerAnalytics(sb, teamId, season),
    getTopScorers(sb, season, 25),
    getSquadCodes(sb, teamId, season, gameweek),
    getTransferMomentum(sb, season, 5).catch(() => ({ risers: [], fallers: [] })),
    getDifferentials(sb, season, new Set(), 10, 8).catch(() => []),
  ]);

  const rd = rankDelta(analytics.currentRank, analytics.startRank);
  const pointsSeries = analytics.rows.map((r) => r.points);

  return (
    <main className="animate-fade-in mx-auto w-full max-w-4xl px-4 py-6">
      <Hero
        icon={<IconChart className="h-4 w-4" />}
        eyebrow={`${season} · ${analytics.rows.length} gameweeks tracked`}
        title="Analytics"
        stats={[
          { label: "Avg pts / GW", value: analytics.averagePoints.toFixed(1), accent: true },
          {
            label: "Best GW",
            value: `${analytics.bestGameweek?.points ?? 0}${
              analytics.bestGameweek ? ` (GW${analytics.bestGameweek.gameweek})` : ""
            }`,
          },
          {
            label: "Overall rank",
            value: analytics.currentRank ? `#${analytics.currentRank.toLocaleString()}` : "—",
          },
          ...(rd && rd.direction !== "same"
            ? [{ label: "Since GW1", value: `${rd.direction === "up" ? "▲" : "▼"} ${rd.value.toLocaleString()}` }]
            : []),
        ]}
      />

      <div className="bento mb-6">
        <StatTile label="Green arrows" value={analytics.greenArrows} accent="var(--good)" />
        <StatTile label="Red arrows" value={analytics.redArrows} accent="var(--critical)" />
        <StatTile
          label="Bench points"
          value={analytics.totalBenchPoints}
          accent="var(--warning)"
          hint="Left on the bench"
        />
        <StatTile
          label="Hits taken"
          value={analytics.totalHitCost}
          prefix="-"
          accent="var(--critical)"
          hint="Points spent on transfers"
        />
        <div className="card card-hover bento-wide px-4 py-3.5">
          <div className="section-label mb-2">Overall rank progression</div>
          <RankChart data={analytics.rows.map((r) => ({ gameweek: r.gameweek, overallRank: r.overallRank }))} />
        </div>
        <div className="card card-hover bento-wide px-4 py-3.5">
          <div className="section-label mb-2">Points vs global average</div>
          <PointsVsAverageChart
            data={analytics.rows.map((r) => ({
              gameweek: r.gameweek,
              points: r.points,
              averageEntryScore: r.averageEntryScore,
            }))}
          />
        </div>
        {analytics.teamValueSeries.length > 1 && (
          <div className="card card-hover col-span-2 px-4 py-3.5 sm:col-span-4">
            <div className="section-label mb-2">Squad value</div>
            <AreaTrend
              data={analytics.teamValueSeries as unknown as Record<string, number>[]}
              dataKey="value"
              label="Squad value"
              format="money"
              color="var(--cyan)"
            />
          </div>
        )}
      </div>

      {(movers.risers.length > 0 || movers.fallers.length > 0) && (
        <section className="mb-6">
          <SectionHeader title="Transfer momentum" hint={`Net transfers this gameweek`} />
          <MoversWidget risers={movers.risers} fallers={movers.fallers} />
        </section>
      )}

      {differentials.length > 0 && (
        <section className="mb-6">
          <SectionHeader title="Differentials" hint="Top scorers owned by under 10% of managers" />
          <DifferentialsGrid players={differentials} />
        </section>
      )}

      <section>
        <SectionHeader title="Top scorers this season" hint="Tap a row for the full profile" />
        <TopScorersTable rows={topScorers} squadCodes={[...squadCodes]} />
      </section>
    </main>
  );
}
