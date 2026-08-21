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
