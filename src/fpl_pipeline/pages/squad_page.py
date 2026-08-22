"""Renders a static, self-contained HTML "pitch view" of the current squad,
styled after the FPL app. Regenerated on every scheduled ingest run and
published to GitHub Pages, so it always reflects the squad that's actually
locked in for the current gameweek.
"""

import html

from fpl_pipeline.advisor.context import build_context
from fpl_pipeline.db.connection import get_connection

TEAM_COLORS = {
    "ARS": "#EF0107", "AVL": "#670E36", "BOU": "#DA291C", "BRE": "#e30613",
    "BHA": "#0057B8", "BUR": "#6C1D45", "CHE": "#034694", "CRY": "#1B458F",
    "EVE": "#003399", "FUL": "#000000", "LIV": "#C8102E", "MCI": "#6CABDD",
    "MUN": "#DA291C", "NEW": "#241F20", "NFO": "#DD0000", "SUN": "#EB172B",
    "TOT": "#132257", "WHU": "#7A263A", "WOL": "#FDB913", "LEE": "#FFCD00",
    "COV": "#78D0F7",
}
DEFAULT_COLOR = "#5A5A5A"

POSITION_ORDER = ["GKP", "DEF", "MID", "FWD"]


def _fixture_tag(player: dict) -> str:
    fixtures = player.get("upcoming_fixtures") or []
    if not fixtures:
        return "-"
    f = fixtures[0]
    venue = "H" if f["was_home"] else "A"
    return f"{html.escape(f['opponent'] or '?')} ({venue})"


def _last_points(player: dict) -> int:
    form = player.get("recent_form") or []
    return form[0]["total_points"] if form else 0


def _player_card(player: dict) -> str:
    color = TEAM_COLORS.get(player["team"], DEFAULT_COLOR)
    badge = ""
    if player["is_captain"]:
        badge = '<span class="badge captain">C</span>'
    elif player["is_vice_captain"]:
        badge = '<span class="badge vice">V</span>'

    return f"""
    <div class="player-card">
      {badge}
      <div class="shirt" style="background:{color}"></div>
      <div class="name-tag">
        <div class="name">{html.escape(player['player'])}</div>
        <div class="fixture">{_fixture_tag(player)}</div>
      </div>
      <div class="points">{_last_points(player)}</div>
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
        f'<div class="bench-slot"><div class="bench-label">{i + 1}. {p["position"]}</div>{_player_card(p)}</div>'
        for i, p in enumerate(bench)
    )

    budget = context["budget"] or {}

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>My FPL Squad</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {{ color-scheme: light; }}
  body {{
    margin: 0; padding: 24px; font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #f2f2f2; color: #1a1a2e;
  }}
  h1 {{ font-size: 20px; margin: 0 0 4px; }}
  .meta {{ color: #555; font-size: 14px; margin-bottom: 20px; }}
  .pitch {{
    background: linear-gradient(180deg, #1a8f3c, #167a33);
    border-radius: 12px; padding: 28px 12px; max-width: 900px; margin: 0 auto;
  }}
  .row {{ display: flex; justify-content: space-evenly; margin-bottom: 28px; flex-wrap: wrap; }}
  .player-card {{ position: relative; width: 90px; text-align: center; }}
  .shirt {{
    width: 42px; height: 42px; margin: 0 auto 4px; border-radius: 6px 6px 2px 2px;
    box-shadow: 0 1px 3px rgba(0,0,0,.4);
  }}
  .name-tag {{
    background: #fff; border-radius: 4px; padding: 3px 4px; font-size: 11px; line-height: 1.3;
  }}
  .name {{ font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
  .fixture {{ color: #666; }}
  .points {{
    background: #2b0f45; color: #fff; font-weight: 700; font-size: 12px;
    border-radius: 0 0 4px 4px; padding: 1px;
  }}
  .badge {{
    position: absolute; top: -4px; right: 14px; z-index: 2; width: 18px; height: 18px;
    border-radius: 50%; font-size: 11px; font-weight: 700; color: #1a1a2e;
    display: flex; align-items: center; justify-content: center;
  }}
  .badge.captain {{ background: #05f0ff; }}
  .badge.vice {{ background: #d9d9d9; }}
  .bench {{
    max-width: 900px; margin: 20px auto 0; background: #e8f5e9; border-radius: 12px;
    padding: 16px 12px; display: flex; justify-content: space-evenly; flex-wrap: wrap;
  }}
  .bench-slot {{ text-align: center; }}
  .bench-label {{ font-size: 11px; color: #555; margin-bottom: 4px; text-transform: uppercase; }}
  .budget {{ max-width: 900px; margin: 16px auto 0; font-size: 13px; color: #333; }}
  footer {{ text-align: center; color: #999; font-size: 11px; margin-top: 20px; }}
</style>
</head>
<body>
  <h1>My FPL Squad</h1>
  <div class="meta">Season {html.escape(context['season'])} · after gameweek {context['gameweek']}</div>
  <div class="pitch">
    {''.join(rows)}
  </div>
  <div class="bench">
    {bench_cards}
  </div>
  <div class="budget">
    Bank: £{budget.get('bank', 0) / 10:.1f}m &nbsp;·&nbsp;
    Squad value: £{budget.get('team_value', 0) / 10:.1f}m &nbsp;·&nbsp;
    Total points: {budget.get('total_points', 0)} &nbsp;·&nbsp;
    Overall rank: {budget.get('overall_rank', '-')}
  </div>
  <footer>Generated automatically from live FPL data — not affiliated with the Premier League or FPL.</footer>
</body>
</html>
"""


def main() -> None:
    with get_connection() as conn:
        context = build_context(conn)

    html_content = render_squad_html(context)
    import pathlib

    out_dir = pathlib.Path("public")
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / "index.html"
    out_path.write_text(html_content, encoding="utf-8")
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
