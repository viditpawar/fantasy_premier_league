"use client";
import type { SquadPlayer } from "@/lib/types";
import { usePlayerSheet } from "./PlayerSheetProvider";
import { PlayerKit } from "./PlayerKit";
export function PlayerCard({ player, live }: { player: SquadPlayer; live?: number }) {
  const { open } = usePlayerSheet();
  const fixture = player.upcomingFixtures[0];
  const points = (live ?? player.lastGameweekPoints) * (player.multiplier || 1);
  return <button onClick={() => open(player)} className="pitch-player" aria-label={`${player.player}, ${player.position}, ${points} points${player.isCaptain ? ", captain" : ""}. View details`}>
    <PlayerKit code={player.teamCode} goalkeeper={player.position === "GKP"} />
    {(player.isCaptain || player.isViceCaptain) && <span className="player-captain">{player.isCaptain ? "C" : "V"}</span>}
    {player.status !== "a" && <span className="absolute -top-1 left-3 grid h-3.5 w-3.5 place-items-center rounded-full bg-warning text-[8px] text-white" title={player.news || "Check availability"}>!</span>}
    <div className="player-label"><strong>{player.player}</strong><span>{fixture ? `${fixture.opponent} (${fixture.wasHome ? "H" : "A"})` : "No fixture"}</span></div>
    <span className="player-points"><b className="font-semibold">{points}</b> {live != null ? "live pts" : "pts"}</span>
  </button>;
}
