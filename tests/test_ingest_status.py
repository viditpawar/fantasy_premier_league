"""A successful refresh marker must share the data transaction."""

from unittest.mock import MagicMock

import pytest

from fpl_pipeline.ingest import live


@pytest.fixture
def ingest(monkeypatch):
    conn = MagicMock()
    monkeypatch.setattr(live, "get_connection", lambda: conn)
    monkeypatch.setattr(live, "FPLClient", MagicMock())
    monkeypatch.setattr(live, "FPL_TEAM_ID", None)
    monkeypatch.setattr(live, "FPL_EMAIL", None)
    for name in (
        "ingest_teams",
        "ingest_players",
        "ingest_gameweeks",
        "ingest_fixtures",
        "ingest_player_gameweek_stats",
    ):
        monkeypatch.setattr(live, name, MagicMock())
    return conn.__enter__.return_value


def test_successful_refresh_is_recorded_in_same_transaction(ingest):
    live.run_full_ingest()
    sql, params = ingest.execute.call_args.args
    assert "INSERT INTO data_refresh_status" in sql
    assert "clock_timestamp()" in sql
    assert params[1].tzinfo is not None
    ingest.commit.assert_called_once()


def test_failed_refresh_does_not_publish_success_timestamp(ingest, monkeypatch):
    monkeypatch.setattr(
        live,
        "ingest_fixtures",
        MagicMock(side_effect=RuntimeError("source unavailable")),
    )
    with pytest.raises(RuntimeError):
        live.run_full_ingest()
    ingest.execute.assert_not_called()
    ingest.commit.assert_not_called()
