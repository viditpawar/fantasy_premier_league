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

- [x] Project scaffolding (this step)
- [ ] FPL API client
- [ ] Postgres schema + local Docker Postgres
- [ ] Historical season backfill
- [ ] Live gameweek ingest job
- [ ] GitHub Actions scheduled run (writes to Supabase Postgres)
- [ ] Grafana dashboard
- [ ] AI advisor

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
