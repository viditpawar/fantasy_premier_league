"""Event aggregates must preserve doubles and distinguish absent xG from zero."""

from unittest.mock import MagicMock

import pandas as pd
import pytest

from fpl_pipeline.ingest.historical import (
    ADDITIVE_STATS,
    aggregate_gameweeks,
    ingest_player_gameweek_stats_historical,
)
from fpl_pipeline.ingest.live import ingest_player_gameweek_stats


def archive_row(fixture, points, **changes):
    row = {name: 0 for name in ADDITIVE_STATS}
    row.update(
        element=1,
        GW=8,
        fixture=fixture,
        total_points=points,
        minutes=90,
        opponent_team=2,
        was_home=True,
        value=50,
        selected=100,
        transfers_in=10,
        transfers_out=2,
        expected_goals="0.25",
        expected_assists="0.15",
    )
    return {**row, **changes}


def test_historical_double_sums_both_matches_and_preserves_latest_snapshot():
    rows = aggregate_gameweeks(
        pd.DataFrame(
            [
                archive_row(1, 6),
                archive_row(2, 9, value=51),
            ]
        )
    )
    assert len(rows) == 1
    assert rows[0].total_points == 15 and rows[0].minutes == 180
    assert rows[0].fixture_count == 2 and rows[0].value == 51
    assert rows[0].expected_goals == pytest.approx(0.5)
    assert rows[0].fixture is None and rows[0].opponent_team is None


def test_duplicate_archive_match_is_not_counted_twice():
    row = archive_row(1, 6)
    result = aggregate_gameweeks(pd.DataFrame([row, row]))[0]
    assert result.total_points == 6 and result.fixture_count == 1


def test_archive_without_xg_keeps_it_unknown():
    frame = pd.DataFrame([archive_row(1, 6)]).drop(
        columns=["expected_goals", "expected_assists"]
    )
    result = aggregate_gameweeks(frame)[0]
    assert result.expected_goals is None and result.expected_assists is None


def test_historical_ingest_upserts_one_row_per_double():
    conn = MagicMock()
    ingest_player_gameweek_stats_historical(
        conn,
        "2026-27",
        pd.DataFrame(
            [
                archive_row(1, 6),
                archive_row(2, 9),
            ]
        ),
        pd.DataFrame([{"id": 1, "code": 100, "team": 1}]),
    )
    sql, rows = conn.cursor.return_value.executemany.call_args.args
    assert len(rows) == 1 and rows[0][8] == 180 and rows[0][25] == 15
    assert len(rows[0]) == sql.split("ON CONFLICT")[0].count("%s")
    assert rows[0][-1] == 2


@pytest.mark.parametrize("has_xg", [False, True])
def test_live_ingest_preserves_double_totals_and_optional_xg(has_xg):
    conn, client = MagicMock(), MagicMock()
    bootstrap = {
        "elements": [
            {
                "id": 1,
                "code": 100,
                "team": 1,
                "selected_by_percent": "20",
                "now_cost": 50,
            }
        ],
        "events": [{"id": 8, "finished": True, "is_current": False}],
    }
    fixtures = [
        {"id": fixture, "event": 8, "team_h": 1, "team_a": 2} for fixture in (1, 2)
    ]
    stats = {name: 0 for name in ADDITIVE_STATS if not name.startswith("expected_")}
    stats.update(minutes=180, total_points=15)
    if has_xg:
        stats.update(expected_goals="0.5", expected_assists="0.3")
    client.event_live.return_value = {
        "elements": [
            {"id": 1, "stats": stats, "explain": [{"fixture": 1}, {"fixture": 2}]}
        ]
    }
    ingest_player_gameweek_stats(conn, "2026-27", client, bootstrap, fixtures)
    sql, rows = conn.cursor.return_value.executemany.call_args.args
    assert len(rows) == 1 and rows[0][8] == 180 and rows[0][25] == 15
    assert len(rows[0]) == sql.split("ON CONFLICT")[0].count("%s")
    assert rows[0][4] is None and rows[0][-1] == 2
    assert rows[0][-3] == ("0.5" if has_xg else None)
