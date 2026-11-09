"""Leakage-safe model inputs for the learned points estimator.

Every feature for a (season, player, gameweek) example is computed from rows
available before its deadline in strictly earlier gameweeks, the player's
previous-season totals, and the fixture list. Prices use the last observed
prior week; mutable difficulty snapshots are excluded. Live status, news and
chance of playing are never features: they are
not stored for past gameweeks, so including them would train on information
the historical rows cannot reproduce. Availability is applied after prediction.
"""

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from functools import cache
from math import isnan, nan

from psycopg.rows import dict_row

from .rules import POSITIONS

POSITION_CODES = {"GKP": 0, "DEF": 1, "MID": 2, "FWD": 3}

PLAYER_FEATURES = [
    "position",
    "gameweek",
    "price",
    "prior_fixtures",
    "minutes_last",
    "minutes_3",
    "minutes_5",
    "minutes_10",
    "starts_5",
    "starts_season",
    "points_3",
    "points_5",
    "points_10",
    "points_season",
    "bonus_5",
    "bps_5",
    "ict_5",
    "threat_5",
    "creativity_5",
    "saves_5",
    "goal_involvements_5",
    "xg_5",
    "xa_5",
    "xg_10",
    "xa_10",
    "xgi_per90_5",
    "prev_points_per_fixture",
    "prev_minutes_share",
]
FIXTURE_FEATURES = [
    "was_home",
    "team_scored_5",
    "team_conceded_5",
    "team_clean_sheets_5",
    "team_xg_5",
    "team_xga_5",
    "opponent_scored_5",
    "opponent_conceded_5",
    "opponent_clean_sheets_5",
    "opponent_xg_5",
    "opponent_xga_5",
]
FEATURES = [*PLAYER_FEATURES, *FIXTURE_FEATURES, "xg_share_5"]
CATEGORICAL = ["position"]


def _num(value) -> float:
    return nan if value is None else float(value)


def _per_fixture(rows: list[dict], key: str) -> float:
    if not rows or any(r.get(key) is None for r in rows):
        return nan
    return sum(float(r[key]) for r in rows) / sum(r["fixture_count"] for r in rows)


def _starts(rows: list[dict]) -> float:
    # Aggregated doubles cannot tell us whether either individual match
    # reached 60 minutes (90 + 30 and 60 + 60 both total 120).
    rows = [r for r in rows if r["fixture_count"] == 1]
    if not rows:
        return nan
    return sum(r["minutes"] / r["fixture_count"] >= 60 for r in rows) / len(rows)


def _timestamp(value) -> datetime | None:
    if value is None:
        return None
    parsed = datetime.fromisoformat(value) if isinstance(value, str) else value
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed


def deadline(fixtures: list[dict], gameweek: int) -> datetime | None:
    """Use the stored deadline, or conservatively reconstruct archive deadlines."""
    week = [f for f in fixtures if f.get("gameweek") == gameweek]
    recorded = [_timestamp(f.get("deadline_time")) for f in week if f.get("deadline_time")]
    kickoffs = [_timestamp(f["kickoff_time"]) for f in week if f.get("kickoff_time")]
    return min(recorded) if recorded else min(kickoffs) - timedelta(minutes=90) if kickoffs else None


def known_before(row: dict, cutoff: datetime | None) -> bool:
    available = _timestamp(row.get("available_at"))
    return cutoff is None or (available is not None and available < cutoff)


def _xg(rows: list[dict]) -> list[dict]:
    return [
        r
        for r in rows
        if r.get("expected_goals") is not None and r.get("expected_assists") is not None
    ]


def history_features(
    prior: list[dict],
    position: str,
    gameweek: int,
    price: float | None,
    previous: dict | None,
    cutoff: datetime | None = None,
) -> dict:
    """Player form from strictly earlier played gameweeks (oldest first)."""
    prior = [
        r for r in prior
        if r["fixture_count"] > 0 and r["gameweek"] < gameweek and known_before(r, cutoff)
    ]
    last3, last5, last10 = prior[-3:], prior[-5:], prior[-10:]
    xg5 = _xg(last5)
    xg_minutes = sum(r["minutes"] for r in xg5)
    return {
        "position": POSITION_CODES[position],
        "gameweek": gameweek,
        "price": _num(price),
        "prior_fixtures": sum(r["fixture_count"] for r in prior),
        "minutes_last": _per_fixture(prior[-1:], "minutes"),
        "minutes_3": _per_fixture(last3, "minutes"),
        "minutes_5": _per_fixture(last5, "minutes"),
        "minutes_10": _per_fixture(last10, "minutes"),
        "starts_5": _starts(last5),
        "starts_season": _starts(prior),
        "points_3": _per_fixture(last3, "total_points"),
        "points_5": _per_fixture(last5, "total_points"),
        "points_10": _per_fixture(last10, "total_points"),
        "points_season": _per_fixture(prior, "total_points"),
        "bonus_5": _per_fixture(last5, "bonus"),
        "bps_5": _per_fixture(last5, "bps"),
        "ict_5": _per_fixture(last5, "ict_index"),
        "threat_5": _per_fixture(last5, "threat"),
        "creativity_5": _per_fixture(last5, "creativity"),
        "saves_5": _per_fixture(last5, "saves"),
        "goal_involvements_5": (
            _per_fixture(last5, "goals_scored") + _per_fixture(last5, "assists")
        ),
        "xg_5": _per_fixture(xg5, "expected_goals"),
        "xa_5": _per_fixture(xg5, "expected_assists"),
        "xg_10": _per_fixture(_xg(last10), "expected_goals"),
        "xa_10": _per_fixture(_xg(last10), "expected_assists"),
        "xgi_per90_5": sum(r["expected_goals"] + r["expected_assists"] for r in xg5)
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


def row_team(row: dict, by_fixture: dict) -> int:
    """Archive rows carry the player's final club; a single fixture's home
    flag identifies the club on the day."""
    single = by_fixture.get(row.get("fixture_id"))
    if single is not None and row.get("was_home") is not None:
        return single["team_h"] if row["was_home"] else single["team_a"]
    return row["team_id"]


def _mean(values: list[float]) -> float:
    values = [v for v in values if not isnan(v)]
    return sum(values) / len(values) if values else nan


class TeamForm:
    """Rolling club results and xG from fixtures finished before a gameweek.

    Club xG is the sum of its players' xG in single-fixture rows; fixtures
    without it (doubles, seasons before xG) contribute only goals.
    """

    def __init__(self, fixtures: list[dict], rows: list[dict] | None = None):
        by_fixture = {f["id"]: f for f in fixtures if f.get("id") is not None}
        xg = defaultdict(float)
        for r in rows or []:
            if (
                r["fixture_count"] == 1
                and r.get("fixture_id") in by_fixture
                and r.get("expected_goals") is not None
            ):
                xg[r["fixture_id"], row_team(r, by_fixture)] += r["expected_goals"]
        self.results = defaultdict(list)
        self.fixtures = fixtures
        for f in fixtures:
            if (
                f.get("finished")
                and f.get("gameweek") is not None
                and f.get("team_h_score") is not None
            ):
                home, away = f["team_h"], f["team_a"]
                known = (f["id"], home) in xg and (f["id"], away) in xg
                hxg = xg[f["id"], home] if known else nan
                axg = xg[f["id"], away] if known else nan
                kickoff = _timestamp(f.get("kickoff_time"))
                available = kickoff + timedelta(hours=3) if kickoff else None
                self.results[home].append(
                    (f["gameweek"], f["team_h_score"], f["team_a_score"], hxg, axg, available)
                )
                self.results[away].append(
                    (f["gameweek"], f["team_a_score"], f["team_h_score"], axg, hxg, available)
                )
        for games in self.results.values():
            games.sort(key=lambda g: g[0])

    @cache  # noqa: B019 - each instance exists for one season's feature build
    def before(self, team: int, gameweek: int) -> dict:
        cutoff = deadline(self.fixtures, gameweek)
        games = [
            g for g in self.results.get(team, [])
            if g[0] < gameweek and (cutoff is None or (g[5] is not None and g[5] < cutoff))
        ][-5:]
        if not games:
            return {k: nan for k in ("scored", "conceded", "clean_sheets", "xg", "xga")}
        return {
            "scored": _mean([g[1] for g in games]),
            "conceded": _mean([g[2] for g in games]),
            "clean_sheets": _mean([float(g[2] == 0) for g in games]),
            "xg": _mean([g[3] for g in games]),
            "xga": _mean([g[4] for g in games]),
        }


def fixture_features(fixture: dict, team: int, form: TeamForm, as_of: int | None = None) -> dict:
    """One fixture from the player's team's perspective, using results
    before `as_of` (default: the fixture's own gameweek)."""
    home = fixture["team_h"] == team
    opponent = fixture["team_a"] if home else fixture["team_h"]
    cutoff = as_of if as_of is not None else fixture["gameweek"]
    own, opp = form.before(team, cutoff), form.before(opponent, cutoff)
    return {
        "was_home": float(home),
        "team_scored_5": own["scored"],
        "team_conceded_5": own["conceded"],
        "team_clean_sheets_5": own["clean_sheets"],
        "team_xg_5": own["xg"],
        "team_xga_5": own["xga"],
        "opponent_scored_5": opp["scored"],
        "opponent_conceded_5": opp["conceded"],
        "opponent_clean_sheets_5": opp["clean_sheets"],
        "opponent_xg_5": opp["xg"],
        "opponent_xga_5": opp["xga"],
    }


def combine(player: dict, fixtures: list[dict]) -> dict:
    """Player features plus the mean of a gameweek's fixture features."""
    combined = dict(player)
    for key in FIXTURE_FEATURES:
        combined[key] = sum(f[key] for f in fixtures) / len(fixtures)
    team_xg = combined["team_xg_5"]
    combined["xg_share_5"] = (
        player["xg_5"] / team_xg if team_xg and not isnan(team_xg) else nan
    )
    return combined


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
    form = TeamForm(fixtures, rows)
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
                team = row_team(r, by_fixture)
                week = by_team_week.get((team, r["gameweek"]), [])
                if week:
                    cutoff = deadline(fixtures, r["gameweek"])
                    known = [h for h in history if known_before(h, cutoff)]
                    # Today's fixture ratings and archive prices can be revised
                    # after a deadline. Use only the last observed price.
                    value = known[-1].get("value") if known else None
                    example = combine(
                        history_features(
                            history,
                            r["position"],
                            r["gameweek"],
                            value / 10 if value is not None else None,
                            previous.get(code),
                            cutoff,
                        ),
                        [fixture_features(f, team, form) for f in week],
                    )
                    example.update(
                        {
                            "season": r["season"],
                            "player_code": code,
                            "target_points": float(r["total_points"]) / r["fixture_count"],
                            "target_60": float(r["minutes"] >= 60) if r["fixture_count"] == 1 else None,
                            "fixture_count": r["fixture_count"],
                            "available_at": r.get("available_at"),
                            "deadline_time": cutoff,
                        }
                    )
                    examples.append(example)
            history.append(r)
    return examples


STATS_QUERY = """
    select s.season, s.player_code, s.gameweek, s.team_id, s.fixture_id,
        s.was_home, s.minutes, s.total_points, s.goals_scored, s.assists,
        s.expected_goals, s.expected_assists, s.bps, s.bonus, s.saves,
        s.ict_index, s.threat, s.creativity, s.value,
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
    select f.id, f.gameweek, f.team_h, f.team_a, f.team_h_score, f.team_a_score, f.finished,
        f.team_h_difficulty, f.team_a_difficulty, f.kickoff_time, g.deadline_time
    from fixtures f left join gameweeks g on g.season = f.season and g.id = f.gameweek
    where f.season = %s
"""

NUMERIC = ("expected_goals", "expected_assists", "ict_index", "threat", "creativity")


def load_season(conn, season: str) -> tuple[list[dict], list[dict]]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(STATS_QUERY, (season,))
        rows = cur.fetchall()
        cur.execute(FIXTURES_QUERY, (season,))
        fixtures = cur.fetchall()
    for r in rows:
        r["position"] = POSITIONS[r.pop("element_type")]
        for key in NUMERIC:
            if r[key] is not None:
                r[key] = float(r[key])
    by_fixture = {f["id"]: f for f in fixtures}
    by_team_week = defaultdict(list)
    for f in fixtures:
        kickoff = _timestamp(f.get("kickoff_time"))
        if kickoff:
            for team in (f["team_h"], f["team_a"]):
                by_team_week[team, f["gameweek"]].append(kickoff + timedelta(hours=3))
    for r in rows:
        times = by_team_week[row_team(r, by_fixture), r["gameweek"]]
        r["available_at"] = max(times) if times else None
        r["deadline_time"] = deadline(fixtures, r["gameweek"])
    return rows, fixtures


def seasons(conn) -> list[str]:
    return [
        row[0]
        for row in conn.execute(
            "select distinct season from gameweeks order by season"
        ).fetchall()
    ]


def load_raw(conn) -> dict:
    """Rows and fixtures for every stored season."""
    data = {}
    for season in seasons(conn):
        rows, fixtures = load_season(conn, season)
        data[season] = {"rows": rows, "fixtures": fixtures}
    return data


def prepare(raw: dict) -> dict:
    """Add examples to raw season data, each season primed by the one before."""
    previous, previous_year = {}, None
    for season in sorted(raw):
        season_data = raw[season]
        year = int(season[:4])
        if previous_year is not None and year != previous_year + 1:
            previous = {}
        season_data["previous"] = previous
        season_data["examples"] = build_examples(
            season_data["rows"], season_data["fixtures"], previous
        )
        previous = previous_summaries(season_data["rows"])
        previous_year = year
    return raw


def load_dataset(conn) -> dict:
    return prepare(load_raw(conn))
