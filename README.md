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
