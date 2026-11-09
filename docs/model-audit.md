# Prediction model audit — 8 November 2026

The review covered historical and live data, feature construction, model fitting,
parameter selection, evaluation, activation, saved artifacts, scheduled training,
publication and the website's use of predictions. The warehouse contained
139,076 completed player/gameweek records across 2021-22 through 2026-27.
The official FPL API and warehouse agreed that GW9 was the latest finished week;
GW10 was still provisional and the next deadline belonged to GW11. The latest
warehouse refresh was checked against official player prices and availability:
there were no differences at the time of that check.

## Repaired data and prediction logic

- **Historical doubles:** 2,215 rows from 2021-22 still held only one fixture's
  result while being divided by two. Rebuilt all 23,230 player/gameweek records
  from 25,447 archived fixture records. Season totals changed from 29,001 to
  31,414 points and from 689,418 to 749,468 minutes. The repaired season now
  contains 2,217 correctly aggregated double-gameweek records. This also fixes
  the prior-season features used by the following season.
- **Deadline inputs:** removed mutable FPL difficulty ratings from the model
  and replaced target-week price snapshots with the last observed prior price.
  Player and club histories exclude results unavailable by the target deadline,
  even when gameweek schedules overlap. Archived deadlines missing from the
  database are approximated as 90 minutes before the first kickoff; results
  become usable no earlier than three hours after kickoff. These are conservative
  timing assumptions, not a complete archive of original deadlines/stat revisions.
- **Double-gameweek forecasts:** training used average fixture context while
  inference previously predicted each fixture separately. A nonlinear model
  need not give the same answer. Both now use the same averaged context, then
  multiply predicted points per fixture by the scheduled fixture count.
- **Playing-time labels:** 120 aggregate minutes cannot distinguish two
  60-minute appearances from 90 plus 30. Doubles no longer create false 60-minute
  labels or start-rate inputs. The auxiliary probability is reported for single
  fixtures only.
- **Training checks:** reject duplicate rows, invalid minutes/points and the old
  overwritten-double format before fitting. Preserve missing xG as unknown;
  2021-22 has no xG coverage. Previous-season priors cannot cross a missing season.
  An empty current season cannot silently turn last season into the current one.

The local database setting also pointed to stopped Docker while an existing
hosted connection was configured. The local `.env` now selects that working
hosted connection, and the default connection was verified without exposing
credentials.

## Evaluation method

Four fixed configurations were compared on **2024-25**, fitted on
**2021-22 through 2023-24**: the original regularized settings, fewer boosting
iterations, more leaves, and greater weight on recent seasons. The validation
winner was the model with fewer iterations. Parameter selection did not use
2025-26 or current-season targets.

The selected challenger was then tested on **2025-26**, fitted only on earlier
seasons, and on **2026-27 GW1–9**, refitting before each week using available
earlier observations. GW1 was missing from the previous current-season error
check and is now included. Ranking still requires prior minutes evidence,
so current ranking results cover GW4–9: six weeks and 120 selections.

If the challenger fails deployment checks, the original fixed production settings
are also evaluated using the repaired features and the same gate. This is an
explicit incumbent comparison, with no further parameter search or relaxed
thresholds based on the test/current results. Both comparisons are preserved.

Errors are reported across all players, separately for players averaging at
least 60 minutes in their previous five nonblank weeks, and by position. The
comparison is a last-five-gameweek points-per-fixture average; the naive estimate
is zero when no current-season history exists. Ranking compares five players
per position from the same eligible pool. Playing-time reports include Brier
scores and probability bins. Ranking intervals resample entire gameweeks so
correlated player outcomes stay together.

## Measured results and decision

The selected challenger improved points prediction error but failed the
current-season ranking check. The original fixed settings also failed that
same check. **The trained model remains inactive; recent form with minutes
and availability checks is the active ranking.** No gate threshold was lowered.

| Measure | Selected learned model | Simple benchmark |
| --- | ---: | ---: |
| 2025-26 mean absolute error, all players | 0.9781 | 1.0455 |
| 2025-26 mean absolute error, regular players | 2.2998 | 2.6651 |
| Current-season mean absolute error, all players | 1.1843 | 1.2850 |
| Current-season mean absolute error, regular players | 2.3836 | 2.8127 |
| 2025-26 top-pick return per selection | 4.367 | 3.866 |
| Current-season top-pick return per selection | 4.425 | 4.533 |
| 2025-26 playing-time Brier score | 0.07870 | 0.10095 |
| Current-season playing-time Brier score | 0.08553 | 0.10912 |

Errors and returns above are points per fixture. Lower errors and Brier scores
are better; higher ranking returns are better. Points errors use the previous
five nonblank gameweeks' average as the benchmark; ranking uses the existing
weighted form ranking, and playing-time probabilities use the observed prior
single-fixture 60-minute rate. These are different benchmarks for different
questions, not an accuracy percentage.

For the selected model, the held-out ranking lift was **+0.501 points per pick**
(weekly bootstrap interval **+0.214 to +0.758**). The current-season lift was
**−0.108** (interval **−0.742 to +0.358**). Regular-player absolute error was
about **15.3% below the simple average** in the current season, but this did
not translate into better recent top-five choices.

With the original fixed settings, held-out lift was **+0.512**, and current
lift was **−0.041**. The original settings also improved error measures but
did not meet the unchanged nonnegative current ranking requirement. The short
current intervals include zero: this is uncertainty, not proof that either
model is intrinsically worse. It is enough to withhold deployment under the
existing gate.

Saved the retrained candidate and both full evaluation reports locally. The
warehouse's run status was updated to `gate_passed=false`, and its previously
published forecasts were cleared through the normal gated publication path.
Confirmed that both local and published readers keep the fallback. A read-only
advisor run selected `baseline_with_minutes`, targeted GW11, included all 15
squad members and produced the four-week baseline. Forecast generation itself
was also checked for all 672 current players across six weeks: complete,
finite outputs and valid single-fixture playing-time probabilities.

Full artifacts: `data/models/learned-points.joblib` and
`data/models/learned-points-report.json`. Original artifacts, the pre-repair
warehouse snapshot, publication backup and audit evidence are retained under
`data/raw/model-audit/`; all these data/model paths are git-ignored.

## Operational checks

Published forecasts must match `learned-hgb-v3`, pass the evaluation gate, be no
more than two finished gameweeks behind, include no future training week, and
have been refreshed within 24 hours. Incomplete coverage and non-finite numbers
are rejected. A blank is an explicitly published zero; an absent prediction is
unknown and cannot silently become a blank. Both Python and the website enforce
these rules.

Daily refreshes can no longer be skipped indefinitely just because no gameweek
has finished. Artifact replacement is atomic, and reports record the input data
fingerprint, model settings, Python and scikit-learn versions. CI now installs
the ML dependencies, exercises training tests and runs Ruff. The training
workflow preserves complete model/report artifacts for 30 days.

Verification passed: **167 Python tests**, **60 JavaScript tests**, Ruff,
TypeScript, ESLint and the production Next.js build. One schema integration
test requires a dedicated isolated test database and was skipped locally.

Source and workflow changes remain local until committed and deployed. The
existing hosted workflow can still run its previous code until those changes
are deployed; a local model update does not update GitHub Actions or the website.

## Limits

This is a retrospective prediction/ranking evaluation, not a season strategy
simulation with budgets, transfers, captaincy, chips and autosubs. Six current
ranking weeks are a small sample. Previously inspected historical tests are
not a new independent future test, and the gate is a deployment policy rather
than proof that the model will win future gameweeks.

The archive supplies final fixture lists, not every historical schedule
announcement, price snapshot or injury report. Historical outcomes also span
changes in FPL scoring. Current availability is applied outside the model and
cannot be fully tested historically without archived news. Forecasts across
several future weeks freeze observed form and assume the current role/minutes
evidence continues; recovery dates and future rotation are not known.

The audit used the [FPL historical archive](https://github.com/vaastav/Fantasy-Premier-League),
[official FPL data](https://fantasy.premierleague.com/api/bootstrap-static/),
the [official scoring guidance](https://www.premierleague.com/en/news/2174909/),
the [2025-26 scoring changes](https://www.premierleague.com/en/news/4373187),
and scikit-learn's guidance on
[data leakage](https://scikit-learn.org/stable/common_pitfalls) and
[evaluation splits](https://scikit-learn.org/stable/modules/cross_validation.html).
