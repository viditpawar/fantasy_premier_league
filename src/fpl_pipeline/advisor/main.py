"""AI advisor: reasons over the current squad plus historical/upcoming context
from the warehouse and suggests transfers and a captaincy pick.

Prints a combined prompt to paste into a free Claude.ai chat — no API
credits needed. The prompt asks for a machine-readable JSON block at the
end of the response; paste that response into a file and run
`python -m fpl_pipeline.advisor --apply <file>` to write it to
`advisor_suggestions`, which the web frontend's Transfers tab reads. This
whole flow costs nothing — it never calls the Claude API.
"""

import argparse
import json
import re

from fpl_pipeline.db.connection import get_connection

from .context import build_context

SYSTEM_PROMPT = """\
You are a Fantasy Premier League advisor. The squad you're given is the \
manager's currently locked-in squad from their most recent completed \
gameweek — any transfer you recommend will only take effect for the NEXT \
gameweek's deadline, not the one already played. You're also given each \
player's recent form (last 5 gameweeks), each player's next 3 fixtures with \
difficulty ratings (1=easiest, 5=hardest), the manager's budget (bank plus \
squad value), how many free transfers they currently have banked, and a \
list of in-form alternative players at each position with their prices.

The manager has a limited number of free transfers (given as \
`free_transfers`). Each transfer beyond that number costs 4 points off \
their total score for the gameweek. A transfer must also fit the budget: \
the incoming player's price must be no more than the outgoing player's \
price plus bank.

## Deterministic scoring method — follow exactly, do not substitute judgment

This is a mechanical calculation, not a creative task. Two runs over the \
same data must produce the same ranking. Do not weigh "gut feel", team \
reputation, or anything not listed below.

Step 1 — Flag replacement need, in this strict priority order:
  a. `status` isn't 'a' (injured/suspended/on loan/unavailable) — always \
     flag, regardless of form.
  b. `chance_of_playing_next_round` is not null and < 75 — always flag.
  c. 0 minutes in the most recent gameweek of `recent_form` — flag as a \
     rotation-risk concern (lower priority than a/b).
  d. Otherwise, a player is only a replacement candidate if their \
     `recent_form` score (Step 2) is the lowest on the squad at their \
     position AND at least 4 points below the best available candidate's \
     score (Step 2) at that position.
  Rank flagged players a > b > c > d; only consider replacing the \
  highest-priority flagged player(s) first.

Step 2 — Score every player (squad player being replaced, and every \
candidate) with this exact formula:
  score = sum(recent_form points, last 5 GWs, most recent GW counted \
  twice) − (average next-3-fixture difficulty × 3)
  Show this score for the outgoing player and every candidate you compare \
  in your reasoning.

Step 3 — Candidate selection: among transfer_candidates at the same \
position as the outgoing player, keep only those whose price ≤ outgoing \
player's price + bank. Rank the remainder strictly by score (Step 2), \
highest first. On a tie, prefer the cheaper player; if still tied, prefer \
the player with the easier (lower) next fixture difficulty.

Step 4 — Captain/vice-captain: score every available (`status` == 'a') \
squad player with Step 2's formula but using next 1 fixture difficulty \
only (not average of 3), doubled instead of ×3. Captain = highest score; \
vice-captain = second highest. On a tie, prefer the player with the \
easier next fixture.

Recommend:
1. Up to 3 transfer ideas that each fit within the free transfers the \
   manager already has banked (no point cost), in the exact rank order \
   from Step 3 — the manager will only actually make the top one now, the \
   rest are backup options in case a price rises or a player's status \
   changes before the deadline. Leave this empty only if Step 1 flags no \
   one.
2. Separately, any transfer that goes beyond the free allowance and costs \
   4 points — include one here ONLY if its Step 2 score gain over 4 \
   gameweeks (score_in − score_out, projected × 4) exceeds 4. Leave this \
   empty in the (much more common) case that no transfer clears that bar.
3. The captain and vice-captain from Step 4, with their scores shown.

Be concise. Only use data present in the context — never invent stats, \
injury news, or fixtures not given to you.
"""

SUGGESTION_JSON_INSTRUCTIONS = """\
After your written recommendation, output a machine-readable version as a \
fenced ```json code block (and nothing else in that block), matching \
exactly this shape:

{
  "recommended_transfers": [
    {
      "player_out": "...",
      "player_in": "...",
      "position": "GKP" | "DEF" | "MID" | "FWD",
      "reasoning": "..."
    }
  ],
  "hit_transfers": [
    {
      "player_out": "...",
      "player_in": "...",
      "position": "GKP" | "DEF" | "MID" | "FWD",
      "reasoning": "..."
    }
  ],
  "captain": "...",
  "vice_captain": "...",
  "captaincy_reasoning": "...",
  "summary": "one or two sentence overall summary"
}

`recommended_transfers` holds up to 3 free-transfer ideas, ranked best \
first (index 0 = the one to actually make). `hit_transfers` holds only \
transfers you'd recommend paying 4 points for — leave it an empty list \
unless one is clearly worth it. Both are empty lists if nothing applies. \
Use the exact player web names from the squad/candidate data given.
"""

REQUIRED_SUGGESTION_KEYS = {
    "recommended_transfers",
    "hit_transfers",
    "captain",
    "vice_captain",
    "captaincy_reasoning",
    "summary",
}


def build_prompt(context: dict) -> str:
    return (
        f"Season {context['season']}, after gameweek {context['gameweek']}. "
        f"Recommending for gameweek {context['for_gameweek']}.\n\n"
        f"Free transfers available: {context['free_transfers']}\n\n"
        f"Budget: {json.dumps(context['budget'], default=str)}\n\n"
        f"Current squad:\n{json.dumps(context['squad'], indent=2, default=str)}\n\n"
        f"In-form alternatives by position (last 5 gameweeks):\n"
        f"{json.dumps(context['transfer_candidates'], indent=2, default=str)}"
    )


def build_full_prompt() -> str:
    with get_connection() as conn:
        context = build_context(conn)
    system = f"{SYSTEM_PROMPT}\n{SUGGESTION_JSON_INSTRUCTIONS}"
    return f"{system}\n\n---\n\n{build_prompt(context)}"


def extract_suggestion(response_text: str) -> dict:
    match = re.search(r"```json\s*(\{.*?\})\s*```", response_text, re.DOTALL)
    if match:
        suggestion = json.loads(match.group(1))
    else:
        # No fenced block — maybe the file is just the raw JSON object itself.
        try:
            suggestion = json.loads(response_text)
        except json.JSONDecodeError:
            raise ValueError(
                "No ```json code block found, and the file isn't valid JSON on its own."
            )
    missing = REQUIRED_SUGGESTION_KEYS - suggestion.keys()
    if missing:
        raise ValueError(f"Suggestion JSON is missing keys: {sorted(missing)}")
    return suggestion


def write_suggestion(context: dict, suggestion: dict) -> None:
    with get_connection() as conn:
        team_id = conn.execute("select team_id from managers limit 1").fetchone()[0]
        conn.execute(
            """
            insert into advisor_suggestions
                (team_id, season, for_gameweek, free_transfers, suggestion, generated_at)
            values (%s, %s, %s, %s, %s, now())
            on conflict (team_id, season, for_gameweek) do update set
                free_transfers = excluded.free_transfers,
                suggestion = excluded.suggestion,
                generated_at = excluded.generated_at
            """,
            (
                team_id,
                context["season"],
                context["for_gameweek"],
                context["free_transfers"],
                json.dumps(suggestion),
            ),
        )
        conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        metavar="FILE",
        help="Parse a saved claude.ai response (containing the ```json block) and "
        "write the suggestion to advisor_suggestions. Use '-' to read from stdin.",
    )
    args = parser.parse_args()

    if args.apply:
        import sys

        response_text = sys.stdin.read() if args.apply == "-" else open(args.apply, encoding="utf-8").read()
        suggestion = extract_suggestion(response_text)
        with get_connection() as conn:
            context = build_context(conn)
        write_suggestion(context, suggestion)
        print(f"Wrote suggestion for gameweek {context['for_gameweek']} to advisor_suggestions.")
    else:
        print(build_full_prompt())
        print("\n\n--- Copy everything above into a new chat at claude.ai, then save the "
              "reply and run `python -m fpl_pipeline.advisor --apply <file>` ---")


if __name__ == "__main__":
    main()
