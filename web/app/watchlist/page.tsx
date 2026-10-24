import type { Metadata } from "next";
import Link from "next/link";
import { getWorkspace } from "@/lib/workspace";
import { getLatestGameweek, getPlayers, getSquadCodes } from "@/lib/queries";
import { Hero } from "@/components/ui/Hero";
import { PlayerExplorer } from "@/components/PlayerExplorer";
import { IconStar } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Watchlist" };
export default async function WatchlistPage() {
  const { sb, season, teamId } = await getWorkspace();
  const gameweek = await getLatestGameweek(sb, teamId, season);
  const codes = await getSquadCodes(sb, teamId, season, gameweek);
  const players = await getPlayers(sb, season, codes);
  return <main className="page-container animate-fade-in"><Hero title="Keep an eye on possibility." eyebrow="Your watchlist" icon={<IconStar />} subtitle="Your saved players, with the latest prices and form. Saved on this device for this season." />
    <div className="mb-5 flex flex-wrap gap-4"><Link href="/players" className="text-link">Explore all players →</Link><Link href="/planner" className="text-link">Try a transfer plan →</Link></div>
    <PlayerExplorer players={players} teams={[...new Set(players.map(p => p.team))].sort()} season={season} onlyWatchlist />
  </main>;
}
