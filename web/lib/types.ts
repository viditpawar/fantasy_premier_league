export type Position = "GKP" | "DEF" | "MID" | "FWD";

export const POSITION_NAMES: Record<number, Position> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

export interface UpcomingFixture {
  opponent: string;
  wasHome: boolean;
  difficulty: number | null;
  kickoffTime: string | null;
}

export interface SquadPlayer {
  player: string;
  elementType: number;
  position: Position;
  team: string;
  teamId: number;
  teamCode: number;
  playerCode: number;
  nowCost: number;
  price: number;
  status: string;
  news: string;
  squadPosition: number;
  multiplier: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
  lastGameweekPoints: number;
  upcomingFixtures: UpcomingFixture[];
}

export interface Budget {
  bank: number;
  teamValue: number;
  totalPoints: number;
  overallRank: number;
}

export interface TopScorer {
  player: string;
  team: string;
  points: number;
  goals: number;
  assists: number;
  playerCode: number;
}

export interface GameweekHistoryPoint {
  gameweek: number;
  points: number;
  totalPoints: number;
  overallRank: number;
}

export interface SuggestedTransfer {
  player_out: string;
  player_in: string;
  position: Position;
  reasoning: string;
}

export interface AdvisorSuggestion {
  forGameweek: number;
  freeTransfers: number;
  generatedAt: string;
  recommendedTransfers: SuggestedTransfer[];
  hitTransfers: SuggestedTransfer[];
  captain: string;
  viceCaptain: string;
  captaincyReasoning: string;
  summary: string;
}

export type LeagueType = "classic" | "h2h";

export interface ManagerLeague {
  leagueId: number;
  leagueName: string;
  leagueType: LeagueType;
  entryRank: number | null;
  entryLastRank: number | null;
}

export interface LeagueStandingRow {
  entryTeamId: number;
  entryName: string;
  playerName: string;
  rank: number;
  lastRank: number;
  total: number;
  eventTotal: number | null;
}

export interface GameweekMeta {
  id: number;
  name: string;
  deadlineTime: string | null;
  averageEntryScore: number | null;
  highestScore: number | null;
  finished: boolean;
  isCurrent: boolean;
  isNext: boolean;
}

export interface PlayerSeasonRow {
  playerCode: number;
  playerId: number;
  player: string;
  team: string;
  teamId: number;
  teamCode: number;
  position: Position;
  elementType: number;
  price: number;
  nowCost: number;
  status: string;
  news: string;
  chanceOfPlaying: number | null;
  gamesPlayed: number;
  totalPoints: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  minutes: number;
  bonus: number;
  bps: number;
  ictIndex: number;
  pointsPerGame: number;
  pointsPerMillion: number;
  ownership: number | null;
  form5: number;
  formSeries: number[];
  inSquad: boolean;
}

export interface PlayerGameLogRow {
  gameweek: number;
  opponent: string;
  wasHome: boolean;
  difficulty: number | null;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  goalsConceded: number;
  bonus: number;
  bps: number;
  ictIndex: number;
  totalPoints: number;
  value: number | null;
}

export interface PlayerDetail {
  meta: PlayerSeasonRow;
  gameLog: PlayerGameLogRow[];
  upcomingFixtures: UpcomingFixture[];
}

export interface ManagerGameweekRow {
  gameweek: number;
  points: number;
  totalPoints: number;
  overallRank: number | null;
  pointsOnBench: number;
  transferCost: number;
  averageEntryScore: number | null;
  vsAverage: number | null;
}

export interface ManagerAnalytics {
  rows: ManagerGameweekRow[];
  teamValueSeries: { gameweek: number; value: number }[];
  averagePoints: number;
  bestGameweek: { gameweek: number; points: number } | null;
  worstGameweek: { gameweek: number; points: number } | null;
  greenArrows: number;
  redArrows: number;
  totalBenchPoints: number;
  totalHitCost: number;
  currentRank: number | null;
  startRank: number | null;
}

export interface LivePlayer {
  player: string;
  playerCode: number;
  teamCode: number;
  team: string;
  position: Position;
  squadPosition: number;
  multiplier: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
  livePoints: number; // raw, before multiplier
  minutes: number;
  fixtureFinished: boolean;
  hasFixture: boolean;
}

export interface LiveGameweek {
  gameweek: number;
  finished: boolean;
  players: LivePlayer[];
  liveTotal: number; // starting XI incl. captain multiplier
  benchPoints: number;
  playersYetToPlay: number;
  playersPlaying: number;
  captain: string | null;
  averageEntryScore: number | null;
}

export interface LeagueRival {
  entryTeamId: number;
  entryName: string;
  playerName: string;
  rank: number;
  lastRank: number;
  total: number;
  eventTotal: number | null;
  isMe: boolean;
}

export interface LeagueRivalsView {
  leagueId: number;
  leagueName: string;
  podium: LeagueRival[];
  nearby: LeagueRival[];
  me: LeagueRival | null;
  gapToFirst: number | null;
  gapToPodium: number | null;
  gapToNextRank: number | null;
}
