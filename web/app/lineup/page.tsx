import type { Metadata } from "next";
import { getPlanningWorkspace } from "@/lib/planning-workspace";
import { LineupStudio } from "@/components/LineupStudio";
import { EmptyState } from "@/components/ui/EmptyState";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lineup studio" };
export default async function LineupPage() {
  const ws = await getPlanningWorkspace();
  return <main className="page-container animate-fade-in">{ws.squad.length === 15 ? <LineupStudio players={ws.studioPlayers} savedSquad={ws.squad} fixtures={ws.ticker.fixtures} season={ws.season} teamId={ws.teamId} target={ws.target} sourceGameweek={ws.sourceGameweek} /> : <EmptyState title="Your full squad is needed.">Refresh the warehouse to load all 15 players before drafting a lineup.</EmptyState>}</main>;
}
