# FPL Cockpit

A Next.js companion for your Fantasy Premier League season, backed by the existing Supabase warehouse. The interface uses a light canvas, evergreen accents, Inter typography, rounded surfaces and restrained motion. An alternative dark appearance is saved per device.

## Develop

Run commands from `web/`. Install dependencies with `npm install`, copy `.env.local.example` to `.env.local`, and supply the existing Supabase URL and public read-only key. Then run `npm run dev` and visit http://localhost:3000.

The root repository's `.env` configures the Python pipeline. The web app reads `web/.env.local`; it does not require the database password or a service-role key.

## The workspace

| Route | Purpose |
| --- | --- |
| `/` | Overview: key metrics, interactive season chart, gameweek snapshot, squad preview, advisor summary, leagues and upcoming club fixtures |
| `/squad` | Saved starting XI and bench, pitch/list switch, player detail panels, captain and availability checks |
| `/live` | Match centre: saved gameweek points, captain multiplier, playing status and nearby league rivals |
| `/dashboard` | Detailed rank, points and value charts, transfer momentum, differentials and top scorers |
| `/players` | Searchable player explorer with position, club, availability and ownership filters; card/table views; comparison selection |
| `/players/[code]` | Individual profile, game log, charts and fixtures |
| `/players/compare?codes=…` | Compare two to four players |
| `/fixtures` | Fixture difficulty ticker with gameweek windows and attack/defence perspectives |
| `/fixtures?team=…` | Upcoming fixtures for a specific club |
| `/transfers` | Saved AI transfer, captaincy and chip advice |
| `/leagues` | Classic and head-to-head league summaries |
| `/leagues/[id]` | Classic league standings, podium and nearby rivals |
| `/settings` | Appearance, connection information, data refresh expectations and keyboard shortcuts |

`Ctrl/⌘ + K` opens workspace search. Player panels and search support keyboard navigation, focus management and Escape to close. All routes are accessible from the mobile navigation menu, with five frequent destinations in the bottom bar. Motion respects the reduced-motion preference.

## Data and boundaries

The existing read-only queries and Python advisor/ingest workflow remain the source of truth. No example scores or squads are substituted for unavailable data. Errors show a retry view, while genuine empty results have purpose-specific messages.

The match centre reloads the warehouse snapshot every minute. Underlying scores still follow the ingest schedule, approximately every two hours. Team selections and transfers are performed on the official FPL site. The AI advisor shows its target gameweek and generated date; refreshing a page does not generate new advice.

The shared shell and overview resolve the same manager and season through `lib/workspace.ts`. Design tokens and responsive layouts live in `app/globals.css`. Club-colour kit illustrations render locally as SVG. Deadline and generated-time labels use America/Phoenix (MST).

Analytics defaults to confirmed finished gameweeks, so a pending zero does not lower season averages. Full-season, last-five and last-ten views update the summary, points/rank/advantage charts, squad value, consistency and sortable gameweek journal together. Unfinished weeks can be included explicitly and are marked provisional. CSV export includes the selected gameweeks, completion status, reported scores, global averages, overall ranks, bench points and transfer costs. Missing averages are excluded from comparison denominators, and transfer costs remain separate from reported scores.

The player insights below the analytics workspace use the full season and latest transfer snapshot independently of the selected period. Leading scorers can be filtered by current squad ownership. Transfer momentum displays the same net-transfer metric used for its ranking.

## Validate and deploy

`npx tsc --noEmit` checks types. `npm run build` produces the production app; `npm run start` serves it locally. No additional dependencies were introduced by the redesign.

`npm test` checks the analytics calculations, including completion filtering, missing averages and ranks, period baselines, transfer costs, valuation snapshots and CSV output. The tests use Node’s built-in test runner and the existing TypeScript compiler.

For the existing Vercel deployment, keep the project root set to `web` and retain `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The existing Python pipeline and database schema do not need to change for this interface.
