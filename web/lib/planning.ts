import type { PlayerSeasonRow, Position } from "./types";

export interface PlanPick { code: number; slot: number; sellingPrice: number | null }
export interface PlanMove { out: number; in: number }
export interface PlanWeek { gameweek: number; moves: PlanMove[] }
export interface PlanResult {
  gameweek: number; squad: PlanPick[]; bank: number | null; freeBefore: number | null;
  freeAfter: number | null; hitCost: number; errors: string[]; warnings: string[];
}

/** Accept FPL money units without silently rounding impossible prices. */
export function parseMillions(value: string): number | null {
  if (!/^\d+(?:\.\d)?$/.test(value.trim())) return null;
  const units = Number(value) * 10;
  return Number.isSafeInteger(Math.round(units)) && Number(value) <= 200 ? Math.round(units) : null;
}

export function squadErrors(picks: PlanPick[], players: Map<number, PlayerSeasonRow>, checkClubs = true): string[] {
  const errors: string[] = [];
  if (picks.length !== 15 || new Set(picks.map(p => p.code)).size !== 15) errors.push("Select 15 different players.");
  if (new Set(picks.map(p => p.slot)).size !== 15 || picks.some(p => !Number.isInteger(p.slot) || p.slot < 1 || p.slot > 15)) errors.push("Every lineup slot from 1 to 15 must appear once.");
  const positions: Record<string, number> = {};
  const starters: Record<string, number> = {};
  const clubs = new Map<number, number>();
  for (const pick of picks) {
    const p = players.get(pick.code);
    if (!p) { errors.push("A saved player is no longer in this season's data. Update your squad."); continue; }
    positions[p.position] = (positions[p.position] ?? 0) + 1;
    if (pick.slot <= 11) starters[p.position] = (starters[p.position] ?? 0) + 1;
    clubs.set(p.teamId, (clubs.get(p.teamId) ?? 0) + 1);
    if (pick.sellingPrice != null && (!Number.isInteger(pick.sellingPrice) || pick.sellingPrice <= 0 || pick.sellingPrice > p.nowCost)) errors.push(`Check ${p.player}'s selling price against current FPL prices.`);
  }
  if (positions.GKP !== 2 || positions.DEF !== 5 || positions.MID !== 5 || positions.FWD !== 3) errors.push("A squad needs 2 goalkeepers, 5 defenders, 5 midfielders and 3 forwards.");
  if (starters.GKP !== 1 || !(starters.DEF >= 3 && starters.DEF <= 5) || !(starters.MID >= 2 && starters.MID <= 5) || !(starters.FWD >= 1 && starters.FWD <= 3)) errors.push("Your starting XI needs one goalkeeper, at least three defenders and at least one forward.");
  if (checkClubs && [...clubs.values()].some(n => n > 3)) errors.push("Your squad exceeds three players from one club. Resolve that before planning further transfers.");
  return [...new Set(errors)];
}

/** Simulate ordinary transfers at today's prices; chips/price forecasts are excluded. */
export function simulatePlan(initial: PlanPick[], players: PlayerSeasonRow[], bank: number | null, remaining: number | null, weeks: PlanWeek[]): PlanResult[] {
  const byCode = new Map(players.map(p => [p.playerCode, p]));
  let squad = initial.map(p => ({ ...p }));
  let available = remaining;
  let funds = bank;
  let blocked = false;
  return weeks.map((week, index) => {
    const errors = index === 0 ? squadErrors(squad, byCode, false) : [];
    const warnings: string[] = [];
    if (blocked) errors.push("Resolve the earlier gameweek before using this week's totals.");
    if (index > 0 && week.gameweek !== weeks[index - 1].gameweek + 1) errors.push("Plan consecutive gameweeks.");
    if (funds == null || !Number.isInteger(funds) || funds < 0) errors.push("Enter your current bank to check affordability.");
    if (available == null || !Number.isInteger(available) || available < 0 || available > 5) errors.push("Enter your remaining free transfers (0 to 5).");
    const before = available;
    const next = squad.map(p => ({ ...p }));
    const outs = new Set<number>(), ins = new Set<number>();
    let delta = 0;
    for (const move of week.moves) {
      const outgoing = next.find(p => p.code === move.out);
      const incoming = byCode.get(move.in);
      const oldPlayer = byCode.get(move.out);
      // Transfers within a week form a simultaneous bundle, not a resale chain.
      if (outs.has(move.out) || ins.has(move.in)) { errors.push("A player can appear only once on each side of a gameweek's transfers."); continue; }
      outs.add(move.out); ins.add(move.in);
      if (!outgoing || !oldPlayer || !incoming || !squad.some(p => p.code === move.out)) { errors.push("Choose an owned outgoing player and an incoming player."); continue; }
      if (squad.some(p => p.code === move.in)) errors.push(`${incoming.player} is already in your squad at the start of this week.`);
      if (incoming.position !== oldPlayer.position) errors.push("Incoming and outgoing players must share an FPL position.");
      if (outgoing.sellingPrice == null) errors.push(`Enter ${oldPlayer.player}'s actual selling price in squad setup.`);
      else delta += outgoing.sellingPrice - incoming.nowCost;
      if (incoming.status !== "a" || (incoming.chanceOfPlaying != null && incoming.chanceOfPlaying < 100)) warnings.push(`${incoming.player}: ${incoming.news || "check availability before transferring."}`);
      outgoing.code = incoming.playerCode;
      outgoing.sellingPrice = incoming.nowCost;
    }
    errors.push(...squadErrors(next, byCode));
    const nextFunds = funds == null ? null : funds + delta;
    if (nextFunds != null && nextFunds < 0) errors.push("This week's transfer bundle exceeds your bank and actual selling proceeds.");
    const hitCost = available == null ? 0 : Math.max(0, week.moves.length - available) * 4;
    const after = available == null ? null : Math.max(0, available - week.moves.length);
    const unique = [...new Set(errors)];
    if (unique.length) blocked = true;
    if (!blocked) { squad = next; funds = nextFunds; available = after == null ? null : Math.min(5, after + 1); }
    return { gameweek: week.gameweek, squad: blocked ? squad.map(p => ({ ...p })) : next,
      bank: blocked ? null : nextFunds, freeBefore: before, freeAfter: blocked ? null : after,
      hitCost, errors: unique, warnings: [...new Set(warnings)] };
  });
}

export interface FixtureEntry { difficulty: number | null }
export interface GridFixture { gameweek: number; teamH: number; teamA: number; diffH: number | null; diffA: number | null }
export function fixturesForTeam(fixtures: GridFixture[], teamId: number, gameweek: number) {
  return fixtures.filter(f => f.gameweek === gameweek && (f.teamH === teamId || f.teamA === teamId)).map(f => ({
    opponentId: f.teamH === teamId ? f.teamA : f.teamH,
    home: f.teamH === teamId, difficulty: f.teamH === teamId ? f.diffH : f.diffA,
  }));
}
/** Average difficulty per scheduled match; blanks/doubles reported separately. */
export function fixtureRun(cells: { entries: FixtureEntry[] }[]) {
  const entries = cells.flatMap(c => c.entries);
  const known = entries.filter((e): e is { difficulty: number } => e.difficulty != null);
  return {
    average: known.length ? known.reduce((n, e) => n + e.difficulty, 0) / known.length : null,
    fixtures: entries.length, blanks: cells.filter(c => c.entries.length === 0).length,
    doubles: cells.filter(c => c.entries.length > 1).length,
    unknown: entries.length - known.length,
  };
}

/** Maximum players that can fill a legal XI, respecting positional capacity. */
export function playableCount(positions: Position[]): number {
  const counts = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const position of positions) counts[position]++;
  let best = 0;
  for (let d = 3; d <= 5; d++) for (let m = 2; m <= 5; m++) {
    const f = 10 - d - m;
    if (f >= 1 && f <= 3) best = Math.max(best, Math.min(1, counts.GKP) + Math.min(d, counts.DEF) + Math.min(m, counts.MID) + Math.min(f, counts.FWD));
  }
  return best;
}
