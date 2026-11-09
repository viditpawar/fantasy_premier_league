"""Regressions for deadline safety and honest training/evaluation."""

from copy import deepcopy
from datetime import UTC, datetime, timedelta

import pytest
from test_learned import features_at, report, same, season_data

from fpl_pipeline.advisor import learned
from fpl_pipeline.advisor.diagnostics import audit_data
from fpl_pipeline.advisor.features import FEATURES, build_examples, prepare


def test_target_price_and_revised_difficulty_do_not_leak_into_features():
    rows, fixtures = season_data()
    before = build_examples(rows, fixtures)
    modified = deepcopy(rows)
    ratings = deepcopy(fixtures)
    for row in modified:
        if row["gameweek"] >= 5:
            row["value"] = 200
    for fixture in ratings:
        fixture.update(team_h_difficulty=5, team_a_difficulty=5)
    after = build_examples(modified, ratings)
    assert same(features_at(before, 1, 5), features_at(after, 1, 5))


def test_overlapping_gameweeks_exclude_results_unavailable_at_deadline():
    rows, fixtures = season_data(weeks=5)
    start = datetime(2026, 8, 1, 15, tzinfo=UTC)
    for fixture in fixtures:
        fixture["kickoff_time"] = start + timedelta(days=7 * fixture["gameweek"])
    cutoff = start + timedelta(days=35, minutes=-90)
    for row in rows:
        row["available_at"] = start + timedelta(days=7 * row["gameweek"], hours=3)
        if row["gameweek"] == 4:
            row["available_at"] = cutoff + timedelta(hours=1)
    for fixture in fixtures:
        if fixture["gameweek"] == 4:
            fixture["kickoff_time"] = cutoff
    before = build_examples(rows, fixtures)
    modified = deepcopy(rows)
    for row in modified:
        if row["gameweek"] == 4:
            row.update(total_points=999, minutes=0, value=200, expected_goals=99)
    after = build_examples(modified, fixtures)
    assert same(features_at(before, 1, 5), features_at(after, 1, 5))
    assert features_at(before, 1, 5)["prior_fixtures"] == 3


def test_double_prediction_uses_the_same_average_context_as_training():
    rows, fixtures = season_data(weeks=5)
    fixtures.append({**fixtures[-1], "id": 999, "team_h": 2, "team_a": 3})
    for row in rows:
        if row["gameweek"] == 5 and row["team_id"] in (2, 3):
            row.update(fixture_count=2, fixture_id=None, was_home=None)
    training = features_at(build_examples(rows, fixtures), 1, 5)
    players = [{"code": 1, "team_id": 2, "element_type": 2, "now_cost": 99}]
    examples, keys = learned.upcoming_examples(rows, fixtures, {}, players, 5, 1)
    assert keys == [(1, 5)] and examples[0]["fixture_count"] == 2
    assert same(training, {k: examples[0][k] for k in FEATURES})
    target = next(e for e in build_examples(rows, fixtures) if e["player_code"] == 1 and e["gameweek"] == 5)
    assert target["target_60"] is None


def test_data_audit_rejects_the_old_overwritten_double_records():
    rows, fixtures = season_data()
    rows[0]["fixture_count"] = 2
    audit = audit_data({"2026-27": {"rows": rows, "fixtures": fixtures}})
    assert not audit["passed"] and "unrepaired" in audit["errors"][0]


def test_gate_cannot_hide_current_errors_or_regular_player_regression():
    for field in ("model_mae", "model_rmse", "regular_players"):
        metrics = report()
        if field == "regular_players":
            metrics["current"][field]["model_rmse"] = 10
        else:
            metrics["current"][field] = 10
        assert not learned.gate(metrics)["passed"]


def test_walk_forward_tests_first_week_and_only_fits_prior_rows(monkeypatch):
    raw = {season: dict(zip(("rows", "fixtures"), season_data(season, weeks=4)))
           for season in ("2024-25", "2025-26", "2026-27")}
    data = prepare(raw)
    fitted = []

    def fit(examples, config=None):
        fitted.append([(e["season"], e["gameweek"]) for e in examples])
        return {}

    monkeypatch.setattr(learned, "fit", fit)
    monkeypatch.setattr(learned, "predict", lambda bundle, examples: [(1.0, 0.5) for _ in examples])
    result = learned.evaluate(data, "2025-26", "2026-27")
    assert result["current"]["examples"] == len(data["2026-27"]["examples"])
    assert all(season < "2025-26" for season, _ in fitted[0])
    for gw, rows in enumerate(fitted[1:], 1):
        assert all(season < "2026-27" or week < gw for season, week in rows)


def test_tuning_never_reads_holdout_or_current_targets(monkeypatch):
    raw = {season: dict(zip(("rows", "fixtures"), season_data(season, weeks=4)))
           for season in ("2023-24", "2024-25", "2025-26", "2026-27")}
    data = prepare(raw)
    calls = []

    def fit(examples, config=None):
        assert all(e["season"] < "2024-25" for e in examples)
        calls.append(config["name"])
        return {}

    def predict(bundle, examples):
        assert {e["season"] for e in examples} == {"2024-25"}
        return [(1.0, 0.5) for _ in examples]

    monkeypatch.setattr(learned, "fit", fit)
    monkeypatch.setattr(learned, "predict", predict)
    _, selection = learned.select_config(data, "2025-26")
    assert len(calls) == 4 and selection["validation_season"] == "2024-25"


def test_empty_current_season_cannot_be_silently_replaced_by_last_season(monkeypatch, tmp_path):
    pytest.importorskip("joblib")
    raw = {season: dict(zip(("rows", "fixtures"), season_data(season)))
           for season in ("2024-25", "2025-26")}
    raw["2026-27"] = {"rows": [], "fixtures": []}
    monkeypatch.setattr(learned, "load_dataset", lambda conn: prepare(raw))
    with pytest.raises(ValueError, match="current and held-out"):
        learned.train(None, tmp_path)


def test_training_saves_a_reproducible_report_and_a_reloadable_model(monkeypatch, tmp_path):
    joblib = pytest.importorskip("joblib")
    pytest.importorskip("sklearn")
    raw = {season: dict(zip(("rows", "fixtures"), season_data(season, weeks=4)))
           for season in ("2024-25", "2025-26", "2026-27")}
    monkeypatch.setattr(learned, "load_dataset", lambda conn: prepare(raw))
    monkeypatch.setitem(learned.PARAMS, "max_iter", 5)
    bundle = learned.train(None, tmp_path)
    saved = joblib.load(tmp_path / learned.ARTIFACT)
    assert saved["meta"] == bundle["meta"]
    assert len(saved["meta"]["data_fingerprint"]) == 64
    assert saved["report"]["data_audit"]["passed"]
    assert saved["report"]["current"]["examples"] == len(raw["2026-27"]["examples"])
    assert not list(tmp_path.glob("*.tmp"))
    example = raw["2026-27"]["examples"][-1:]
    assert learned.predict(bundle, example) == learned.predict(saved, example)


@pytest.mark.parametrize("incumbent_passes", [True, False])
def test_failed_challenger_can_only_fall_back_to_a_gated_incumbent(monkeypatch, tmp_path, incumbent_passes):
    pytest.importorskip("joblib")
    raw = {season: dict(zip(("rows", "fixtures"), season_data(season, weeks=4)))
           for season in ("2024-25", "2025-26", "2026-27")}
    monkeypatch.setattr(learned, "load_dataset", lambda conn: prepare(raw))
    challenger = {"name": "smoother", "params": {"max_iter": 100}, "season_decay": 1.0}
    monkeypatch.setattr(learned, "select_config", lambda data, holdout: (challenger, {"selected": "smoother"}))
    calls = []

    def evaluate(data, holdout, current, config):
        calls.append(config["name"])
        return report(current_lift=0.1 if config["name"] == "regularized" and incumbent_passes else -0.1)

    monkeypatch.setattr(learned, "evaluate", evaluate)
    monkeypatch.setattr(learned, "fit", lambda examples, config: {"features": FEATURES})
    bundle = learned.train(None, tmp_path)
    assert calls == ["smoother", "regularized"]
    assert bundle["report"]["gate"]["passed"] is incumbent_passes
    assert bundle["meta"]["config"]["name"] == ("regularized" if incumbent_passes else "smoother")
