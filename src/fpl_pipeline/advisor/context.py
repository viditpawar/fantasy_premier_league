"""Builds the structured context the AI advisor reasons over: current squad,
recent per-player form, upcoming fixture difficulty, budget, and in-form
alternatives at each position.
"""

import psycopg
from psycopg.rows import dict_row

POSITION_NAMES = {1: "GKP", 2: "DEF", 3: "MID", 4: "FWD"}


def get_current_season(conn: psycopg.Connection) -> str:
    return conn.execute(
        "select season from gameweeks where is_current = true limit 1"
    ).fetchone()[0]


def get_team_id(conn: psycopg.Connection) -> int:
    return conn.execute("select team_id from managers limit 1").fetchone()[0]


def get_latest_gameweek(conn: psycopg.Connection, team_id: int, season: str) -> int:
    return conn.execute(
        """
        select max(gameweek) from manager_gameweek_history
        where team_id = %s and season = %s
        """,
        (team_id, season),
    ).fetchone()[0]


def get_budget(conn: psycopg.Connection, team_id: int, season: str, gameweek: int) -> dict:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select bank, team_value, total_points, overall_rank
            from manager_gameweek_history
            where team_id = %s and season = %s and gameweek = %s
            """,
            (team_id, season, gameweek),
        )
        return cur.fetchone()


def get_squad(conn: psycopg.Connection, team_id: int, season: str, gameweek: int) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select p.web_name as player, p.element_type, t.short_name as team,
                p.team_id, p.code as player_code, p.now_cost, p.status, p.news,
                p.chance_of_playing_next_round, mp.squad_position, mp.multiplier,
                mp.is_captain, mp.is_vice_captain
            from manager_picks mp
            join players p on p.season = mp.season and p.id = mp.player_id
            join teams t on t.season = mp.season and t.id = p.team_id
            where mp.team_id = %s and mp.season = %s and mp.gameweek = %s
            order by mp.squad_position
            """,
            (team_id, season, gameweek),
        )
        squad = cur.fetchall()
    for player in squad:
        player["position"] = POSITION_NAMES[player["element_type"]]
        player["price"] = player["now_cost"] / 10
    return squad


def get_recent_form(
    conn: psycopg.Connection, season: str, player_codes: list[int], last_n: int = 5
) -> dict[int, list[dict]]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select player_code, gameweek, total_points, minutes
            from player_gameweek_stats
            where season = %s and player_code = any(%s)
            order by player_code, gameweek desc
            """,
            (season, player_codes),
        )
        rows = cur.fetchall()

    form: dict[int, list[dict]] = {code: [] for code in player_codes}
    for row in rows:
        code = row.pop("player_code")
        if len(form[code]) < last_n:
            form[code].append(row)
    return form


def get_upcoming_fixtures(
    conn: psycopg.Connection, season: str, team_ids: list[int], n: int = 3
) -> dict[int, list[dict]]:
    teams = dict(
        conn.execute(
            "select id, short_name from teams where season = %s", (season,)
        ).fetchall()
    )

    fixtures: dict[int, list[dict]] = {}
    with conn.cursor(row_factory=dict_row) as cur:
        for team_id in set(team_ids):
            cur.execute(
                """
                select
                    case when team_h = %(team_id)s then team_a else team_h end as opponent_team_id,
                    team_h = %(team_id)s as was_home,
                    case when team_h = %(team_id)s then team_h_difficulty else team_a_difficulty end as difficulty,
                    kickoff_time
                from fixtures
                where season = %(season)s and finished = false
                    and (team_h = %(team_id)s or team_a = %(team_id)s)
                order by kickoff_time
                limit %(n)s
                """,
                {"team_id": team_id, "season": season, "n": n},
            )
            rows = cur.fetchall()
            for row in rows:
                row["opponent"] = teams.get(row.pop("opponent_team_id"))
            fixtures[team_id] = rows
    return fixtures


def get_transfer_candidates(
    conn: psycopg.Connection,
    season: str,
    element_type: int,
    exclude_codes: list[int],
    last_n_gameweeks: int,
    limit: int = 8,
) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select p.web_name as player, t.short_name as team,
                round(p.now_cost / 10.0, 1) as price,
                sum(s.total_points) as recent_points
            from player_gameweek_stats s
            join players p on p.season = s.season and p.code = s.player_code
            join teams t on t.season = s.season and t.id = p.team_id
            where s.season = %(season)s and p.element_type = %(element_type)s
                and s.gameweek > (select max(gameweek) - %(last_n)s from player_gameweek_stats where season = %(season)s)
                and not (p.code = any(%(exclude_codes)s))
                and p.status = 'a'
            group by p.web_name, t.short_name, p.now_cost
            order by recent_points desc
            limit %(limit)s
            """,
            {
                "season": season,
                "element_type": element_type,
                "last_n": last_n_gameweeks,
                "exclude_codes": exclude_codes,
                "limit": limit,
            },
        )
        return cur.fetchall()


def build_context(conn: psycopg.Connection) -> dict:
    season = get_current_season(conn)
    team_id = get_team_id(conn)
    gameweek = get_latest_gameweek(conn, team_id, season)

    squad = get_squad(conn, team_id, season, gameweek)
    player_codes = [p["player_code"] for p in squad]
    team_ids = [p["team_id"] for p in squad]

    form = get_recent_form(conn, season, player_codes)
    fixtures = get_upcoming_fixtures(conn, season, team_ids)
    budget = get_budget(conn, team_id, season, gameweek)

    for player in squad:
        player["recent_form"] = form.get(player["player_code"], [])
        player["upcoming_fixtures"] = fixtures.get(player["team_id"], [])

    candidates = {
        POSITION_NAMES[element_type]: get_transfer_candidates(
            conn, season, element_type, player_codes, last_n_gameweeks=5
        )
        for element_type in POSITION_NAMES
    }

    return {
        "season": season,
        "gameweek": gameweek,
        "budget": budget,
        "squad": squad,
        "transfer_candidates": candidates,
    }
