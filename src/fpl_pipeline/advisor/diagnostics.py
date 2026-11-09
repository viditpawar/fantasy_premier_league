"""Training data checks that run before fitting or activating a model."""

from collections import Counter
from math import isfinite


def audit_data(data: dict) -> dict:
    seasons, errors = {}, []
    for season, part in sorted(data.items()):
        rows = part["rows"]
        duplicates = sum(n - 1 for n in Counter((r["player_code"], r["gameweek"]) for r in rows).values())
        broken_doubles = sum(r["fixture_count"] > 1 and r.get("fixture_id") is not None for r in rows)
        invalid = sum(
            r["fixture_count"] < 0 or r["minutes"] < 0
            or r["minutes"] > 90 * r["fixture_count"]
            or not isfinite(float(r["total_points"]))
            for r in rows
        )
        if duplicates or broken_doubles or invalid:
            errors.append(
                f"{season}: {duplicates} duplicate rows, {broken_doubles} unrepaired double-gameweek rows, "
                f"{invalid} invalid points/minutes rows. Rerun the historical backfill."
            )
        seasons[season] = {
            "rows": len(rows), "players": len({r["player_code"] for r in rows}),
            "weeks": len({r["gameweek"] for r in rows}),
            "double_rows": sum(r["fixture_count"] > 1 for r in rows),
            "zero_minute_rows": sum(r["minutes"] == 0 for r in rows),
            "missing_price": sum(r.get("value") is None for r in rows),
            "missing_xg": sum(r.get("expected_goals") is None for r in rows),
            "unrepaired_double_rows": broken_doubles,
        }
    return {"passed": not errors, "errors": errors, "seasons": seasons}
