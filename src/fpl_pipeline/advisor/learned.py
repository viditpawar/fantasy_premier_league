"""Learned per-fixture points estimator, trained and gated on stored history.

Two gradient-boosted models share one leakage-safe feature set
(see features.py): a regressor for points per fixture and a classifier for the
chance of playing 60+ minutes. Neither sees live status or news; availability
is applied afterwards, exactly as for the rule-based ranking.

The advisor uses these predictions only when the saved artifact passed the
activation gate below. Until then, the rule-based ranking stays in charge.
scikit-learn is an optional dependency (`pip install -e .[ml]`).
"""

import json
from datetime import UTC, datetime
from math import isnan
from pathlib import Path

from psycopg.rows import dict_row

from fpl_pipeline.config import MODEL_DIR

from .evaluation import evaluate_rankings
from .features import (
    CATEGORICAL,
    FEATURES,
    TeamForm,
    fixture_features,
    history_features,
    load_dataset,
    load_season,
    previous_summaries,
)
from .rules import POSITIONS

LEARNED_VERSION = "learned-hgb-v1"
ARTIFACT = "learned-points.joblib"
REPORT = "learned-points-report.json"
# Gate: a full held-out season must show a clear ranking lift, and the
# current season's walk-forward check must not regress.
MIN_HOLDOUT_WEEKS = 30
MIN_HOLDOUT_LIFT = 0.15
MIN_CURRENT_WEEKS = 6
MIN_CURRENT_LIFT = 0.0
MAX_STALE_GAMEWEEKS = 2
PARAMS = {
    "learning_rate": 0.05,
    "max_iter": 300,
    "max_leaf_nodes": 31,
    "min_samples_leaf": 100,
    "l2_regularization": 1.0,
    "early_stopping": False,
    "random_state": 0,
}


def _matrix(examples: list[dict]):
    import numpy as np

    return np.array([[float(e[f]) for f in FEATURES] for e in examples], dtype=float)


def fit(examples: list[dict]) -> dict:
    from sklearn.ensemble import (
        HistGradientBoostingClassifier,
        HistGradientBoostingRegressor,
    )

    if not examples:
        raise ValueError("No training examples; ingest completed gameweeks first.")
    import numpy as np

    X = _matrix(examples)
    # The binner rejects a column with no values (e.g. no previous season
    # stored); such a feature carries no information for this fit anyway.
    X[:, np.isnan(X).all(axis=0)] = 0.0
    categorical = [f in CATEGORICAL for f in FEATURES]
    points = HistGradientBoostingRegressor(categorical_features=categorical, **PARAMS)
    points.fit(X, [e["target_points"] for e in examples])
    labels = {e["target_60"] for e in examples}
    minutes = None
    if len(labels) == 2:
        minutes = HistGradientBoostingClassifier(categorical_features=categorical, **PARAMS)
        minutes.fit(X, [e["target_60"] for e in examples])
    return {"points": points, "minutes": minutes, "features": list(FEATURES)}


def predict(bundle: dict, examples: list[dict]) -> list[tuple[float, float | None]]:
    if bundle["features"] != FEATURES:
        raise ValueError("Saved model features differ from this code; retrain the model.")
    if not examples:
        return []
    X = _matrix(examples)
    points = bundle["points"].predict(X)
    p60 = bundle["minutes"].predict_proba(X)[:, 1] if bundle["minutes"] else [None] * len(X)
    return [(max(-1.0, float(p)), None if m is None else float(m)) for p, m in zip(points, p60)]


def _errors(examples: list[dict], predictions: list[float]) -> dict:
    actual = [e["target_points"] for e in examples]
    naive = [
        e["points_5"] if not isnan(e["points_5"]) else 0.0 for e in examples
    ]
    n = len(actual) or 1
    return {
        "examples": len(actual),
        "model_mae": round(sum(abs(a - p) for a, p in zip(actual, predictions)) / n, 4),
        "naive_mae": round(sum(abs(a - p) for a, p in zip(actual, naive)) / n, 4),
        "naive": "average points per fixture over the previous five played gameweeks",
    }


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
    return {**{k: report[k] for k in ("weeks", "selections", "model_return", "baseline_return")}, "lift": lift}


def evaluate(data: dict, holdout: str, current: str) -> dict:
    """Held-out season plus walk-forward weeks of the current season."""
    seasons = sorted(data)
    train = [e for s in seasons if s < holdout for e in data[s]["examples"]]
    test = data[holdout]["examples"]
    bundle = fit(train)
    preds = [p for p, _ in predict(bundle, test)]
    holdout_report = {
        "season": holdout,
        "trained_on": [s for s in seasons if s < holdout],
        **_errors(test, preds),
        "ranking": _ranking(
            data[holdout]["rows"],
            {(e["player_code"], e["gameweek"]): p for e, p in zip(test, preds)},
        ),
    }
    past = [e for s in seasons if s < current for e in data[s]["examples"]]
    examples = data[current]["examples"]
    walk, walk_examples, walk_preds = {}, [], []
    for gameweek in sorted({e["gameweek"] for e in examples}):
        before = [e for e in examples if e["gameweek"] < gameweek]
        if not before:
            continue
        week = [e for e in examples if e["gameweek"] == gameweek]
        week_preds = [p for p, _ in predict(fit(past + before), week)]
        walk.update({(e["player_code"], gameweek): p for e, p in zip(week, week_preds)})
        walk_examples += week
        walk_preds += week_preds
    current_report = {
        "season": current,
        "method": "retrain before each gameweek on past seasons plus earlier weeks",
        **_errors(walk_examples, walk_preds),
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
        "current_weeks": len(c["ranking"]["weeks"]) >= MIN_CURRENT_WEEKS,
        "current_lift": c["ranking"]["lift"] is not None
        and c["ranking"]["lift"] >= MIN_CURRENT_LIFT,
    }
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


def train(conn, model_dir: Path | str = MODEL_DIR) -> dict:
    """Evaluate, then fit on every finished gameweek and save artifact + report."""
    import joblib

    data = load_dataset(conn)
    seasons = sorted(s for s in data if data[s]["examples"])
    if len(seasons) < 3:
        raise ValueError("Need at least two completed seasons plus the current one; run the historical backfill.")
    current, holdout = seasons[-1], seasons[-2]
    report = evaluate(data, holdout, current)
    report["gate"] = gate(report)
    bundle = fit([e for s in seasons for e in data[s]["examples"]])
    trained_through = max(e["gameweek"] for e in data[current]["examples"])
    meta = {
        "version": LEARNED_VERSION,
        "season": current,
        "trained_through": trained_through,
        "trained_at": datetime.now(UTC).isoformat(),
        "seasons": seasons,
        "features": FEATURES,
        "params": PARAMS,
    }
    report = {**meta, **report}
    path = Path(model_dir)
    path.mkdir(parents=True, exist_ok=True)
    joblib.dump({**bundle, "meta": meta, "report": report}, path / ARTIFACT)
    (path / REPORT).write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


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
        }

    return {
        "version": report["version"],
        "season": report["season"],
        "trained_through": report["trained_through"],
        "holdout": part(report["holdout"]),
        "current": part(report["current"]),
        "gate": report["gate"],
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

        bundle = joblib.load(path)
    except ImportError:
        return None, {"status": "unavailable", "reason": "Install the ml extra to load the trained model."}
    except Exception as exc:  # noqa: BLE001 - a corrupt or incompatible artifact must never break advice
        return None, {"status": "unreadable", "reason": f"Could not load the model: {exc}"}
    meta, report = bundle.get("meta", {}), bundle.get("report", {})
    status = {"status": "inactive", "summary": summary(report) if report else None}
    if bundle.get("features") != FEATURES or meta.get("version") != LEARNED_VERSION:
        status["reason"] = "Model was trained by different code; retrain."
    elif meta.get("season") != season:
        status["reason"] = "Model was trained for another season; retrain."
    elif (latest_finished or 0) - meta.get("trained_through", 0) > MAX_STALE_GAMEWEEKS:
        status["reason"] = f"Model is more than {MAX_STALE_GAMEWEEKS} gameweeks old; retrain."
    elif not report.get("gate", {}).get("passed"):
        status["reason"] = "Model has not passed the evaluation gate; the rule-based ranking stays active."
    else:
        status.update(status="active", reason="Model passed the evaluation gate.")
        return bundle, status
    return None, status


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
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "select code, team_id, element_type, now_cost from players"
            " where season = %s and element_type between 1 and 4",
            (season,),
        )
        players = cur.fetchall()
    form = TeamForm(fixtures)
    history = {}
    for r in rows:
        history.setdefault(r["player_code"], []).append(r)
    upcoming = [
        f
        for f in fixtures
        if f["gameweek"] is not None and target <= f["gameweek"] < target + horizon
    ]
    examples, keys = [], []
    for p in players:
        base = history_features(
            sorted(history.get(p["code"], []), key=lambda r: r["gameweek"]),
            POSITIONS[p["element_type"]],
            target,
            p["now_cost"] / 10,
            previous.get(p["code"]),
        )
        for f in upcoming:
            if p["team_id"] in (f["team_h"], f["team_a"]):
                # Later weeks reuse current form; only the fixture changes.
                examples.append({**base, "gameweek": f["gameweek"], **fixture_features(
                    {**f, "gameweek": target}, p["team_id"], form
                )})
                keys.append((p["code"], f["gameweek"]))
    result = {
        p["code"]: {
            "points": {gw: 0.0 for gw in range(target, target + horizon)},
            "p60": None,
        }
        for p in players
    }
    for (code, gameweek), (points, p60) in zip(keys, predict(bundle, examples)):
        result[code]["points"][gameweek] += points
        if gameweek == target and p60 is not None:
            result[code]["p60"] = p60
    return result
