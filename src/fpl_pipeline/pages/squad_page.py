"""Renders a static, self-contained HTML "pitch view" of the current squad,
styled after the FPL app. Regenerated on every scheduled ingest run and
published to GitHub Pages, so it always reflects the squad that's actually
locked in for the current gameweek.
"""

import html
import pathlib
from datetime import datetime, timezone

from fpl_pipeline.advisor.context import build_context
from fpl_pipeline.db.connection import get_connection

SHIRT_URL = "https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_{code}-66.png"

POSITION_ORDER = ["GKP", "DEF", "MID", "FWD"]

STATUS_LABELS = {
    "d": "Doubtful", "i": "Injured", "s": "Suspended", "u": "Unavailable", "n": "Not available",
}


def _fixture_tag(player: dict) -> tuple[str, int | None]:
    fixtures = player.get("upcoming_fixtures") or []
    if not fixtures:
        return "No fixture", None
    f = fixtures[0]
    venue = "H" if f["was_home"] else "A"
    diff = f.get("difficulty")
    return f"{html.escape(f['opponent'] or '?')} ({venue})", diff


def _last_points(player: dict) -> int:
    form = player.get("recent_form") or []
    return form[0]["total_points"] if form else 0


def _difficulty_class(diff: int | None) -> str:
    if diff is None:
        return ""
    if diff <= 2:
        return "diff-easy"
    if diff == 3:
        return "diff-mid"
    return "diff-hard"


def _player_card(player: dict) -> str:
    badge = ""
    if player["is_captain"]:
        badge = '<span class="badge captain" title="Captain">C</span>'
    elif player["is_vice_captain"]:
        badge = '<span class="badge vice" title="Vice-captain">V</span>'

    warning = ""
    if player.get("status") and player["status"] != "a":
        label = STATUS_LABELS.get(player["status"], "Flagged")
        title = html.escape(player.get("news") or label)
        warning = f'<span class="warning" title="{title}">!</span>'

    fixture_text, difficulty = _fixture_tag(player)
    diff_class = _difficulty_class(difficulty)
    shirt_url = SHIRT_URL.format(code=player["team_code"])

    return f"""
    <div class="player-card">
      {badge}
      {warning}
      <img class="shirt" src="{shirt_url}" alt="{html.escape(player['team'])} shirt" loading="lazy">
      <div class="name-tag">
        <div class="name">{html.escape(player['player'])}</div>
        <div class="fixture {diff_class}">{fixture_text}</div>
      </div>
      <div class="points">{_last_points(player)} pts</div>
    </div>
    """


def _stat_tile(label: str, value: str) -> str:
    return f"""
    <div class="stat">
      <div class="stat-value">{value}</div>
      <div class="stat-label">{label}</div>
    </div>
    """


def render_squad_html(context: dict) -> str:
    squad = context["squad"]
    starting = sorted(
        [p for p in squad if p["squad_position"] <= 11],
        key=lambda p: (POSITION_ORDER.index(p["position"]), p["squad_position"]),
    )
    bench = sorted([p for p in squad if p["squad_position"] > 11], key=lambda p: p["squad_position"])

    rows = []
    for position in POSITION_ORDER:
        row_players = [p for p in starting if p["position"] == position]
        if row_players:
            rows.append(
                '<div class="row">' + "".join(_player_card(p) for p in row_players) + "</div>"
            )

    bench_cards = "".join(
        f'<div class="bench-slot"><div class="bench-label">{i + 1} · {p["position"]}</div>{_player_card(p)}</div>'
        for i, p in enumerate(bench)
    )

    budget = context["budget"] or {}
    generated_at = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")

    stats_html = "".join([
        _stat_tile("Total points", str(budget.get("total_points", "-"))),
        _stat_tile("Overall rank", f"{budget.get('overall_rank', 0):,}" if budget.get("overall_rank") else "-"),
        _stat_tile("Squad value", f"£{budget.get('team_value', 0) / 10:.1f}m"),
        _stat_tile("In the bank", f"£{budget.get('bank', 0) / 10:.1f}m"),
    ])

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>My FPL Squad</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  :root {{
    --bg: #0a0e27; --card-bg: #ffffff; --ink: #0a0e27; --muted: #6b7280;
    --pitch-1: #0f9b48; --pitch-2: #0b7a38; --accent: #37003c; --cyan: #05f0ff;
    --panel: #ffffff; --panel-border: #e5e7eb;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; padding: 20px; font-family: "Inter", -apple-system, "Segoe UI", sans-serif;
    background: var(--bg); color: #fff; min-height: 100vh;
  }}
  .wrap {{ max-width: 960px; margin: 0 auto; }}
  header {{ display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }}
  h1 {{ font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.01em; }}
  .meta {{ color: #9ca3af; font-size: 13px; }}

  .stats {{
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;
  }}
  .stat {{
    background: var(--panel); border-radius: 12px; padding: 14px 10px; text-align: center;
    border: 1px solid var(--panel-border);
  }}
  .stat-value {{ font-size: 20px; font-weight: 800; color: var(--accent); }}
  .stat-label {{ font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }}

  .pitch {{
    background:
      repeating-linear-gradient(180deg, rgba(255,255,255,.05) 0 40px, rgba(0,0,0,.03) 40px 80px),
      linear-gradient(180deg, var(--pitch-1), var(--pitch-2));
    border-radius: 16px; padding: 32px 12px 24px; position: relative; overflow: hidden;
    box-shadow: inset 0 0 60px rgba(0,0,0,.25);
  }}
  .row {{ display: flex; justify-content: space-evenly; margin-bottom: 26px; flex-wrap: wrap; gap: 8px; }}
  .row:last-child {{ margin-bottom: 4px; }}

  .player-card {{ position: relative; width: 96px; text-align: center; transition: transform .15s ease; }}
  .player-card:hover {{ transform: translateY(-3px); }}

  .shirt {{
    width: 44px; height: 44px; margin: 0 auto 6px; object-fit: contain;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,.45));
  }}

  .name-tag {{
    background: var(--card-bg); border-radius: 6px; padding: 4px 5px 3px; font-size: 11.5px; line-height: 1.35;
    box-shadow: 0 1px 4px rgba(0,0,0,.3);
  }}
  .name {{ font-weight: 700; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
  .fixture {{ color: var(--muted); font-weight: 600; }}
  .fixture.diff-easy {{ color: #16a34a; }}
  .fixture.diff-mid {{ color: #d97706; }}
  .fixture.diff-hard {{ color: #dc2626; }}

  .points {{
    background: var(--accent); color: #fff; font-weight: 700; font-size: 11px;
    border-radius: 0 0 6px 6px; padding: 2px; letter-spacing: 0.02em;
  }}

  .badge {{
    position: absolute; top: -6px; right: 18px; z-index: 2; width: 19px; height: 19px;
    border-radius: 50%; font-size: 11px; font-weight: 800; color: #0a0e27;
    display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,.4);
  }}
  .badge.captain {{ background: var(--cyan); }}
  .badge.vice {{ background: #d1d5db; }}
  .warning {{
    position: absolute; top: -6px; left: 18px; z-index: 2; width: 18px; height: 18px;
    border-radius: 50%; background: #ef4444; color: #fff; font-weight: 800; font-size: 12px;
    display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,.4);
    cursor: help;
  }}

  .subs-label {{
    text-align: center; color: #9ca3af; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.08em; margin: 18px 0 10px; font-weight: 700;
  }}
  .bench {{
    background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 16px;
    padding: 16px 12px; display: flex; justify-content: space-evenly; flex-wrap: wrap; gap: 12px;
  }}
  .bench-slot {{ text-align: center; }}
  .bench-label {{ font-size: 10.5px; color: #9ca3af; margin-bottom: 6px; text-transform: uppercase; font-weight: 700; }}

  footer {{ text-align: center; color: #6b7280; font-size: 11.5px; margin-top: 22px; line-height: 1.6; }}

  @media (max-width: 640px) {{
    .stats {{ grid-template-columns: repeat(2, 1fr); }}
    .player-card, .shirt {{ width: 72px; }}
  }}
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>My FPL Squad</h1>
      <div class="meta">Season {html.escape(context['season'])} · after gameweek {context['gameweek']}</div>
    </header>

    <div class="stats">{stats_html}</div>

    <div class="pitch">
      {''.join(rows)}
    </div>

    <div class="subs-label">Substitutes</div>
    <div class="bench">
      {bench_cards}
    </div>

    <footer>
      Generated automatically from live FPL data at {generated_at} — refreshes every 2 hours.<br>
      Not affiliated with the Premier League or Fantasy Premier League.
    </footer>
  </div>
</body>
</html>
"""


def main() -> None:
    with get_connection() as conn:
        context = build_context(conn)

    html_content = render_squad_html(context)

    out_dir = pathlib.Path("public")
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / "index.html"
    out_path.write_text(html_content, encoding="utf-8")
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
