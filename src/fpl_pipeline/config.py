import os
from datetime import date

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
FPL_TEAM_ID = os.environ.get("FPL_TEAM_ID") or None


def current_season(today: date | None = None) -> str:
    """FPL season label, e.g. '2025-26'. Seasons run August through May."""
    today = today or date.today()
    start_year = today.year if today.month >= 7 else today.year - 1
    return f"{start_year}-{str(start_year + 1)[-2:]}"


def completed_seasons(n: int, today: date | None = None) -> list[str]:
    """The `n` most recently completed season labels, oldest first."""
    current_start_year = int(current_season(today).split("-")[0])
    return [
        f"{y}-{str(y + 1)[-2:]}"
        for y in range(current_start_year - n, current_start_year)
    ]
