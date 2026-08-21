import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
FPL_TEAM_ID = os.environ.get("FPL_TEAM_ID") or None
