"""Learned estimator: leakage safety, determinism, gate and ranking integration."""

from copy import deepcopy
from math import isnan

import pytest

from fpl_pipeline.advisor import learned
from fpl_pipeline.advisor.evaluation import evaluate_rankings
from fpl_pipeline.advisor.features import FEATURES, build_examples, previous_summaries
from fpl_pipeline.advisor.model import apply_ranking_policy, best_lineup, week_score

TEAMS = range(1, 5)
POSITIONS = ["GKP", "DEF", "MID", "FWD"]


def season_data(season="2026-27", weeks=8, players=24):
    """Round-robin fixtures between four clubs; each player always starts."""
    fixtures, fid = [], 1
    for gw in range(1, weeks + 1):
        pairs = [(1, 2), (3, 4)] if gw % 2 else [(1, 3), (2, 4)]
        for h, a in pairs:
            fixtures.append(
                {
                    "id": fid,
                    "gameweek": gw,
                    "team_h": h,
                    "team_a": a,
                    "team_h_score": (gw + h) % 3,
                    "team_a_score": (gw * a) % 2,
                    "finished": True,
                    "team_h_difficulty": 2 + h % 3,
                    "team_a_difficulty": 2 + a % 3,
                }
            )
            fid += 1
    rows = []
    for code in range(1, players + 1):
        team = TEAMS[code % 4]
        for gw in range(1, weeks + 1):
            fixture = next(
                f for f in fixtures if f["gameweek"] == gw and team in (f["team_h"], f["team_a"])
            )
            minutes = 90 if (code + gw) % 5 else 20
            rows.append(
                {
                    "season": season,
                    "player_code": code,
                    "gameweek": gw,
                    "team_id": team,
                    "fixture_id": fixture["id"],
                    "was_home": fixture["team_h"] == team,
                    "minutes": minutes,
                    "total_points": (code % 7) + (2 if minutes >= 60 else 0) + gw % 3,
                    "goals_scored": code % 2,
                    "assists": gw % 2,
                    "expected_goals": 0.1 * (code % 5),
                    "expected_assists": 0.05 * (gw % 4),
                    "bps": 10 + code % 9,
                    "ict_index": 3.0 + code % 4,
                    "value": 50 + code,
                    "fixture_count": 1,
                    "position": POSITIONS[code % 4],
                }
            )
    return rows, fixtures


def features_at(examples, code, gw):
    return next(
        {k: e[k] for k in FEATURES}
        for e in examples
        if e["player_code"] == code and e["gameweek"] == gw
    )


def same(a: dict, b: dict) -> bool:
    return all(
        (isnan(a[k]) and isnan(b[k])) if isinstance(a[k], float) and isnan(a[k]) else a[k] == b[k]
        for k in a
    )


def test_features_never_see_the_target_week_or_later():
    rows, fixtures = season_data()
    before = build_examples(rows, fixtures)
    changed_rows, changed_fixtures = deepcopy(rows), deepcopy(fixtures)
    for r in changed_rows:
        if r["gameweek"] >= 5:
            r.update(minutes=0, total_points=99, bps=0, expected_goals=9.0, goals_scored=9)
    for f in changed_fixtures:
        if f["gameweek"] >= 5:
            f.update(team_h_score=9, team_a_score=9)
    after = build_examples(changed_rows, changed_fixtures)
    for code in (1, 6, 11):
        assert same(features_at(before, code, 5), features_at(after, code, 5))
    target = next(e for e in after if e["player_code"] == 1 and e["gameweek"] == 5)
    assert target["target_points"] == 99


def test_first_week_has_no_form_and_uses_previous_season_prior():
    rows, fixtures = season_data()
    prior = previous_summaries(rows)
    first = features_at(build_examples(rows, fixtures, prior), 3, 1)
    assert isnan(first["points_5"]) and first["prior_fixtures"] == 0
    assert first["prev_points_per_fixture"] == pytest.approx(prior[3]["points_per_fixture"])
    assert isnan(features_at(build_examples(rows, fixtures), 3, 1)["prev_points_per_fixture"])


def test_double_gameweek_label_is_per_fixture_and_blank_is_skipped():
    rows, fixtures = season_data(players=4)
    fixtures.append({**fixtures[0], "id": 999})  # GW1 double for clubs 1 and 2
    for r in rows:
        if r["gameweek"] == 1 and r["team_id"] in (1, 2):
            r.update(fixture_count=2, total_points=12, minutes=180, fixture_id=None, was_home=None)
        if r["gameweek"] == 3:
            r["fixture_count"] = 0
    examples = build_examples(rows, fixtures)
    double = next(e for e in examples if e["gameweek"] == 1 and e["player_code"] == 1)
    assert double["target_points"] == 6
    assert not any(e["gameweek"] == 3 for e in examples)


def test_fit_is_deterministic():
    pytest.importorskip("sklearn")
    rows, fixtures = season_data(weeks=10, players=60)
    examples = build_examples(rows, fixtures)
    a = learned.predict(learned.fit(examples), examples[:20])
    b = learned.predict(learned.fit(examples), examples[:20])
    assert a == b


def report(holdout_lift=0.3, holdout_weeks=34, current_lift=0.1, current_weeks=7, mae=(2.0, 2.2)):
    def part(lift, weeks):
        return {
            "season": "x",
            "model_mae": mae[0],
            "naive_mae": mae[1],
            "ranking": {"weeks": [{}] * weeks, "lift": lift, "model_return": 4, "baseline_return": 4 - lift},
        }

    return {"holdout": part(holdout_lift, holdout_weeks), "current": part(current_lift, current_weeks)}


@pytest.mark.parametrize(
    ("kwargs", "passed"),
    [
        ({}, True),
        ({"holdout_lift": 0.1}, False),
        ({"holdout_weeks": 20}, False),
        ({"current_lift": -0.05}, False),
        ({"current_weeks": 5}, False),
        ({"mae": (2.3, 2.2)}, False),
    ],
)
def test_gate_requires_holdout_lift_and_no_current_regression(kwargs, passed):
    assert learned.gate(report(**kwargs))["passed"] is passed


def test_stale_or_failing_artifacts_stay_inactive(tmp_path):
    joblib = pytest.importorskip("joblib")
    meta = {"version": learned.LEARNED_VERSION, "season": "2026-27", "trained_through": 9}
    full = {**report(), **meta, "gate": {"passed": True}}
    bundle = {"features": FEATURES, "meta": meta, "report": full}
    joblib.dump(bundle, tmp_path / learned.ARTIFACT)
    assert learned.load_active("2026-27", 10, tmp_path)[1]["status"] == "active"
    assert learned.load_active("2026-27", 12, tmp_path)[1]["status"] == "inactive"
    assert learned.load_active("2027-28", 1, tmp_path)[1]["status"] == "inactive"
    joblib.dump({**bundle, "report": {**full, "gate": {"passed": False}}}, tmp_path / learned.ARTIFACT)
    assert learned.load_active("2026-27", 10, tmp_path)[0] is None
    assert learned.load_active("2026-27", 10, tmp_path / "missing")[1]["status"] == "absent"


def player(code, position, status="a", chance=None):
    return {
        "player_id": code,
        "player_code": code,
        "player": f"P{code}",
        "position": position,
        "status": status,
        "chance_of_playing_next_round": chance,
        "team_id": code,
        "recent_form": [
            {"gameweek": gw, "total_points": 4, "minutes": 90, "fixture_count": 1}
            for gw in range(1, 6)
        ],
        "upcoming_fixtures": [{"gameweek": 6, "difficulty": 3}],
    }


LEARNED = {"selected": "learned"}


def test_learned_points_drive_week_score_with_availability():
    double = {"points": {6: 9.0, 7: 0.0}, "p60": 0.9}
    p = player(1, "MID")
    p["performance"] = apply_ranking_policy(p, LEARNED, double)
    assert week_score(p, 6) == 9.0 and week_score(p, 7) == 0.0
    assert p["performance"]["p60"] == 0.9
    doubtful = player(2, "MID", status="d", chance=50)
    doubtful["performance"] = apply_ranking_policy(doubtful, LEARNED, double)
    assert week_score(doubtful, 6) == 4.5
    injured = player(3, "MID", status="i", chance=0)
    injured["performance"] = apply_ranking_policy(injured, LEARNED, double)
    assert week_score(injured, 6) == 0


def test_baseline_policy_ignores_predictions():
    p = player(1, "MID")
    p["performance"] = apply_ranking_policy(
        p, {"selected": "baseline_with_minutes"}, {"points": {6: 50.0}, "p60": 1}
    )
    assert "predicted_points" not in p["performance"]
    assert week_score(p, 6) < 10


def test_lineup_follows_learned_predictions():
    squad = [
        player(i, pos)
        for i, pos in enumerate(["GKP"] * 2 + ["DEF"] * 5 + ["MID"] * 5 + ["FWD"] * 3, 1)
    ]
    for p in squad:
        points = 1.0 + p["player_id"] / 10
        if p["player_id"] == 4:  # a defender the model expects to blank out
            points = 0.1
        p["performance"] = apply_ranking_policy(p, LEARNED, {"points": {6: points}, "p60": 0.9})
    lineup = best_lineup(squad, 6)
    assert 4 not in lineup["starters"]


def test_ranking_scorer_replaces_new_rating_on_the_same_pool():
    rows = [
        {
            "player_code": code,
            "gameweek": gw,
            "position": "MID",
            "total_points": code if gw == 5 else 3,
            "minutes": 90,
            "fixture_count": 1,
        }
        for code in range(1, 13)
        for gw in range(1, 6)
    ]
    oracle = evaluate_rankings(rows, scorer=lambda row, _p: row["total_points"] if row["gameweek"] == 5 else 0)
    week5 = next(w for w in oracle["weeks"] if w["gameweek"] == 5)
    assert sorted(week5["model_picks"]) == [8, 9, 10, 11, 12]
    skipped = evaluate_rankings(rows, scorer=lambda row, _p: None)
    assert skipped["weeks"] == []
