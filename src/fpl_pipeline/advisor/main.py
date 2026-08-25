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
their total score for the gameweek. Only recommend a transfer beyond the \
free allowance if the expected point gain over the next few gameweeks \
clearly outweighs the 4-point hit — say so explicitly when a transfer \
costs points, and default to recommending at most `free_transfers` \
transfers otherwise. A transfer must also fit the budget: the incoming \
player's price must be no more than the outgoing player's price plus bank.

Recommend:
1. Any transfers worth making before the next gameweek deadline (or say \
   none are needed), with the specific player in and player out, and \
   reasoning grounded in the data provided (form, fixtures, price, \
   availability status, and whether it costs points).
2. A captain and vice-captain pick for the next gameweek, with reasoning.

Be concise and specific. Only recommend transfers clearly supported by the \
data — do not invent information not present in the context. Flag any \
squad player whose `status` isn't 'a' (available) as a priority concern.
"""

SUGGESTION_JSON_INSTRUCTIONS = """\
After your written recommendation, output a machine-readable version as a \
fenced ```json code block (and nothing else in that block), matching \
exactly this shape:

{
  "transfers": [
    {
      "player_out": "...",
      "player_in": "...",
      "position": "GKP" | "DEF" | "MID" | "FWD",
      "costs_points": true | false,
      "reasoning": "..."
    }
  ],
  "captain": "...",
  "vice_captain": "...",
  "captaincy_reasoning": "...",
  "summary": "one or two sentence overall summary"
}

`transfers` is an empty list if none are recommended. Use the exact \
player web names from the squad/candidate data given.
"""

REQUIRED_SUGGESTION_KEYS = {
    "transfers",
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
