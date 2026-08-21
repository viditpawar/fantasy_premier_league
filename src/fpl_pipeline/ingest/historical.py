"""Backfill historical seasons from the community-maintained vaastav/Fantasy-Premier-League
archive, since FPL's own API only exposes the current season.
"""

import numpy as np
import pandas as pd
import psycopg

from fpl_pipeline.config import completed_seasons
from fpl_pipeline.db.connection import get_connection

DATA_BASE_URL = "https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data"


def _fetch_csv(season: str, path: str) -> pd.DataFrame:
    df = pd.read_csv(f"{DATA_BASE_URL}/{season}/{path}")
    return df.replace({np.nan: None})


def ingest_teams_historical(conn: psycopg.Connection, season: str, teams_df: pd.DataFrame) -> None:
    rows = [
        (
            season,
            r.id,
            r.name,
            r.short_name,
            r.strength_overall_home,
            r.strength_overall_away,
            r.strength_attack_home,
            r.strength_attack_away,
            r.strength_defence_home,
            r.strength_defence_away,
        )
        for r in teams_df.itertuples()
    ]
    conn.cursor().executemany(
        """
        INSERT INTO teams (season, id, name, short_name, strength_overall_home,
            strength_overall_away, strength_attack_home, strength_attack_away,
            strength_defence_home, strength_defence_away)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (season, id) DO UPDATE SET
            name = EXCLUDED.name,
            short_name = EXCLUDED.short_name,
            strength_overall_home = EXCLUDED.strength_overall_home,
            strength_overall_away = EXCLUDED.strength_overall_away,
            strength_attack_home = EXCLUDED.strength_attack_home,
            strength_attack_away = EXCLUDED.strength_attack_away,
            strength_defence_home = EXCLUDED.strength_defence_home,
            strength_defence_away = EXCLUDED.strength_defence_away
        """,
        rows,
    )


def ingest_players_historical(
    conn: psycopg.Connection, season: str, players_df: pd.DataFrame
) -> None:
    rows = [
        (
            season,
            r.id,
            r.code,
            r.first_name,
            r.second_name,
            r.web_name,
            r.team,
            r.element_type,
            r.now_cost,
            r.status,
            r.news,
            r.chance_of_playing_next_round,
        )
        for r in players_df.itertuples()
    ]
    conn.cursor().executemany(
        """
        INSERT INTO players (season, id, code, first_name, second_name, web_name,
            team_id, element_type, now_cost, status, news, chance_of_playing_next_round)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (season, id) DO UPDATE SET
            code = EXCLUDED.code,
            first_name = EXCLUDED.first_name,
            second_name = EXCLUDED.second_name,
            web_name = EXCLUDED.web_name,
            team_id = EXCLUDED.team_id,
            element_type = EXCLUDED.element_type,
            now_cost = EXCLUDED.now_cost,
            status = EXCLUDED.status,
            news = EXCLUDED.news,
            chance_of_playing_next_round = EXCLUDED.chance_of_playing_next_round
        """,
        rows,
    )


def ingest_fixtures_historical(
    conn: psycopg.Connection, season: str, fixtures_df: pd.DataFrame
) -> None:
    rows = [
        (
            season,
            r.id,
            int(r.event) if r.event is not None else None,
            r.team_h,
            r.team_a,
            r.team_h_score,
            r.team_a_score,
            r.kickoff_time,
            bool(r.finished),
            r.team_h_difficulty,
            r.team_a_difficulty,
        )
        for r in fixtures_df.itertuples()
    ]
    conn.cursor().executemany(
        """
        INSERT INTO fixtures (season, id, gameweek, team_h, team_a, team_h_score,
            team_a_score, kickoff_time, finished, team_h_difficulty, team_a_difficulty)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (season, id) DO UPDATE SET
            gameweek = EXCLUDED.gameweek,
            team_h = EXCLUDED.team_h,
            team_a = EXCLUDED.team_a,
            team_h_score = EXCLUDED.team_h_score,
            team_a_score = EXCLUDED.team_a_score,
            kickoff_time = EXCLUDED.kickoff_time,
            finished = EXCLUDED.finished,
            team_h_difficulty = EXCLUDED.team_h_difficulty,
            team_a_difficulty = EXCLUDED.team_a_difficulty
        """,
        rows,
    )


def ingest_gameweeks_historical(
    conn: psycopg.Connection, season: str, fixtures_df: pd.DataFrame
) -> None:
    gameweek_numbers = sorted({int(e) for e in fixtures_df["event"] if e is not None})
    rows = [(season, gw, f"Gameweek {gw}", True, False, False) for gw in gameweek_numbers]
    conn.cursor().executemany(
        """
        INSERT INTO gameweeks (season, id, name, finished, is_current, is_next)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (season, id) DO NOTHING
        """,
        rows,
    )


def ingest_player_gameweek_stats_historical(
    conn: psycopg.Connection,
    season: str,
    merged_gw_df: pd.DataFrame,
    players_df: pd.DataFrame,
) -> None:
    player_code_by_id = dict(zip(players_df["id"], players_df["code"]))
    player_team_by_id = dict(zip(players_df["id"], players_df["team"]))

    rows = []
    skipped = 0
    for r in merged_gw_df.itertuples():
        player_code = player_code_by_id.get(r.element)
        if player_code is None:
            skipped += 1
            continue
        rows.append(
            (
                season,
                player_code,
                r.element,
                int(r.GW),
                r.fixture,
                player_team_by_id.get(r.element),
                r.opponent_team,
                r.was_home,
                r.minutes,
                r.goals_scored,
                r.assists,
                r.clean_sheets,
                r.goals_conceded,
                r.own_goals,
                r.penalties_saved,
                r.penalties_missed,
                r.yellow_cards,
                r.red_cards,
                r.saves,
                r.bonus,
                r.bps,
                r.influence,
                r.creativity,
                r.threat,
                r.ict_index,
                r.total_points,
                r.value,
                r.selected,
                r.transfers_in,
                r.transfers_out,
            )
        )

    if skipped:
        print(f"  [{season}] skipped {skipped} gameweek rows with no matching player code")

    conn.cursor().executemany(
        """
        INSERT INTO player_gameweek_stats (season, player_code, player_id,
            gameweek, fixture_id, team_id, opponent_team_id, was_home,
            minutes, goals_scored, assists, clean_sheets, goals_conceded,
            own_goals, penalties_saved, penalties_missed, yellow_cards,
            red_cards, saves, bonus, bps, influence, creativity, threat,
            ict_index, total_points, value, selected, transfers_in,
            transfers_out)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (season, player_code, gameweek) DO UPDATE SET
            player_id = EXCLUDED.player_id,
            fixture_id = EXCLUDED.fixture_id,
            team_id = EXCLUDED.team_id,
            opponent_team_id = EXCLUDED.opponent_team_id,
            was_home = EXCLUDED.was_home,
            minutes = EXCLUDED.minutes,
            goals_scored = EXCLUDED.goals_scored,
            assists = EXCLUDED.assists,
            clean_sheets = EXCLUDED.clean_sheets,
            goals_conceded = EXCLUDED.goals_conceded,
            own_goals = EXCLUDED.own_goals,
            penalties_saved = EXCLUDED.penalties_saved,
            penalties_missed = EXCLUDED.penalties_missed,
            yellow_cards = EXCLUDED.yellow_cards,
            red_cards = EXCLUDED.red_cards,
            saves = EXCLUDED.saves,
            bonus = EXCLUDED.bonus,
            bps = EXCLUDED.bps,
            influence = EXCLUDED.influence,
            creativity = EXCLUDED.creativity,
            threat = EXCLUDED.threat,
            ict_index = EXCLUDED.ict_index,
            total_points = EXCLUDED.total_points,
            value = EXCLUDED.value,
            selected = EXCLUDED.selected,
            transfers_in = EXCLUDED.transfers_in,
            transfers_out = EXCLUDED.transfers_out
        """,
        rows,
    )


def backfill_season(conn: psycopg.Connection, season: str) -> None:
    print(f"Backfilling {season}...")
    teams_df = _fetch_csv(season, "teams.csv")
    players_df = _fetch_csv(season, "players_raw.csv")
    fixtures_df = _fetch_csv(season, "fixtures.csv")
    merged_gw_df = _fetch_csv(season, "gws/merged_gw.csv")

    ingest_teams_historical(conn, season, teams_df)
    ingest_players_historical(conn, season, players_df)
    ingest_gameweeks_historical(conn, season, fixtures_df)
    ingest_fixtures_historical(conn, season, fixtures_df)
    ingest_player_gameweek_stats_historical(conn, season, merged_gw_df, players_df)
    conn.commit()


def run_historical_backfill(n_seasons: int = 5) -> None:
    with get_connection() as conn:
        for season in completed_seasons(n_seasons):
            backfill_season(conn, season)


if __name__ == "__main__":
    run_historical_backfill()
    print("Historical backfill complete.")
