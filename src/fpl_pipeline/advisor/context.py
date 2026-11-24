"""Warehouse research context and optional, manually confirmed current squad."""

from collections import Counter
from datetime import UTC, datetime, timedelta

import psycopg
from psycopg.rows import dict_row

from fpl_pipeline.config import FPL_TEAM_ID

from .evaluation import evaluate_warehouse, ranking_policy
from .learned import LEARNED_VERSION, load_active, load_published, predict_upcoming
from .model import (
    MODEL_VERSION,
    apply_ranking_policy,
    best_lineup,
    decision_context,
    week_score,
)
from .rules import (
    CHIPS,
    POSITIONS,
    available,
    context_fingerprint,
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
    conn, season: str, player_codes: list[int], last_n: int = 8
) -> dict[int, list[dict]]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select s.player_code, s.gameweek, s.total_points, s.minutes,
                s.goals_scored, s.assists, s.expected_goals, s.expected_assists,
                coalesce(s.fixture_count, (
                    select count(*) from fixtures f where f.season = s.season
                    and f.gameweek = s.gameweek and s.team_id in (f.team_h, f.team_a)
                )) as fixture_count
            from player_gameweek_stats s
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


# FPL issues each chip twice: the first set must be played by GW19, the
# second from GW20 to GW38. Unused chips are lost at the window's end.
CHIP_WINDOW_ENDS = (19, 38)
# Share of remaining gameweeks that unused chips would need before timing
# pressure relaxes the double-gameweek-only triggers (4 chips in 9 weeks).
EXPIRY_PRESSURE = 0.4


def chip_window(target: int) -> int:
    return next(end for end in CHIP_WINDOW_ENDS if target <= end)


# A later week must beat this one by this share before a chip waits for it.
CHIP_WAIT_MARGIN = 0.15


def bench_strength(squad: list[dict], gameweek: int) -> float:
    """Scores of the four players the optimized lineup would leave out."""
    lineup = best_lineup(squad, gameweek)
    return sum(week_score(p, gameweek) for p in squad if p["player_id"] in lineup["bench"])


def captain_strength(squad: list[dict], gameweek: int, starters: set[int]) -> float:
    return max(
        (week_score(p, gameweek) for p in squad if p["player_id"] in starters and available(p)),
        default=0.0,
    )


def better_week(
    strength, target: int, weeks_left: int, unused: int
) -> tuple[int, float, float] | None:
    """A clearly stronger week reachable without forfeiting any unused chip.

    With N unused chips and W weeks before expiry, a chip can wait W - N weeks.
    Only weeks the scores actually cover are compared; GW11's Bench Boost was
    played on the first eligible week although later benches looked stronger.
    """
    slack = weeks_left - max(unused, 1)
    if slack < 1:
        return None
    try:
        now = strength(target)
        later = [(gw, strength(gw)) for gw in range(target + 1, target + slack + 1)]
    except (ValueError, KeyError):
        return None
    if not later:
        return None
    gameweek, best = max(later, key=lambda item: (item[1], -item[0]))
    if best > max(now, 0.0) * (1 + CHIP_WAIT_MARGIN) and best > 0:
        return gameweek, round(now, 2), round(best, 2)
    return None


def bench_ready(squad: list[dict]) -> bool:
    """Require two recent fixtures with demonstrable 60-minute appearances."""
    for player in squad:
        if (
            player["status"] != "a"
            or player.get("chance_of_playing_next_round") not in (None, 100)
            or player["next_gameweek_fixture_count"] < 1
        ):
            return False
        fixtures_seen = 0
        for row in sorted(player["recent_form"], key=lambda r: r["gameweek"], reverse=True):
            count = row.get("fixture_count", 1)
            if count < 1:
                continue
            # In a double, even if all other matches lasted 90 minutes,
            # the remaining appearance must still have reached 60.
            if row["minutes"] - 90 * (count - 1) < 60:
                return False
            fixtures_seen += count
            if fixtures_seen >= 2:
                break
        if fixtures_seen < 2:
            return False
    return len(squad) == 15


def compute_chip_advice(
    squad: list[dict],
    target: int,
    available_chips: list[str] | None = None,
    active_chip: str | None = None,
    lineup: dict | None = None,
    after_transfer: list[dict] | None = None,
) -> dict:
    """Conservative planning signals, gated on confirmed chip availability.

    `after_transfer` is the squad after the top eligible transfer: selling a
    non-playing reserve can be what makes a Bench Boost viable. When unused
    chips nearly fill the gameweeks left before they expire, single-gameweek
    Bench Boost and Triple Captain signals replace waiting for a double.
    """
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
    # Bench Boost scores all 15. Reliable reserves cannot compensate for a
    # non-playing nominal starter; inspect minutes across the whole squad.
    squad_ready = bench_ready(squad)
    ready_after = after_transfer is not None and bench_ready(after_transfer)
    expiry = chip_window(target)
    weeks_left = expiry - target + 1
    unused = len(available_chips) if available_chips is not None else 0
    pressured = unused >= 2 and unused / weeks_left >= EXPIRY_PRESSURE
    expiry_note = (
        f" {unused} unused chips expire after GW{expiry}, with {weeks_left} gameweeks left"
        " to play them (one per gameweek), so a strong single gameweek is worth using."
        if pressured
        else ""
    )
    starter_ids = set(lineup["starters"]) if lineup else {p["player_id"] for p in squad if p["squad_position"] <= 11}
    captain_double = any(
        available(p)
        and p["player_id"] in starter_ids
        and p["next_gameweek_fixture_count"] >= 2
        and p["form_score"] >= 5
        for p in squad
    )
    easy_home_captain = pressured and any(
        available(p)
        and p["player_id"] in starter_ids
        and p["next_gameweek_fixture_count"] == 1
        and ((p.get("performance") or {}).get("recent_minutes") or 0) >= 60
        and any(
            f["gameweek"] == target and f.get("was_home") and (f.get("difficulty") or 5) <= 2
            for f in p.get("upcoming_fixtures", [])
        )
        and p["position"] in ("MID", "FWD")
        for p in squad
    )
    boost_squad = after_transfer if ready_after and not squad_ready else squad
    boost_wait = better_week(lambda gw: bench_strength(boost_squad, gw), target, weeks_left, unused)
    captain_wait = better_week(
        lambda gw: captain_strength(squad, gw, starter_ids), target, weeks_left, unused
    )

    def wait_note(wait, what):
        return (
            f" Hold: GW{wait[0]}'s {what} scores {wait[2]} against {wait[1]} now, and it can"
            " be reached without forfeiting an unused chip."
            if wait
            else ""
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
            ((squad_ready and len(fit) == 15) or (pressured and ready_after)) and not boost_wait,
            "Assess all four substitutes' likely minutes. Bench Boost can work in a single or double gameweek."
            + (
                " All 15 have two recent 60-minute appearances only after the top eligible transfer."
                if ready_after and not squad_ready
                else ""
            )
            + expiry_note
            + wait_note(boost_wait, "bench"),
        ),
        "triple_captain": (
            (captain_double or easy_home_captain) and not captain_wait,
            "Compare your strongest captain's fixtures and minutes. A double is an opportunity, not a requirement or a guarantee."
            + (
                " A starting attacker with regular minutes has an easy (difficulty 2) home fixture."
                if easy_home_captain and not captain_double
                else ""
            )
            + expiry_note
            + wait_note(captain_wait, "best captain"),
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
    policy = ranking_policy(evaluate_warehouse(conn))
    latest_finished = conn.execute(
        "select max(id) from gameweeks where season = %s and finished = true",
        (season,),
    ).fetchone()[0]
    horizon = min(4, 39 - target)
    # A local artifact must not override a newer weekly deployment decision.
    bundle, learned_status = load_active(season, latest_finished)
    if bundle is not None and bundle["meta"]["trained_through"] == latest_finished:
        predictions = predict_upcoming(conn, bundle, season, target, horizon)
    else:
        predictions, published = load_published(
            conn, season, target, horizon, latest_finished
        )
        published_week = (published.get("summary") or {}).get("trained_through")
        if bundle is not None and (
            published["status"] == "absent"
            or (published_week is not None and published_week < bundle["meta"]["trained_through"])
        ):
            predictions = predict_upcoming(conn, bundle, season, target, horizon)
        else:
            local_report = learned_status.get("summary") or {}
            if (
                local_report.get("version") == LEARNED_VERSION
                and local_report.get("season") == season
                and published_week is not None
                and published_week < local_report.get("trained_through", 0) <= (latest_finished or 0)
                and local_report.get("gate", {}).get("passed") is False
            ):
                predictions = {}
            elif published["status"] != "absent" or learned_status["status"] == "absent":
                learned_status = published
    if predictions and set(all_codes).difference(predictions):
        predictions = {}
        learned_status = {
            **learned_status, "status": "inactive",
            "reason": "Predictions do not cover the current player list; refresh predictions.",
        }
    if predictions:
        policy = {
            **policy,
            "selected": "learned",
            "learned_version": LEARNED_VERSION,
            "reason": "The learned points model passed its held-out season and current-season gate; scores are predicted points per gameweek, adjusted for current availability.",
            "limitation": "Predictions ignore team news; they are estimates with substantial error, not guarantees.",
        }
    elif learned_status["status"] != "absent":
        warnings.append(f"Learned model inactive: {learned_status['reason']}")
    policy["learned_model"] = learned_status
    refresh = conn.execute(
        "select completed_at from data_refresh_status where season = %s", (season,)
    ).fetchone()
    refreshed_at = refresh[0] if refresh else None
    data_fresh = refreshed_at is not None and now - timedelta(hours=6) <= refreshed_at <= now + timedelta(minutes=5)
    if not data_fresh:
        warnings.append("Warehouse freshness is unconfirmed or older than six hours. Run ingestion before saving advice.")
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
        p["performance"] = apply_ranking_policy(
            p, policy, predictions.get(p["player_code"])
        )
        horizon = min(4, 39 - target)
        p["score"] = round(sum(week_score(p, gw) for gw in range(target, target + horizon)) / horizon, 3)
        p["captain_score"] = week_score(p, target)
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
        candidates[position] = pool
    # Compare every legal candidate with the full squad before reducing the
    # prompt. A raw form shortlist can hide the best cover or positional swap.
    decision = decision_context(squad, candidates, target, bank)
    selected_ids = {option["in_id"] for option in decision["transfer_options"]}
    for position, pool in candidates.items():
        candidates[position] = [p for index, p in enumerate(pool) if index < 12 or p["player_id"] in selected_ids]
    top = next((o for o in decision["transfer_options"] if o["eligible"]), None)
    after_transfer = None
    if top is not None:
        incoming = next(
            (p for pool in candidates.values() for p in pool if p["player_id"] == top["in_id"]),
            None,
        )
        if incoming is not None:
            after_transfer = [incoming if p["player_id"] == top["out_id"] else p for p in squad]
    chip_advice = compute_chip_advice(
        squad,
        target,
        state.get("available_chips") if state else None,
        state.get("active_chip") if state else None,
        decision["lineup"],
        after_transfer,
    )
    warnings.append(
        "Form and fixtures are warehouse snapshots; refresh ingestion and team news before using advice. "
        + (
            "Scores are learned predicted points, not guarantees."
            if policy["selected"] == "learned"
            else "Scores rank options and are not expected points."
        )
        + " No points-hit recommendation is supported."
    )
    context = {
        "model_version": MODEL_VERSION,
        "ranking_policy": policy,
        "data_refreshed_at": refreshed_at.isoformat() if refreshed_at else None,
        "data_fresh": data_fresh,
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
        "decision": decision,
    }
    if transfers is not None and transfers["remaining"] == 0:
        context["decision"]["action"] = "roll"
        context["decision"]["reason"] = "No free transfers remain. Use the best existing XI; paid hits are disabled."
        for option in context["decision"]["transfer_options"]:
            option["eligible"] = False
    context["context_id"] = context_fingerprint(context)
    return context
