import type { Metadata } from "next";
import { getPlanningWorkspace } from "@/lib/planning-workspace";
import { ResearchLab } from "@/components/ResearchLab";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Research lab" };
export default async function LabPage() {
  const ws = await getPlanningWorkspace();
  return <main className="page-container animate-fade-in"><ResearchLab players={ws.players} fixtures={ws.ticker.fixtures} teams={ws.ticker.teams} studioPlayers={ws.studioPlayers} startingCodes={ws.squad.filter(p => p.squadPosition <= 11).map(p => p.playerCode)} season={ws.season} teamId={ws.teamId} target={ws.target} /></main>;
}
