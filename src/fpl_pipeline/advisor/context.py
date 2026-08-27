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


def get_free_transfers(conn: psycopg.Connection, team_id: int, season: str, upto_gameweek: int) -> int:
    """Free transfers banked for the gameweek *after* `upto_gameweek`.

    FPL rule: every manager starts with 1 free transfer for gameweek 2 (no
    transfer concept applies to the initial gameweek 1 squad selection).
    Each subsequent gameweek adds 1, capped at 5, minus however many
    transfers were actually made that gameweek (transfers beyond the
    banked free ones cost 4 points each, already reflected in
    `event_transfers_cost` and not needed here).
    """
    rows = conn.execute(
        """
        select gameweek, event_transfers from manager_gameweek_history
        where team_id = %s and season = %s and gameweek between 2 and %s
        order by gameweek
        """,
        (team_id, season, upto_gameweek),
    ).fetchall()

    free_transfers = 1
    for _gameweek, made in rows:
        free_transfers = min(5, free_transfers - min(made or 0, free_transfers))
        free_transfers = min(5, free_transfers + 1)
    return free_transfers


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
                t.code as team_code, p.team_id, p.code as player_code, p.now_cost,
                p.status, p.news, p.chance_of_playing_next_round, mp.squad_position,
                mp.multiplier, mp.is_captain, mp.is_vice_captain
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
            select p.web_name as player, t.short_name as team, p.team_id, p.code as player_code,
                round(p.now_cost / 10.0, 1) as price,
                sum(s.total_points) as recent_points
            from player_gameweek_stats s
            join players p on p.season = s.season and p.code = s.player_code
            join teams t on t.season = s.season and t.id = p.team_id
            where s.season = %(season)s and p.element_type = %(element_type)s
                and s.gameweek > (select max(gameweek) - %(last_n)s from player_gameweek_stats where season = %(season)s)
                and not (p.code = any(%(exclude_codes)s))
                and p.status = 'a'
            group by p.web_name, t.short_name, p.team_id, p.code, p.now_cost
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


def compute_form_score(recent_form: list[dict]) -> float:
    """Last-N gameweek points, most recent gameweek weighted double."""
    weights = [2] + [1] * (len(recent_form) - 1)
    return float(sum(w * gw["total_points"] for w, gw in zip(weights, recent_form)))


def avg_upcoming_difficulty(fixtures: list[dict], n: int = 3) -> float | None:
    diffs = [f["difficulty"] for f in fixtures[:n]]
    return sum(diffs) / len(diffs) if diffs else None


def compute_score(recent_form: list[dict], fixtures: list[dict]) -> float:
    """Step-2 rubric score: form (last 5 GW, most recent doubled) minus
    average next-3-fixture difficulty x3. Computed here, not by the LLM, so
    the advisor never has to invent numbers it wasn't given.
    """
    form = compute_form_score(recent_form)
    avg_diff = avg_upcoming_difficulty(fixtures, n=3)
    return round(form - (avg_diff * 3 if avg_diff is not None else 0.0), 1)


def compute_captain_score(recent_form: list[dict], fixtures: list[dict]) -> float:
    """Step-4 rubric score: form (same weighting) minus next-1-fixture
    difficulty x2.
    """
    form = compute_form_score(recent_form)
    next_diff = fixtures[0]["difficulty"] if fixtures else None
    return round(form - (next_diff * 2 if next_diff is not None else 0.0), 1)


def build_context(conn: psycopg.Connection) -> dict:
    season = get_current_season(conn)
    team_id = get_team_id(conn)
    gameweek = get_latest_gameweek(conn, team_id, season)

    squad = get_squad(conn, team_id, season, gameweek)
    player_codes = [p["player_code"] for p in squad]

    candidates = {
        POSITION_NAMES[element_type]: get_transfer_candidates(
            conn, season, element_type, player_codes, last_n_gameweeks=5
        )
        for element_type in POSITION_NAMES
    }
    all_candidates = [c for group in candidates.values() for c in group]

    # Fetch form/fixtures for squad AND candidates together so every score
    # in the prompt is computed here, in Python, from real data — the LLM
    # is never asked to invent a fixture difficulty or form number.
    all_codes = player_codes + [c["player_code"] for c in all_candidates]
    all_team_ids = [p["team_id"] for p in squad] + [c["team_id"] for c in all_candidates]

    form = get_recent_form(conn, season, all_codes)
    fixtures = get_upcoming_fixtures(conn, season, all_team_ids)
    budget = get_budget(conn, team_id, season, gameweek)
    free_transfers = get_free_transfers(conn, team_id, season, gameweek)

    for player in squad:
        player["recent_form"] = form.get(player["player_code"], [])
        player["upcoming_fixtures"] = fixtures.get(player["team_id"], [])
        player["score"] = compute_score(player["recent_form"], player["upcoming_fixtures"])
        player["captain_score"] = compute_captain_score(player["recent_form"], player["upcoming_fixtures"])

    for candidate in all_candidates:
        candidate["recent_form"] = form.get(candidate["player_code"], [])
        candidate["upcoming_fixtures"] = fixtures.get(candidate["team_id"], [])
        candidate["score"] = compute_score(candidate["recent_form"], candidate["upcoming_fixtures"])

    _flag_replacement_candidates(squad, candidates)

    return {
        "season": season,
        "gameweek": gameweek,
        "for_gameweek": gameweek + 1,
        "free_transfers": free_transfers,
        "budget": budget,
        "squad": squad,
        "transfer_candidates": candidates,
    }


def _flag_replacement_candidates(squad: list[dict], candidates: dict[str, list[dict]]) -> None:
    """Sets `flag` on each squad player per the Step-1 rubric priority
    order (a > b > c > d), computed here instead of left for the LLM to
    judge — the highest-priority flag reason wins.
    """
    for player in squad:
        starting = player["multiplier"] > 0
        if player["status"] != "a":
            player["flag"] = "a_unavailable_status"
        elif player["chance_of_playing_next_round"] is not None and player["chance_of_playing_next_round"] < 75:
            player["flag"] = "b_low_chance_of_playing"
        elif starting and player["recent_form"] and player["recent_form"][0]["minutes"] == 0:
            # 0 minutes only matters as a rotation-risk signal for players
            # who were actually selected to start — a bench player sitting
            # out costs nothing directly (multiplier 0).
            player["flag"] = "c_zero_minutes_last_gw"
        else:
            player["flag"] = None

    by_position: dict[str, list[dict]] = {}
    for player in squad:
        if player["multiplier"] > 0:
            by_position.setdefault(player["position"], []).append(player)

    for position, players in by_position.items():
        best_candidate_score = max(
            (c["score"] for c in candidates.get(position, [])), default=None
        )
        if best_candidate_score is None:
            continue
        unflagged = [p for p in players if p["flag"] is None]
        if not unflagged:
            continue
        worst = min(unflagged, key=lambda p: p["score"])
        if best_candidate_score - worst["score"] >= 4:
            worst["flag"] = "d_low_form_vs_best_candidate"
