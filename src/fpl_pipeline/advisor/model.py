"""Explainable ranking and squad decisions. Scores are NOT expected points.

All inputs must be known before the target deadline. Parameters are conservative
policy choices, not fitted or calibrated probabilities.
"""

from collections import Counter
from itertools import combinations, product
from statistics import median

from .rules import available, legal_swap

MODEL_VERSION = "minutes-fixtures-v3"
HORIZON = 4
MIN_GAIN = 1.5
LINEUP_TIE_MARGIN = 0.75
TRANSFER_TIE_MARGIN = MIN_GAIN
GOAL_POINTS = {"GKP": 6, "DEF": 6, "MID": 5, "FWD": 4}
PRIOR = {"GKP": 2.5, "DEF": 2.5, "MID": 3.0, "FWD": 3.0}
FORMATIONS = [
    (d, m, 10 - d - m)
    for d, m in product(range(3, 6), range(2, 6))
    if 1 <= 10 - d - m <= 3
]


def performance_profile(player: dict) -> dict:
    """Normalize past doubles, exclude blanks, shrink hauls and short samples.

    Minutes enter the observed per-fixture return already; applying a second
    minutes multiplier would penalize substitutes twice. Only a recent change
    in minutes is applied separately.
    """
    rows = sorted(
        player.get("recent_form", []), key=lambda r: r["gameweek"], reverse=True
    )
    rows = [r for r in rows if r.get("fixture_count", 1) > 0][:8]
    if not rows:
        return {
            "rating": 0.0,
            "minutes_per_fixture": None,
            "recent_minutes": None,
            "sample_matches": 0,
            "confidence": "unknown",
            "underlying_matches": 0,
            "haul_share": None,
        }
    latest = rows[0]["gameweek"]
    weights = [0.5 ** ((latest - r["gameweek"]) / 4) for r in rows]
    counts = [r.get("fixture_count", 1) for r in rows]
    matches = sum(counts)
    denominator = sum(w * n for w, n in zip(weights, counts))
    minutes = sum(w * r["minutes"] for w, r in zip(weights, rows)) / denominator
    per_match = [float(r["total_points"]) / n for r, n in zip(rows, counts)]
    # A single recent haul must not dominate five ordinary appearances.
    cap = max(6.0, median(per_match) + 4.0)
    returns = []
    underlying_matches = 0
    for row, count, actual in zip(rows, counts, per_match):
        value = actual
        if all(
            row.get(k) is not None
            for k in ("expected_goals", "expected_assists", "goals_scored", "assists")
        ):
            goal_points = GOAL_POINTS[player["position"]]
            underlying = (
                float(row["total_points"])
                - goal_points * row["goals_scored"]
                - 3 * row["assists"]
                + goal_points * float(row["expected_goals"])
                + 3 * float(row["expected_assists"])
            ) / count
            value = 0.4 * actual + 0.6 * underlying
            underlying_matches += count
        returns.append(max(-2.0, min(cap, value)))
    mean = sum(w * n * v for w, n, v in zip(weights, counts, returns)) / denominator
    # Prior scales with actual participation; a non-playing reserve gets no
    # invented appearance points from shrinkage.
    prior = PRIOR[player["position"]] * min(1.0, minutes / 75)
    rating = (mean * matches + prior * 3) / (matches + 3)
    recent = rows[:2]
    recent_minutes = sum(r["minutes"] for r in recent) / sum(counts[:2])
    if minutes > 0:
        rating *= min(1.0, (recent_minutes + 15) / (minutes + 15))
    chance = player.get("chance_of_playing_next_round")
    # Unknown doubtful status deserves a conservative risk adjustment.
    risk = (
        chance / 100
        if chance is not None
        else 0.75
        if player.get("status") == "d"
        else 1
    )
    if not available(player):
        risk = 0
    total_positive = sum(max(0, float(r["total_points"])) for r in rows)
    return {
        "rating": round(max(0, rating) * risk, 4),
        "minutes_per_fixture": round(minutes, 1),
        "recent_minutes": round(recent_minutes, 1),
        "sample_matches": matches,
        "confidence": "low" if matches < 4 or recent_minutes < 60 else "medium",
        "underlying_matches": underlying_matches,
        "haul_share": round(
            max(max(0, float(r["total_points"])) for r in rows) / total_positive, 3
        )
        if total_positive
        else 0,
    }


def apply_ranking_policy(player: dict, policy: dict) -> dict:
    """Keep the experimental estimator inactive until its evaluation gate passes.

    The fallback retains observed form, with doubles normalized and a separate
    adjustment for recent loss of minutes and current availability. These are
    decision safeguards, not evidence of predictive lift.
    """
    profile = performance_profile(player)
    profile["experimental_rating"] = profile["rating"]
    profile["ranking_source"] = policy["selected"]
    if policy["selected"] == "experimental":
        return profile
    rows = sorted(
        (r for r in player.get("recent_form", []) if r.get("fixture_count", 1) > 0),
        key=lambda row: row["gameweek"],
        reverse=True,
    )[:5]
    if not rows:
        return profile
    weights = [2] + [1] * (len(rows) - 1)
    rating = sum(
        w * float(row["total_points"]) / row.get("fixture_count", 1)
        for w, row in zip(weights, rows)
    ) / sum(weights)
    minutes = profile["minutes_per_fixture"] or 0
    if minutes > 0:
        rating *= min(1, ((profile["recent_minutes"] or 0) + 15) / (minutes + 15))
    chance = player.get("chance_of_playing_next_round")
    risk = (
        chance / 100
        if chance is not None
        else 0.75
        if player.get("status") == "d"
        else 1
    )
    profile["rating"] = round(max(0, rating) * risk, 4) if available(player) else 0.0
    return profile


def week_score(player: dict, gameweek: int) -> float:
    profile = player.get("performance") or performance_profile(player)
    # FDR is ordinal: modest adjustments, never an asserted scoring probability.
    factor = sum(
        1 + (3 - (f.get("difficulty") or 3)) * 0.12
        for f in player.get("upcoming_fixtures", [])
        if f["gameweek"] == gameweek
    )
    return round(profile["rating"] * factor, 4)


def reliable_minutes(player: dict, gameweek: int) -> bool:
    """Conservative cover classification, not an appearance probability."""
    profile = player.get("performance") or performance_profile(player)
    return (
        player.get("status") == "a"
        and player.get("chance_of_playing_next_round") in (None, 100)
        and profile["sample_matches"] >= 3
        and (profile["recent_minutes"] or 0) >= 60
        and week_score(player, gameweek) > 0
    )


def best_lineup(squad: list[dict], gameweek: int) -> dict:
    """Optimize all 15; prefer regular minutes when index differences are small."""
    scores = {p["player_id"]: week_score(p, gameweek) for p in squad}
    reliable = {p["player_id"]: reliable_minutes(p, gameweek) for p in squad}
    groups = {
        position: sorted(p["player_id"] for p in squad if p["position"] == position)
        for position in GOAL_POINTS
    }
    # Keep the best subset for each count of regular players. This retains
    # alternatives within a position without enumerating every full XI.
    selections = {}
    for position, ids in groups.items():
        for n in range(1, len(ids) + 1):
            best = {}
            for ids_subset in combinations(ids, n):
                safe = sum(reliable[i] for i in ids_subset)
                score = sum(scores[i] for i in ids_subset)
                if safe not in best or score > best[safe][0]:
                    best[safe] = (score, safe, ids_subset)
            selections[position, n] = list(best.values())
    choices = []
    for d, m, f in FORMATIONS:
        if any(
            len(groups[pos]) < n
            for pos, n in (("GKP", 1), ("DEF", d), ("MID", m), ("FWD", f))
        ):
            continue
        for parts in product(
            *(
                selections[pos, n]
                for pos, n in (("GKP", 1), ("DEF", d), ("MID", m), ("FWD", f))
            )
        ):
            choices.append(
                (
                    sum(part[0] for part in parts),
                    sum(part[1] for part in parts),
                    (d, m, f),
                    tuple(i for part in parts for i in part[2]),
                )
            )
    if not choices:
        raise ValueError("Cannot select a legal starting XI from this squad.")
    maximum = max(choice[0] for choice in choices)
    close = [choice for choice in choices if choice[0] >= maximum - LINEUP_TIE_MARGIN]
    score, regular, formation, ids = max(
        close, key=lambda choice: (choice[1], choice[0])
    )
    bench = sorted(
        (p for p in squad if p["player_id"] not in ids),
        key=lambda p: (
            p["position"] == "GKP",
            not reliable[p["player_id"]],
            -scores[p["player_id"]],
            p["player_id"],
        ),
    )
    return {
        "gameweek": gameweek,
        "formation": "-".join(map(str, formation)),
        "starters": list(ids),
        "bench": [p["player_id"] for p in bench],
        "score": round(score, 4),
        "regular_starters": regular,
        "selection_note": "Prefer regular minutes over a marginal ranking advantage."
        if maximum - score > 0.0001
        else None,
    }


def automatic_substitutions(
    squad: list[dict], lineup: dict, minutes: dict[int, int]
) -> dict:
    """Resolve known full-gameweek minutes; a one-minute cameo blocks a sub.

    Find the largest legal set of substitutions, preserving bench priority.
    Unreplaced zero-minute players retain their nominal formation slots.
    """
    by_id = {p["player_id"]: p for p in squad}
    starters = list(lineup["starters"])
    subs = []
    keeper = next(i for i in starters if by_id[i]["position"] == "GKP")
    reserve = next(i for i in lineup["bench"] if by_id[i]["position"] == "GKP")
    if minutes.get(keeper, 0) == 0 and minutes.get(reserve, 0) > 0:
        starters[starters.index(keeper)] = reserve
        subs.append({"out": keeper, "in": reserve})
    absent = [
        i for i in starters if by_id[i]["position"] != "GKP" and minutes.get(i, 0) == 0
    ]
    bench = [
        i
        for i in lineup["bench"]
        if by_id[i]["position"] != "GKP" and minutes.get(i, 0) > 0
    ]
    for n in range(min(len(absent), len(bench)), -1, -1):
        for incoming in combinations(bench, n):
            for outgoing in combinations(absent, n):
                updated = [i for i in starters if i not in outgoing] + list(incoming)
                counts = Counter(by_id[i]["position"] for i in updated)
                if (
                    counts["GKP"] == 1
                    and 3 <= counts["DEF"] <= 5
                    and 2 <= counts["MID"] <= 5
                    and 1 <= counts["FWD"] <= 3
                ):
                    return {
                        "scoring_players": [
                            i for i in updated if minutes.get(i, 0) > 0
                        ],
                        "substitutions": subs
                        + [{"out": o, "in": i} for o, i in zip(outgoing, incoming)],
                    }
    raise ValueError("The supplied XI is not a legal formation.")


def lineup_evidence(
    squad: list[dict], gameweek: int, lineup: dict | None = None
) -> dict:
    """Show safe reserve cover for each single absent starter, without xP claims."""
    lineup = dict(lineup or best_lineup(squad, gameweek))
    by_id = {p["player_id"]: p for p in squad}
    regular = {i for i, p in by_id.items() if reliable_minutes(p, gameweek)}
    coverage = []
    for absent in lineup["starters"]:
        minutes = {
            i: 90
            if available(p)
            and week_score(p, gameweek) > 0
            and (i in lineup["starters"] or i in regular)
            else 0
            for i, p in by_id.items()
        }
        minutes[absent] = 0
        resolved = automatic_substitutions(squad, lineup, minutes)
        coverage.append(
            {
                "absent": absent,
                "replacement": next(
                    (s["in"] for s in resolved["substitutions"] if s["out"] == absent),
                    None,
                ),
            }
        )
    lineup["coverage"] = coverage
    lineup["reliable_outfield_bench"] = [
        i for i in lineup["bench"] if i in regular and by_id[i]["position"] != "GKP"
    ]
    lineup["uncovered_starters"] = [
        c["absent"] for c in coverage if c["replacement"] is None
    ]
    lineup["warnings"] = [
        f"{by_id[i]['player']}: check availability and minutes; automatic substitutes only replace zero-minute appearances."
        for i in lineup["starters"]
        if i not in regular
    ]
    if lineup["uncovered_starters"]:
        lineup["warnings"].append(
            "Some starter absences have no reserve with established minutes who preserves a legal formation."
        )
    lineup["coverage_note"] = (
        "Single-absence stress check using available reserves with established minutes; not a probability or a guarantee. Cameos cannot be replaced."
    )
    return lineup


def decision_context(
    squad: list[dict], candidates: dict, target: int, bank: int | None
) -> dict:
    """Compare independent moves with rolling and optimizing the existing XI."""
    horizon = min(HORIZON, 39 - target)
    baseline = [best_lineup(squad, gw) for gw in range(target, target + horizon)]
    baseline_score = sum(row["score"] for row in baseline)
    options = []
    compared_candidates = 0
    for pool in candidates.values():
        for incoming in pool:
            profile = incoming["performance"]
            # Unknown and cameo-only candidates remain research, never buys.
            if profile["sample_matches"] < 3 or (profile["recent_minutes"] or 0) < 60:
                continue
            compared_candidates += 1
            for outgoing in squad:
                if not legal_swap(squad, outgoing, incoming, bank):
                    continue
                changed = [
                    incoming if p["player_id"] == outgoing["player_id"] else p
                    for p in squad
                ]
                lineups = [
                    best_lineup(changed, gw) for gw in range(target, target + horizon)
                ]
                scores = [lineup["score"] for lineup in lineups]
                gain = sum(scores) - baseline_score
                immediate = scores[0] - baseline[0]["score"]
                # A transfer must clear the opportunity cost of rolling and
                # help the coming XI. Index thresholds are NOT point costs.
                eligible = gain >= MIN_GAIN and immediate >= 0.25
                options.append(
                    {
                        "player_out": outgoing["player"],
                        "player_in": incoming["player"],
                        "out_id": outgoing["player_id"],
                        "in_id": incoming["player_id"],
                        "horizon_gain": round(gain, 3),
                        "next_gameweek_gain": round(immediate, 3),
                        "bank_after": bank
                        + outgoing["selling_price"]
                        - incoming["now_cost"],
                        "eligible": eligible,
                        "lineup": lineup_evidence(changed, target, lineups[0]),
                    }
                )
    options.sort(
        key=lambda option: (
            -option["horizon_gain"],
            -option["next_gameweek_gain"],
            option["out_id"],
            option["in_id"],
        )
    )
    # The gain is an index: tiny differences must not override useful cover.
    eligible = [o for o in options if o["eligible"]]
    if eligible:
        close = [
            o
            for o in eligible
            if o["horizon_gain"] >= eligible[0]["horizon_gain"] - TRANSFER_TIE_MARGIN
        ]
        preferred = max(
            close,
            key=lambda o: (
                len(o["lineup"]["reliable_outfield_bench"]),
                -len(o["lineup"]["uncovered_starters"]),
                o["lineup"]["regular_starters"],
                o["horizon_gain"],
            ),
        )
        options.remove(preferred)
        options.insert(0, preferred)
    compared_options = len(options)
    # Truncate after assessing all legal candidates; retain each outgoing
    # player's best alternative so bench repairs cannot disappear silently.
    retained = options[:24]
    for outgoing in squad:
        best = next((o for o in options if o["out_id"] == outgoing["player_id"]), None)
        if best is not None and best not in retained:
            retained.append(best)
    starters = {
        p["player_id"] for p in squad if p["player_id"] in baseline[0]["starters"]
    }
    captains = sorted(
        (
            p
            for p in squad
            if p["player_id"] in starters and available(p) and week_score(p, target) > 0
        ),
        key=lambda p: (-week_score(p, target), p["player_id"]),
    )
    reliable = [
        p
        for p in captains
        if p["performance"]["sample_matches"] >= 3
        and (p["performance"]["recent_minutes"] or 0) >= 60
    ]
    if len(reliable) >= 2:
        captains = reliable
    return {
        "model_version": MODEL_VERSION,
        "score_units": "heuristic index; not expected points",
        "horizon": horizon,
        "minimum_horizon_gain": MIN_GAIN,
        "baseline": baseline,
        "lineup": lineup_evidence(squad, target, baseline[0]),
        "captain_candidates": [p["player_id"] for p in captains],
        "transfer_options": retained,
        "compared_candidates": compared_candidates,
        "compared_options": compared_options,
        "lineup_tie_margin": LINEUP_TIE_MARGIN,
        "transfer_tie_margin": TRANSFER_TIE_MARGIN,
        "action": "consider_transfer"
        if any(o["eligible"] for o in options)
        else "roll",
        "reason": "Compare eligible options with rolling the free transfer; keep your squad when gains are marginal.",
        "policy": "Compare all 15 players and all legal candidates before truncation. Prefer established minutes and usable reserve cover when ranking gains are marginal. Require a material multiweek gain and an immediate improvement. No hits.",
    }
