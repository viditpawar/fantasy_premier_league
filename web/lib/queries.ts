import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AdvisorSuggestion,
  Budget,
  GameweekHistoryPoint,
  POSITION_NAMES,
  SquadPlayer,
  TopScorer,
  UpcomingFixture,
} from "./types";

export async function getCurrentSeason(sb: SupabaseClient): Promise<string> {
  const { data, error } = await sb
    .from("gameweeks")
    .select("season")
    .eq("is_current", true)
    .limit(1)
    .single();
  if (error) throw error;
  return data.season;
}

export async function getTeamId(sb: SupabaseClient): Promise<number> {
  const { data, error } = await sb.from("managers").select("team_id").limit(1).single();
  if (error) throw error;
  return data.team_id;
}

export async function getLatestGameweek(
  sb: SupabaseClient,
  teamId: number,
  season: string,
): Promise<number> {
  const { data, error } = await sb
    .from("manager_gameweek_history")
    .select("gameweek")
    .eq("team_id", teamId)
    .eq("season", season)
    .order("gameweek", { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data.gameweek;
}

export async function getBudget(
  sb: SupabaseClient,
  teamId: number,
  season: string,
  gameweek: number,
): Promise<Budget> {
  const { data, error } = await sb
    .from("manager_gameweek_history")
    .select("bank, team_value, total_points, overall_rank")
    .eq("team_id", teamId)
    .eq("season", season)
    .eq("gameweek", gameweek)
    .single();
  if (error) throw error;
  return {
    bank: data.bank,
    teamValue: data.team_value,
    totalPoints: data.total_points,
    overallRank: data.overall_rank,
  };
}

async function getUpcomingFixturesForTeam(
  sb: SupabaseClient,
  season: string,
  teamId: number,
  n = 3,
): Promise<UpcomingFixture[]> {
  const { data, error } = await sb
    .from("fixtures")
    .select("team_h, team_a, team_h_difficulty, team_a_difficulty, kickoff_time, finished")
    .eq("season", season)
    .eq("finished", false)
    .or(`team_h.eq.${teamId},team_a.eq.${teamId}`)
    .order("kickoff_time", { ascending: true })
    .limit(n);
  if (error) throw error;

  const opponentIds = data.map((f) => (f.team_h === teamId ? f.team_a : f.team_h));
  const { data: teams } = await sb
    .from("teams")
    .select("id, short_name")
    .eq("season", season)
    .in("id", opponentIds.length ? opponentIds : [-1]);
  const nameById = new Map((teams ?? []).map((t) => [t.id, t.short_name]));

  return data.map((f) => {
    const wasHome = f.team_h === teamId;
    const opponentId = wasHome ? f.team_a : f.team_h;
    return {
      opponent: nameById.get(opponentId) ?? "?",
      wasHome,
      difficulty: wasHome ? f.team_h_difficulty : f.team_a_difficulty,
      kickoffTime: f.kickoff_time,
    };
  });
}

export async function getSquad(
  sb: SupabaseClient,
  teamId: number,
  season: string,
  gameweek: number,
): Promise<SquadPlayer[]> {
  const { data: picks, error: picksError } = await sb
    .from("manager_picks")
    .select("player_id, squad_position, multiplier, is_captain, is_vice_captain")
    .eq("team_id", teamId)
    .eq("season", season)
    .eq("gameweek", gameweek)
    .order("squad_position", { ascending: true });
  if (picksError) throw picksError;

  const playerIds = picks.map((p) => p.player_id);
  const { data: players, error: playersError } = await sb
    .from("players")
    .select("id, code, web_name, team_id, element_type, now_cost, status, news")
    .eq("season", season)
    .in("id", playerIds);
  if (playersError) throw playersError;
  const playerById = new Map(players.map((p) => [p.id, p]));

  const teamIds = [...new Set(players.map((p) => p.team_id))];
  const { data: teams, error: teamsError } = await sb
    .from("teams")
    .select("id, code, short_name")
    .eq("season", season)
    .in("id", teamIds);
  if (teamsError) throw teamsError;
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const playerCodes = players.map((p) => p.code);
  const { data: stats } = await sb
    .from("player_gameweek_stats")
    .select("player_code, total_points")
    .eq("season", season)
    .eq("gameweek", gameweek)
    .in("player_code", playerCodes.length ? playerCodes : [-1]);
  const pointsByCode = new Map((stats ?? []).map((s) => [s.player_code, s.total_points]));

  const fixturesByTeam = new Map<number, UpcomingFixture[]>();
  await Promise.all(
    teamIds.map(async (tid) => {
      fixturesByTeam.set(tid, await getUpcomingFixturesForTeam(sb, season, tid));
    }),
  );

  return picks.map((pick) => {
    const player = playerById.get(pick.player_id)!;
    const team = teamById.get(player.team_id);
    return {
      player: player.web_name,
      elementType: player.element_type,
      position: POSITION_NAMES[player.element_type],
      team: team?.short_name ?? "?",
      teamId: player.team_id,
      teamCode: team?.code ?? 0,
      playerCode: player.code,
      nowCost: player.now_cost,
      price: player.now_cost / 10,
      status: player.status,
      news: player.news,
      squadPosition: pick.squad_position,
      multiplier: pick.multiplier,
      isCaptain: pick.is_captain,
      isViceCaptain: pick.is_vice_captain,
      lastGameweekPoints: pointsByCode.get(player.code) ?? 0,
      upcomingFixtures: fixturesByTeam.get(player.team_id) ?? [],
    };
  });
}

export async function getTopScorers(
  sb: SupabaseClient,
  season: string,
  limit = 15,
): Promise<TopScorer[]> {
  const { data: stats, error } = await sb
    .from("player_gameweek_stats")
    .select("player_code, total_points, goals_scored, assists")
    .eq("season", season);
  if (error) throw error;

  const totals = new Map<number, { points: number; goals: number; assists: number }>();
  for (const s of stats) {
    const entry = totals.get(s.player_code) ?? { points: 0, goals: 0, assists: 0 };
    entry.points += s.total_points;
    entry.goals += s.goals_scored;
    entry.assists += s.assists;
    totals.set(s.player_code, entry);
  }

  const codes = [...totals.keys()];
  const { data: players, error: playersError } = await sb
    .from("players")
    .select("code, web_name, team_id")
    .eq("season", season)
    .in("code", codes.length ? codes : [-1]);
  if (playersError) throw playersError;

  const teamIds = [...new Set(players.map((p) => p.team_id))];
  const { data: teams } = await sb
    .from("teams")
    .select("id, short_name")
    .eq("season", season)
    .in("id", teamIds.length ? teamIds : [-1]);
  const teamNameById = new Map((teams ?? []).map((t) => [t.id, t.short_name]));

  return players
    .map((p) => {
      const totalsForPlayer = totals.get(p.code)!;
      return {
        player: p.web_name,
        team: teamNameById.get(p.team_id) ?? "?",
        points: totalsForPlayer.points,
        goals: totalsForPlayer.goals,
        assists: totalsForPlayer.assists,
      };
    })
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

export async function getAdvisorSuggestion(
  sb: SupabaseClient,
  teamId: number,
  season: string,
): Promise<AdvisorSuggestion | null> {
  const { data, error } = await sb
    .from("advisor_suggestions")
    .select("for_gameweek, free_transfers, suggestion, generated_at")
    .eq("team_id", teamId)
    .eq("season", season)
    .order("for_gameweek", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const suggestion = data.suggestion as {
    transfers: AdvisorSuggestion["transfers"];
    captain: string;
    vice_captain: string;
    captaincy_reasoning: string;
    summary: string;
  };

  return {
    forGameweek: data.for_gameweek,
    freeTransfers: data.free_transfers,
    generatedAt: data.generated_at,
    transfers: suggestion.transfers,
    captain: suggestion.captain,
    viceCaptain: suggestion.vice_captain,
    captaincyReasoning: suggestion.captaincy_reasoning,
    summary: suggestion.summary,
  };
}

export async function getGameweekHistory(
  sb: SupabaseClient,
  teamId: number,
  season: string,
): Promise<GameweekHistoryPoint[]> {
  const { data, error } = await sb
    .from("manager_gameweek_history")
    .select("gameweek, points, total_points, overall_rank")
    .eq("team_id", teamId)
    .eq("season", season)
    .order("gameweek", { ascending: true });
  if (error) throw error;
  return data.map((d) => ({
    gameweek: d.gameweek,
    points: d.points,
    totalPoints: d.total_points,
    overallRank: d.overall_rank,
  }));
}
