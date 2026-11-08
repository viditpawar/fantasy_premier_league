"""Leakage-safe model inputs for the learned points estimator.

Every feature for a (season, player, gameweek) example is computed from rows
with a strictly earlier gameweek in that season, the player's previous-season
totals, and that gameweek's fixture list and price, all known before the
deadline. Live status, news and chance of playing are never features: they are
not stored for past gameweeks, so including them would train on information
the historical rows cannot reproduce. Availability is applied after prediction.
"""

from collections import defaultdict
from math import nan

from psycopg.rows import dict_row

from .rules import POSITIONS

POSITION_CODES = {"GKP": 0, "DEF": 1, "MID": 2, "FWD": 3}

FEATURES = [
    "position",
    "gameweek",
    "price",
    "prior_fixtures",
    "minutes_last",
    "minutes_3",
    "minutes_5",
    "starts_5",
    "points_3",
    "points_5",
    "points_season",
    "bps_5",
    "ict_5",
    "goal_involvements_5",
    "xg_5",
    "xa_5",
    "xgi_per90_5",
    "prev_points_per_fixture",
    "prev_minutes_share",
    "was_home",
    "difficulty",
    "team_scored_5",
    "team_conceded_5",
    "opponent_scored_5",
    "opponent_conceded_5",
]
CATEGORICAL = ["position"]


def _num(value) -> float:
    return nan if value is None else float(value)


def _window(rows: list[dict], n: int) -> list[dict]:
    return rows[-n:]


def _per_fixture(rows: list[dict], key: str) -> float:
    if not rows or any(r.get(key) is None for r in rows):
        return nan
    return sum(float(r[key]) for r in rows) / sum(r["fixture_count"] for r in rows)


def history_features(
    prior: list[dict],
    position: str,
    gameweek: int,
    price: float | None,
    previous: dict | None,
) -> dict:
    """Player form from strictly earlier played gameweeks (oldest first)."""
    prior = [r for r in prior if r["fixture_count"] > 0 and r["gameweek"] < gameweek]
    last5 = _window(prior, 5)
    with_xg = [
        r
        for r in last5
        if r.get("expected_goals") is not None and r.get("expected_assists") is not None
    ]
    xg_minutes = sum(r["minutes"] for r in with_xg)
    return {
        "position": POSITION_CODES[position],
        "gameweek": gameweek,
        "price": _num(price),
        "prior_fixtures": sum(r["fixture_count"] for r in prior),
        "minutes_last": _per_fixture(prior[-1:], "minutes"),
        "minutes_3": _per_fixture(_window(prior, 3), "minutes"),
        "minutes_5": _per_fixture(last5, "minutes"),
        "starts_5": sum(r["minutes"] / r["fixture_count"] >= 60 for r in last5) / len(last5)
        if last5
        else nan,
        "points_3": _per_fixture(_window(prior, 3), "total_points"),
        "points_5": _per_fixture(last5, "total_points"),
        "points_season": _per_fixture(prior, "total_points"),
        "bps_5": _per_fixture(last5, "bps"),
        "ict_5": _per_fixture(last5, "ict_index"),
        "goal_involvements_5": (
            _per_fixture(last5, "goals_scored") + _per_fixture(last5, "assists")
        ),
        "xg_5": _per_fixture(with_xg, "expected_goals"),
        "xa_5": _per_fixture(with_xg, "expected_assists"),
        "xgi_per90_5": sum(
            float(r["expected_goals"]) + float(r["expected_assists"]) for r in with_xg
        )
        * 90
        / xg_minutes
        if xg_minutes
        else nan,
        "prev_points_per_fixture": previous["points_per_fixture"] if previous else nan,
        "prev_minutes_share": previous["minutes_share"] if previous else nan,
    }


def previous_summaries(rows: list[dict]) -> dict[int, dict]:
    """Whole-season totals per player code, used as next season's prior."""
    totals = defaultdict(lambda: [0.0, 0.0, 0])
    for r in rows:
        if r["fixture_count"] > 0:
            t = totals[r["player_code"]]
            t[0] += float(r["total_points"])
            t[1] += float(r["minutes"])
            t[2] += r["fixture_count"]
    return {
        code: {
            "points_per_fixture": points / fixtures,
            "minutes_share": minutes / (90 * fixtures),
        }
        for code, (points, minutes, fixtures) in totals.items()
        if fixtures
    }


class TeamForm:
    """Rolling goals for/against from fixtures finished before a gameweek."""

    def __init__(self, fixtures: list[dict]):
        self.results = defaultdict(list)
        for f in fixtures:
            if (
                f.get("finished")
                and f.get("gameweek") is not None
                and f.get("team_h_score") is not None
            ):
                self.results[f["team_h"]].append(
                    (f["gameweek"], f["team_h_score"], f["team_a_score"])
                )
                self.results[f["team_a"]].append(
                    (f["gameweek"], f["team_a_score"], f["team_h_score"])
                )
        for games in self.results.values():
            games.sort()

    def before(self, team: int, gameweek: int) -> tuple[float, float]:
        games = [g for g in self.results.get(team, []) if g[0] < gameweek][-5:]
        if not games:
            return nan, nan
        return (
            sum(g[1] for g in games) / len(games),
            sum(g[2] for g in games) / len(games),
        )


def fixture_features(fixture: dict, team: int, form: TeamForm) -> dict:
    """One fixture from the player's team's perspective."""
    home = fixture["team_h"] == team
    opponent = fixture["team_a"] if home else fixture["team_h"]
    gameweek = fixture["gameweek"]
    scored, conceded = form.before(team, gameweek)
    opp_scored, opp_conceded = form.before(opponent, gameweek)
    return {
        "was_home": float(home),
        "difficulty": _num(fixture.get("team_h_difficulty" if home else "team_a_difficulty")),
        "team_scored_5": scored,
        "team_conceded_5": conceded,
        "opponent_scored_5": opp_scored,
        "opponent_conceded_5": opp_conceded,
    }


def _mean_fixture(features: list[dict]) -> dict:
    keys = features[0].keys()
    return {k: sum(f[k] for f in features) / len(features) for k in keys}


def build_examples(
    rows: list[dict],
    fixtures: list[dict],
    previous: dict[int, dict] | None = None,
) -> list[dict]:
    """Training examples for one season: features + per-fixture labels.

    History for each player is appended only after its example is built, so
    no example can see its own gameweek or anything later.
    """
    previous = previous or {}
    form = TeamForm(fixtures)
    by_fixture = {f["id"]: f for f in fixtures if f.get("id") is not None}
    by_team_week = defaultdict(list)
    for f in fixtures:
        if f.get("gameweek") is not None:
            by_team_week[f["team_h"], f["gameweek"]].append(f)
            by_team_week[f["team_a"], f["gameweek"]].append(f)
    by_player = defaultdict(list)
    for r in rows:
        by_player[r["player_code"]].append(r)
    examples = []
    for code, player_rows in by_player.items():
        player_rows.sort(key=lambda r: r["gameweek"])
        history = []
        for r in player_rows:
            if r["fixture_count"] > 0:
                team = r["team_id"]
                single = by_fixture.get(r.get("fixture_id"))
                # Archive rows carry the player's final club; a single
                # fixture's home flag identifies the club on the day.
                if single is not None and r.get("was_home") is not None:
                    team = single["team_h"] if r["was_home"] else single["team_a"]
                week = by_team_week.get((team, r["gameweek"]), [])
                if week:
                    value = r.get("value")
                    example = history_features(
                        history,
                        r["position"],
                        r["gameweek"],
                        value / 10 if value is not None else None,
                        previous.get(code),
                    )
                    example.update(
                        _mean_fixture([fixture_features(f, team, form) for f in week])
                    )
                    example.update(
                        {
                            "season": r["season"],
                            "player_code": code,
                            "target_points": float(r["total_points"]) / r["fixture_count"],
                            "target_60": float(r["minutes"] / r["fixture_count"] >= 60),
                        }
                    )
                    examples.append(example)
            history.append(r)
    return examples


STATS_QUERY = """
    select s.season, s.player_code, s.gameweek, s.team_id, s.fixture_id,
        s.was_home, s.minutes, s.total_points, s.goals_scored, s.assists,
        s.expected_goals, s.expected_assists, s.bps, s.ict_index, s.value,
        coalesce(s.fixture_count, (select count(*) from fixtures f
            where f.season = s.season and f.gameweek = s.gameweek
            and s.team_id in (f.team_h, f.team_a))) as fixture_count,
        p.element_type
    from player_gameweek_stats s
    join gameweeks g on g.season = s.season and g.id = s.gameweek
    join players p on p.season = s.season and p.code = s.player_code
    where s.season = %s and g.finished = true
        and p.element_type between 1 and 4  -- excludes 2024-25 manager cards
    order by s.player_code, s.gameweek
"""

FIXTURES_QUERY = """
    select id, gameweek, team_h, team_a, team_h_score, team_a_score, finished,
        team_h_difficulty, team_a_difficulty
    from fixtures where season = %s
"""


def load_season(conn, season: str) -> tuple[list[dict], list[dict]]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(STATS_QUERY, (season,))
        rows = cur.fetchall()
        cur.execute(FIXTURES_QUERY, (season,))
        fixtures = cur.fetchall()
    for r in rows:
        r["position"] = POSITIONS[r.pop("element_type")]
        for key in ("expected_goals", "expected_assists", "ict_index"):
            if r[key] is not None:
                r[key] = float(r[key])
    return rows, fixtures


def seasons(conn) -> list[str]:
    return [
        row[0]
        for row in conn.execute(
            "select distinct season from gameweeks order by season"
        ).fetchall()
    ]


def load_dataset(conn) -> dict:
    """Examples for every stored season, each primed by the season before."""
    data = {}
    previous = {}
    for season in seasons(conn):
        rows, fixtures = load_season(conn, season)
        data[season] = {
            "rows": rows,
            "fixtures": fixtures,
            "previous": previous,
            "examples": build_examples(rows, fixtures, previous),
        }
        previous = previous_summaries(rows)
    return data
