import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";
import {
  getCurrentSeason,
  getLatestGameweek,
  getPlayers,
  getSquadCodes,
  getTeamId,
} from "@/lib/queries";
import { PlayerExplorer } from "@/components/PlayerExplorer";
import { Hero } from "@/components/ui/Hero";
import { IconUsers } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Players" };

export default async function PlayersPage() {
  const sb = getSupabase();
  const season = await getCurrentSeason(sb);
  const teamId = await getTeamId(sb).catch(() => null);

  let squadCodes = new Set<number>();
  if (teamId) {
    const gw = await getLatestGameweek(sb, teamId, season).catch(() => null);
    if (gw) squadCodes = await getSquadCodes(sb, teamId, season, gw);
  }

  const players = await getPlayers(sb, season, squadCodes);
  const teams = [...new Set(players.map((p) => p.team))].sort();

  return (
    <main className="animate-fade-in mx-auto w-full max-w-5xl px-4 py-6">
      <Hero
        icon={<IconUsers className="h-4 w-4" />}
        eyebrow={season}
        title="Player explorer"
        stats={[
          { label: "Players", value: players.length, accent: true },
          { label: "Available", value: players.filter((p) => p.status === "a").length },
          { label: "In your squad", value: players.filter((p) => p.inSquad).length },
        ]}
      />
      <PlayerExplorer players={players} teams={teams} />
    </main>
  );
}
