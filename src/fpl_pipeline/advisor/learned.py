"""Learned per-fixture points estimator, trained and gated on stored history.

Two gradient-boosted models share one leakage-safe feature set
(see features.py): a regressor for points per fixture and a classifier for the
chance of playing 60+ minutes. Neither sees live status or news; availability
is applied afterwards, exactly as for the rule-based ranking.

The advisor uses these predictions only when the saved artifact passed the
activation gate below. Until then, the rule-based ranking stays in charge.
scikit-learn is an optional dependency (`pip install -e .[ml]`).
"""

import hashlib
import json
import platform
import warnings
from datetime import UTC, datetime
from math import isfinite, isnan, sqrt
from pathlib import Path
from uuid import uuid4

from psycopg.rows import dict_row

from fpl_pipeline.config import MODEL_DIR

from .diagnostics import audit_data
from .evaluation import evaluate_rankings
from .features import (
    CATEGORICAL,
    FEATURES,
    TeamForm,
    combine,
    deadline,
    fixture_features,
    history_features,
    known_before,
    load_dataset,
    load_season,
    previous_summaries,
)
from .rules import POSITIONS

LEARNED_VERSION = "learned-hgb-v3"
ARTIFACT = "learned-points.joblib"
REPORT = "learned-points-report.json"
# Gate: a full held-out season must show a clear ranking lift, and the
# current season's walk-forward check must not regress.
MIN_HOLDOUT_WEEKS = 30
MIN_HOLDOUT_LIFT = 0.15
MIN_CURRENT_WEEKS = 6
MIN_CURRENT_LIFT = 0.0
MAX_STALE_GAMEWEEKS = 2
MAX_PREDICTION_AGE_HOURS = 24
# Conservative defaults. select_config compares a fixed, small candidate set
# on an earlier validation season; test/current results never select settings.
PARAMS = {
    "learning_rate": 0.05,
    "max_iter": 200,
    "max_leaf_nodes": 7,
    "min_samples_leaf": 200,
    "l2_regularization": 1.0,
    "early_stopping": False,
    "random_state": 0,
}


def _matrix(examples: list[dict]):
    import numpy as np

    return np.array([[float(e[f]) for f in FEATURES] for e in examples], dtype=float)


def fit(examples: list[dict], config: dict | None = None) -> dict:
    from sklearn.ensemble import (
        HistGradientBoostingClassifier,
        HistGradientBoostingRegressor,
    )

    if not examples:
        raise ValueError("No training examples; ingest completed gameweeks first.")
    import numpy as np

    config = config or {}
    params = {**PARAMS, **config.get("params", {})}
    X = _matrix(examples)
    # The binner rejects a column with no values (e.g. no previous season
    # stored); such a feature carries no information for this fit anyway.
    empty_features = np.flatnonzero(np.isnan(X).all(axis=0)).tolist()
    X[:, empty_features] = 0.0
    if not np.isfinite([e["target_points"] for e in examples]).all():
        raise ValueError("Training points contain a missing or non-finite value.")
    decay = config.get("season_decay", 1.0)
    newest = max(int(e["season"][:4]) for e in examples)
    weights = np.array([decay ** (newest - int(e["season"][:4])) for e in examples])
    categorical = [f in CATEGORICAL for f in FEATURES]
    points = HistGradientBoostingRegressor(categorical_features=categorical, **params)
    points.fit(X, [e["target_points"] for e in examples], sample_weight=weights)
    minute_indices = [i for i, e in enumerate(examples) if e["target_60"] is not None]
    labels = {examples[i]["target_60"] for i in minute_indices}
    minutes = None
    if len(labels) == 2:
        minutes = HistGradientBoostingClassifier(categorical_features=categorical, **params)
        minutes.fit(X[minute_indices], [examples[i]["target_60"] for i in minute_indices], sample_weight=weights[minute_indices])
    return {
        "points": points, "minutes": minutes, "features": list(FEATURES),
        "empty_features": empty_features,
        "constant_p60": next(iter(labels)) if len(labels) == 1 else None,
    }


def predict(bundle: dict, examples: list[dict]) -> list[tuple[float, float | None]]:
    if bundle["features"] != FEATURES:
        raise ValueError("Saved model features differ from this code; retrain the model.")
    if not examples:
        return []
    X = _matrix(examples)
    X[:, bundle.get("empty_features", [])] = 0.0
    points = bundle["points"].predict(X)
    p60 = bundle["minutes"].predict_proba(X)[:, 1] if bundle["minutes"] else [bundle.get("constant_p60")] * len(X)
    if any(not isfinite(float(p)) for p in points):
        raise ValueError("Model produced non-finite predictions; retrain.")
    return [(max(-1.0, float(p)), None if m is None else float(m)) for p, m in zip(points, p60)]


def _errors(examples: list[dict], predictions: list[float]) -> dict:
    if len(examples) != len(predictions):
        raise ValueError("Every evaluation example must have a prediction.")
    actual = [e["target_points"] for e in examples]
    naive = [
        e["points_5"] if not isnan(e["points_5"]) else 0.0 for e in examples
    ]
    n = len(actual) or 1
    return {
        "examples": len(actual),
        "model_mae": round(sum(abs(a - p) for a, p in zip(actual, predictions)) / n, 4),
        "naive_mae": round(sum(abs(a - p) for a, p in zip(actual, naive)) / n, 4),
        "model_rmse": round(sqrt(sum((a - p) ** 2 for a, p in zip(actual, predictions)) / n), 4),
        "naive_rmse": round(sqrt(sum((a - p) ** 2 for a, p in zip(actual, naive)) / n), 4),
        "bias": round(sum(p - a for a, p in zip(actual, predictions)) / n, 4),
        "naive": "average points per fixture over the previous five played gameweeks",
    }


def _diagnostics(examples: list[dict], predictions: list[tuple]) -> dict:
    """Separately expose the errors that matter for selectable players and minutes."""
    indices = [i for i, e in enumerate(examples) if not isnan(e["minutes_5"]) and e["minutes_5"] >= 60]
    by_position = {}
    for position in sorted({e["position"] for e in examples}):
        ids = [i for i, e in enumerate(examples) if e["position"] == position]
        by_position[list(POSITIONS.values())[int(position)]] = _errors(
            [examples[i] for i in ids], [predictions[i][0] for i in ids]
        )
    minutes = [
        (e["target_60"], p60, e["starts_5"])
        for e, (_, p60) in zip(examples, predictions)
        if e["target_60"] is not None and p60 is not None and not isnan(e["starts_5"])
    ]
    bins = []
    for low in (0.0, 0.2, 0.4, 0.6, 0.8):
        group = [(a, p) for a, p, _ in minutes if min(4, int(p * 5)) == round(low * 5)]
        if group:
            bins.append({"from": low, "examples": len(group), "predicted": round(sum(p for _, p in group) / len(group), 4),
                         "observed": round(sum(a for a, _ in group) / len(group), 4)})
    return {
        "regular_players": _errors([examples[i] for i in indices], [predictions[i][0] for i in indices]),
        "by_position": by_position,
        "minutes": {
            "examples": len(minutes),
            "brier": round(sum((a - p) ** 2 for a, p, _ in minutes) / len(minutes), 5) if minutes else None,
            "naive_brier": round(sum((a - p) ** 2 for a, _, p in minutes) / len(minutes), 5) if minutes else None,
            "calibration": bins,
            "limitation": "60+ minutes per single fixture; aggregated doubles have no reliable label and are excluded.",
        },
    }


def ranking_interval(weeks: list[dict]) -> list[float] | None:
    """Paired whole-week uncertainty, preserving correlated player outcomes."""
    if len(weeks) < 2:
        return None
    import numpy as np

    rng = np.random.default_rng(0)
    indices = rng.integers(0, len(weeks), size=(2000, len(weeks)))
    counts = np.array([w["selected"] for w in weeks])
    differences = np.array([w["model_return"] - w["baseline_return"] for w in weeks])
    boot = (differences[indices] * counts[indices]).sum(axis=1) / counts[indices].sum(axis=1)
    return [round(float(q), 3) for q in np.quantile(boot, [0.025, 0.975])]


def _ranking(rows: list[dict], predictions: dict) -> dict:
    report = evaluate_rankings(
        rows, scorer=lambda row, _profile: predictions.get((row["player_code"], row["gameweek"]))
    )
    weeks = report["weeks"]
    lift = (
        round(report["model_return"] - report["baseline_return"], 3)
        if weeks
        else None
    )
    return {
        **{k: report[k] for k in ("weeks", "selections", "model_return", "baseline_return")},
        "lift": lift, "lift_interval_95": ranking_interval(weeks),
        "uncertainty_method": "Paired bootstrap of whole gameweeks; diagnostic, not a guarantee of future improvement.",
    }


def evaluate(data: dict, holdout: str, current: str, config: dict | None = None) -> dict:
    """Held-out season plus walk-forward weeks of the current season."""
    seasons = sorted(data)
    train = [e for s in seasons if s < holdout for e in data[s]["examples"]]
    test = data[holdout]["examples"]
    bundle = fit(train, config)
    predictions = predict(bundle, test)
    preds = [p for p, _ in predictions]
    holdout_report = {
        "season": holdout,
        "trained_on": [s for s in seasons if s < holdout],
        **_errors(test, preds),
        **_diagnostics(test, predictions),
        "ranking": _ranking(
            data[holdout]["rows"],
            {(e["player_code"], e["gameweek"]): p for e, p in zip(test, preds)},
        ),
    }
    past = [e for s in seasons if s < current for e in data[s]["examples"]]
    examples = data[current]["examples"]
    walk, walk_examples, walk_preds, walk_full = {}, [], [], []
    for gameweek in sorted({e["gameweek"] for e in examples}):
        week = [e for e in examples if e["gameweek"] == gameweek]
        cutoff = week[0].get("deadline_time")
        before = [e for e in examples if e["gameweek"] < gameweek and known_before(e, cutoff)]
        full = predict(fit(past + before, config), week)
        week_preds = [p for p, _ in full]
        walk.update({(e["player_code"], gameweek): p for e, p in zip(week, week_preds)})
        walk_examples += week
        walk_preds += week_preds
        walk_full += full
    current_report = {
        "season": current,
        "method": "retrain before each gameweek on past seasons plus earlier weeks",
        **_errors(walk_examples, walk_preds),
        **_diagnostics(walk_examples, walk_full),
        "ranking": _ranking(data[current]["rows"], walk),
    }
    return {"holdout": holdout_report, "current": current_report}


def gate(report: dict) -> dict:
    """Predeclared activation rule; not a claim of statistical significance."""
    h, c = report["holdout"], report["current"]
    checks = {
        "holdout_weeks": len(h["ranking"]["weeks"]) >= MIN_HOLDOUT_WEEKS,
        "holdout_lift": (h["ranking"]["lift"] or -1) >= MIN_HOLDOUT_LIFT,
        "holdout_mae": h["model_mae"] < h["naive_mae"],
        "current_mae": c["model_mae"] <= c["naive_mae"],
        "current_weeks": len(c["ranking"]["weeks"]) >= MIN_CURRENT_WEEKS,
        "current_lift": c["ranking"]["lift"] is not None
        and c["ranking"]["lift"] >= MIN_CURRENT_LIFT,
    }
    for name, part in (("holdout", h), ("current", c)):
        checks[f"{name}_rmse"] = part["model_rmse"] <= part["naive_rmse"]
        regular = part["regular_players"]
        checks[f"{name}_regular_rmse"] = regular["examples"] > 0 and regular["model_rmse"] <= regular["naive_rmse"]
    return {
        "passed": all(checks.values()),
        "checks": checks,
        "thresholds": {
            "min_holdout_weeks": MIN_HOLDOUT_WEEKS,
            "min_holdout_lift": MIN_HOLDOUT_LIFT,
            "min_current_weeks": MIN_CURRENT_WEEKS,
            "min_current_lift": MIN_CURRENT_LIFT,
        },
    }


def select_config(data: dict, holdout: str) -> tuple[dict, dict]:
    """Tune only on a season earlier than the held-out test; never on current results."""
    earlier = sorted(s for s in data if s < holdout and data[s]["examples"])
    candidates = [
        {"name": "regularized", "params": {}, "season_decay": 1.0},
        {"name": "smoother", "params": {"max_iter": 100}, "season_decay": 1.0},
        {"name": "richer", "params": {"max_leaf_nodes": 15}, "season_decay": 1.0},
        {"name": "recent", "params": {}, "season_decay": 0.7},
    ]
    if len(earlier) < 2:
        return candidates[0], {"selected": "regularized", "reason": "Insufficient earlier seasons for separate tuning."}
    validation = earlier[-1]
    train = [e for s in earlier[:-1] for e in data[s]["examples"]]
    test = data[validation]["examples"]
    results = []
    for config in candidates:
        predictions = predict(fit(train, config), test)
        metrics = _errors(test, [p for p, _ in predictions])
        ranking = _ranking(data[validation]["rows"], {
            (e["player_code"], e["gameweek"]): p for e, (p, _) in zip(test, predictions)
        })
        results.append({"config": config, **metrics, "lift": ranking["lift"]})
    eligible = [r for r in results if r["model_rmse"] <= r["naive_rmse"] and r["lift"] is not None]
    selected = max(eligible, key=lambda r: (r["lift"], -r["model_rmse"])) if eligible else results[0]
    return selected["config"], {"validation_season": validation, "trained_on": earlier[:-1],
                               "selected": selected["config"]["name"], "candidates": results,
                               "method": "Highest validation ranking lift among models beating naive RMSE; no test/current-season tuning."}


def train(conn, model_dir: Path | str | None = None) -> dict:
    """Evaluate, then fit on every finished gameweek and save artifact + report."""
    import joblib

    data = load_dataset(conn)
    audit = audit_data(data)
    if not audit["passed"]:
        raise ValueError("Training data failed validation: " + " ".join(audit["errors"]))
    seasons = sorted(data)
    if len(seasons) < 3:
        raise ValueError("Need at least two completed seasons plus the current one; run the historical backfill.")
    current, holdout = seasons[-1], seasons[-2]
    if not data[current]["examples"] or not data[holdout]["examples"]:
        raise ValueError("The current and held-out seasons must contain completed fixtures; an older season cannot stand in for the current one.")
    config, selection = select_config(data, holdout)
    report = evaluate(data, holdout, current, config)
    report["gate"] = gate(report)
    # A validation winner is only a challenger. If it fails deployment checks,
    # the original fixed production settings may remain in service, but must
    # clear exactly the same gate on the repaired features. No additional
    # parameter search or threshold changes use test/current-season results.
    if not report["gate"]["passed"] and config["name"] != "regularized":
        incumbent_config = {"name": "regularized", "params": {}, "season_decay": 1.0}
        incumbent = evaluate(data, holdout, current, incumbent_config)
        incumbent["gate"] = gate(incumbent)
        comparison = {"challenger": {"config": config, **report},
                      "incumbent": {"config": incumbent_config, **incumbent}}
        selection["validation_winner"] = config["name"]
        if incumbent["gate"]["passed"]:
            config, report = incumbent_config, incumbent
            selection.update(selected=config["name"], deployment_reason="Validation challenger failed; retain the original settings after they passed the same gate.")
        else:
            selection["deployment_reason"] = "Both the validation challenger and original settings failed; keep the rule-based fallback."
        report["deployment_comparison"] = comparison
    report["selection"] = selection
    report["data_audit"] = audit
    bundle = fit([e for s in seasons for e in data[s]["examples"]], config)
    trained_through = max(e["gameweek"] for e in data[current]["examples"])
    meta = {
        "version": LEARNED_VERSION,
        "season": current,
        "trained_through": trained_through,
        "trained_at": datetime.now(UTC).isoformat(),
        "seasons": seasons,
        "features": FEATURES,
        "params": {**PARAMS, **config["params"]},
        "config": config,
        "python_version": platform.python_version(),
        "sklearn_version": __import__("sklearn").__version__,
        "data_fingerprint": hashlib.sha256(json.dumps(
            {s: {k: data[s][k] for k in ("rows", "fixtures")} for s in seasons},
            sort_keys=True, default=str,
        ).encode()).hexdigest(),
    }
    report = {**meta, **report}
    path = Path(model_dir or MODEL_DIR)
    path.mkdir(parents=True, exist_ok=True)
    bundle = {**bundle, "meta": meta, "report": report}
    # Readers keep the previous complete artifact until the replacement is ready.
    temporary = path / f".{ARTIFACT}.{uuid4().hex}.tmp"
    temporary_report = path / f".{REPORT}.{uuid4().hex}.tmp"
    try:
        joblib.dump(bundle, temporary)
        temporary_report.write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
        temporary.replace(path / ARTIFACT)
        temporary_report.replace(path / REPORT)
    finally:
        temporary.unlink(missing_ok=True)
        temporary_report.unlink(missing_ok=True)
    return bundle


def summary(report: dict) -> dict:
    """Compact report for prompts and CLI output (no per-week pick lists)."""
    def part(p):
        r = p["ranking"]
        return {
            "season": p["season"],
            "model_mae": p["model_mae"],
            "naive_mae": p["naive_mae"],
            "ranking_weeks": len(r["weeks"]),
            "model_return": r["model_return"],
            "baseline_return": r["baseline_return"],
            "lift": r["lift"],
            "lift_interval_95": r.get("lift_interval_95"),
            **{k: p[k] for k in ("model_rmse", "naive_rmse", "bias", "regular_players", "minutes") if k in p},
        }

    return {
        "version": report["version"],
        "season": report["season"],
        "trained_through": report["trained_through"],
        "holdout": part(report["holdout"]),
        "current": part(report["current"]),
        "gate": report["gate"],
        "selection": report.get("selection"),
        "data_fingerprint": report.get("data_fingerprint"),
    }


def load_active(
    season: str, latest_finished: int | None, model_dir: Path | str | None = None
):
    """Return (bundle or None, status). Only a fresh, gate-passing model is active."""
    path = Path(model_dir or MODEL_DIR) / ARTIFACT
    if not path.exists():
        return None, {"status": "absent", "reason": "No trained model; run --train."}
    try:
        import joblib
        from sklearn.exceptions import InconsistentVersionWarning

        with warnings.catch_warnings():
            warnings.simplefilter("error", InconsistentVersionWarning)
            bundle = joblib.load(path)
    except ImportError:
        return None, {"status": "unavailable", "reason": "Install the ml extra to load the trained model."}
    except Exception as exc:  # noqa: BLE001 - a corrupt or incompatible artifact must never break advice
        return None, {"status": "unreadable", "reason": f"Could not load the model: {exc}"}
    try:
        meta, report = bundle.get("meta", {}), bundle.get("report", {})
        status = {"status": "inactive", "summary": summary(report) if report else None}
    except (AttributeError, KeyError, TypeError):
        return None, {"status": "unreadable", "reason": "Model metadata is incomplete; retrain."}
    if bundle.get("features") != FEATURES or meta.get("version") != LEARNED_VERSION:
        status["reason"] = "Model was trained by different code; retrain."
    elif meta.get("season") != season:
        status["reason"] = "Model was trained for another season; retrain."
    elif meta.get("trained_through", 0) > (latest_finished or 0):
        status["reason"] = "Model includes gameweeks not yet finished in this warehouse; retrain."
    elif (latest_finished or 0) - meta.get("trained_through", 0) > MAX_STALE_GAMEWEEKS:
        status["reason"] = f"Model is more than {MAX_STALE_GAMEWEEKS} gameweeks old; retrain."
    elif not report.get("gate", {}).get("passed"):
        status["reason"] = "Model has not passed the evaluation gate; the rule-based ranking stays active."
    else:
        status.update(status="active", reason="Model passed the evaluation gate.")
        return bundle, status
    return None, status


def upcoming_examples(
    rows: list[dict],
    fixtures: list[dict],
    previous: dict[int, dict],
    players: list[dict],
    target: int,
    horizon: int,
) -> tuple[list[dict], list[tuple[int, int]]]:
    """Feature rows for every player's fixtures in [target, target + horizon).

    Form is fixed at the target deadline; later weeks change only the fixture.
    """
    form = TeamForm(fixtures, rows)
    cutoff = deadline(fixtures, target)
    history = {}
    for r in rows:
        if r["gameweek"] < target and known_before(r, cutoff):
            history.setdefault(r["player_code"], []).append(r)
    upcoming = [
        f
        for f in fixtures
        if f["gameweek"] is not None and target <= f["gameweek"] < target + horizon
    ]
    examples, keys = [], []
    for p in players:
        prior = sorted(history.get(p["code"], []), key=lambda r: r["gameweek"])
        value = prior[-1].get("value") if prior else None
        base = history_features(
            prior,
            POSITIONS[p["element_type"]],
            target,
            value / 10 if value is not None else None,
            previous.get(p["code"]),
            cutoff,
        )
        for gameweek in sorted({f["gameweek"] for f in upcoming}):
            week = [f for f in upcoming if f["gameweek"] == gameweek and p["team_id"] in (f["team_h"], f["team_a"])]
            if not week:
                continue
            # Match training: one example with average fixture context, then
            # multiply per-fixture points by the number of scheduled matches.
            example = combine(base, [fixture_features(f, p["team_id"], form, as_of=target) for f in week])
            example.update(gameweek=gameweek, fixture_count=len(week))
            examples.append(example)
            keys.append((p["code"], gameweek))
    return examples, keys


def load_players(conn, season: str) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "select id, code, web_name, team_id, element_type, now_cost from players"
            " where season = %s and element_type between 1 and 4",
            (season,),
        )
        return cur.fetchall()


def predict_upcoming(
    conn, bundle: dict, season: str, target: int, horizon: int
) -> dict[int, dict]:
    """Points per player code for each gameweek in [target, target + horizon).

    Doubles sum their fixtures; a blank gameweek is zero. Raw predictions,
    before availability is applied by the ranking policy.
    """
    rows, fixtures = load_season(conn, season)
    prev_season = conn.execute(
        "select max(season) from gameweeks where season < %s", (season,)
    ).fetchone()[0]
    previous = previous_summaries(load_season(conn, prev_season)[0]) if prev_season else {}
    players = load_players(conn, season)
    examples, keys = upcoming_examples(rows, fixtures, previous, players, target, horizon)
    result = {
        p["code"]: {
            "points": {gw: 0.0 for gw in range(target, target + horizon)},
            "p60_by_gameweek": {},
            "p60": None,
        }
        for p in players
    }
    for (code, gameweek), example, (points, p60) in zip(keys, examples, predict(bundle, examples)):
        result[code]["points"][gameweek] = points * example["fixture_count"]
        if p60 is not None and example["fixture_count"] == 1:
            result[code]["p60_by_gameweek"].setdefault(gameweek, p60)
    for row in result.values():
        row["p60"] = row["p60_by_gameweek"].get(target)
    return result


PUBLISH_HORIZON = 6


def next_gameweek(conn, season: str) -> int | None:
    row = conn.execute(
        "select id from gameweeks where season = %s and deadline_time > now()"
        " order by deadline_time limit 1",
        (season,),
    ).fetchone()
    return row[0] if row else None


def published_is_current(conn) -> tuple[bool, str]:
    """Whether the published run already covers the latest finished gameweek
    and the next deadline, so a scheduled retrain can be skipped."""
    season = conn.execute("select max(season) from gameweeks").fetchone()[0]
    latest = conn.execute(
        "select max(id) from gameweeks where season = %s and finished", (season,)
    ).fetchone()[0]
    target = next_gameweek(conn, season)
    run = conn.execute(
        "select model_version, trained_through, from_gameweek, generated_at from prediction_runs"
        " where season = %s",
        (season,),
    ).fetchone()
    if run is None:
        return False, "no published run"
    version, trained_through, from_gameweek, generated_at = run
    if version != LEARNED_VERSION:
        return False, f"published by {version}"
    if trained_through != latest:
        return False, f"trained through GW{trained_through}, GW{latest} has finished"
    if from_gameweek != target:
        return False, f"published from GW{from_gameweek}, next deadline is GW{target}"
    if (datetime.now(UTC) - generated_at).total_seconds() > MAX_PREDICTION_AGE_HOURS * 3600:
        return False, "predictions need their daily fixture refresh"
    return True, f"already trained through GW{latest} and published from GW{target}"


def publish(conn, bundle: dict, horizon: int = PUBLISH_HORIZON) -> dict:
    """Write upcoming predictions for the web app and advisor; gate-checked.

    A failing model clears the season's predictions so nothing stale is shown.
    """
    meta, report = bundle["meta"], bundle["report"]
    season, passed = meta["season"], report["gate"]["passed"]
    target = next_gameweek(conn, season)
    conn.execute("delete from player_predictions where season = %s", (season,))
    written = 0
    if passed and target is not None:
        horizon = min(horizon, 39 - target)
        predictions = predict_upcoming(conn, bundle, season, target, horizon)
        rows = []
        for code, row in predictions.items():
            for gw, points in row["points"].items():
                p60 = row["p60_by_gameweek"].get(gw)
                rows.append(
                    (season, gw, code, round(points, 4), None if p60 is None else round(p60, 4))
                )
        conn.cursor().executemany(
            "insert into player_predictions"
            " (season, gameweek, player_code, predicted_points, p60)"
            " values (%s, %s, %s, %s, %s)",
            rows,
        )
        written = len(rows)
    conn.execute(
        """
        insert into prediction_runs (season, model_version, trained_through,
            from_gameweek, gate_passed, summary, generated_at)
        values (%s, %s, %s, %s, %s, %s, now())
        on conflict (season) do update set
            model_version = excluded.model_version,
            trained_through = excluded.trained_through,
            from_gameweek = excluded.from_gameweek,
            gate_passed = excluded.gate_passed,
            summary = excluded.summary,
            generated_at = excluded.generated_at
        """,
        (
            season,
            meta["version"],
            meta["trained_through"],
            target,
            passed,
            json.dumps(summary(report)),
        ),
    )
    conn.commit()
    return {"from_gameweek": target, "rows": written, "gate_passed": passed}


def load_published(
    conn, season: str, target: int, horizon: int, latest_finished: int | None
) -> tuple[dict, dict]:
    """Published predictions for [target, target + horizon), if trustworthy."""
    run = conn.execute(
        "select model_version, trained_through, gate_passed, summary, from_gameweek, generated_at"
        " from prediction_runs where season = %s",
        (season,),
    ).fetchone()
    if run is None:
        return {}, {"status": "absent", "reason": "No published predictions."}
    version, trained_through, passed, report, from_gameweek, generated_at = run
    status = {"status": "inactive", "source": "published", "summary": report}
    if version != LEARNED_VERSION:
        status["reason"] = "Published predictions come from different model code; retrain."
    elif not passed:
        status["reason"] = "Model has not passed the evaluation gate; the rule-based ranking stays active."
    elif trained_through > (latest_finished or 0):
        status["reason"] = "Published model includes unfinished gameweeks; retrain."
    elif (latest_finished or 0) - trained_through > MAX_STALE_GAMEWEEKS:
        status["reason"] = f"Published model is more than {MAX_STALE_GAMEWEEKS} gameweeks old; retrain."
    elif generated_at is None or not 0 <= (datetime.now(UTC) - generated_at).total_seconds() <= MAX_PREDICTION_AGE_HOURS * 3600:
        status["reason"] = "Published predictions need their daily fixture refresh."
    elif from_gameweek is None or target < from_gameweek:
        status["reason"] = "Published predictions were generated for a later deadline."
    else:
        rows = conn.execute(
            "select player_code, gameweek, predicted_points, p60 from player_predictions"
            " where season = %s and gameweek >= %s and gameweek < %s",
            (season, target, target + horizon),
        ).fetchall()
        predictions = {}
        for code, gw, points, p60 in rows:
            if not isfinite(float(points)) or (p60 is not None and not 0 <= float(p60) <= 1):
                return {}, {**status, "reason": "Published predictions contain invalid numbers; retrain."}
            entry = predictions.setdefault(code, {"points": {}, "p60": None})
            entry["points"][gw] = float(points)
            if gw == target and p60 is not None:
                entry["p60"] = float(p60)
        if not any(target in p["points"] for p in predictions.values()):
            status["reason"] = f"No published predictions for GW{target}; retrain."
        else:
            expected = set(range(target, min(39, target + horizon)))
            if any(not expected <= set(entry["points"]) for entry in predictions.values()):
                return {}, {**status, "reason": "Published prediction coverage is incomplete; refresh predictions."}
            status.update(status="active", reason="Model passed the evaluation gate.")
            return predictions, status
    return {}, status
