# FPL Cockpit — frontend

The Next.js workspace for the FPL data pipeline. A calm light canvas, an evergreen navigation rail, lime matchday accents and Manrope/Inter typography connect the research, lineup and deadline tools. Dark mode is saved per browser.

## Run locally

From `web/`:

```powershell
npm ci
Copy-Item .env.local.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`. Use a public read-only anon/publishable key. The browser does not need the Postgres password, FPL login or a service-role key.

The root repository's `.env` is for Python; this directory's `.env.local` is for Next.js. See the [root setup guide](../README.md#get-started) for schema and ingestion.

## Three connected planning tools

### Gameweek HQ — `/gameweek`

- Countdown to the next future deadline, displayed in America/Phoenix.
- Download a UTC `.ics` event with a two-hour reminder; import it into your calendar.
- A five-part preparation checklist shared with the overview.
- A season/manager/gameweek-specific notebook with up to 4,000 characters.
- Current availability flags and links to research, lineup drafts and saved advice.

Checks are manual preparation reminders. They do not verify or apply changes on FPL.

### Lineup studio — `/lineup`

- Draft a starting XI from all 15 saved players.
- Select a starter, then a bench replacement. Illegal formations are rejected.
- Choose distinct starting captain and vice-captain; move outfield substitutes up/down.
- Request a heuristic XI based on observed points, season minutes, availability and fixtures.
- Rehearse 0-, 1- or 90-minute outcomes for starters and substitutes.
- Inspect formation-aware autosubs, goalkeeper cover and captain fallback.
- Explore Standard, Bench Boost and Triple Captain scoring scenarios.
- Save the lineup locally, export draft JSON or print a team sheet.

A cameo prevents an autosub. Hypothetical minutes cover the entire gameweek, including all matches in a double. The rehearsal does not predict minutes, verify chip inventory or reproduce pending official live substitutions.

The lineup draft starts from the latest locked squad, not an authenticated current My Team response. Its export is different from the planner's advisor-compatible `current-state.json`.

### Research lab — `/lab`

- Screen by name, club, position, price, minutes, ownership, availability and watchlist.
- Start with value-under-£6.5m, low-ownership, easy-fixture and squad presets.
- Sort by recent form, total points, value, points per appearance or fixture difficulty.
- Display 3/5/8-week fixture windows with blanks and doubles.
- Compare the next three fixtures' average difficulty with the following three gameweeks.
- Explore an owned-player captain shortlist with its method and limitations stated.
- Save up to eight research views per season/manager/browser.
- Add players to the shared watchlist, compare up to four or export filtered CSV.

The captain shortlist considers all 15 owned players and marks candidates on the saved bench; they must start before receiving an armband. Its index is a heuristic, not expected points. Research form may include an unfinished saved gameweek.

## The rest of the workspace

| Route | Purpose |
| --- | --- |
| `/` | Gameweek result, metrics, season chart, all 15 players, preparation checklist, research radar and leagues |
| `/squad` | Saved pitch/list view, player sheets, availability and squad fixture coverage |
| `/live` | Latest saved match scoring with published multipliers |
| `/dashboard` | Finished-week analytics, rank/value/advantage charts and CSV journal |
| `/players` | Detailed explorer with table/card views and comparison selection |
| `/players/[code]` | Player history, charts and future fixtures |
| `/players/compare?codes=…` | Two-to-four-player comparisons |
| `/watchlist` | Saved players for this browser/season |
| `/fixtures` | Calendar-based fixture ticker and club detail |
| `/planner` | Five-week transfer bundles, actual selling values, rollover and hit costs |
| `/transfers` | Saved validated advisor output, per-alternative lineups and freshness notices |
| `/leagues` and `/leagues/[id]` | League summaries, standings and rival gaps |
| `/settings` | Appearance, connection information, freshness, workspace backup/restore and shortcuts |

`Ctrl/⌘ + K` opens page/player search. Escape closes search or player panels. The mobile menu reaches every route; frequent destinations also appear in the bottom navigation. Focus states, reduced motion and print styles are included.

## Local data and backups

`lib/local-state.ts` provides an external-store-backed local persistence layer. Watchlists and compare selections share their existing keys across the explorer and lab. Preparation checks share a key between HQ and the overview.

Lineup drafts, research views and notes are scoped to season, manager and gameweek as appropriate. If storage fails, edits stay in memory for the current visit and a notice appears. A draft that no longer contains the same 15 saved players falls back to the current saved squad.

Settings can export a workspace backup and preview a restore. Only recognized `fpl:` workspace keys are accepted, JSON is validated, duplicate keys are rejected and input is limited to 2 MB/200 entries. Matching items are replaced; unrelated browser storage is kept. Files are processed locally and do not execute FPL actions.

## Data boundaries

All data queries remain read-only against Supabase. New planning features require no new database tables or paid APIs.

- A page load reads the warehouse; it does not ingest fresh FPL data.
- Normal ingestion is every two hours; match-centre reloads are every minute.
- Freshness is based on the last successful ingest timestamp.
- Analytics uses confirmed finished gameweeks by default and labels unfinished data.
- Fixture averages exclude unknown ratings and preserve blanks/doubles.
- The advisor uses its own validated current-state workflow and never executes transfers.
- No fabricated scores, squads, prices or league standings replace missing data.

## Implementation map

```text
app/globals.css               Tokens, shared components and responsive layouts
app/layout.tsx                Fonts, shell, theme bootstrapping and search
components/HomeOverview.tsx   Server-rendered command centre
components/ResearchLab.tsx    Filters, saved views, shortlist and fixture swings
components/LineupStudio.tsx   Draft board and autosub rehearsal
components/GameweekPrep.tsx   Shared preparation checklist and notebook
components/WorkspaceBackup.tsx  Local export/restore flow
lib/planning-workspace.ts     Shared read-only planning inputs
lib/studio.ts                 Formation, simulation, fixtures and export logic
lib/backup.ts                 Backup format and input validation
lib/queries.ts                Existing warehouse queries
lib/analytics.ts              Finished-week analytics
lib/planning.ts               Transfer scenario constraints
```

## Validation and deployment

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run start
```

Tests use Node's built-in runner and the existing TypeScript compiler. They cover the financial/planning rules, analytics calculations, post-transfer evidence, autosub scenarios, captain fallback, fixture windows, local-state parsing, calendar export, CSV escaping and backup boundaries.

The app has also been checked in headless Chrome with real read-only warehouse data at desktop and mobile widths. Browser QA artifacts live in ignored `.qa/` and are excluded from lint.

For Vercel, retain `web` as the root directory and configure the two public Supabase variables. New code requires deployment through the normal repository flow. Existing scores and saved advisor rows remain database-driven.
