"""Thin client for the public FPL API (no auth required)."""

import requests

BASE_URL = "https://fantasy.premierleague.com/api"


class FPLClient:
    def __init__(self) -> None:
        self._session = requests.Session()
        self._session.headers.update({"User-Agent": "fpl-pipeline/0.1"})

    def _get(self, path: str) -> dict:
        response = self._session.get(f"{BASE_URL}{path}", timeout=30)
        response.raise_for_status()
        return response.json()

    def bootstrap_static(self) -> dict:
        """Players, teams, gameweeks (events), and position types for the current season."""
        return self._get("/bootstrap-static/")

    def fixtures(self) -> list[dict]:
        """All fixtures for the current season, past and future."""
        return self._get("/fixtures/")

    def player_summary(self, element_id: int) -> dict:
        """A single player's full history plus upcoming fixtures."""
        return self._get(f"/element-summary/{element_id}/")

    def event_live(self, event_id: int) -> dict:
        """Every player's stats for a single gameweek, in one call."""
        return self._get(f"/event/{event_id}/live/")

    def entry(self, team_id: int) -> dict:
        """A manager's team: name, overall rank, current season summary."""
        return self._get(f"/entry/{team_id}/")

    def entry_history(self, team_id: int) -> dict:
        """A manager's gameweek-by-gameweek history, including past seasons."""
        return self._get(f"/entry/{team_id}/history/")

    def entry_picks(self, team_id: int, event_id: int) -> dict:
        """A manager's squad picks and captain choice for a given gameweek."""
        return self._get(f"/entry/{team_id}/event/{event_id}/picks/")

    def classic_league_standings(self, league_id: int, page: int = 1) -> dict:
        """One page (≤50 entries) of a classic league's standings table."""
        return self._get(f"/leagues-classic/{league_id}/standings/?page_standings={page}")
