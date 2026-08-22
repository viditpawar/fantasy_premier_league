![Fantasy Premier League AI](docs/assets/image.png)

# Fantasy Premier League Pipeline

A data pipeline for Fantasy Premier League: ingest live FPL API data and historical
season data into Postgres, then consume it through a Grafana dashboard and an
LLM-based transfer/captaincy advisor.

## Architecture

```
FPL live API ─┐
              ├─> ingest job (Python, Docker, GitHub Actions cron) ─> Postgres ─┬─> Grafana dashboard
Historical    ─┘                                                                └─> AI advisor
season data
```

The ingest job is the only thing that writes to Postgres. Both the dashboard and
the AI advisor read from the same warehouse, so the advisor can reason over real
multi-season history instead of just the current gameweek snapshot.

## Status

Work in progress, built step by step:

- [x] Project scaffolding
- [x] FPL API client
- [x] Postgres schema + local Docker Postgres
- [x] Live gameweek ingest job
- [x] Historical season backfill (last 5 completed seasons)
- [x] Production Postgres on Supabase, seeded with live + historical data
- [x] GitHub Actions scheduled run (writes to Supabase Postgres)
- [x] Grafana dashboard
- [x] AI advisor
- [x] Auto-updating squad page (GitHub Pages)
- [x] Next.js frontend (squad + dashboard) on Vercel, reading Supabase directly

## Local development

Requires Docker and Python 3.11+.

```
cp .env.example .env
docker compose up -d
pip install -e ".[dev]"
```

`DATABASE_URL` in `.env` points at the local Docker Postgres by default. The
production ingest job (run via GitHub Actions) points at a hosted Supabase
Postgres instance instead, configured via repo secrets.

`docker compose up -d` also starts Grafana at http://localhost:3001
(login `admin` / `admin`, or whatever `GRAFANA_ADMIN_PASSWORD` is set to) with
an "FPL Overview" dashboard already provisioned — current rank, season points,
top scorers, and your current squad. It reads from the same local Postgres by
default; to point it at production Supabase instead, override the
`GRAFANA_POSTGRES_*` variables in `.env` with the session pooler
host/port/db/user/password and set `GRAFANA_POSTGRES_SSLMODE=require`.

## Production setup (Supabase + GitHub Actions)

The GitHub Actions workflow (`.github/workflows/ingest.yml`) needs two repo
secrets, set at Settings → Secrets and variables → Actions:

- `DATABASE_URL` — Supabase's **session pooler** connection string (Project
  Settings → Database → Connection string → Session pooler tab), of the form
  `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`.
  Use the pooler host, not the direct `db.<ref>.supabase.co` host — the direct
  host is IPv6-only and fails to resolve on many networks/runners.
- `FPL_TEAM_ID` — your FPL entry id.

The schema and historical backfill only need to be run once against a fresh
Supabase database (the scheduled job only handles the live/current-season
data from then on):

```
export DATABASE_URL="<supabase session pooler connection string>"
python -m fpl_pipeline.db.connection
python -m fpl_pipeline.ingest.historical
```

## Auto-updating squad page

Live at **https://viditpawar.github.io/fantasy_premier_league/**.

Every scheduled ingest run regenerates a static "pitch view" of your current
squad (`src/fpl_pipeline/pages/squad_page.py`) and publishes it to GitHub
Pages — no manual step ever needed. It shows:

- Formation view on a pitch, grouped by position, with captain (C) and
  vice-captain (V) badges
- A red warning badge on any player flagged injured/suspended/doubtful/unavailable
  (hover for the reason)
- Each player's next fixture, colour-coded by difficulty (green = easy,
  amber = medium, red = hard)
- Last gameweek's points per player
- A stats row: total points, overall rank, squad value, money in the bank
- Substitutes bench, in order
- "Generated at" timestamp so you can see how fresh it is

One-time setup: Settings → Pages → **Source: GitHub Actions** (not "Deploy
from a branch").

To generate it locally instead:

```
python -m fpl_pipeline.pages.squad_page
```

writes `public/index.html` — open it directly in a browser.

## Frontend (Next.js on Vercel)

A real web app (`web/`) that queries Supabase directly from the browser/server
(no Python backend involved) — a squad page (same info as the GitHub Pages
version, plus live formation view) and a dashboard (rank/points history, top
scorers).

This only works because Row Level Security is enabled on every table with a
public **read-only** policy for the `anon` role (see `schema.sql`) — the
frontend uses Supabase's anon/publishable key, which is meant to be public
and safe to embed in client code; it can only ever `SELECT`, never write.

### Local development

```
cd web
cp .env.local.example .env.local
```

Fill in `.env.local` with your Supabase project URL and anon/publishable key
(Project Settings → API):

```
npm install
npm run dev
```

Visit http://localhost:3000 (squad) and http://localhost:3000/dashboard.

### Deploy to Vercel

1. Go to vercel.com → **New Project** → import this GitHub repo.
2. Set **Root Directory** to `web` (important — the Next.js app isn't at the repo root).
3. Add two environment variables (from the same Supabase API settings page):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Every push to `main` auto-deploys; every page load fetches fresh
   data straight from Supabase, so there's nothing to keep "in sync" — no
   ingest job dependency, no rebuild needed when the data changes.

## AI advisor

Builds a prompt from your current squad, each player's last-5-gameweek form,
next-3 fixture difficulty, your budget, and in-form alternatives at each
position (all pulled from Postgres):

```
python -m fpl_pipeline.advisor
```

By default this prints the prompt for you to paste into a free chat at
claude.ai — no API costs. If you'd rather it call the Claude API directly
and print the suggestions straight to your terminal (costs a small amount
of usage credit per run, from console.anthropic.com):

```
export ANTHROPIC_API_KEY="<your key from console.anthropic.com>"
python -m fpl_pipeline.advisor --api
```
