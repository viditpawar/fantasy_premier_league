import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AdvisorSuggestion,
  Budget,
  GameweekHistoryPoint,
  GameweekMeta,
  LeagueRival,
  LeagueRivalsView,
  LeagueStandingRow,
  LeagueType,
  LiveGameweek,
  LivePlayer,
  ManagerAnalytics,
  ManagerGameweekRow,
  ManagerLeague,
  PlayerDetail,
  PlayerGameLogRow,
  PlayerSeasonRow,
  POSITION_NAMES,
  Position,
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
  const { data, error } = await sb
    .from("v_player_season")
    .select("web_name, team_short_name, total_points, goals_scored, assists, player_code")
    .eq("season", season)
    .order("total_points", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((p) => ({
    player: p.web_name,
    team: p.team_short_name ?? "?",
    points: p.total_points,
    goals: p.goals_scored,
    assists: p.assists,
    playerCode: p.player_code,
  }));
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
    recommended_transfers: AdvisorSuggestion["recommendedTransfers"];
    hit_transfers: AdvisorSuggestion["hitTransfers"];
    captain: string;
    vice_captain: string;
    captaincy_reasoning: string;
    summary: string;
  };

  return {
    forGameweek: data.for_gameweek,
    freeTransfers: data.free_transfers,
    generatedAt: data.generated_at,
    recommendedTransfers: suggestion.recommended_transfers ?? [],
    hitTransfers: suggestion.hit_transfers ?? [],
    captain: suggestion.captain,
    viceCaptain: suggestion.vice_captain,
    captaincyReasoning: suggestion.captaincy_reasoning,
    summary: suggestion.summary,
  };
}

export async function getManagerLeagues(
  sb: SupabaseClient,
  teamId: number,
  season: string,
): Promise<ManagerLeague[]> {
  const { data, error } = await sb
    .from("manager_leagues")
    .select("league_id, league_name, league_type, entry_rank, entry_last_rank")
    .eq("team_id", teamId)
    .eq("season", season)
    .order("league_type", { ascending: true })
    .order("league_name", { ascending: true });
  if (error) throw error;
  return data.map((l) => ({
    leagueId: l.league_id,
    leagueName: l.league_name,
    leagueType: l.league_type as LeagueType,
    entryRank: l.entry_rank,
    entryLastRank: l.entry_last_rank,
  }));
}

export async function getLeagueStandings(
  sb: SupabaseClient,
  leagueId: number,
  season: string,
): Promise<LeagueStandingRow[]> {
  const { data, error } = await sb
    .from("league_standings")
    .select("entry_team_id, entry_name, player_name, rank, last_rank, total, event_total")
    .eq("league_id", leagueId)
    .eq("season", season)
    .order("rank", { ascending: true });
  if (error) throw error;
  return data.map((r) => ({
    entryTeamId: r.entry_team_id,
    entryName: r.entry_name,
    playerName: r.player_name,
    rank: r.rank,
    lastRank: r.last_rank,
    total: r.total,
    eventTotal: r.event_total,
  }));
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

// --- Gameweek metadata -------------------------------------------------------

export async function getGameweekMeta(
  sb: SupabaseClient,
  season: string,
): Promise<{ current: GameweekMeta | null; next: GameweekMeta | null }> {
  const { data, error } = await sb
    .from("gameweeks")
    .select("id, name, deadline_time, average_entry_score, highest_score, finished, is_current, is_next")
    .eq("season", season)
    .order("id", { ascending: true });
  if (error) throw error;
  const map = (g: (typeof data)[number]): GameweekMeta => ({
    id: g.id,
    name: g.name,
    deadlineTime: g.deadline_time,
    averageEntryScore: g.average_entry_score,
    highestScore: g.highest_score,
    finished: g.finished,
    isCurrent: g.is_current,
    isNext: g.is_next,
  });
  return {
    current: (data ?? []).filter((g) => g.is_current).map(map)[0] ?? null,
    next: (data ?? []).filter((g) => g.is_next).map(map)[0] ?? null,
  };
}

export interface TickerTeam {
  id: number;
  shortName: string;
  code: number;
  strengthAttackHome: number;
  strengthAttackAway: number;
  strengthDefenceHome: number;
  strengthDefenceAway: number;
}
export interface TickerFixture {
  gameweek: number;
  teamH: number;
  teamA: number;
  diffH: number | null;
  diffA: number | null;
}

export async function getFixtureTickerData(
  sb: SupabaseClient,
  season: string,
  fromGameweek: number,
  ownedTeamIds: number[] = [],
): Promise<{
  teams: TickerTeam[];
  fixtures: TickerFixture[];
  gameweeks: number[];
  owned: number[];
}> {
  const [{ data: teams, error: tErr }, { data: fixtures, error: fErr }] = await Promise.all([
    sb
      .from("teams")
      .select(
        "id, short_name, code, strength_attack_home, strength_attack_away, strength_defence_home, strength_defence_away",
      )
      .eq("season", season),
    sb
      .from("fixtures")
      .select("gameweek, team_h, team_a, team_h_difficulty, team_a_difficulty")
      .eq("season", season)
      .gte("gameweek", fromGameweek)
      .not("gameweek", "is", null)
      .order("gameweek", { ascending: true }),
  ]);
  if (tErr) throw tErr;
  if (fErr) throw fErr;

  const gameweeks = [...new Set((fixtures ?? []).map((f) => f.gameweek as number))].sort((a, b) => a - b);

  return {
    teams: (teams ?? []).map((t) => ({
      id: t.id,
      shortName: t.short_name,
      code: t.code ?? 0,
      strengthAttackHome: t.strength_attack_home ?? 1200,
      strengthAttackAway: t.strength_attack_away ?? 1200,
      strengthDefenceHome: t.strength_defence_home ?? 1200,
      strengthDefenceAway: t.strength_defence_away ?? 1200,
    })),
    fixtures: (fixtures ?? []).map((f) => ({
      gameweek: f.gameweek as number,
      teamH: f.team_h,
      teamA: f.team_a,
      diffH: f.team_h_difficulty,
      diffA: f.team_a_difficulty,
    })),
    gameweeks,
    owned: ownedTeamIds,
  };
}

// --- Player explorer & detail --------------------------------------------

const V_PLAYER_COLS =
  "player_code, player_id, web_name, element_type, now_cost, status, news, chance_of_playing_next_round, team_id, team_short_name, team_code, games_played, total_points, goals_scored, assists, clean_sheets, minutes, bonus, bps, ict_index, points_per_game, points_per_million, ownership, form_5, form_series";

function mapPlayerSeason(
  row: Record<string, unknown>,
  squadCodes: Set<number>,
): PlayerSeasonRow {
  const code = row.player_code as number;
  return {
    playerCode: code,
    playerId: row.player_id as number,
    player: row.web_name as string,
    team: (row.team_short_name as string) ?? "?",
    teamId: row.team_id as number,
    teamCode: (row.team_code as number) ?? 0,
    elementType: row.element_type as number,
    position: POSITION_NAMES[row.element_type as number],
    price: (row.now_cost as number) / 10,
    nowCost: row.now_cost as number,
    status: (row.status as string) ?? "a",
    news: (row.news as string) ?? "",
    chanceOfPlaying: (row.chance_of_playing_next_round as number) ?? null,
    gamesPlayed: (row.games_played as number) ?? 0,
    totalPoints: (row.total_points as number) ?? 0,
    goals: (row.goals_scored as number) ?? 0,
    assists: (row.assists as number) ?? 0,
    cleanSheets: (row.clean_sheets as number) ?? 0,
    minutes: (row.minutes as number) ?? 0,
    bonus: (row.bonus as number) ?? 0,
    bps: (row.bps as number) ?? 0,
    ictIndex: Number(row.ict_index ?? 0),
    pointsPerGame: Number(row.points_per_game ?? 0),
    pointsPerMillion: Number(row.points_per_million ?? 0),
    ownership: (row.ownership as number) ?? null,
    form5: Number(row.form_5 ?? 0),
    formSeries: Array.isArray(row.form_series) ? (row.form_series as number[]) : [],
    inSquad: squadCodes.has(code),
  };
}

export async function getSquadCodes(
  sb: SupabaseClient,
  teamId: number,
  season: string,
  gameweek: number,
): Promise<Set<number>> {
  const { data: picks } = await sb
    .from("manager_picks")
    .select("player_id")
    .eq("team_id", teamId)
    .eq("season", season)
    .eq("gameweek", gameweek);
  const ids = (picks ?? []).map((p) => p.player_id);
  if (ids.length === 0) return new Set();
  const { data: players } = await sb
    .from("players")
    .select("code")
    .eq("season", season)
    .in("id", ids);
  return new Set((players ?? []).map((p) => p.code));
}

export async function getPlayers(
  sb: SupabaseClient,
  season: string,
  squadCodes: Set<number> = new Set(),
): Promise<PlayerSeasonRow[]> {
  const { data, error } = await sb
    .from("v_player_season")
    .select(V_PLAYER_COLS)
    .eq("season", season)
    .order("total_points", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapPlayerSeason(r as Record<string, unknown>, squadCodes));
}

export async function getPlayerDetail(
  sb: SupabaseClient,
  season: string,
  playerCode: number,
  squadCodes: Set<number> = new Set(),
): Promise<PlayerDetail | null> {
  const { data: metaRow, error } = await sb
    .from("v_player_season")
    .select(V_PLAYER_COLS)
    .eq("season", season)
    .eq("player_code", playerCode)
    .maybeSingle();
  if (error) throw error;
  if (!metaRow) return null;
  const meta = mapPlayerSeason(metaRow as Record<string, unknown>, squadCodes);

  const { data: stats } = await sb
    .from("player_gameweek_stats")
    .select(
      "gameweek, was_home, opponent_team_id, minutes, goals_scored, assists, clean_sheets, goals_conceded, bonus, bps, ict_index, total_points, value",
    )
    .eq("season", season)
    .eq("player_code", playerCode)
    .order("gameweek", { ascending: true });

  const oppIds = [...new Set((stats ?? []).map((s) => s.opponent_team_id).filter(Boolean))];
  const { data: teams } = await sb
    .from("teams")
    .select("id, short_name")
    .eq("season", season)
    .in("id", oppIds.length ? oppIds : [-1]);
  const teamNameById = new Map((teams ?? []).map((t) => [t.id, t.short_name]));

  const gameLog: PlayerGameLogRow[] = (stats ?? []).map((s) => ({
    gameweek: s.gameweek,
    opponent: teamNameById.get(s.opponent_team_id) ?? "?",
    wasHome: s.was_home ?? false,
    difficulty: null,
    minutes: s.minutes,
    goals: s.goals_scored,
    assists: s.assists,
    cleanSheets: s.clean_sheets,
    goalsConceded: s.goals_conceded,
    bonus: s.bonus,
    bps: s.bps,
    ictIndex: Number(s.ict_index ?? 0),
    totalPoints: s.total_points,
    value: s.value ?? null,
  }));
  meta.formSeries = gameLog.slice(-6).map((g) => g.totalPoints);

  const upcomingFixtures = await getUpcomingFixturesForTeam(sb, season, meta.teamId, 5);

  return { meta, gameLog, upcomingFixtures };
}

// --- Manager analytics ----------------------------------------------------

export async function getManagerAnalytics(
  sb: SupabaseClient,
  teamId: number,
  season: string,
): Promise<ManagerAnalytics> {
  const [{ data: hist, error }, { data: gws }] = await Promise.all([
    sb
      .from("manager_gameweek_history")
      .select("gameweek, points, total_points, overall_rank, points_on_bench, event_transfers_cost, team_value")
      .eq("team_id", teamId)
      .eq("season", season)
      .order("gameweek", { ascending: true }),
    sb.from("gameweeks").select("id, average_entry_score").eq("season", season),
  ]);
  if (error) throw error;
  const avgByGw = new Map((gws ?? []).map((g) => [g.id, g.average_entry_score as number | null]));

  const rows: ManagerGameweekRow[] = (hist ?? []).map((h) => {
    const avg = avgByGw.get(h.gameweek) ?? null;
    return {
      gameweek: h.gameweek,
      points: h.points ?? 0,
      totalPoints: h.total_points ?? 0,
      overallRank: h.overall_rank ?? null,
      pointsOnBench: h.points_on_bench ?? 0,
      transferCost: h.event_transfers_cost ?? 0,
      averageEntryScore: avg,
      vsAverage: avg == null ? null : (h.points ?? 0) - avg,
    };
  });

  const teamValueSeries = (hist ?? []).map((h) => ({
    gameweek: h.gameweek,
    value: (h.team_value ?? 0) / 10,
  }));

  let greenArrows = 0;
  let redArrows = 0;
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1].overallRank;
    const cur = rows[i].overallRank;
    if (prev != null && cur != null) {
      if (cur < prev) greenArrows++;
      else if (cur > prev) redArrows++;
    }
  }

  const best = rows.reduce<ManagerGameweekRow | null>(
    (b, r) => (b == null || r.points > b.points ? r : b),
    null,
  );
  const worst = rows.reduce<ManagerGameweekRow | null>(
    (w, r) => (w == null || r.points < w.points ? r : w),
    null,
  );

  return {
    rows,
    teamValueSeries,
    averagePoints: rows.length ? rows.reduce((s, r) => s + r.points, 0) / rows.length : 0,
    bestGameweek: best ? { gameweek: best.gameweek, points: best.points } : null,
    worstGameweek: worst ? { gameweek: worst.gameweek, points: worst.points } : null,
    greenArrows,
    redArrows,
    totalBenchPoints: rows.reduce((s, r) => s + r.pointsOnBench, 0),
    totalHitCost: rows.reduce((s, r) => s + r.transferCost, 0),
    currentRank: rows.length ? rows[rows.length - 1].overallRank : null,
    startRank: rows.length ? rows[0].overallRank : null,
  };
}

// --- Live gameweek ------------------------------------------------------

export async function getLiveGameweek(
  sb: SupabaseClient,
  teamId: number,
  season: string,
): Promise<LiveGameweek | null> {
  const { current } = await getGameweekMeta(sb, season);
  const { data: latestPick } = await sb
    .from("manager_picks")
    .select("gameweek")
    .eq("team_id", teamId)
    .eq("season", season)
    .order("gameweek", { ascending: false })
    .limit(1)
    .maybeSingle();
  const gameweek = current?.id ?? latestPick?.gameweek;
  if (!gameweek) return null;

  const { data: picks } = await sb
    .from("manager_picks")
    .select("player_id, squad_position, multiplier, is_captain, is_vice_captain")
    .eq("team_id", teamId)
    .eq("season", season)
    .eq("gameweek", gameweek)
    .order("squad_position", { ascending: true });
  if (!picks || picks.length === 0) return null;

  const playerIds = picks.map((p) => p.player_id);
  const { data: players } = await sb
    .from("players")
    .select("id, code, web_name, team_id, element_type")
    .eq("season", season)
    .in("id", playerIds);
  const playerById = new Map((players ?? []).map((p) => [p.id, p]));

  const teamIds = [...new Set((players ?? []).map((p) => p.team_id))];
  const { data: teams } = await sb
    .from("teams")
    .select("id, short_name, code")
    .eq("season", season)
    .in("id", teamIds.length ? teamIds : [-1]);
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));

  const codes = (players ?? []).map((p) => p.code);
  const { data: stats } = await sb
    .from("player_gameweek_stats")
    .select("player_code, total_points, minutes")
    .eq("season", season)
    .eq("gameweek", gameweek)
    .in("player_code", codes.length ? codes : [-1]);
  const statByCode = new Map((stats ?? []).map((s) => [s.player_code, s]));

  const { data: fixtures } = await sb
    .from("fixtures")
    .select("team_h, team_a, finished")
    .eq("season", season)
    .eq("gameweek", gameweek);
  const fixtureFinishedByTeam = new Map<number, boolean>();
  const teamHasFixture = new Set<number>();
  for (const f of fixtures ?? []) {
    teamHasFixture.add(f.team_h);
    teamHasFixture.add(f.team_a);
    fixtureFinishedByTeam.set(f.team_h, (fixtureFinishedByTeam.get(f.team_h) ?? true) && f.finished);
    fixtureFinishedByTeam.set(f.team_a, (fixtureFinishedByTeam.get(f.team_a) ?? true) && f.finished);
  }

  const livePlayers: LivePlayer[] = picks.map((pick) => {
    const player = playerById.get(pick.player_id);
    const team = player ? teamById.get(player.team_id) : undefined;
    const stat = player ? statByCode.get(player.code) : undefined;
    const hasFixture = player ? teamHasFixture.has(player.team_id) : false;
    return {
      player: player?.web_name ?? "?",
      playerCode: player?.code ?? 0,
      teamCode: team?.code ?? 0,
      team: team?.short_name ?? "?",
      position: POSITION_NAMES[player?.element_type ?? 3] as Position,
      squadPosition: pick.squad_position,
      multiplier: pick.multiplier,
      isCaptain: pick.is_captain,
      isViceCaptain: pick.is_vice_captain,
      livePoints: stat?.total_points ?? 0,
      minutes: stat?.minutes ?? 0,
      fixtureFinished: player ? (fixtureFinishedByTeam.get(player.team_id) ?? false) : false,
      hasFixture,
    };
  });

  const starting = livePlayers.filter((p) => p.squadPosition <= 11);
  const bench = livePlayers.filter((p) => p.squadPosition > 11);
  const liveTotal = starting.reduce((s, p) => s + p.livePoints * (p.multiplier || 1), 0);
  const benchPoints = bench.reduce((s, p) => s + p.livePoints, 0);
  const playersYetToPlay = starting.filter((p) => p.hasFixture && !p.fixtureFinished && p.minutes === 0).length;
  const playersPlaying = starting.filter((p) => p.hasFixture && !p.fixtureFinished && p.minutes > 0).length;
  const captain = starting.find((p) => p.isCaptain)?.player ?? null;

  return {
    gameweek,
    finished: current?.finished ?? false,
    players: livePlayers,
    liveTotal,
    benchPoints,
    playersYetToPlay,
    playersPlaying,
    captain,
    averageEntryScore: current?.averageEntryScore ?? null,
  };
}

// --- League rivals ------------------------------------------------------

export async function getLeagueRivals(
  sb: SupabaseClient,
  leagueId: number,
  season: string,
  teamId: number,
  leagueName = "",
  window = 4,
): Promise<LeagueRivalsView> {
  const standings = await getLeagueStandings(sb, leagueId, season);
  const toRival = (r: LeagueStandingRow): LeagueRival => ({
    entryTeamId: r.entryTeamId,
    entryName: r.entryName,
    playerName: r.playerName,
    rank: r.rank,
    lastRank: r.lastRank,
    total: r.total,
    eventTotal: r.eventTotal,
    isMe: r.entryTeamId === teamId,
  });

  const rivals = standings.map(toRival);
  const me = rivals.find((r) => r.isMe) ?? null;
  const podium = rivals.filter((r) => r.rank <= 3);

  let nearby: LeagueRival[] = [];
  if (me) {
    const idx = rivals.findIndex((r) => r.isMe);
    nearby = rivals.slice(Math.max(0, idx - window), idx + window + 1);
  } else {
    nearby = rivals.slice(0, window * 2 + 1);
  }

  const leader = rivals[0] ?? null;
  const third = rivals.find((r) => r.rank === 3) ?? null;
  const above = me ? rivals.find((r) => r.rank === me.rank - 1) ?? null : null;

  return {
    leagueId,
    leagueName,
    podium,
    nearby,
    me,
    gapToFirst: me && leader ? Math.max(0, leader.total - me.total) : null,
    gapToPodium: me && third && me.rank > 3 ? Math.max(0, third.total - me.total) : null,
    gapToNextRank: me && above ? Math.max(0, above.total - me.total) : null,
  };
}
