"""Walk-forward ranking checks using completed gameweeks, without live flags.

This measures ranking quality, not points calibration or transfer profitability.
Current prices, availability and news must never enter a historical ranking.
"""

from collections import defaultdict
from copy import deepcopy

from psycopg.rows import dict_row

from .model import MODEL_VERSION, performance_profile
from .rules import POSITIONS, form_score


def ranking_policy(report: dict) -> dict:
    """Predeclared activation gate, not a claim of statistical significance."""
    weeks = report.get("weeks", [])
    model, baseline = report.get("model_return"), report.get("baseline_return")
    enough = len(weeks) >= 6
    better = model is not None and baseline is not None and model >= baseline + 0.15
    active = enough and better
    return {
        "selected": "experimental" if active else "baseline_with_minutes",
        "evaluation_weeks": len(weeks),
        "model_return": model,
        "baseline_return": baseline,
        "minimum_weeks": 6,
        "minimum_lift": 0.15,
        "reason": "Experimental ranking cleared the historical gate; keep monitoring future results."
        if active
        else "Experimental ranking has not cleared the historical gate. Retain observed form with minutes and availability safeguards.",
        "limitation": "Same-season ranking diagnostic; no claim of calibrated expected points or profitable transfers.",
    }


def evaluate_rankings(rows: list[dict], top_n: int = 5) -> dict:
    """Score each next GW using strictly earlier rows; same pool for both models."""
    history = defaultdict(list)
    by_week = defaultdict(list)
    for row in rows:
        by_week[row["gameweek"]].append(row)
    weeks = []
    for gw, actuals in sorted(by_week.items()):
        groups = defaultdict(list)
        for actual in actuals:
            past = sorted(
                history[actual["player_code"]],
                key=lambda r: r["gameweek"],
                reverse=True,
            )
            recent = [r for r in past if r["gameweek"] >= gw - 8]
            player = {
                "position": actual["position"],
                "status": "a",
                "chance_of_playing_next_round": None,
                "recent_form": recent,
            }
            profile = performance_profile(player)
            if profile["sample_matches"] < 3 or (profile["recent_minutes"] or 0) < 60:
                continue
            if actual.get("fixture_count", 1) < 1:
                continue
            old = form_score([r for r in past if r["gameweek"] >= gw - 5])
            groups[actual["position"]].append(
                {
                    "code": actual["player_code"],
                    "new": profile["rating"],
                    "old": old,
                    "actual": actual["total_points"] / actual.get("fixture_count", 1),
                }
            )
        new, old, count = 0.0, 0.0, 0
        picks = {"new": [], "old": []}
        for pool in groups.values():
            if len(pool) < top_n * 2:
                continue
            for model in ("new", "old"):
                selected = sorted(pool, key=lambda item: (-item[model], item["code"]))[
                    :top_n
                ]
                picks[model].extend(item["code"] for item in selected)
                total = sum(item["actual"] for item in selected)
                if model == "new":
                    new += total
                else:
                    old += total
            count += top_n
        if count:
            weeks.append(
                {
                    "gameweek": gw,
                    "selected": count,
                    "model_return": round(new / count, 3),
                    "baseline_return": round(old / count, 3),
                    "model_picks": picks["new"],
                    "baseline_picks": picks["old"],
                }
            )
        # Append only after evaluating every player in this gameweek.
        for actual in actuals:
            history[actual["player_code"]].append(deepcopy(actual))
    count = sum(w["selected"] for w in weeks)
    return {
        "model_version": MODEL_VERSION,
        "weeks": weeks,
        "selections": count,
        "model_return": round(
            sum(w["model_return"] * w["selected"] for w in weeks) / count, 3
        )
        if count
        else None,
        "baseline_return": round(
            sum(w["baseline_return"] * w["selected"] for w in weeks) / count, 3
        )
        if count
        else None,
        "method": "Walk-forward top-five within position, same eligible pool, actual points per fixture; no current price, news or status. Ranking diagnostic, not a transfer or xP backtest.",
    }


def evaluate_warehouse(conn) -> dict:
    season = conn.execute("select max(season) from gameweeks").fetchone()[0]
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select s.player_code, s.gameweek, s.total_points, s.minutes,
                s.goals_scored, s.assists, s.expected_goals, s.expected_assists,
                coalesce(s.fixture_count, (select count(*) from fixtures f
                    where f.season = s.season and f.gameweek = s.gameweek
                    and s.team_id in (f.team_h, f.team_a))) as fixture_count,
                p.element_type
            from player_gameweek_stats s
            join gameweeks g on g.season = s.season and g.id = s.gameweek
            join players p on p.season = s.season and p.code = s.player_code
            where s.season = %s and g.finished = true
            order by s.gameweek, s.player_code
        """,
            (season,),
        )
        rows = cur.fetchall()
    for row in rows:
        row["position"] = POSITIONS[row.pop("element_type")]
    return {"season": season, **evaluate_rankings(rows)}
