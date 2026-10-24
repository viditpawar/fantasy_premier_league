# Planning your next gameweeks

The watchlist, transfer planner and squad outlook complement the saved advisor
recommendations. They do not call an LLM or execute changes on FPL.

## Watchlist and player explorer

Save a player using the star in the explorer or player profile. The watchlist
shows that player's latest warehouse price, form and availability each visit.
Shortlists are stored per season in this browser; they do not sync across
devices. Comparison selections also survive page navigation. If storage is
unavailable, the site keeps edits in memory for the current visit and displays
a notice instead of claiming they were saved permanently.

Filter players by position, club, availability, ownership in the saved squad,
maximum price, minimum season minutes, maximum ownership and watchlist status.
Unknown ownership is excluded when a maximum ownership filter is active.
Table sorting happens before pagination, so a points sort ranks the whole
filtered group. Card view loads additional players in batches.

## Transfer planner

Open `/planner`. Your saved selection supplies a starting point, not proof of
your current squad. In setup:

1. Replace players to match My Team, including moves already made this week.
2. Swap lineup slots if your current starting XI differs from the saved picks.
3. Enter the current bank, the free-transfer allocation before this week's
   moves, and the number already confirmed. Allocation 2 minus made 2 means
   zero free transfers remain. Previously committed hit costs are displayed
   separately from hypothetical new costs.
4. Supply actual FPL selling prices for outgoing players. A market price is
   never silently substituted for a selling value.
5. Confirm that you checked the baseline. Confirmation expires after 24 hours
   and is invalidated by baseline edits or changes to relevant warehouse
   player prices, clubs, positions or availability.

Plan up to five consecutive gameweeks. Each week's moves form a simultaneous
bundle: the final squad must have 15 distinct players, the correct positional
distribution, a legal starting formation, at most three from a club, and a
nonnegative bank. Multiple moves may release funds or a club slot for another
move in the same bundle. Repeated outgoing/incoming players and resale chains
are rejected. An existing excess-club squad can make a corrective transfer.

Unused free transfers roll forward by one per ordinary gameweek, capped at
five. Additional moves cost four points each. A bad earlier step blocks later
verified totals; it is never silently skipped. Bought players have a scenario
selling value equal to today's purchase price in later weeks.

This is a fixed-price scenario planner. Future price changes, chips and
season-specific transfer top-ups are excluded. Availability flags are warnings,
not predictions of future minutes. Review every real move on official FPL.

Drafts save locally per season, manager and target gameweek. Export draft JSON
for a backup. An additional **Export current squad** action becomes available
when the confirmed baseline has all fifteen actual selling values. Its
`current-state.json` is compatible with the manual advisor's `--state` option;
it contains the baseline, never hypothetical planned transfers. It includes no
login or API credentials. The site does not verify manual inputs against your
private FPL account.

## Fixtures and squad coverage

Planning starts at the next future deadline. The fixture ticker can start
later, show 3/5/8 weeks, filter to squad clubs or clubs with blanks/doubles,
and sort by average difficulty or club name. It uses calendar gameweeks even
when a whole week has no assigned fixtures.

Average difficulty is calculated per rated match: doubles contribute both
matches; blanks contribute no invented difficulty; unknown ratings are
excluded and counted separately. Match counts and blank weeks are visible
beside the average. Attack/Defence modes remain strength-based heuristics.

The squad outlook on `/squad` shows each player's scheduled matches and a
formation-aware coverage count using today's availability. This is not a
forecast of future lineups. A blank means no fixture is currently assigned;
rescheduling may change it.

## Match scores and refresh times

Match totals sum **all** saved FPL multipliers, including scoring substitutes,
vice-captain fallback, Triple Captain and Bench Boost. A zero multiplier stays
zero. Row scores show raw points and the scoring multiplier; bench raw points
are identified separately. Autosubs appear when FPL publishes them and the
pipeline saves them; the frontend does not invent pending substitutions.

The footer and settings use `data_refresh_status.completed_at`, committed in
the same transaction as a successful ingest. A failed ingest cannot mark old
data fresh. Missing timestamps display as unavailable; timestamps more than
four hours old are marked potentially stale. Page loads do not count as data
refreshes. The GitHub Actions ingest job is serialized to avoid overlapping
runs.

The next Docker ingest applies the updated schema automatically. For a manual
installation, apply it with `python -m fpl_pipeline.db.connection` before running
live ingestion. The website continues working while the new timestamp table
is absent, displaying an unavailable refresh time.

## Automated checks

GitHub Actions runs the Python tests, web logic tests and production build on
pushes and pull requests. An isolated Postgres service applies the schema
twice and checks that the refresh table is readable, but not writable, by the
anonymous frontend role. It never uses the production database connection.
Locally, this integration test is skipped unless `FPL_TEST_DATABASE_URL` points
to a dedicated database ending in `_test`; all changes in that test are rolled
back. The local Docker daemon was unavailable during this implementation, so
the integration check runs in CI rather than against the live warehouse.
