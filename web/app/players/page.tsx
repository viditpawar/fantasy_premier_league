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
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-fg">Player explorer</h1>
        <span className="text-sm text-fg-muted">{season}</span>
      </header>
      <PlayerExplorer players={players} teams={teams} />
    </main>
  );
}
