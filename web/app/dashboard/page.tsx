import type { Metadata } from "next";
import Link from "next/link";
import { getWorkspace } from "@/lib/workspace";
import {
  getDifferentials,
  getLatestGameweek,
  getManagerAnalytics,
  getSquadCodes,
  getTopScorers,
  getTransferMomentum,
} from "@/lib/queries";
import { AnalyticsWorkspace } from "@/components/AnalyticsWorkspace";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TopScorersTable } from "@/components/TopScorersTable";
import { MoversWidget } from "@/components/MoversWidget";
import { DifferentialsGrid } from "@/components/DifferentialsGrid";
import { IconArrowRight } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const { sb, season, teamId } = await getWorkspace();
  const gameweek = await getLatestGameweek(sb, teamId, season);
  const squadCodesPromise = getSquadCodes(sb, teamId, season, gameweek);
  const [analytics, topScorers, squadCodes, movers, differentials] =
    await Promise.all([
      getManagerAnalytics(sb, teamId, season),
      getTopScorers(sb, season, 25),
      squadCodesPromise,
      getTransferMomentum(sb, season, 5).catch(() => ({
        risers: [],
        fallers: [],
      })),
      squadCodesPromise
        .then((codes) => getDifferentials(sb, season, codes, 10, 8))
        .catch(() => []),
    ]);

  return (
    <main className="page-container animate-fade-in">
      <AnalyticsWorkspace analytics={analytics} season={season} />
      <div className="analytics-market-heading">
        <div>
          <p className="page-eyebrow">Widen the lens</p>
          <h2 className="text-2xl font-medium tracking-[-.04em]">
            What’s happening around you.
          </h2>
          <p className="page-description !text-[11px]">
            These player insights cover the full season and latest transfer
            snapshot, independently of the period above.
          </p>
        </div>
        <Link href="/players" className="button-secondary">
          Explore every player
          <IconArrowRight />
        </Link>
      </div>
      {(movers.risers.length > 0 || movers.fallers.length > 0) && (
        <section className="mb-8">
          <SectionHeader
            title="Where managers are moving"
            hint="Ranked by net transfers in the latest gameweek snapshot. Popularity is a signal to investigate."
          />
          <MoversWidget risers={movers.risers} fallers={movers.fallers} />
        </section>
      )}
      {differentials.length > 0 && (
        <section className="mb-8">
          <SectionHeader
            title="Low ownership. Real returns."
            hint="Season points leaders with at least 90 minutes played and ownership of 10% or less. Players you own are marked."
          />
          <DifferentialsGrid players={differentials} />
        </section>
      )}
      <section>
        <SectionHeader
          title="The season’s leading scorers"
          hint="Explore the top 25, or focus on players inside and outside your current squad."
        />
        <TopScorersTable rows={topScorers} squadCodes={[...squadCodes]} />
      </section>
    </main>
  );
}
