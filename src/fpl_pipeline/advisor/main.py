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
gameweek's deadline, not the one already played.

Every squad player and every transfer candidate already has two fields \
computed for you — DO NOT recompute, re-derive, or override them, and \
never state a different number for `score`, `captain_score`, `minutes`, \
`total_points`, or `difficulty` than what's literally in the JSON. If you \
need a number, copy it verbatim from the data; never calculate or \
estimate one yourself:

- `flag`: null if the player is fine, otherwise one of
  `a_unavailable_status` (status isn't 'a' — injured/suspended/unavailable), \
  `b_low_chance_of_playing` (chance_of_playing_next_round < 75), \
  `c_zero_minutes_last_gw` (rotation risk), or \
  `d_low_form_vs_best_candidate` (weakest scorer at their position, well \
  behind the best available replacement). These are already priority- \
  ordered a > b > c > d.
- `score`: last-5-gameweek form (most recent gameweek weighted double) \
  minus (average next-3-fixture difficulty × 3). Higher is better. This \
  is already computed from real data — trust it exactly as given.
- `captain_score` (squad players only): same form weighting, minus \
  (next-1-fixture difficulty × 2). Used only for the captain/vice pick.

The manager has a limited number of free transfers (given as \
`free_transfers`). Each transfer beyond that number costs 4 points off \
their total score for the gameweek. A transfer must also fit the budget: \
the incoming player's price must be no more than the outgoing player's \
price plus bank.

## Selection method — mechanical, not a creative task

Two runs over the same data must produce the same picks.

1. Only consider squad players with a non-null `flag`, highest priority \
   first (a, then b, then c, then d). If none are flagged, recommend no \
   transfer.
2. For the highest-priority flagged player, look at `transfer_candidates` \
   at the same position. Keep only those priced ≤ outgoing player's price \
   + bank. Rank the rest by `score` descending; tie-break by cheaper \
   price, then by lower next-fixture difficulty.
3. Repeat for the next flagged player (if any) to build up to 3 ranked \
   free-transfer ideas, best first.
4. For a -4 hit transfer: only include one if (candidate `score` − \
   outgoing player's `score`) × 4 exceeds 4 points — i.e. the score gap \
   itself must exceed 1. Leave empty otherwise (the common case).
5. Captain = highest `captain_score` among squad players with `flag` not \
   `a_unavailable_status`/`b_low_chance_of_playing`; vice-captain = \
   second highest. Tie-break by lower next-fixture difficulty.

Be concise. Cite the exact `score`/`flag`/`minutes` values from the data \
in your reasoning — never invent or restate them differently.
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
