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
