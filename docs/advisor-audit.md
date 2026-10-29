# Transfer advisor audit

Reviewed 23 October 2026. The manual prompt/reply workflow remains in place;
there is no paid LLM integration or website scan button.

Updated 25 October: the [GW8 follow-up](gameweek-8-review.md) adds a legal-XI
comparison over four weeks, minutes and freshness gates, double-gameweek data
repairs, and measured ranking evaluation. It supersedes the scoring limitations
and local connectivity findings below. The experimental ranking remains
inactive because the observed evaluation did not show an improvement.

## Findings and changes

| Area | Previous problem | Current behavior |
| --- | --- | --- |
| Current squad | Last locked picks were described as current. | Default output is explicitly research only; exact checks require a manually confirmed current snapshot. |
| Transfer allowance | Reconstruction ignored chip weeks and transfers made after the deadline. | Uses the snapshot's real allocation and moves already made. Zero remaining cannot be called a free move; active Wildcard/Free Hit means unlimited moves. |
| Target week | Assumed the last saved week plus one. | Chooses the next future deadline; stops if none exists instead of inventing GW39. |
| Form | Included incomplete weeks and compared unnormalized totals. | Uses the last five completed calendar gameweeks and a weighted mean, with the newest doubled. Missing history remains unknown. |
| Fixtures | Next three unfinished matches could include the current locked week and conceal blanks. | Uses explicit target gameweeks, counts all double fixtures, and preserves blanks. |
| Candidate pool | Top eight raw scorers were selected before budget/club checks. | Evaluates available players first, then checks exact affordability and club limits; retains a shortlist plus the best legal option for each outgoing player. |
| Money | Market price substituted for unknown selling value. | Only a confirmed selling price and current bank establish affordability; integer tenths/decimal comparisons avoid rounding errors. |
| Availability | Doubtful players were automatically called unavailable; yellow warnings ignored cutoffs. | Separates doubt, confirmed absence, missed minutes and suspension risk; uses club matches played for disciplinary cutoffs. |
| Captaincy | Price/position defaults could override evidence; bench/blank choices were possible. | Prompt considers form, fixtures and minutes; validation requires distinct retained starters with target fixtures and no confirmed absence. |
| Bench | Bench points were treated as irrelevant. | Prompt accounts for autosubs, legal formations and Bench Boost. |
| Hits | Ranking-index improvements were treated as predicted point gains. | No hit recommendation without a calibrated points forecast; all hit suggestions are currently rejected. |
| Chips | Availability was unknown; unique club counts and any double could trigger recommendations. | Requires confirmed playable chips, counts available squad players, checks bench minutes and starting captain options, and suggests at most one chip. Unknown availability never triggers a recommendation. |
| Applying replies | Only top-level keys were checked; old advice could be attached to a changed squad or manager. | Validates nested content, financial/squad constraints, deadline and a context fingerprint; uses the configured manager. Duplicate JSON keys, ambiguous names and multiple JSON blocks are rejected. |
| Saved website advice | Old recommendations appeared current. | Expired/legacy snapshots get a visible notice; unknown free transfers are labelled unconfirmed. The overview avoids featuring old transfer picks as a fresh move. |

## Current-state file

`current-state.json` is local, ignored by Git, and contains no login credentials.
Use the values from your current FPL team. `picks` has the same element,
position and selling-price fields as FPL's My Team data. All 15 players are
required, including substitutes. Player IDs are season-specific, not player
codes. Positions 1–11 are the starting XI and 12–15 are the ordered bench.

The following is an illustrative structure, not a usable squad. Replace the
timestamp, entry, season, week and each pick, and include all 15 actual players:

```json
{
  "team_id": 123456,
  "season": "2026-27",
  "for_gameweek": 9,
  "captured_at": "2026-10-23T18:00:00Z",
  "picks": [
    {"element": 100, "position": 1, "selling_price": 50},
    {"element": 200, "position": 2, "selling_price": 45}
  ],
  "transfers": {"bank": 5, "limit": 2, "made": 1},
  "active_chip": null,
  "available_chips": ["wildcard", "freehit", "bboost", "3xc"]
}
```

Here, bank 5 is £0.5m and limit 2 minus made 1 leaves one free transfer.
`made` counts transfers already confirmed for the upcoming week, not the
previous week's moves. Copy the pre-move allocation into `limit`; do not
subtract the moves twice. `null` is accepted for an unlimited limit during
initial selection or an active Wildcard/Free Hit. If joining after GW1, set
`initial_selection: true` only before your team's first deadline; existing
manager history makes that flag invalid. An active Wildcard or
Free Hit also removes transfer-hit costs for this week.

Omit `available_chips` if you have not confirmed availability. Use `[]` if
none is playable. List only chips FPL currently allows you to play, accounting
for prior use, the current chip window, expiry and consecutive-Free-Hit
restrictions. `active_chip` is a confirmed active chip, not a pending selection.
After any new transfer or lineup change, update the snapshot and regenerate
the prompt. A timestamp is your confirmation of recency, not an automatic
verification against your FPL account.

## Rules checked against official sources

The [official FPL FAQ](https://www.premierleague.com/en/news/4661030) confirms
five banked free transfers, retained transfers around Wildcard/Free Hit,
profit-sharing selling prices, legal formations and autosub/captain rules.
The code does not infer current funds or transfer availability from historical
picks, because those records cannot establish predeadline changes.

The [2026/27 chip guidance](https://www.premierleague.com/en/news/4679879/whats-happening-with-fpl-chips-in-202627)
confirms two chip sets, first-half expiry at the GW19 deadline, one chip per
week, and Free Hit restrictions. A double gameweek is not required for a
useful Bench Boost or Triple Captain. Availability is supplied explicitly,
so no previous season's chip calendar is silently reused.

The [Premier League disciplinary explanation](https://www.premierleague.com/en/news/4425344)
places the five- and ten-yellow thresholds at a club's 19th and 32nd league
matches. These warnings are distinct from confirmed suspensions; red-card
and cup-ban duration still depends on the ingested status/news.

## Validation and limitations

Run `python -m pytest -q` for regression tests, including financial boundaries,
already-used free transfers, chips, deadlines, stale responses, malformed
JSON, legal formations and save behavior. Database writes in tests are mocked.
Use `--apply reply.txt --check --state current-state.json` for a read-only
validation of your own response against current warehouse data.

The ranking index is deliberately simple: completed-week weighted mean points,
adjusted mildly for fixture difficulty and averaged over the next three
gameweeks (or remaining weeks at season end). It counts blanks/doubles but
does not predict expected minutes, xG, price changes or future points. A short
history or past double can distort its ranking; the prompt must explain this
uncertainty. It is not a backtested optimizer.

Warehouse data can lag FPL. Refresh ingestion before generating advice and
check late team news. Exact transfer checks are as current as the supplied
snapshot; this workflow cannot see subsequent moves automatically. Applying
advice saves a recommendation to the website, never a transfer to FPL.

Local verification could not establish a live Postgres connection (connection
timeout). No live database writes or FPL transfers were performed during the
audit. Unit and boundary tests verify the logic independently; live end-to-end
database validation remains an environment limitation.

The production web build, TypeScript checks and existing analytics tests passed.
Headless Chrome checked the overview and advisor at desktop/mobile sizes with
live read-only Supabase data: expired advice displayed its notice and an
unconfirmed transfer allowance, with no overflow or browser runtime errors.
