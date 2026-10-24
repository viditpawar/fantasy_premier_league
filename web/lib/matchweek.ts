import type { LivePlayer } from "./types";

/** Saved FPL multipliers are authoritative for autosubs, captain fallback and chips. */
export function matchweekTotals(players: LivePlayer[]) {
  return {
    liveTotal: players.reduce((sum, p) => sum + p.livePoints * p.multiplier, 0),
    benchPoints: players.filter(p => p.squadPosition > 11).reduce((sum, p) => sum + p.livePoints, 0),
    playersYetToPlay: players.filter(p => p.multiplier > 0 && p.hasFixture && !p.fixtureFinished && p.minutes === 0).length,
    playersPlaying: players.filter(p => p.multiplier > 0 && p.hasFixture && !p.fixtureFinished && p.minutes > 0).length,
    captain: players.find(p => p.multiplier > 1)?.player ?? players.find(p => p.isCaptain)?.player ?? null,
  };
}
