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
                mp.selling_price, p.status, p.news, p.chance_of_playing_next_round,
                mp.squad_position, mp.multiplier, mp.is_captain, mp.is_vice_captain
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
        # `selling_price` (real post-profit-sharing sell value) is only
        # populated when FPL_EMAIL/FPL_PASSWORD are configured — fall back
        # to now_cost (current market price) as an approximation otherwise.
        # `price` is what the advisor's budget math actually uses.
        player["price"] = (player["selling_price"] or player["now_cost"]) / 10
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


def get_season_yellow_cards(
    conn: psycopg.Connection, season: str, player_codes: list[int]
) -> dict[int, int]:
    """Accumulated yellow cards this season, per player — used to flag
    suspension risk (FPL bans at 5 yellows, then again every 5 after that
    until the 2nd threshold at 10, which is a 2-match ban)."""
    rows = conn.execute(
        """
        select player_code, sum(yellow_cards) as total
        from player_gameweek_stats
        where season = %s and player_code = any(%s)
        group by player_code
        """,
        (season, player_codes),
    ).fetchall()
    return {code: total or 0 for code, total in rows}


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
    """Weighted average difficulty over the next N fixtures, the immediate
    next fixture weighted double — a transfer is made for the very next
    gameweek, so that match's difficulty should matter more than a fixture
    two or three gameweeks out, not count equally.
    """
    diffs = [f["difficulty"] for f in fixtures[:n]]
    if not diffs:
        return None
    weights = [2] + [1] * (len(diffs) - 1)
    return sum(w * d for w, d in zip(weights, diffs)) / sum(weights)


def compute_score(recent_form: list[dict], fixtures: list[dict]) -> float:
    """Step-2 rubric score: form (last 5 GW, most recent doubled) minus
    upcoming-fixture difficulty x3 (next 3 fixtures, immediate one weighted
    double). Computed here, not by the LLM, so the advisor never has to
    invent numbers it wasn't given.
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


def get_squad_fixture_counts(
    conn: psycopg.Connection, season: str, team_ids: list[int], from_gameweek: int, lookahead: int = 8
) -> dict[int, dict[int, int]]:
    """How many fixtures each of the given teams has in each of the next
    `lookahead` gameweeks — 0 means a blank, 2+ means a double. Used for
    chip timing (Free Hit / Bench Boost / Triple Captain), not for scoring.
    """
    rows = conn.execute(
        """
        select gameweek, team_h, team_a from fixtures
        where season = %s and gameweek is not null
            and gameweek > %s and gameweek <= %s
        """,
        (season, from_gameweek, from_gameweek + lookahead),
    ).fetchall()
    counts: dict[int, dict[int, int]] = {}
    team_id_set = set(team_ids)
    for gw, team_h, team_a in rows:
        bucket = counts.setdefault(gw, {t: 0 for t in team_id_set})
        if team_h in team_id_set:
            bucket[team_h] = bucket.get(team_h, 0) + 1
        if team_a in team_id_set:
            bucket[team_a] = bucket.get(team_a, 0) + 1
    return counts


def compute_chip_advice(
    conn: psycopg.Connection, season: str, squad: list[dict], gameweek: int
) -> dict:
    """Deterministic chip-timing check — no judgment call involved, so
    computed here in Python rather than left for a human/LLM to reason
    about each time. Wildcard looks at current squad health; the other
    three look ahead at the squad's own clubs' fixture counts for an
    actual double or blank gameweek, since Bench Boost / Triple Captain /
    Free Hit are only genuinely strong around one of those.
    """
    flagged = [p for p in squad if p.get("flag")]
    wildcard = {
        "recommended": len(flagged) >= 4,
        "reason": (
            f"{len(flagged)} squad players are flagged right now "
            f"({', '.join(p['player'] for p in flagged)}) — fixing that many "
            "issues one transfer at a time would cost more hits than a Wildcard's "
            "unlimited free reshuffle."
            if len(flagged) >= 4
            else f"Only {len(flagged)} squad player{'s' if len(flagged) != 1 else ''} "
            "flagged right now — not enough simultaneous problems to justify burning "
            "the Wildcard over regular transfers."
        ),
    }

    team_ids = sorted({p["team_id"] for p in squad})
    fixture_counts = get_squad_fixture_counts(conn, season, team_ids, gameweek)

    blank_gw, blank_teams = None, []
    double_gw, double_teams = None, []
    for gw in sorted(fixture_counts):
        counts = fixture_counts[gw]
        blanks = [t for t in team_ids if counts.get(t, 0) == 0]
        doubles = [t for t in team_ids if counts.get(t, 0) >= 2]
        if blanks and blank_gw is None:
            blank_gw, blank_teams = gw, blanks
        if doubles and double_gw is None:
            double_gw, double_teams = gw, doubles

    free_hit = (
        {
            "recommended": len(blank_teams) >= 3,
            "reason": f"GW{blank_gw} is a blank for {len(blank_teams)} of your squad's clubs — "
            "a strong Free Hit week if it holds up as the schedule firms up."
            if blank_gw and len(blank_teams) >= 3
            else f"GW{blank_gw} has a blank for {len(blank_teams)} squad club(s) — not enough "
            "to justify a Free Hit over just taking the points hit on the bench."
            if blank_gw
            else f"No blank gameweek in the next 8 gameweeks (through GW{gameweek + 8}) for any "
            "of your squad's clubs — nothing to Free Hit around yet.",
        }
    )
    bench_boost = (
        {
            "recommended": len(double_teams) >= 4,
            "reason": f"GW{double_gw} is a double for {len(double_teams)} of your squad's clubs — "
            "worth planning a Bench Boost around if your bench is also doubled up by then."
            if double_gw and len(double_teams) >= 4
            else f"GW{double_gw} has a double for {len(double_teams)} squad club(s) — not enough "
            "of the squad to make Bench Boost worth it yet."
            if double_gw
            else f"No double gameweek in the next 8 gameweeks (through GW{gameweek + 8}) for any "
            "of your squad's clubs — nothing to Bench Boost around yet.",
        }
    )
    triple_captain = (
        {
            "recommended": double_gw is not None,
            "reason": f"GW{double_gw} gives {len(double_teams)} squad club(s) two fixtures — "
            "if your best captain option is one of them when it's closer, that's a real "
            "Triple Captain week."
            if double_gw
            else f"No double gameweek in the next 8 gameweeks (through GW{gameweek + 8}) — "
            "hold Triple Captain for one, rather than spending it on a single fixture.",
        }
    )

    return {
        "wildcard": wildcard,
        "free_hit": free_hit,
        "bench_boost": bench_boost,
        "triple_captain": triple_captain,
    }


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
    yellow_cards = get_season_yellow_cards(conn, season, player_codes)

    for player in squad:
        player["recent_form"] = form.get(player["player_code"], [])
        player["upcoming_fixtures"] = fixtures.get(player["team_id"], [])
        player["score"] = compute_score(player["recent_form"], player["upcoming_fixtures"])
        player["captain_score"] = compute_captain_score(player["recent_form"], player["upcoming_fixtures"])
        player["season_yellow_cards"] = yellow_cards.get(player["player_code"], 0)

    for candidate in all_candidates:
        candidate["recent_form"] = form.get(candidate["player_code"], [])
        candidate["upcoming_fixtures"] = fixtures.get(candidate["team_id"], [])
        candidate["score"] = compute_score(candidate["recent_form"], candidate["upcoming_fixtures"])

    _flag_replacement_candidates(squad, candidates)
    chip_advice = compute_chip_advice(conn, season, squad, gameweek)

    return {
        "season": season,
        "gameweek": gameweek,
        "for_gameweek": gameweek + 1,
        "free_transfers": free_transfers,
        "budget": budget,
        "squad": squad,
        "transfer_candidates": candidates,
        "chip_advice": chip_advice,
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
        elif player["season_yellow_cards"] in (4, 9):
            # FPL bans at 5 accumulated yellows (1 match), then again at 10
            # (2 matches) — 4 or 9 means the very next booking triggers it.
            player["flag"] = "b2_suspension_risk"
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
