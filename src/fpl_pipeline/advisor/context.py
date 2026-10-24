"""Warehouse research context and optional, manually confirmed current squad."""

from collections import Counter
from datetime import UTC, datetime, timedelta

import psycopg
from psycopg.rows import dict_row

from fpl_pipeline.config import FPL_TEAM_ID

from .rules import (
    CHIPS,
    POSITIONS,
    available,
    context_fingerprint,
    fixture_score,
    form_score,
    integer,
    legal_swap,
    suspension_risk,
    transfer_state,
    validate_squad,
)

POSITION_NAMES = POSITIONS


def get_team_id(conn: psycopg.Connection) -> int:
    if FPL_TEAM_ID:
        return int(FPL_TEAM_ID)
    rows = conn.execute(
        "select team_id from managers order by team_id limit 2"
    ).fetchall()
    if len(rows) != 1:
        raise ValueError("Set FPL_TEAM_ID to choose the advisor's manager.")
    return rows[0][0]


def _players(conn, season: str) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select p.id as player_id, p.web_name as player, p.element_type,
                t.short_name as team, t.code as team_code, p.team_id,
                p.code as player_code, p.now_cost, p.status, p.news,
                p.chance_of_playing_next_round
            from players p join teams t on t.season = p.season and t.id = p.team_id
            where p.season = %s order by p.id
        """,
            (season,),
        )
        players = cur.fetchall()
    for p in players:
        p["position"] = POSITIONS[p["element_type"]]
        p["price"] = p["market_price"] = p["now_cost"] / 10
    return players


def get_recent_form(
    conn, season: str, player_codes: list[int], last_n: int = 5
) -> dict[int, list[dict]]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select player_code, gameweek, total_points, minutes
            from player_gameweek_stats
            where season = %s and player_code = any(%s) and gameweek in (
                select id from gameweeks where season = %s and finished = true
                order by id desc limit %s
            ) order by player_code, gameweek desc
        """,
            (season, player_codes, season, last_n),
        )
        rows = cur.fetchall()
    form = {code: [] for code in player_codes}
    for row in rows:
        form[row.pop("player_code")].append(row)
    return form


def get_upcoming_fixtures(
    conn, season: str, target: int, horizon: int = 8
) -> dict[int, list[dict]]:
    """Use gameweek boundaries, including blanks and all fixtures in doubles."""
    teams = dict(
        conn.execute(
            "select id, short_name from teams where season = %s", (season,)
        ).fetchall()
    )
    fixtures = {team_id: [] for team_id in teams}
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select gameweek, team_h, team_a, team_h_difficulty, team_a_difficulty, kickoff_time
            from fixtures where season = %s and gameweek >= %s and gameweek < %s
            order by gameweek, kickoff_time nulls last, id
        """,
            (season, target, min(39, target + horizon)),
        )
        for row in cur.fetchall():
            for side, other in (("h", "a"), ("a", "h")):
                fixtures[row[f"team_{side}"]].append(
                    {
                        "gameweek": row["gameweek"],
                        "opponent": teams[row[f"team_{other}"]],
                        "was_home": side == "h",
                        "difficulty": row[f"team_{side}_difficulty"],
                        "kickoff_time": row["kickoff_time"],
                    }
                )
    return fixtures


def _timestamp(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value)
    except (AttributeError, TypeError, ValueError) as exc:
        raise ValueError("captured_at must be an ISO timestamp with timezone.") from exc
    if parsed.tzinfo is None:
        raise ValueError("captured_at must include its timezone.")
    return parsed.astimezone(UTC)


def confirmed_state(
    state: dict, players: list[dict], team_id: int, target: int, now: datetime
) -> tuple[list[dict], dict]:
    """Accept local data copied from My Team; never log in or make FPL moves."""
    if (
        not isinstance(state, dict)
        or state.get("team_id") != team_id
        or state.get("for_gameweek") != target
    ):
        raise ValueError(
            "The state file must match this manager and the upcoming gameweek."
        )
    captured = _timestamp(state.get("captured_at"))
    if captured > now + timedelta(minutes=5) or now - captured > timedelta(hours=24):
        raise ValueError(
            "Confirm a fresh current-state snapshot (within the last 24 hours)."
        )
    picks = state.get("picks")
    if not isinstance(picks, list) or len(picks) != 15:
        raise ValueError("State picks must contain all 15 current players.")
    by_id = {p["player_id"]: p for p in players}
    squad = []
    for pick in picks:
        if not isinstance(pick, dict):
            raise ValueError("Each pick must be an object.")  # noqa: TRY004 - unified user-input validation errors
        element = integer(pick.get("element"), "player ID", 1)
        if element not in by_id:
            raise ValueError(
                f"Player ID {element} is absent from the current warehouse; refresh ingestion."
            )
        player = dict(by_id[element])
        player["squad_position"] = integer(
            pick.get("position"), "squad position", 1, 15
        )
        player["selling_price"] = integer(pick.get("selling_price"), "selling price", 1)
        if player["selling_price"] > player["now_cost"]:
            raise ValueError(
                "A selling price exceeds the warehouse market price; refresh prices or the snapshot."
            )
        squad.append(player)
    squad.sort(key=lambda p: p["squad_position"])
    validate_squad(squad)
    transfers = state.get("transfers")
    if (
        not isinstance(transfers, dict)
        or not {"bank", "limit", "made"} <= transfers.keys()
    ):
        raise ValueError(
            "State transfers must specify bank, limit (null for unlimited), and made."
        )
    integer(transfers["bank"], "bank")
    active = state.get("active_chip")
    if active is not None and (not isinstance(active, str) or active not in CHIPS):
        raise ValueError("Unknown active chip.")
    initial_selection = state.get("initial_selection", target == 1)
    if type(initial_selection) is not bool:
        raise ValueError("initial_selection must be true or false.")
    if (
        transfers["limit"] is None
        and not initial_selection
        and active not in {"wildcard", "freehit"}
    ):
        raise ValueError(
            "Unlimited moves require an active Wildcard/Free Hit or confirmed initial selection."
        )
    result = transfer_state(
        None if active in {"wildcard", "freehit"} else transfers["limit"],
        transfers["made"],
    )
    result["bank"] = transfers["bank"]
    result["captured_at"] = captured.isoformat()
    available_chips = state.get("available_chips")
    if available_chips is not None and (
        not isinstance(available_chips, list)
        or any(
            not isinstance(chip, str) or chip not in CHIPS for chip in available_chips
        )
        or len(set(available_chips)) != len(available_chips)
    ):
        raise ValueError(
            "available_chips must list distinct unused, currently playable chip names."
        )
    return squad, result


def compute_chip_advice(
    squad: list[dict],
    target: int,
    available_chips: list[str] | None = None,
    active_chip: str | None = None,
) -> dict:
    """Conservative planning signals, gated on confirmed chip availability."""
    fit = [p for p in squad if available(p) and p["next_gameweek_fixture_count"] > 0]
    counts = Counter(p["position"] for p in fit)
    # Capacity of a legal starting formation, allowing unfilled slots.
    playable = min(counts["GKP"], 1) + max(
        min(counts["DEF"], d) + min(counts["MID"], m) + min(counts["FWD"], f)
        for d in range(3, 6)
        for m in range(2, 6)
        for f in range(1, 4)
        if d + m + f == 10
    )
    unavailable = sum(not available(p) for p in squad)
    bench = [p for p in squad if p["squad_position"] > 11]
    bench_ready = all(
        available(p)
        and p["next_gameweek_fixture_count"] > 0
        and p["recent_form"]
        and p["recent_form"][0]["minutes"] >= 60
        for p in bench
    )
    captain_double = any(
        available(p)
        and p["squad_position"] <= 11
        and p["next_gameweek_fixture_count"] >= 2
        and p["form_score"] >= 5
        for p in squad
    )
    definitions = {
        "wildcard": (
            unavailable >= 4,
            f"{unavailable} unavailable players; assess lasting squad problems and ordinary transfers before a Wildcard.",
        ),
        "free_hit": (
            playable < 9,
            f"At most {playable} available players fit a starting formation in GW{target}; compare a temporary Free Hit with longer-term repairs.",
        ),
        "bench_boost": (
            bench_ready and len(fit) == 15,
            "Assess all four substitutes' likely minutes. Bench Boost can work in a single or double gameweek.",
        ),
        "triple_captain": (
            captain_double,
            "Compare your strongest captain's fixtures and minutes. A double is an opportunity, not a requirement or a guarantee.",
        ),
    }
    chip_names = {
        "wildcard": "wildcard",
        "free_hit": "freehit",
        "bench_boost": "bboost",
        "triple_captain": "3xc",
    }
    # Signals are alternatives, but at most one chip can be recommended now.
    selected = None
    if available_chips is not None and active_chip is None:
        selected = next(
            (
                key
                for key, (signal, _) in definitions.items()
                if signal and chip_names[key] in available_chips
            ),
            None,
        )
    advice = {}
    for key, (signal, reason) in definitions.items():
        name = chip_names[key]
        prefix = (
            f"{active_chip} is already active; only one chip is allowed this gameweek. "
            if active_chip
            else "Availability and expiry are unconfirmed; check My Team before planning this chip. "
            if available_chips is None
            else "This chip is unavailable for this gameweek. "
            if name not in available_chips
            else "Consider this option after reviewing team news and chip expiry. "
            if signal
            else "No strong current trigger. "
        )
        advice[key] = {"recommended": key == selected, "reason": prefix + reason}
    return advice


def build_context(
    conn: psycopg.Connection, state: dict | None = None, now: datetime | None = None
) -> dict:
    now = now or datetime.now(UTC)
    team_id = get_team_id(conn)
    season_row = conn.execute("select max(season) from gameweeks").fetchone()
    season = season_row[0]
    if not season:
        raise ValueError("No gameweeks found; ingest current FPL data first.")
    event = conn.execute(
        """
        select id, deadline_time from gameweeks where season = %s and deadline_time > %s
        order by deadline_time limit 1
    """,
        (season, now),
    ).fetchone()
    if not event:
        raise ValueError(
            "No future deadline in the warehouse. Refresh ingestion; do not infer GW39 or a stale next week."
        )
    target, deadline = event
    latest = conn.execute(
        "select max(gameweek) from manager_gameweek_history where team_id = %s and season = %s",
        (team_id, season),
    ).fetchone()[0]
    players = _players(conn, season)
    warnings = []
    if state is not None:
        if not isinstance(state, dict) or state.get("season") != season:
            raise ValueError("The state file must name the warehouse's current season.")
        if state.get("initial_selection") is True and latest is not None:
            raise ValueError(
                "Initial selection conflicts with this manager's existing gameweek history."
            )
        squad, transfers = confirmed_state(state, players, team_id, target, now)
        bank = transfers.pop("bank")
    else:
        if latest is None:
            raise ValueError(
                "No saved squad; supply --state with the current squad or run ingestion."
            )
        picks = conn.execute(
            """
            select player_id, squad_position, selling_price from manager_picks
            where team_id = %s and season = %s and gameweek = %s order by squad_position
        """,
            (team_id, season, latest),
        ).fetchall()
        by_id = {p["player_id"]: p for p in players}
        squad = [
            {**by_id[player_id], "squad_position": slot, "selling_price": None}
            for player_id, slot, _ in picks
        ]
        validate_squad(squad)
        # Historical bank/sell values cannot establish this week's funds.
        bank, transfers = None, None
        warnings.append(
            f"Research only: squad is the locked GW{latest} snapshot. Current transfers, bank, selling prices and free transfers are unknown. Supply --state for verified advice."
        )
    all_codes = [p["player_code"] for p in players]
    form = get_recent_form(conn, season, all_codes)
    fixtures = get_upcoming_fixtures(conn, season, target)
    yellows = dict(
        conn.execute(
            """
        select player_code, coalesce(sum(yellow_cards), 0) from player_gameweek_stats
        where season = %s group by player_code
    """,
            (season,),
        ).fetchall()
    )
    matches = Counter()
    for home, away in conn.execute(
        "select team_h, team_a from fixtures where season = %s and finished = true",
        (season,),
    ).fetchall():
        matches.update((home, away))

    def enrich(p):
        p["recent_form"] = form.get(p["player_code"], [])
        p["upcoming_fixtures"] = fixtures.get(p["team_id"], [])
        p["form_score"] = form_score(p["recent_form"])
        p["score"] = fixture_score(
            p["recent_form"], p["upcoming_fixtures"], target, min(3, 39 - target)
        )
        p["captain_score"] = fixture_score(
            p["recent_form"], p["upcoming_fixtures"], target, 1
        )
        p["next_gameweek_fixture_count"] = sum(
            f["gameweek"] == target for f in p["upcoming_fixtures"]
        )

    for p in players + squad:
        enrich(p)
    for p in squad:
        p["season_yellow_cards"] = yellows.get(p["player_code"], 0)
        p["flag"] = (
            "unavailable"
            if not available(p)
            else "doubtful"
            if p["status"] == "d" or (p["chance_of_playing_next_round"] or 100) < 100
            else "suspension_risk"
            if suspension_risk(p["season_yellow_cards"], matches.get(p["team_id"]))
            else "blank_gameweek"
            if not p["next_gameweek_fixture_count"]
            else "zero_minutes_last_completed_gw"
            if p["recent_form"] and p["recent_form"][0]["minutes"] == 0
            else None
        )
    owned = {p["player_id"] for p in squad}
    candidates = {}
    for position in POSITIONS.values():
        pool = [
            p
            for p in players
            if p["position"] == position
            and p["player_id"] not in owned
            and p["status"] == "a"
            and (
                p["chance_of_playing_next_round"] is None
                or p["chance_of_playing_next_round"] == 100
            )
            and p["next_gameweek_fixture_count"]
        ]
        for p in pool:
            p["affordable_for"] = [
                s["player"] for s in squad if legal_swap(squad, s, p, bank)
            ]
        # Apply constraints BEFORE ranking/truncation, so cheap viable players
        # are not crowded out by unaffordable high scorers.
        if state is not None:
            pool = [p for p in pool if p["affordable_for"]]
        pool.sort(key=lambda p: (-p["score"], p["price"], p["player_id"]))
        # Retain the strongest option for every outgoing player as well as the
        # global shortlist, even if only one inexpensive option is affordable.
        shortlist = pool[:12]
        if state is not None:
            for owned_player in squad:
                best = next(
                    (p for p in pool if owned_player["player"] in p["affordable_for"]),
                    None,
                )
                if best is not None and best not in shortlist:
                    shortlist.append(best)
        candidates[position] = shortlist
    chip_advice = compute_chip_advice(
        squad,
        target,
        state.get("available_chips") if state else None,
        state.get("active_chip") if state else None,
    )
    warnings.append(
        "Form and fixtures are warehouse snapshots; refresh ingestion and team news before using advice. Scores rank options and are not expected points. No points-hit recommendation is supported."
    )
    context = {
        "season": season,
        "team_id": team_id,
        "gameweek": latest,
        "for_gameweek": target,
        "deadline": deadline.isoformat(),
        "state_verified": state is not None,
        "state_captured_at": transfers.get("captured_at") if transfers else None,
        "free_transfers": transfers["remaining"] if transfers else None,
        "transfer_state": transfers,
        "budget": {"bank": bank, "units": "tenths of a million GBP"},
        "squad": squad,
        "transfer_candidates": candidates,
        "chip_advice": chip_advice,
        "warnings": warnings,
    }
    context["context_id"] = context_fingerprint(context)
    return context
