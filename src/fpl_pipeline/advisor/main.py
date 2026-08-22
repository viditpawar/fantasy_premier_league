"""AI advisor: reasons over the current squad plus historical/upcoming context
from the warehouse and suggests transfers and a captaincy pick.
"""

import json

import anthropic

from fpl_pipeline.db.connection import get_connection

from .context import build_context

SYSTEM_PROMPT = """\
You are a Fantasy Premier League advisor. You're given a manager's current \
squad, each player's recent form (last 5 gameweeks), each player's next 3 \
fixtures with difficulty ratings (1=easiest, 5=hardest), the manager's \
budget (bank plus squad value), and a list of in-form alternative players \
at each position.

Recommend:
1. Any transfers worth making this gameweek (or say none are needed), with \
   the specific player in and player out, and reasoning grounded in the \
   data provided (form, fixtures, price, availability status).
2. A captain and vice-captain pick for the upcoming gameweek, with reasoning.

Be concise and specific. Only recommend transfers clearly supported by the \
data — do not invent information not present in the context. Flag any \
squad player whose `status` isn't 'a' (available) as a priority concern.
"""


def build_prompt(context: dict) -> str:
    return (
        f"Season {context['season']}, after gameweek {context['gameweek']}.\n\n"
        f"Budget: {json.dumps(context['budget'], default=str)}\n\n"
        f"Current squad:\n{json.dumps(context['squad'], indent=2, default=str)}\n\n"
        f"In-form alternatives by position (last 5 gameweeks):\n"
        f"{json.dumps(context['transfer_candidates'], indent=2, default=str)}"
    )


def run_advisor() -> str:
    with get_connection() as conn:
        context = build_context(conn)

    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-opus-5",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": build_prompt(context)}],
    )
    return next(block.text for block in response.content if block.type == "text")


if __name__ == "__main__":
    print(run_advisor())
