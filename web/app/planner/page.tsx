import type { Metadata } from "next";
import { getWorkspace } from "@/lib/workspace";
import { getBudget, getFixtureTickerData, getLatestGameweek, getPlanningGameweek, getPlayers, getSquad } from "@/lib/queries";
import { TransferPlanner } from "@/components/TransferPlanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Hero } from "@/components/ui/Hero";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Transfer planner" };
export default async function PlannerPage() {
  const { sb, season, teamId } = await getWorkspace();
  const [target, sourceGameweek] = await Promise.all([getPlanningGameweek(sb, season), getLatestGameweek(sb, teamId, season)]);
  if (target == null) return <main className="page-container"><Hero title="The next chapter is coming." eyebrow="Transfer planner" /><EmptyState title="No future deadline yet.">The planner will be ready when the next season&apos;s calendar is available.</EmptyState></main>;
  const [squad, budget, players, ticker] = await Promise.all([getSquad(sb, teamId, season, sourceGameweek), getBudget(sb, teamId, season, sourceGameweek), getPlayers(sb, season), getFixtureTickerData(sb, season, target)]);
  return <main className="page-container animate-fade-in"><TransferPlanner season={season} teamId={teamId} sourceGameweek={sourceGameweek} target={target} savedSquad={squad} savedBank={budget.bank} players={players} fixtures={ticker.fixtures} teams={ticker.teams} /></main>;
}
