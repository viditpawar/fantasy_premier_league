"""Behavioral regressions for ranking, lineup selection and transfer decisions."""

from copy import deepcopy

import pytest

from fpl_pipeline.advisor.evaluation import evaluate_rankings, ranking_policy
from fpl_pipeline.advisor.model import (
    apply_ranking_policy,
    automatic_substitutions,
    best_lineup,
    decision_context,
    lineup_evidence,
    performance_profile,
    week_score,
)
from fpl_pipeline.advisor.rules import validate_lineup


def player(code=1, position="MID", points=(5, 5, 5, 5, 5), minutes=None):
    return {
        "player_id": code,
        "player_code": code,
        "player": f"P{code}",
        "position": position,
        "status": "a",
        "chance_of_playing_next_round": 100,
        "team_id": code,
        "price": 5,
        "now_cost": 50,
        "selling_price": 50,
        "recent_form": [
            {"gameweek": gw, "total_points": pts, "minutes": mins, "fixture_count": 1}
            for gw, pts, mins in zip(
                range(1, len(points) + 1), points, minutes or [90] * len(points)
            )
        ],
        "upcoming_fixtures": [{"gameweek": gw, "difficulty": 3} for gw in range(6, 10)],
    }


def squad():
    return [
        player(i, pos)
        for i, pos in enumerate(
            ["GKP"] * 2 + ["DEF"] * 5 + ["MID"] * 5 + ["FWD"] * 3, 1
        )
    ]


def test_steady_returner_beats_single_recent_haul():
    steady = performance_profile(player(points=(5, 5, 5, 5, 5)))
    haul = performance_profile(player(points=(2, 2, 2, 2, 17)))
    assert steady["rating"] > haul["rating"]
    assert haul["haul_share"] > 0.6


def test_cameo_and_missing_history_do_not_become_buy_signals():
    regular = performance_profile(player())
    cameo = performance_profile(player(points=(0, 0, 0, 0, 8), minutes=[0, 0, 0, 0, 5]))
    unknown = performance_profile(player(points=()))
    assert cameo["rating"] < regular["rating"]
    assert cameo["confidence"] == "low"
    assert unknown["rating"] == 0 and unknown["confidence"] == "unknown"
    assert unknown["recent_minutes"] is None


def test_historical_double_is_normalized_and_blank_is_excluded():
    ordinary = player(points=(5, 5, 5, 5))
    double = player(points=(5, 5, 10))
    double["recent_form"][-1].update(minutes=180, fixture_count=2)
    double["recent_form"].append(
        {"gameweek": 4, "total_points": 0, "minutes": 0, "fixture_count": 0}
    )
    a, b = performance_profile(ordinary), performance_profile(double)
    assert a["rating"] == pytest.approx(b["rating"])
    assert b["minutes_per_fixture"] == 90 and b["sample_matches"] == 4


def test_unavailable_and_doubtful_reduce_rank_but_do_not_erase_history():
    fit = player()
    doubtful = {**fit, "status": "d", "chance_of_playing_next_round": 50}
    injured = {**fit, "status": "i", "chance_of_playing_next_round": 0}
    assert performance_profile(doubtful)["rating"] == pytest.approx(
        performance_profile(fit)["rating"] / 2
    )
    assert performance_profile(injured)["rating"] == 0
    assert performance_profile(injured)["sample_matches"] == 5


def test_missing_xg_is_distinct_from_known_zero():
    missing = player(points=(8, 8, 8, 8))
    zero = deepcopy(missing)
    for row in zero["recent_form"]:
        row.update(goals_scored=1, assists=0, expected_goals=0, expected_assists=0)
    assert performance_profile(zero)["rating"] < performance_profile(missing)["rating"]
    assert performance_profile(missing)["underlying_matches"] == 0
    assert performance_profile(zero)["underlying_matches"] == 4


def test_recent_loss_of_minutes_is_penalized_without_declaring_absence():
    regular = player()
    dropped = player(points=(5, 5, 5, 5, 0), minutes=[90, 90, 90, 90, 0])
    assert (
        0
        < performance_profile(dropped)["rating"]
        < performance_profile(regular)["rating"]
    )


def test_future_blank_and_double_are_explicit():
    p = player()
    p["upcoming_fixtures"] = [{"gameweek": 7, "difficulty": 3}] * 2
    assert week_score(p, 6) == 0
    assert week_score(p, 7) == 2 * performance_profile(p)["rating"]


def test_lineup_selects_legal_formation_and_only_one_keeper():
    owned = squad()
    owned[1] = player(2, "GKP", points=(10,) * 5)
    owned[6] = player(7, "DEF", points=(9,) * 5)
    result = best_lineup(owned, 6)
    xi = [p for p in owned if p["player_id"] in result["starters"]]
    counts = {
        pos: sum(p["position"] == pos for p in xi)
        for pos in ("GKP", "DEF", "MID", "FWD")
    }
    assert len(xi) == 11 and len(set(result["bench"])) == 4
    assert counts["GKP"] == 1 and counts["DEF"] >= 3 and counts["FWD"] >= 1
    assert 2 in result["starters"] and 7 in result["starters"]
    assert result["bench"][-1] == 1


def enrich(p):
    p["performance"] = performance_profile(p)
    return p


def test_equivalent_player_is_not_a_transfer_upgrade():
    owned = [enrich(p) for p in squad()]
    decision = decision_context(owned, {"MID": [enrich(player(100))]}, 6, 0)
    assert decision["action"] == "roll"
    assert decision["transfer_options"]
    assert not any(o["eligible"] for o in decision["transfer_options"])


def test_good_buy_must_improve_optimized_xi_not_just_weakest_bench_player():
    owned = [enrich(p) for p in squad()]
    incoming = enrich(player(100, points=(3,) * 5))
    owned[11] = enrich(player(12, points=(0,) * 5, minutes=[0] * 5))
    decision = decision_context(owned, {"MID": [incoming]}, 6, 0)
    option = next(o for o in decision["transfer_options"] if o["out_id"] == 12)
    assert option["horizon_gain"] == 0 and not option["eligible"]


def test_clear_starter_upgrade_is_eligible_and_checks_club_and_budget():
    owned = [enrich(p) for p in squad()]
    good = enrich(player(100, points=(10,) * 5))
    decision = decision_context(owned, {"MID": [good]}, 6, 0)
    assert decision["action"] == "consider_transfer"
    assert decision["transfer_options"][0]["horizon_gain"] > 1.5
    good["now_cost"], good["price"] = 51, 5.1
    assert not decision_context(owned, {"MID": [good]}, 6, 0)["transfer_options"]
    assert (
        decision_context(owned, {"MID": [good]}, 6, 1)["transfer_options"][0][
            "bank_after"
        ]
        == 0
    )


def test_tiny_sample_and_recent_cameos_never_recommended():
    owned = [enrich(p) for p in squad()]
    tiny = enrich(player(100, points=(20,)))
    cameo = enrich(player(101, points=(8,) * 5, minutes=[10] * 5))
    assert not decision_context(owned, {"MID": [tiny, cameo]}, 6, 10)[
        "transfer_options"
    ]


def test_unknown_bank_never_produces_actionable_transfer():
    owned = [enrich(p) for p in squad()]
    assert (
        decision_context(owned, {"MID": [enrich(player(100))]}, 6, None)["action"]
        == "roll"
    )


def test_end_of_season_horizon_stops_at_38():
    result = decision_context([enrich(p) for p in squad()], {}, 38, 0)
    assert result["horizon"] == 1 and result["baseline"][0]["gameweek"] == 38


def test_walk_forward_does_not_leak_target_or_future_results():
    rows = [
        {**row, "player_code": p["player_code"], "position": "MID"}
        for code in range(1, 11)
        for p in [player(code, points=(code,) * 6)]
        for row in p["recent_form"]
    ]
    snapshot = deepcopy(rows)
    before = evaluate_rankings(rows)
    mutated = deepcopy(rows)
    for row in mutated:
        if row["gameweek"] == 6:
            row["total_points"] = 1000
    after = evaluate_rankings(mutated)
    assert before["weeks"][:-1] == after["weeks"][:-1]
    assert before["weeks"][-1]["model_picks"] == after["weeks"][-1]["model_picks"]
    assert before["weeks"][0]["gameweek"] == 4
    assert before["selections"] == 15
    assert rows == snapshot


@pytest.mark.parametrize(
    "weeks,new,old,selected",
    [
        (4, 6, 4, "baseline_with_minutes"),
        (6, 4.6, 4.8, "baseline_with_minutes"),
        (6, 4.9, 4.8, "baseline_with_minutes"),
        (6, 5.1, 4.8, "experimental"),
    ],
)
def test_experimental_model_requires_enough_weeks_and_measured_lift(
    weeks, new, old, selected
):
    policy = ranking_policy(
        {"weeks": [{}] * weeks, "model_return": new, "baseline_return": old}
    )
    assert policy["selected"] == selected


def test_inactive_experimental_rating_is_diagnostic_only():
    p = player(points=(2, 2, 2, 2, 17))
    result = apply_ranking_policy(p, {"selected": "baseline_with_minutes"})
    assert result["experimental_rating"] == performance_profile(p)["rating"]
    assert result["rating"] == 7
    active = apply_ranking_policy(p, {"selected": "experimental"})
    assert active["rating"] == active["experimental_rating"]


def explicit_lineup(starters, bench, formation="3-4-3"):
    return {"starters": starters, "bench": bench, "formation": formation}


def test_auto_sub_skips_high_priority_forward_when_defender_required():
    owned = squad()
    xi = explicit_lineup([1, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14], [15, 6, 7, 2], "3-5-2")
    minutes = {p["player_id"]: 90 for p in owned}
    minutes[3] = 0
    result = automatic_substitutions(owned, xi, minutes)
    assert {"out": 3, "in": 6} in result["substitutions"]
    assert 15 not in result["scoring_players"] and len(result["scoring_players"]) == 11


def test_cameo_blocks_autosub_even_if_bench_scores_more():
    owned = squad()
    xi = explicit_lineup([1, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14], [15, 6, 7, 2], "3-5-2")
    minutes = {p["player_id"]: 90 for p in owned}
    minutes[3] = 1
    result = automatic_substitutions(owned, xi, minutes)
    assert result["substitutions"] == [] and 3 in result["scoring_players"]


def test_goalkeeper_only_replaced_by_reserve_goalkeeper():
    owned = squad()
    xi = best_lineup(owned, 6)
    keeper = next(i for i in xi["starters"] if i in (1, 2))
    reserve = next(i for i in xi["bench"] if i in (1, 2))
    minutes = {p["player_id"]: 90 for p in owned}
    minutes[keeper] = 0
    result = automatic_substitutions(owned, xi, minutes)
    assert result["substitutions"] == [{"out": keeper, "in": reserve}]
    minutes[reserve] = 0
    result = automatic_substitutions(owned, xi, minutes)
    assert len(result["scoring_players"]) == 10 and not result["substitutions"]


def test_unplayed_first_sub_is_skipped_and_multiple_absences_preserve_formation():
    owned = squad()
    xi = explicit_lineup([1, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14], [15, 6, 7, 2], "3-5-2")
    minutes = {p["player_id"]: 90 for p in owned}
    minutes.update({3: 0, 13: 0, 15: 0})
    result = automatic_substitutions(owned, xi, minutes)
    assert {6, 7} <= set(result["scoring_players"])
    assert len(result["scoring_players"]) == 11
    active = [p for p in owned if p["player_id"] in result["scoring_players"]]
    assert sum(p["position"] == "DEF" for p in active) == 4


def test_double_gameweek_any_minutes_block_substitution():
    owned = squad()
    xi = best_lineup(owned, 6)
    starter = xi["starters"][1]
    minutes = {p["player_id"]: 90 for p in owned}
    minutes[starter] = 12  # first fixture DNP, second fixture cameo
    assert not automatic_substitutions(owned, xi, minutes)["substitutions"]


def test_near_equal_lineups_prefer_regular_minutes_with_bounded_score_tradeoff():
    owned = squad()
    risky = owned[7]
    risky["performance"] = {"rating": 4.6, "recent_minutes": 30, "sample_matches": 5}
    lineup = best_lineup(owned, 6)
    assert risky["player_id"] not in lineup["starters"]
    assert lineup["regular_starters"] == 11 and lineup["selection_note"]
    risky["performance"]["rating"] = 7
    assert risky["player_id"] in best_lineup(owned, 6)["starters"]


def test_bench_order_prioritizes_available_regular_cover_over_doubtful_player():
    owned = squad()
    # Reserve goalkeepers cannot displace outfield bench priority.
    owned[1]["performance"] = {"rating": 15, "recent_minutes": 90, "sample_matches": 5}
    owned[11].update(status="d", chance_of_playing_next_round=75)
    owned[11]["performance"] = {
        "rating": 4.6,
        "recent_minutes": 90,
        "sample_matches": 5,
    }
    lineup = best_lineup(owned, 6)
    assert lineup["bench"][-1] == 1
    assert lineup["bench"][-2] == 12


def test_coverage_checks_each_starter_and_all_15_players_are_preserved():
    owned = squad()
    evidence = lineup_evidence(owned, 6)
    assert len(evidence["coverage"]) == 11
    assert len(set(evidence["starters"] + evidence["bench"])) == 15
    assert set(evidence["reliable_outfield_bench"]) <= set(evidence["bench"])
    validate_lineup(owned, evidence)


def test_no_reliable_defender_cover_in_three_at_back_is_reported():
    owned = squad()
    xi = explicit_lineup([1, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14], [15, 6, 7, 2], "3-5-2")
    for p in owned:
        if p["player_id"] in (6, 7):
            p["status"] = "i"
    evidence = lineup_evidence(owned, 6, xi)
    assert {3, 4, 5} <= set(evidence["uncovered_starters"])
    assert any("no reserve" in warning for warning in evidence["warnings"])


def test_each_transfer_has_its_own_valid_full_squad_lineup():
    owned = [enrich(p) for p in squad()]
    incoming = enrich(player(100, points=(10,) * 5))
    decision = decision_context(owned, {"MID": [incoming]}, 6, 0)
    for option in decision["transfer_options"]:
        changed = [incoming if p["player_id"] == option["out_id"] else p for p in owned]
        validate_lineup(changed, option["lineup"])
        assert 100 in option["lineup"]["starters"]
        assert (
            option["out_id"]
            not in option["lineup"]["starters"] + option["lineup"]["bench"]
        )


def test_all_candidates_compared_before_results_are_shortlisted():
    owned = [enrich(p) for p in squad()]
    pool = [enrich(player(code, points=(7,) * 5)) for code in range(100, 140)]
    decision = decision_context(owned, {"MID": pool}, 6, 0)
    assert decision["compared_candidates"] == 40
    assert decision["compared_options"] == 40 * 5
    assert len(decision["transfer_options"]) < decision["compared_options"]


def test_near_equal_transfers_preserve_useful_bench_cover():
    owned = [enrich(p) for p in squad()]
    ratings = {8: 6, 9: 6, 10: 4.2, 11: 3.7, 12: 2.5, 13: 8, 14: 6, 15: 4}
    for p in owned:
        p["performance"] = {
            "rating": ratings.get(p["player_id"], 5),
            "recent_minutes": 30 if p["player_id"] == 10 else 90,
            "sample_matches": 5,
        }
    owned[14].update(status="d", chance_of_playing_next_round=75)
    incoming = enrich(player(100))
    incoming["performance"]["rating"] = 8
    result = decision_context(owned, {"MID": [incoming]}, 6, 0)
    preferred = result["transfer_options"][0]
    assert preferred["out_id"] == 10
    assert 12 in preferred["lineup"]["reliable_outfield_bench"]
    assert preferred["lineup"]["regular_starters"] == 11


@pytest.mark.parametrize(
    "change",
    [
        lambda xi: xi["bench"].__setitem__(0, xi["starters"][0]),
        lambda xi: xi.update(formation="5-4-1"),
        lambda xi: xi["bench"].reverse(),
    ],
)
def test_invalid_post_transfer_lineup_is_rejected(change):
    owned = squad()
    xi = best_lineup(owned, 6)
    change(xi)
    with pytest.raises(ValueError):
        validate_lineup(owned, xi)
