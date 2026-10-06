"""Thin client for the public FPL API, plus optional authenticated endpoints
(the real sell price for your own squad is only exposed once logged in —
the public entry/picks endpoint never includes it)."""

import requests

BASE_URL = "https://fantasy.premierleague.com/api"
LOGIN_URL = "https://users.premierleague.com/accounts/login/"


class FPLAuthError(RuntimeError):
    """Raised when login fails or an authenticated call is made while logged out."""


class FPLClient:
    def __init__(self) -> None:
        self._session = requests.Session()
        self._session.headers.update({"User-Agent": "fpl-pipeline/0.1"})
        self._authenticated = False

    @property
    def authenticated(self) -> bool:
        return self._authenticated

    def _get(self, path: str, base: str = BASE_URL) -> dict:
        response = self._session.get(f"{base}{path}", timeout=30)
        response.raise_for_status()
        return response.json()

    def login(self, email: str, password: str) -> None:
        """Authenticate the session so authenticated endpoints (my_team) work.

        Mirrors the login flow the official FPL web app itself uses — POSTs
        credentials to the Premier League's accounts service, which sets
        session cookies on success. There's no JSON success/failure field;
        failure shows up as a redirect back to the login page instead of
        fantasy.premierleague.com, so that's what's checked here.
        """
        response = self._session.post(
            LOGIN_URL,
            data={
                "login": email,
                "password": password,
                "app": "plfpl-web",
                "redirect_uri": "https://fantasy.premierleague.com/a/login",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
            allow_redirects=True,
        )
        response.raise_for_status()
        if "fantasy.premierleague.com" not in response.url:
            raise FPLAuthError(
                "FPL login did not redirect to fantasy.premierleague.com — "
                "check FPL_EMAIL/FPL_PASSWORD are correct."
            )
        self._authenticated = True

    def my_team(self, team_id: int) -> dict:
        """The logged-in manager's current squad, including each pick's real
        `selling_price` (accounts for FPL's profit-sharing rule) and
        `purchase_price` — only available authenticated; the public
        entry/picks endpoint never includes these fields.
        """
        if not self._authenticated:
            raise FPLAuthError("my_team() requires login() first.")
        return self._get(f"/my-team/{team_id}/")

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
