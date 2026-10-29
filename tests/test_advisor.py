"""Regression coverage for the advisor's financial and squad constraints."""

import copy
import json
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest

from fpl_pipeline.advisor import context as context_module
from fpl_pipeline.advisor import main as cli
from fpl_pipeline.advisor.context import (
    compute_chip_advice,
    confirmed_state,
    get_recent_form,
)
from fpl_pipeline.advisor.rules import (
    context_fingerprint,
    fixture_score,
    form_score,
    suspension_risk,
    transfer_state,
    validate_squad,
    validate_suggestion,
)

NOW = datetime(2026, 10, 23, 12, tzinfo=UTC)


@pytest.fixture
def context():
    positions = [
        "GKP",
        "DEF",
        "DEF",
        "DEF",
        "MID",
        "MID",
        "MID",
        "MID",
        "FWD",
        "FWD",
        "FWD",
        "GKP",
        "DEF",
        "DEF",
        "MID",
    ]
    squad = [
        {
            "player_id": i,
            "player_code": 1000 + i,
            "player": f"Player {i}",
            "position": position,
            "squad_position": i,
            "team_id": (i - 1) % 5 + 1,
            "now_cost": 50,
            "status": "a",
            "chance_of_playing_next_round": 100,
            "selling_price": 48,
            "price": 5,
            "next_gameweek_fixture_count": 1,
            "form_score": 5,
            "recent_form": [{"gameweek": 7, "total_points": 5, "minutes": 90}],
        }
        for i, position in enumerate(positions, 1)
    ]
    candidate = {
        **squad[1],
        "player_id": 100,
        "player_code": 2000,
        "player": "New defender",
        "team_id": 6,
        "price": 5,
    }
    result = {
        "season": "2026-27",
        "team_id": 123,
        "gameweek": 8,
        "for_gameweek": 9,
        "deadline": (NOW + timedelta(days=2)).isoformat(),
        "state_captured_at": NOW.isoformat(),
        "state_verified": True,
        "free_transfers": 1,
        "budget": {"bank": 2},
        "transfer_state": transfer_state(2, 1),
        "squad": squad,
        "transfer_candidates": {"GKP": [], "DEF": [candidate], "MID": [], "FWD": []},
        "chip_advice": {},
        "warnings": [],
        "model_version": "minutes-fixtures-v2",
        "decision": {"transfer_options": [{"out_id": 2, "in_id": 100, "eligible": True}]},
    }
    result["context_id"] = context_fingerprint(result)
    return result


@pytest.fixture
def suggestion(context):
    return {
        "context_id": context["context_id"],
        "recommended_transfers": [
            {
                "player_out": "Player 2",
                "player_in": "New defender",
                "position": "DEF",
                "reasoning": "Useful fixtures.",
            }
        ],
        "hit_transfers": [],
        "captain": "Player 6",
        "vice_captain": "Player 7",
        "captaincy_reasoning": "Both have fixtures and minutes.",
        "lineup_watch": [],
        "summary": "An affordable alternative.",
    }


@pytest.fixture
def state(context):
    return {
        "team_id": 123,
        "season": "2026-27",
        "for_gameweek": 9,
        "captured_at": NOW.isoformat(),
        "picks": [
            {
                "element": p["player_id"],
                "position": p["squad_position"],
                "selling_price": p["selling_price"],
            }
            for p in context["squad"]
        ],
        "transfers": {"bank": 2, "limit": 2, "made": 1},
    }


@pytest.mark.parametrize(
    "limit,made,remaining,committed,next_cost",
    [
        (1, 0, 1, 0, 0),
        (1, 1, 0, 0, 4),
        (2, 3, 0, 4, 4),
        (5, 2, 3, 0, 0),
        (None, 20, None, 0, 0),
        (0, 0, 0, 0, 4),
    ],
)
def test_already_made_transfers(limit, made, remaining, committed, next_cost):
    result = transfer_state(limit, made)
    assert (
        result["remaining"],
        result["already_committed_cost"],
        result["next_transfer_cost"],
    ) == (remaining, committed, next_cost)


@pytest.mark.parametrize("limit,made", [(6, 0), (-1, 0), (1, -1), (True, 0), (1, 1.5)])
def test_invalid_transfer_counts(limit, made):
    with pytest.raises(ValueError):
        transfer_state(limit, made)


@pytest.mark.parametrize(
    "cards,matches,risk",
    [
        (4, 18, True),
        (4, 19, False),
        (9, 31, True),
        (9, 32, False),
        (14, 37, True),
        (14, 38, False),
        (5, 10, False),
        (4, None, False),
    ],
)
def test_yellow_card_cutoffs(cards, matches, risk):
    assert suspension_risk(cards, matches) is risk


def test_normalized_form_and_target_gameweek_fixtures():
    form = [{"gameweek": 2, "total_points": 3}, {"gameweek": 3, "total_points": 6}]
    assert form_score(form) == 5
    assert form_score([]) == 0
    assert form_score([{"gameweek": 3, "total_points": 5}]) == 5
    fixtures = [{"gameweek": gw, "difficulty": 3} for gw in (8, 9, 9, 11, 12)]
    assert fixture_score(form, fixtures, 9, 1) == 10  # both double fixtures, no GW8
    assert fixture_score(form, fixtures, 10, 1) == 0  # explicit blank
    assert fixture_score(form, fixtures, 9, 3) == 5


def test_recent_form_query_excludes_unfinished_gameweeks():
    conn = MagicMock()
    cursor = conn.cursor.return_value.__enter__.return_value
    cursor.fetchall.return_value = [
        {"player_code": 1001, "gameweek": 7, "total_points": 4, "minutes": 90}
    ]
    assert get_recent_form(conn, "2026-27", [1001])[1001][0]["minutes"] == 90
    sql, params = cursor.execute.call_args.args
    assert "finished = true" in sql and "order by id desc limit" in sql
    assert params == ("2026-27", [1001], "2026-27", 8)


def test_confirmed_snapshot_subtracts_used_transfer(context, state):
    squad, transfers = confirmed_state(state, context["squad"], 123, 9, NOW)
    assert len(squad) == 15 and transfers["remaining"] == 1
    state["transfers"]["made"] = 2
    assert confirmed_state(state, context["squad"], 123, 9, NOW)[1]["remaining"] == 0


@pytest.mark.parametrize(
    "mutation",
    [
        lambda s: s.update(team_id=456),
        lambda s: s.update(for_gameweek=8),
        lambda s: s.update(captured_at=(NOW - timedelta(hours=25)).isoformat()),
        lambda s: s.update(captured_at=(NOW + timedelta(hours=1)).isoformat()),
        lambda s: s.update(captured_at="2026-10-23T12:00:00"),
        lambda s: s["picks"].pop(),
        lambda s: s["picks"][0].update(element=9999),
        lambda s: s["picks"][0].update(selling_price=51),
        lambda s: s["picks"][0].update(selling_price=None),
        lambda s: s["picks"][0].update(position=2),
        lambda s: s["transfers"].update(bank=-1),
        lambda s: s["transfers"].update(limit=None),
        lambda s: s.update(available_chips=["freehit", "freehit"]),
        lambda s: s.update(active_chip="unknown"),
    ],
)
def test_invalid_current_snapshots(context, state, mutation):
    mutation(state)
    with pytest.raises(ValueError):
        confirmed_state(state, context["squad"], 123, 9, NOW)


@pytest.mark.parametrize("chip", ["wildcard", "freehit"])
def test_active_unlimited_chip(context, state, chip):
    state["active_chip"] = chip
    state["transfers"]["made"] = 12
    assert confirmed_state(state, context["squad"], 123, 9, NOW)[1]["remaining"] is None


def test_chip_availability_and_only_one_chip(context):
    squad = context["squad"]
    assert not any(a["recommended"] for a in compute_chip_advice(squad, 9).values())
    assert not any(a["recommended"] for a in compute_chip_advice(squad, 9, []).values())
    assert compute_chip_advice(squad, 9, ["bboost"])["bench_boost"]["recommended"]
    for p in squad[:5]:
        p["status"] = "i"
    advice = compute_chip_advice(squad, 9, ["wildcard", "freehit", "bboost", "3xc"])
    assert sum(a["recommended"] for a in advice.values()) == 1
    assert advice["wildcard"]["recommended"]
    assert not any(
        a["recommended"]
        for a in compute_chip_advice(squad, 9, ["freehit"], "wildcard").values()
    )


def test_chips_count_players_not_unique_clubs(context):
    # Three club blanks remove nine players, not merely three clubs.
    for p in context["squad"]:
        if p["team_id"] in {1, 2, 3}:
            p["next_gameweek_fixture_count"] = 0
    assert compute_chip_advice(context["squad"], 9, ["freehit"])["free_hit"][
        "recommended"
    ]


def test_captain_chip_does_not_trigger_for_double_bench_keeper(context):
    context["squad"][11]["next_gameweek_fixture_count"] = 2
    assert not compute_chip_advice(context["squad"], 9, ["3xc"])["triple_captain"][
        "recommended"
    ]


def test_valid_transfer_and_exact_profit_sharing_budget(context, suggestion):
    assert validate_suggestion(context, suggestion) is suggestion
    context["budget"]["bank"] = 1  # market price 50, real sale 48, cannot buy at 50
    with pytest.raises(ValueError, match="Illegal transfer"):
        validate_suggestion(context, suggestion)


def test_legal_transfer_with_no_material_improvement_is_rejected(context, suggestion):
    context["decision"]["transfer_options"][0]["eligible"] = False
    with pytest.raises(ValueError, match="optimized XI"):
        validate_suggestion(context, suggestion)


def test_reply_without_current_decision_model_cannot_recommend_moves(context, suggestion):
    del context["decision"]
    with pytest.raises(ValueError, match="current decision model"):
        validate_suggestion(context, suggestion)


def test_fresh_current_squad_does_not_override_stale_ingestion(context, suggestion):
    context["data_fresh"] = False
    with pytest.raises(ValueError, match="Refresh ingestion"):
        validate_suggestion(context, suggestion)


def test_captain_must_pass_minutes_safety_shortlist(context, suggestion):
    context["decision"]["captain_candidates"] = [7, 8]
    with pytest.raises(ValueError, match="Captain"):
        validate_suggestion(context, suggestion)


def test_captain_can_start_in_optimized_legal_lineup(context, suggestion):
    context["decision"]["lineup"] = {"starters": [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 15]}
    suggestion["captain"] = "Player 15"
    assert validate_suggestion(context, suggestion)


def test_retained_captain_must_start_after_every_transfer_alternative(context, suggestion):
    context["decision"]["transfer_options"][0]["lineup"] = {
        "formation": "3-4-3",
        "starters": [1, 100, 3, 4, 5, 15, 7, 8, 9, 10, 11],
        "bench": [6, 13, 14, 12],
    }
    with pytest.raises(ValueError, match="Captain"):
        validate_suggestion(context, suggestion)


def test_bench_boost_requires_minutes_from_starters_as_well_as_bench(context):
    squad = context["squad"]
    assert compute_chip_advice(squad, 9, ["bboost"])["bench_boost"]["recommended"]
    squad[5]["recent_form"][0]["minutes"] = 1
    assert not compute_chip_advice(squad, 9, ["bboost"])["bench_boost"]["recommended"]


@pytest.mark.parametrize(
    "mutation,match",
    [
        (lambda c, s: s.update(context_id="old"), "stale"),
        (lambda c, s: c.update(state_verified=False), "--state"),
        (lambda c, s: c.update(free_transfers=0), "No free"),
        (lambda c, s: s.update(recommended_transfers="bad"), "three"),
        (
            lambda c, s: s["recommended_transfers"].append(
                copy.deepcopy(s["recommended_transfers"][0])
            ),
            "Duplicate",
        ),
        (
            lambda c, s: s["recommended_transfers"][0].update(player_out="Unknown"),
            "names",
        ),
        (lambda c, s: s["recommended_transfers"][0].update(position="MID"), "Illegal"),
        (lambda c, s: c["squad"][1].update(selling_price=None), "Illegal"),
        (lambda c, s: c["transfer_candidates"]["DEF"][0].update(team_id=1), "Illegal"),
        (lambda c, s: c["transfer_candidates"]["DEF"][0].update(status="i"), "Illegal"),
        (lambda c, s: s.update(captain="Player 12"), "Captain"),
        (lambda c, s: s.update(captain="Player 2"), "Captain"),
        (lambda c, s: c["squad"][5].update(next_gameweek_fixture_count=0), "Captain"),
        (lambda c, s: c["squad"][5].update(chance_of_playing_next_round=0), "Captain"),
        (lambda c, s: s.update(vice_captain="Player 6"), "different"),
        (lambda c, s: s.update(summary=""), "summary"),
        (lambda c, s: s.update(lineup_watch="bad"), "lineup_watch"),
        (lambda c, s: c["squad"][14].update(player="Player 1"), "ambiguous"),
        (lambda c, s: c["squad"][14].update(player_id=1), "distinct"),
        (lambda c, s: s.update(captain=[]), "Captain"),
    ],
)
def test_invalid_advice(context, suggestion, mutation, match):
    mutation(context, suggestion)
    with pytest.raises(ValueError, match=match):
        validate_suggestion(context, suggestion)


def test_heuristic_score_cannot_justify_hit(context, suggestion):
    context["free_transfers"] = 0
    suggestion["hit_transfers"] = suggestion["recommended_transfers"]
    suggestion["recommended_transfers"] = []
    with pytest.raises(ValueError, match="Hits are disabled"):
        validate_suggestion(context, suggestion)


def test_no_move_valid_after_free_transfer_used(context, suggestion):
    context["free_transfers"] = 0
    suggestion["recommended_transfers"] = []
    assert validate_suggestion(context, suggestion)


def test_unlimited_transfers_can_have_independent_free_alternatives(
    context, suggestion
):
    context["free_transfers"] = None
    assert validate_suggestion(context, suggestion)


def test_fingerprint_changes_with_bank_and_used_transfer(context):
    original = context_fingerprint(context)
    context["budget"]["bank"] += 1
    assert context_fingerprint(context) != original
    context["budget"]["bank"] -= 1
    context["transfer_state"]["made"] += 1
    assert context_fingerprint(context) != original


def test_json_extraction(suggestion):
    payload = json.dumps(suggestion)
    assert cli.extract_suggestion(payload) == suggestion
    assert cli.extract_suggestion(f"Reasoning\n```json\n{payload}\n```\n") == suggestion


@pytest.mark.parametrize(
    "response",
    [
        "[]",
        "null",
        "bad json",
        "{}",
        '{"summary":1,"summary":2}',
        '{"n":NaN}',
        "```json\n{}\n```\n```json\n{}\n```",
    ],
)
def test_json_rejections(response):
    with pytest.raises(ValueError):
        cli.extract_suggestion(response)


def test_unsafe_reply_never_opens_write_connection(context, suggestion, monkeypatch):
    connection = MagicMock()
    monkeypatch.setattr(cli, "get_connection", connection)
    suggestion["context_id"] = "stale"
    with pytest.raises(ValueError):
        cli.write_suggestion(context, suggestion)
    connection.assert_not_called()


def test_write_uses_configured_team_and_validated_metadata(
    context, suggestion, monkeypatch
):
    context["deadline"] = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    context["context_id"] = context_fingerprint(context)
    suggestion["context_id"] = context["context_id"]
    suggestion["validation"] = {"state_verified": False}  # ignored LLM metadata
    conn = MagicMock()
    monkeypatch.setattr(cli, "get_connection", lambda: conn)
    cli.write_suggestion(context, suggestion)
    sql, params = conn.__enter__.return_value.execute.call_args.args
    assert "insert into advisor_suggestions" in sql
    assert params[0] == 123
    assert json.loads(params[-1])["validation"]["state_verified"] is True
    conn.__enter__.return_value.commit.assert_called_once()


def test_build_prompt_exposes_current_state_uncertainty(context):
    context["state_verified"] = False
    context["warnings"] = ["Research only: current transfer count unknown"]
    prompt = cli.build_prompt(context)
    assert '"state_verified": false' in prompt
    assert "current transfer count unknown" in prompt


def test_illegal_starting_formation(context):
    context["squad"][0]["squad_position"], context["squad"][12]["squad_position"] = (
        13,
        1,
    )
    with pytest.raises(ValueError, match="formation"):
        validate_squad(context["squad"])


@pytest.fixture
def warehouse(context, monkeypatch):
    """Read-only warehouse boundary with an older locked squad and future GW9."""
    conn = MagicMock()

    def execute(sql, params=None):
        result = MagicMock()
        if "max(season)" in sql:
            result.fetchone.return_value = ("2026-27",)
        elif "deadline_time >" in sql:
            result.fetchone.return_value = (9, NOW + timedelta(days=2))
        elif "max(gameweek)" in sql:
            result.fetchone.return_value = (6,)  # target must NOT become 7
        elif "from data_refresh_status" in sql:
            result.fetchone.return_value = (NOW,)
        elif "from manager_picks" in sql:
            result.fetchall.return_value = [
                (p["player_id"], p["squad_position"], 48) for p in context["squad"]
            ]
        else:
            result.fetchall.return_value = []
        return result

    conn.execute.side_effect = execute
    players = copy.deepcopy(context["squad"] + context["transfer_candidates"]["DEF"])
    # Incoming players retain their real market price; no fallback to a
    # historical selling value is allowed for squad affordability.
    for player in players:
        player["market_price"] = player["price"]
    monkeypatch.setattr(context_module, "get_team_id", lambda conn: 123)
    monkeypatch.setattr(context_module, "_players", lambda conn, season: players)
    monkeypatch.setattr(
        context_module,
        "get_recent_form",
        lambda *args: {p["player_code"]: p["recent_form"] for p in players},
    )
    monkeypatch.setattr(
        context_module,
        "get_upcoming_fixtures",
        lambda *args: {
            club: [
                {"gameweek": 9, "difficulty": 3, "opponent": "Opp", "was_home": True}
            ]
            for club in range(1, 7)
        },
    )
    return conn


def test_build_context_research_never_guesses_current_funds(warehouse):
    result = context_module.build_context(warehouse, now=NOW)
    assert result["for_gameweek"] == 9 and result["gameweek"] == 6
    assert result["free_transfers"] is None and result["transfer_state"] is None
    assert result["budget"]["bank"] is None and not result["state_verified"]
    assert all(p["selling_price"] is None for p in result["squad"])
    assert result["context_id"] == context_fingerprint(result)


def test_build_context_current_squad_and_budget(warehouse, state):
    result = context_module.build_context(warehouse, state, NOW)
    assert result["state_verified"] and result["free_transfers"] == 1
    assert result["transfer_candidates"]["DEF"][0]["affordable_for"]
    assert result["context_id"] == context_fingerprint(result)
    state["transfers"]["bank"] = 1
    updated = context_module.build_context(warehouse, state, NOW)
    assert not updated["transfer_candidates"]["DEF"]
    assert updated["context_id"] != result["context_id"]


def test_build_context_no_free_transfers_never_urges_new_move(warehouse, state):
    state["transfers"]["made"] = state["transfers"]["limit"]
    result = context_module.build_context(warehouse, state, NOW)
    assert result["decision"]["action"] == "roll"
    assert not any(o["eligible"] for o in result["decision"]["transfer_options"])


def test_current_state_must_match_season(warehouse, state):
    state["season"] = "2025-26"
    with pytest.raises(ValueError, match="season"):
        context_module.build_context(warehouse, state, NOW)


def test_season_end_does_not_invent_gw39(warehouse):
    warehouse.execute.side_effect = None
    warehouse.execute.return_value.fetchone.side_effect = [("2026-27",), None]
    with pytest.raises(ValueError, match="No future deadline"):
        context_module.build_context(warehouse, now=NOW)


def test_wrong_snapshot_shapes_fail_with_clear_validation(context, state):
    state["active_chip"] = []
    with pytest.raises(ValueError, match="active chip"):
        confirmed_state(state, context["squad"], 123, 9, NOW)


def test_duplicate_candidate_names_are_rejected(context, suggestion):
    context["transfer_candidates"]["DEF"].append(
        {**context["transfer_candidates"]["DEF"][0], "player_id": 101}
    )
    with pytest.raises(ValueError, match="unique candidate"):
        validate_suggestion(context, suggestion)


def test_deadline_passed_never_writes(context, suggestion, monkeypatch):
    context["deadline"] = (datetime.now(UTC) - timedelta(minutes=1)).isoformat()
    context["context_id"] = context_fingerprint(context)
    suggestion["context_id"] = context["context_id"]
    connection = MagicMock()
    monkeypatch.setattr(cli, "get_connection", connection)
    with pytest.raises(ValueError, match="deadline"):
        cli.write_suggestion(context, suggestion)
    connection.assert_not_called()


def test_late_entry_initial_selection_is_unlimited(context, state):
    state["initial_selection"] = True
    state["transfers"]["limit"] = None
    result = confirmed_state(state, context["squad"], 123, 9, NOW)[1]
    assert result["remaining"] is None and result["next_transfer_cost"] == 0


def test_existing_manager_cannot_claim_initial_selection(warehouse, state):
    state["initial_selection"] = True
    with pytest.raises(ValueError, match="existing gameweek history"):
        context_module.build_context(warehouse, state, NOW)


def test_cli_check_does_not_save(context, suggestion, tmp_path, monkeypatch, capsys):
    reply = tmp_path / "reply.txt"
    reply.write_text(json.dumps(suggestion), encoding="utf-8")
    monkeypatch.setattr(cli.sys, "argv", ["advisor", "--apply", str(reply), "--check"])
    monkeypatch.setattr(cli, "get_connection", MagicMock())
    monkeypatch.setattr(cli, "build_context", lambda *args: context)
    writer = MagicMock()
    monkeypatch.setattr(cli, "write_suggestion", writer)
    cli.main()
    assert "nothing saved" in capsys.readouterr().out
    writer.assert_not_called()
