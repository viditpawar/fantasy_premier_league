"""Ingest the current season's live FPL data into Postgres."""

import psycopg

from fpl_pipeline.api.fpl_client import FPLClient
from fpl_pipeline.config import FPL_TEAM_ID, current_season
from fpl_pipeline.db.connection import get_connection


def ingest_teams(conn: psycopg.Connection, season: str, bootstrap: dict) -> None:
    rows = [
        (
            season,
            t["id"],
            t["code"],
            t["name"],
            t["short_name"],
            t["strength_overall_home"],
            t["strength_overall_away"],
            t["strength_attack_home"],
            t["strength_attack_away"],
            t["strength_defence_home"],
            t["strength_defence_away"],
        )
        for t in bootstrap["teams"]
    ]
    conn.cursor().executemany(
        """
        INSERT INTO teams (season, id, code, name, short_name, strength_overall_home,
            strength_overall_away, strength_attack_home, strength_attack_away,
            strength_defence_home, strength_defence_away)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (season, id) DO UPDATE SET
            code = EXCLUDED.code,
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


def ingest_players(conn: psycopg.Connection, season: str, bootstrap: dict) -> None:
    rows = [
        (
            season,
            p["id"],
            p["code"],
            p["first_name"],
            p["second_name"],
            p["web_name"],
            p["team"],
            p["element_type"],
            p["now_cost"],
            p["status"],
            p["news"],
            p["chance_of_playing_next_round"],
        )
        for p in bootstrap["elements"]
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


def ingest_gameweeks(conn: psycopg.Connection, season: str, bootstrap: dict) -> None:
    rows = [
        (
            season,
            e["id"],
            e["name"],
            e["deadline_time"],
            e["finished"],
            e["is_current"],
            e["is_next"],
            e["average_entry_score"],
            e["highest_score"],
        )
        for e in bootstrap["events"]
    ]
    conn.cursor().executemany(
        """
        INSERT INTO gameweeks (season, id, name, deadline_time, finished,
            is_current, is_next, average_entry_score, highest_score)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (season, id) DO UPDATE SET
            name = EXCLUDED.name,
            deadline_time = EXCLUDED.deadline_time,
            finished = EXCLUDED.finished,
            is_current = EXCLUDED.is_current,
            is_next = EXCLUDED.is_next,
            average_entry_score = EXCLUDED.average_entry_score,
            highest_score = EXCLUDED.highest_score
        """,
        rows,
    )


def ingest_fixtures(conn: psycopg.Connection, season: str, fixtures: list[dict]) -> None:
    rows = [
        (
            season,
            f["id"],
            f["event"],
            f["team_h"],
            f["team_a"],
            f["team_h_score"],
            f["team_a_score"],
            f["kickoff_time"],
            f["finished"],
            f["team_h_difficulty"],
            f["team_a_difficulty"],
        )
        for f in fixtures
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


def ingest_player_gameweek_stats(
    conn: psycopg.Connection,
    season: str,
    client: FPLClient,
    bootstrap: dict,
    fixtures: list[dict],
) -> None:
    player_team = {p["id"]: p["team"] for p in bootstrap["elements"]}
    player_code = {p["id"]: p["code"] for p in bootstrap["elements"]}
    fixture_by_id = {f["id"]: f for f in fixtures}

    played_gameweeks = [e["id"] for e in bootstrap["events"] if e["finished"] or e["is_current"]]

    for gw in played_gameweeks:
        live = client.event_live(gw)
        rows = []
        for element in live["elements"]:
            player_id = element["id"]
            stats = element["stats"]
            explain = element.get("explain") or []
            fixture_id = explain[0]["fixture"] if explain else None
            team_id = player_team.get(player_id)
            fixture = fixture_by_id.get(fixture_id) if fixture_id else None
            was_home = fixture["team_h"] == team_id if fixture else None
            opponent_team_id = None
            if fixture and was_home is not None:
                opponent_team_id = fixture["team_a"] if was_home else fixture["team_h"]

            rows.append(
                (
                    season,
                    player_code.get(player_id),
                    player_id,
                    gw,
                    fixture_id,
                    team_id,
                    opponent_team_id,
                    was_home,
                    stats["minutes"],
                    stats["goals_scored"],
                    stats["assists"],
                    stats["clean_sheets"],
                    stats["goals_conceded"],
                    stats["own_goals"],
                    stats["penalties_saved"],
                    stats["penalties_missed"],
                    stats["yellow_cards"],
                    stats["red_cards"],
                    stats["saves"],
                    stats["bonus"],
                    stats["bps"],
                    stats["influence"],
                    stats["creativity"],
                    stats["threat"],
                    stats["ict_index"],
                    stats["total_points"],
                    stats.get("value"),
                    stats.get("selected"),
                    stats.get("transfers_in"),
                    stats.get("transfers_out"),
                )
            )

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


def ingest_manager(conn: psycopg.Connection, season: str, client: FPLClient, team_id: int, entry: dict) -> None:
    conn.cursor().execute(
        """
        INSERT INTO managers (team_id, name, player_first_name, player_last_name)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (team_id) DO UPDATE SET
            name = EXCLUDED.name,
            player_first_name = EXCLUDED.player_first_name,
            player_last_name = EXCLUDED.player_last_name
        """,
        (team_id, entry["name"], entry["player_first_name"], entry["player_last_name"]),
    )

    history = client.entry_history(team_id)
    rows = [
        (
            team_id,
            season,
            h["event"],
            h["points"],
            h["total_points"],
            h["overall_rank"],
            h["bank"],
            h["value"],
            h["event_transfers"],
            h["event_transfers_cost"],
            h["points_on_bench"],
        )
        for h in history["current"]
    ]
    conn.cursor().executemany(
        """
        INSERT INTO manager_gameweek_history (team_id, season, gameweek, points,
            total_points, overall_rank, bank, team_value, event_transfers,
            event_transfers_cost, points_on_bench)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (team_id, season, gameweek) DO UPDATE SET
            points = EXCLUDED.points,
            total_points = EXCLUDED.total_points,
            overall_rank = EXCLUDED.overall_rank,
            bank = EXCLUDED.bank,
            team_value = EXCLUDED.team_value,
            event_transfers = EXCLUDED.event_transfers,
            event_transfers_cost = EXCLUDED.event_transfers_cost,
            points_on_bench = EXCLUDED.points_on_bench
        """,
        rows,
    )

    played_gameweeks = [h["event"] for h in history["current"]]
    for gw in played_gameweeks:
        picks = client.entry_picks(team_id, gw)
        pick_rows = [
            (
                team_id,
                season,
                gw,
                pick["element"],
                pick["position"],
                pick["multiplier"],
                pick["is_captain"],
                pick["is_vice_captain"],
            )
            for pick in picks["picks"]
        ]
        conn.cursor().executemany(
            """
            INSERT INTO manager_picks (team_id, season, gameweek, player_id,
                squad_position, multiplier, is_captain, is_vice_captain)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (team_id, season, gameweek, player_id) DO UPDATE SET
                squad_position = EXCLUDED.squad_position,
                multiplier = EXCLUDED.multiplier,
                is_captain = EXCLUDED.is_captain,
                is_vice_captain = EXCLUDED.is_vice_captain
            """,
            pick_rows,
        )


def ingest_leagues(conn: psycopg.Connection, season: str, client: FPLClient, team_id: int, entry: dict) -> None:
    league_rows = [
        (team_id, season, league["id"], league["name"], league_type, league.get("entry_rank"), league.get("entry_last_rank"))
        for league_type in ("classic", "h2h")
        for league in entry["leagues"][league_type]
    ]
    conn.cursor().executemany(
        """
        INSERT INTO manager_leagues (team_id, season, league_id, league_name,
            league_type, entry_rank, entry_last_rank)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (team_id, season, league_id) DO UPDATE SET
            league_name = EXCLUDED.league_name,
            league_type = EXCLUDED.league_type,
            entry_rank = EXCLUDED.entry_rank,
            entry_last_rank = EXCLUDED.entry_last_rank
        """,
        league_rows,
    )

    for league in entry["leagues"]["classic"]:
        league_id = league["id"]
        results = []
        page = 1
        while page <= 3:
            standings = client.classic_league_standings(league_id, page)["standings"]
            results.extend(standings["results"])
            if not standings["has_next"]:
                break
            page += 1

        conn.cursor().execute("DELETE FROM league_standings WHERE season = %s AND league_id = %s", (season, league_id))
        rows = [
            (season, league_id, r["entry"], r["entry_name"], r["player_name"], r["rank"], r["last_rank"], r["total"], r.get("event_total"))
            for r in results
        ]
        conn.cursor().executemany(
            """
            INSERT INTO league_standings (season, league_id, entry_team_id,
                entry_name, player_name, rank, last_rank, total, event_total)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            rows,
        )


def run_full_ingest() -> None:
    season = current_season()
    client = FPLClient()
    bootstrap = client.bootstrap_static()
    fixtures = client.fixtures()

    with get_connection() as conn:
        ingest_teams(conn, season, bootstrap)
        ingest_players(conn, season, bootstrap)
        ingest_gameweeks(conn, season, bootstrap)
        ingest_fixtures(conn, season, fixtures)
        ingest_player_gameweek_stats(conn, season, client, bootstrap, fixtures)
        if FPL_TEAM_ID:
            team_id = int(FPL_TEAM_ID)
            entry = client.entry(team_id)
            ingest_manager(conn, season, client, team_id, entry)
            ingest_leagues(conn, season, client, team_id, entry)
        conn.commit()


if __name__ == "__main__":
    run_full_ingest()
    print("Live ingest complete.")
