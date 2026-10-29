import type { PlayerSeasonRow, Position, SquadPlayer } from "./types";

export interface StudioPlayer {
  code: number; name: string; position: Position; team: string; teamId: number;
  teamCode: number; price: number; status: string; chance: number | null;
  minutes: number; games: number; ppg: number; form: number; lastPoints: number;
}
export interface StudioLineup { starters: number[]; bench: number[]; captain: number; vice: number }
export interface ResearchFixture { gameweek: number; teamH: number; teamA: number; diffH: number | null; diffA: number | null }
export const FORMATIONS = [[3, 4, 3], [3, 5, 2], [4, 3, 3], [4, 4, 2], [4, 5, 1], [5, 2, 3], [5, 3, 2], [5, 4, 1]];
export const PREP_TASKS = [
  { id: "squad", label: "Review all 15 players", hint: "Starting XI, rotation risks and reserve goalkeeper." },
  { id: "news", label: "Check the latest team news", hint: "Review injuries, suspensions and uncertain minutes." },
  { id: "captain", label: "Choose captain & vice", hint: "Two different starters with a fixture." },
  { id: "bench", label: "Set your bench order", hint: "Check which substitute preserves your formation." },
  { id: "transfers", label: "Confirm budget & transfers", hint: "Actual selling values, remaining free moves and hit costs." },
] as const;

export function initialStudioLineup(squad: SquadPlayer[]): StudioLineup {
  const starters = squad.filter(p => p.squadPosition <= 11).sort((a, b) => a.squadPosition - b.squadPosition).map(p => p.playerCode);
  const bench = squad.filter(p => p.squadPosition > 11).sort((a, b) => Number(a.position === "GKP") - Number(b.position === "GKP") || a.squadPosition - b.squadPosition).map(p => p.playerCode);
  const captain = squad.find(p => p.isCaptain && starters.includes(p.playerCode))?.playerCode ?? starters[0] ?? 0;
  const vice = squad.find(p => p.isViceCaptain && p.playerCode !== captain && starters.includes(p.playerCode))?.playerCode ?? starters.find(id => id !== captain) ?? 0;
  return { starters, bench, captain, vice };
}

export function toStudioPlayers(squad: SquadPlayer[], players: PlayerSeasonRow[]): StudioPlayer[] {
  const byCode = new Map(players.map(p => [p.playerCode, p]));
  return squad.map(p => {
    const stats = byCode.get(p.playerCode);
    return { code: p.playerCode, name: p.player, position: p.position, team: p.team,
      teamId: p.teamId, teamCode: p.teamCode, price: p.nowCost, status: p.status,
      chance: stats?.chanceOfPlaying ?? null, minutes: stats?.minutes ?? 0,
      games: stats?.gamesPlayed ?? 0, ppg: stats?.pointsPerGame ?? 0,
      form: stats?.form5 ?? 0, lastPoints: p.lastGameweekPoints };
  });
}

export function formationOf(players: StudioPlayer[], starters: number[]): string {
  const counts = positionCounts(players.filter(p => starters.includes(p.code)));
  return `${counts.DEF}-${counts.MID}-${counts.FWD}`;
}
function positionCounts(players: { position: Position }[]) {
  const counts = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of players) counts[p.position]++;
  return counts;
}
function legalPositions(players: { position: Position }[]) {
  const c = positionCounts(players);
  return players.length === 11 && c.GKP === 1 && c.DEF >= 3 && c.DEF <= 5 && c.MID >= 2 && c.MID <= 5 && c.FWD >= 1 && c.FWD <= 3;
}
export function lineupIssues(players: StudioPlayer[], lineup: StudioLineup): string[] {
  const ids = [...lineup.starters, ...lineup.bench];
  const byCode = new Map(players.map(p => [p.code, p]));
  const issues: string[] = [];
  if (lineup.starters.length !== 11 || lineup.bench.length !== 4 || new Set(ids).size !== 15 || ids.some(id => !byCode.has(id)) || players.length !== 15) issues.push("Your lineup must contain all 15 players exactly once.");
  const xi = lineup.starters.flatMap(id => byCode.has(id) ? [byCode.get(id)!] : []);
  if (!legalPositions(xi)) issues.push("Use one goalkeeper, at least three defenders and at least one forward.");
  if (!lineup.starters.includes(lineup.captain) || !lineup.starters.includes(lineup.vice) || lineup.captain === lineup.vice) issues.push("Choose a different captain and vice-captain from your starting XI.");
  if (lineup.bench.filter(id => byCode.get(id)?.position === "GKP").length !== 1 || byCode.get(lineup.bench[3])?.position !== "GKP") issues.push("Keep the reserve goalkeeper separate from the three ordered outfield substitutes.");
  return issues;
}

export function swapLineup(players: StudioPlayer[], lineup: StudioLineup, out: number, incoming: number): StudioLineup | null {
  if (!lineup.starters.includes(out) || !lineup.bench.includes(incoming)) return null;
  const starters = lineup.starters.map(id => id === out ? incoming : id);
  const bench = lineup.bench.map(id => id === incoming ? out : id);
  const byCode = new Map(players.map(p => [p.code, p]));
  const ordered = [...bench.filter(id => byCode.get(id)?.position !== "GKP"), ...bench.filter(id => byCode.get(id)?.position === "GKP")];
  const next = { starters, bench: ordered, captain: lineup.captain === out ? incoming : lineup.captain, vice: lineup.vice === out ? incoming : lineup.vice };
  return lineupIssues(players, next).length ? null : next;
}

export function fixtureWindow(fixtures: ResearchFixture[], teamId: number, target: number, horizon: number) {
  const weeks = Array.from({ length: Math.max(0, Math.min(horizon, 39 - target)) }, (_, i) => target + i);
  const cells = weeks.map(gw => fixtures.filter(f => f.gameweek === gw && (f.teamH === teamId || f.teamA === teamId)));
  const matches = cells.flat();
  const ratings = matches.map(f => f.teamH === teamId ? f.diffH : f.diffA).filter((n): n is number => n != null);
  return { average: ratings.length ? ratings.reduce((sum, n) => sum + n, 0) / ratings.length : null,
    fixtures: matches.length, blanks: cells.filter(c => !c.length).length,
    doubles: cells.filter(c => c.length > 1).length, unknown: matches.length - ratings.length };
}

/** A transparent shortlist index, not calibrated expected points. */
export function captainIndex(player: StudioPlayer, fixtures: ResearchFixture[], target: number): number {
  if (["i", "s", "u", "n"].includes(player.status) || player.chance === 0) return 0;
  const matches = fixtures.filter(f => f.gameweek === target && (f.teamH === player.teamId || f.teamA === player.teamId));
  const sample = player.games ? Math.min(1, player.minutes / (player.games * 75)) : 0;
  const risk = player.chance != null ? player.chance / 100 : player.status === "d" ? 0.75 : 1;
  return player.ppg * sample * risk * matches.reduce((sum, f) => sum + 1 + (3 - ((f.teamH === player.teamId ? f.diffH : f.diffA) ?? 3)) * 0.08, 0);
}

export function suggestLineup(players: StudioPlayer[], fixtures: ResearchFixture[], target: number): StudioLineup | null {
  const groups = Object.fromEntries((["GKP", "DEF", "MID", "FWD"] as Position[]).map(pos => [pos,
    players.filter(p => p.position === pos).sort((a, b) => captainIndex(b, fixtures, target) - captainIndex(a, fixtures, target) || a.code - b.code)])) as Record<Position, StudioPlayer[]>;
  let best: StudioPlayer[] = [], score = -Infinity;
  for (const [d, m, f] of FORMATIONS) {
    if (groups.GKP.length < 1 || groups.DEF.length < d || groups.MID.length < m || groups.FWD.length < f) continue;
    const xi = [...groups.GKP.slice(0, 1), ...groups.DEF.slice(0, d), ...groups.MID.slice(0, m), ...groups.FWD.slice(0, f)];
    const total = xi.reduce((sum, p) => sum + captainIndex(p, fixtures, target), 0);
    if (total > score) { score = total; best = xi; }
  }
  if (!best.length || score <= 0) return null;
  const ids = best.map(p => p.code);
  const bench = players.filter(p => !ids.includes(p.code)).sort((a, b) => Number(a.position === "GKP") - Number(b.position === "GKP") || captainIndex(b, fixtures, target) - captainIndex(a, fixtures, target));
  const captains = [...best].sort((a, b) => captainIndex(b, fixtures, target) - captainIndex(a, fixtures, target));
  return { starters: ids, bench: bench.map(p => p.code), captain: captains[0].code, vice: captains[1].code };
}

function combinations<T>(values: T[], n: number): T[][] {
  if (!n) return [[]];
  return values.flatMap((v, i) => combinations(values.slice(i + 1), n - 1).map(rest => [v, ...rest]));
}
export function rehearseLineup(players: StudioPlayer[], lineup: StudioLineup, minutes: Record<number, number>) {
  const issues = lineupIssues(players, lineup);
  if (issues.length) return { issues, fielded: [] as number[], substitutions: [] as { out: number; in: number }[], captain: null as number | null };
  const byCode = new Map(players.map(p => [p.code, p]));
  let xi = [...lineup.starters];
  const substitutions: { out: number; in: number }[] = [];
  const keeper = xi.find(id => byCode.get(id)!.position === "GKP")!;
  const reserve = lineup.bench[3];
  if ((minutes[keeper] ?? 90) === 0 && (minutes[reserve] ?? 90) > 0) {
    xi = xi.map(id => id === keeper ? reserve : id);
    substitutions.push({ out: keeper, in: reserve });
  }
  const absent = xi.filter(id => byCode.get(id)!.position !== "GKP" && (minutes[id] ?? 90) === 0);
  const bench = lineup.bench.slice(0, 3).filter(id => (minutes[id] ?? 90) > 0);
  for (let n = Math.min(absent.length, bench.length); n >= 0; n--) {
    for (const incoming of combinations(bench, n)) for (const outgoing of combinations(absent, n)) {
      const next = [...xi.filter(id => !outgoing.includes(id)), ...incoming];
      if (!legalPositions(next.map(id => byCode.get(id)!))) continue;
      substitutions.push(...outgoing.map((id, i) => ({ out: id, in: incoming[i] })));
      const fielded = next.filter(id => (minutes[id] ?? 90) > 0);
      const captain = (minutes[lineup.captain] ?? 90) > 0 ? lineup.captain : (minutes[lineup.vice] ?? 90) > 0 ? lineup.vice : null;
      return { issues: [], fielded, substitutions, captain };
    }
  }
  return { issues: ["Unable to resolve this formation."], fielded: [] as number[], substitutions, captain: null as number | null };
}

export interface PrepState { checked: string[]; notes: string }
export function parsePrep(value: unknown): PrepState {
  if (!value || typeof value !== "object") return { checked: [], notes: "" };
  const data = value as Partial<PrepState>;
  return { checked: Array.isArray(data.checked) ? [...new Set(data.checked.filter((id): id is string => typeof id === "string" && PREP_TASKS.some(task => task.id === id)))] : [], notes: typeof data.notes === "string" ? data.notes.slice(0, 4000) : "" };
}
export function parseStudio(value: unknown, fallback: StudioLineup): StudioLineup {
  if (!value || typeof value !== "object") return fallback;
  const data = value as StudioLineup;
  if (![data.starters, data.bench].every(v => Array.isArray(v) && v.every(n => Number.isSafeInteger(n) && n > 0)) || !Number.isSafeInteger(data.captain) || !Number.isSafeInteger(data.vice)) return fallback;
  return { starters: data.starters, bench: data.bench, captain: data.captain, vice: data.vice };
}

export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function deadlineCalendar(deadline: string, gameweek: number, season: string): string {
  const date = new Date(deadline);
  if (!Number.isFinite(date.getTime()) || !Number.isInteger(gameweek) || gameweek < 1 || gameweek > 38) throw new Error("A valid deadline is needed to export a reminder.");
  const stamp = (d: Date) => d.toISOString().replaceAll(/[-:]/g, "").replace(/\.\d{3}/, "");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FPL Cockpit//Gameweek preparation//EN", "BEGIN:VEVENT", `UID:fpl-${season.replace(/[^a-z0-9-]/gi, "")}-gw${gameweek}@fpl-cockpit`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(date)}`, `DTEND:${stamp(new Date(date.getTime() + 15 * 60000))}`, `SUMMARY:FPL Gameweek ${gameweek} deadline`, "DESCRIPTION:Review your XI and captain. Check bench order and transfers on the official FPL website.", "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:FPL deadline in two hours", "END:VALARM", "END:VEVENT", "END:VCALENDAR", ""].join("\r\n");
}
