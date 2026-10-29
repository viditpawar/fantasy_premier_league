"""FPL constraints and ranking helpers; no network, database or LLM calls."""

import hashlib
import json
from collections import Counter
from decimal import Decimal

MAX_FREE_TRANSFERS = 5
HIT_COST = 4
POSITIONS = {1: "GKP", 2: "DEF", 3: "MID", 4: "FWD"}
UNAVAILABLE = {"i", "s", "u", "n"}
CHIPS = {"wildcard", "freehit", "bboost", "3xc"}


def integer(value, name: str, minimum: int = 0, maximum: int | None = None) -> int:
    if (
        type(value) is not int
        or value < minimum
        or maximum is not None
        and value > maximum
    ):
        raise ValueError(
            f"{name} must be an integer between {minimum} and {maximum or 'unlimited'}."
        )
    return value


def transfer_state(limit: int | None, made: int, cost: int = HIT_COST) -> dict:
    integer(made, "transfers made")
    integer(cost, "transfer cost", 1)
    if limit is not None:
        integer(limit, "transfer limit", 0, MAX_FREE_TRANSFERS)
    return {
        "limit": limit,
        "made": made,
        "remaining": None if limit is None else max(0, limit - made),
        "already_committed_cost": 0 if limit is None else max(0, made - limit) * cost,
        "next_transfer_cost": 0 if limit is None or made < limit else cost,
    }


def suspension_risk(yellows: int, team_matches_played: int | None) -> bool:
    if team_matches_played is None:
        return False
    return any(
        yellows == threshold - 1 and team_matches_played < cutoff
        for threshold, cutoff in ((5, 19), (10, 32), (15, 38))
    )


def form_score(recent_form: list[dict]) -> float:
    """Weighted mean of completed gameweeks, newest first; not expected points."""
    if not recent_form:
        return 0.0
    ordered = sorted(recent_form, key=lambda row: row["gameweek"], reverse=True)
    weights = [2] + [1] * (len(ordered) - 1)
    return round(
        sum(w * float(row["total_points"]) for w, row in zip(weights, ordered))
        / sum(weights),
        3,
    )


def fixture_score(
    recent_form: list[dict], fixtures: list[dict], target: int, horizon: int = 3
) -> float:
    """Ranking index across gameweeks, so blanks and doubles remain visible."""
    integer(horizon, "horizon", 1)
    future = [f for f in fixtures if target <= f["gameweek"] < target + horizon]
    factor = sum(1 + (3 - (f.get("difficulty") or 3)) * 0.08 for f in future)
    return round(form_score(recent_form) * factor / horizon, 3)


def available(player: dict) -> bool:
    return (
        player["status"] not in UNAVAILABLE
        and player.get("chance_of_playing_next_round") != 0
    )


def affordable(outgoing: dict, incoming: dict, bank: int | None) -> bool:
    if bank is None or outgoing.get("selling_price") is None:
        return False
    return Decimal(str(incoming["price"])) * 10 <= outgoing["selling_price"] + bank


def legal_swap(
    squad: list[dict], outgoing: dict, incoming: dict, bank: int | None
) -> bool:
    clubs = Counter(
        p["team_id"] for p in squad if p["player_code"] != outgoing["player_code"]
    )
    clubs[incoming["team_id"]] += 1
    return (
        incoming["position"] == outgoing["position"]
        and incoming["player_code"] not in {p["player_code"] for p in squad}
        and available(incoming)
        and affordable(outgoing, incoming, bank)
        and max(clubs.values()) <= 3
    )


def validate_squad(squad: list[dict]) -> None:
    if len(squad) != 15 or len({p["player_id"] for p in squad}) != 15:
        raise ValueError("A current squad must contain 15 distinct players.")
    if {p["squad_position"] for p in squad} != set(range(1, 16)):
        raise ValueError("Squad positions must contain each slot from 1 to 15 once.")
    if Counter(p["position"] for p in squad) != {
        "GKP": 2,
        "DEF": 5,
        "MID": 5,
        "FWD": 3,
    }:
        raise ValueError(
            "Squad must contain 2 goalkeepers, 5 defenders, 5 midfielders and 3 forwards."
        )
    # A real squad can temporarily own >3 from a club following a real-life
    # transfer. Individual proposed moves must still satisfy FPL's club cap.
    starters = Counter(p["position"] for p in squad if p["squad_position"] <= 11)
    if not (
        starters["GKP"] == 1
        and 3 <= starters["DEF"] <= 5
        and 2 <= starters["MID"] <= 5
        and 1 <= starters["FWD"] <= 3
    ):
        raise ValueError("The starting XI must use a legal FPL formation.")


def context_fingerprint(context: dict) -> str:
    keys = (
        "season",
        "team_id",
        "for_gameweek",
        "deadline",
        "free_transfers",
        "budget",
        "squad",
        "transfer_candidates",
        "transfer_state",
        "state_verified",
        "chip_advice",
        "state_captured_at",
        "model_version",
        "decision",
        "ranking_policy",
        "data_refreshed_at",
        "data_fresh",
    )
    fields = {key: context.get(key) for key in keys}
    encoded = json.dumps(fields, sort_keys=True, default=str, separators=(",", ":"))
    return hashlib.sha256(encoded.encode()).hexdigest()[:24]


def validate_lineup(squad: list[dict], lineup: dict) -> None:
    """Validate the entire proposed XI and bench, including the reserve keeper."""
    starters, bench = lineup.get("starters"), lineup.get("bench")
    if not isinstance(starters, list) or not isinstance(bench, list):
        raise ValueError(  # noqa: TRY004 - consistent user-input validation errors
            "Proposed lineup must contain a starting XI and an ordered bench."
        )
    ids = starters + bench
    if any(type(i) is not int for i in ids):
        raise ValueError("Proposed lineup IDs must be integers.")
    if (
        len(starters) != 11
        or len(bench) != 4
        or len(set(ids)) != 15
        or set(ids) != {p["player_id"] for p in squad}
    ):
        raise ValueError(
            "Proposed lineup must account for all 15 owned players exactly once."
        )
    by_id = {p["player_id"]: p for p in squad}
    ordered = [{**by_id[i], "squad_position": slot} for slot, i in enumerate(ids, 1)]
    validate_squad(ordered)
    counts = Counter(by_id[i]["position"] for i in starters)
    if lineup.get("formation") != f"{counts['DEF']}-{counts['MID']}-{counts['FWD']}":
        raise ValueError("Proposed formation does not match the starting XI.")
    if by_id[bench[-1]]["position"] != "GKP":
        raise ValueError(
            "Keep the reserve goalkeeper separate from the outfield bench order."
        )


def validate_suggestion(context: dict, suggestion: dict) -> dict:
    """Validate independent one-player alternatives before persisting advice."""
    if not isinstance(suggestion, dict):
        raise ValueError("Suggestion must be a JSON object.")  # noqa: TRY004 - unified user-input validation errors
    if (
        not context.get("context_id")
        or suggestion.get("context_id") != context["context_id"]
    ):
        raise ValueError(
            "Advice is stale or has no matching context_id. Generate a fresh prompt and response."
        )
    if not context.get("state_verified"):
        raise ValueError(
            "Supply --state with the confirmed current squad, bank and transfer counts before saving advice."
        )
    if context.get("data_fresh") is False:
        raise ValueError(
            "Warehouse data is stale or unconfirmed. Refresh ingestion before saving advice."
        )
    squad = context["squad"]
    validate_squad(squad)
    names = [p["player"] for p in squad]
    if len(set(names)) != len(names):
        raise ValueError(
            "Squad web names are ambiguous; name-only advice cannot be applied safely."
        )
    by_name = {p["player"]: p for p in squad}
    candidates = [p for group in context["transfer_candidates"].values() for p in group]
    seen = set()
    sold = set()
    post_transfer_lineups = []
    baseline = context.get("decision", {}).get("lineup")
    if baseline and "bench" in baseline:
        validate_lineup(squad, baseline)
    for key in ("recommended_transfers", "hit_transfers"):
        moves = suggestion.get(key)
        if not isinstance(moves, list) or len(moves) > 3:
            raise ValueError(
                f"{key} must contain at most three independent alternatives."
            )
        if moves and key == "recommended_transfers" and context["free_transfers"] == 0:
            raise ValueError(
                "No free transfers remain; a new move cannot be labelled free."
            )
        # No calibrated point forecast exists in this warehouse. An improvement
        # in the ranking index cannot establish that a hit will repay its cost.
        if moves and key == "hit_transfers":
            raise ValueError(
                "Hits are disabled: ranking scores are not points forecasts."
            )
        for move in moves:
            if (
                not isinstance(move, dict)
                or not isinstance(move.get("reasoning"), str)
                or not move["reasoning"].strip()
            ):
                raise ValueError("Each transfer requires a written reason.")
            outgoing = (
                by_name.get(move.get("player_out"))
                if isinstance(move.get("player_out"), str)
                else None
            )
            matches = [p for p in candidates if p["player"] == move.get("player_in")]
            if not outgoing or len(matches) != 1:
                raise ValueError(
                    "Transfer names must identify an owned player and a unique candidate."
                )
            incoming = matches[0]
            pair = (outgoing["player_id"], incoming["player_id"])
            if pair in seen:
                raise ValueError("Duplicate transfer alternative.")
            seen.add(pair)
            sold.add(outgoing["player_id"])
            if move.get("position") != outgoing["position"] or not legal_swap(
                squad, outgoing, incoming, context["budget"]["bank"]
            ):
                raise ValueError(
                    "Illegal transfer: check position, ownership, availability, real selling price, bank and club limit."
                )
            decision = context.get("decision")
            if decision is None:
                raise ValueError(
                    "Advice requires a current decision model; generate a fresh prompt."
                )
            option = next(
                (
                    option
                    for option in decision["transfer_options"]
                    if (
                        option["out_id"] == outgoing["player_id"]
                        and option["in_id"] == incoming["player_id"]
                        and option["eligible"]
                    )
                ),
                None,
            )
            if option is None:
                raise ValueError(
                    "Transfer does not improve the optimized XI enough to justify using a free transfer."
                )
            if option.get("lineup"):
                changed = [
                    incoming if p["player_id"] == outgoing["player_id"] else p
                    for p in squad
                ]
                validate_lineup(changed, option["lineup"])
                post_transfer_lineups.append(set(option["lineup"]["starters"]))
    for key in ("summary", "captaincy_reasoning"):
        if not isinstance(suggestion.get(key), str) or not suggestion[key].strip():
            raise ValueError(f"{key} must be a non-empty string.")
    if not isinstance(suggestion.get("lineup_watch"), list) or any(
        not isinstance(note, str) or not note.strip()
        for note in suggestion["lineup_watch"]
    ):
        raise ValueError("lineup_watch must be a list of non-empty strings.")
    captains = []
    starter_ids = set(
        context.get("decision", {})
        .get("lineup", {})
        .get("starters", [p["player_id"] for p in squad if p["squad_position"] <= 11])
    )
    for key in ("captain", "vice_captain"):
        player = (
            by_name.get(suggestion.get(key))
            if isinstance(suggestion.get(key), str)
            else None
        )
        if (
            not player
            or player["player_id"] not in starter_ids
            or any(
                player["player_id"] not in starters
                for starters in post_transfer_lineups
            )
            or (
                "captain_candidates" in context.get("decision", {})
                and player["player_id"] not in context["decision"]["captain_candidates"]
            )
            or not available(player)
            or not player.get("next_gameweek_fixture_count")
            or player["player_id"] in sold
        ):
            raise ValueError(
                "Captain and vice must be distinct, available retained starters with a target-gameweek fixture."
            )
        captains.append(player["player_id"])
    if captains[0] == captains[1]:
        raise ValueError("Captain and vice-captain must be different players.")
    return suggestion
