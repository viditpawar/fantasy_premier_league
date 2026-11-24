# GW11 prediction and decision review

The entry scored 36 against a gameweek average of 35. All 11 starters appeared. Bench Boost added six points from Kinsky (7), Kostoulas (1), Rúben (2) and Tarkowski (−4). Captain Haaland and vice-captain Jackson both scored two. The Bijol-to-Gabriel transfer gained one point that week. The other named alternatives, Konsa and Van Hecke, scored one and six respectively. The transfer recommendation covered four weeks and only the first had finished at review time. [Official entry and chip](https://fantasy.premierleague.com/api/entry/6540506/event/11/picks/) · [Official player results](https://fantasy.premierleague.com/api/event/11/live/)

## What the forecasts got wrong

The pre-deadline advisor used the form-and-minutes fallback. Its captain order put Jackson first. The written advice overrode him with Haaland and cited the inactive learned model when comparing transfers. The fallback index has no points unit.

The separate learned forecasts are preserved in `data/raw/gw11/final/weekly-predictions.csv`. Joining those 672 availability-adjusted forecasts to the final results by FPL player ID gives the following errors in points. The warehouse matched the official minutes and points for all 674 players. Two players had no archived forecast and were excluded.

| GW11 players | Count | Model MAE | Five-week average MAE | Model RMSE | Five-week average RMSE |
| --- | ---: | ---: | ---: | ---: | ---: |
| All forecast players | 672 | 1.122 | 1.239 | 2.189 | 2.355 |
| Players averaging at least 60 minutes per fixture in GW6–10 | 162 | 2.412 | 2.710 | 3.190 | 3.481 |

The benchmark divides prior points by prior fixtures across the last five nonblank observations, using zero for missing history. For every archived GW11 player, all five or fewer observations fell in GW6–10. For the 15 selected players the model's MAE was 2.84. Applying the actual multipliers to the archived estimates gives 66.56 against 36 scored. That retrospective sum measures the miss on this particular squad. The top 20 forecasts across the league averaged 4.55 points and returned 4.40. The squad concentrated several misses, including Gabriel (4.53 forecast, 1 actual), Cherki (4.39, 1) and Haaland (6.00, 2).

## Bench Boost evidence

The chip check averaged minutes across two weeks and accepted players with just one observation. In the saved deadline context Cherki had played 90 and 35 minutes. That average triggered a claim that the whole post-transfer squad had recent 60-minute starts. Cherki played 20 minutes in GW11. Neto played 26 and Kostoulas 23 despite both reaching 60 in their previous two fixtures.

The revised check requires every member of the 15 to have an available status, a scheduled fixture and at least 60 minutes in each of their two most recent scheduled matches. It skips blanks and accepts aggregated doubles only when the total proves both appearances reached the threshold. Applied to the saved pre-deadline evidence, Cherki alone is sufficient to rule out the positive Bench Boost signal.

| Season | Reached 60 after the old minutes test | Reached 60 after the revised minutes test |
| --- | ---: | ---: |
| 2025–26 | 5,240 / 6,516 (80.4%) | 4,678 / 5,654 (82.7%) |
| 2026–27 through GW11 | 1,545 / 1,886 (81.9%) | 1,293 / 1,527 (84.7%) |

This comparison uses single-fixture targets so the outcome is observable. Both rules see the preceding eight weeks of deadline-available history, including blanks, doubles and short histories. The 2025–26 revised cohort includes 130 cases with a double in the two preceding observed gameweeks. Historical injury flags are unavailable, so these rates measure the minutes check alone. The value of saving Bench Boost for a future squad and gameweek remains unknown.

## Training and serving checks

The retraining experiment adds one candidate to the four existing configurations. It gives three times the weight to observations for players whose prior five-week average minutes reached 60. The minutes classifier retains the existing weights. The choice of configuration uses 2024–25. The holdout season is 2025–26, and each current-season prediction in the backtest uses only data available before that week's deadline.

The advisor now checks whether a newer weekly training run supersedes an older local or published model. It also checks the forecast map against the entire current player list before switching the squad to predicted-point units. This matters when new players join between publications. Training and inference now agree that a prior season separated by a missing year cannot supply player priors. Deadline lookups during historical feature preparation are computed once per gameweek.

## Deployment decision

The starter-weighted candidate earned +0.190 points per positional selection over the form benchmark on the validation season. The smoother configuration won validation at +0.372, then failed the current-season gate. The original regularized configuration passed all ten checks after retraining through GW11.

| Regularized model | Completed-season holdout | Current season through GW11 |
| --- | ---: | ---: |
| Mean absolute error, model / five-week average | 0.969 / 1.046 | 1.173 / 1.268 |
| Top-five-per-position lift over weighted form | +0.512 | +0.063 |
| 95% gameweek bootstrap interval for lift | +0.196 to +0.797 | −0.619 to +0.756 |
| Ranking weeks | 35 | 8 |

The local artifact and full report are under `data/models/`. The prior local artifact is backed up under `data/models/gw11-review/`. All 4,044 player-week forecasts, including their playing-time probabilities, matched the existing GW12–17 publication at its four-decimal precision. The local advisor loaded the validated model for GW12 with all 15 squad members. Its input order is preserved when experimental features are added.

## GW12 operational check on 24 November

The hosted ingest refreshed the warehouse at 21:25 UTC. All 674 player prices, availability flags and reported playing chances matched official FPL data. All 60 scheduled fixtures through GW17 matched on gameweek, participants, kickoff and difficulty. A fresh local calculation matched all published points and playing-time probabilities. The subsequent scheduled training check found an up-to-date GW11 fit and skipped redundant training. [Ingest run](https://github.com/viditpawar/fantasy_premier_league/actions/runs/45490836600) · [Training check](https://github.com/viditpawar/fantasy_premier_league/actions/runs/45490963221)

The local web lineup and gameweek pages rendered GW12 and the squad from the production build. The web planner now checks publication age against the latest officially finished gameweek and requires coverage of the player pool and squad before applying predicted points. The latest saved private squad confirmation and advice were both for GW11. GW12 research can use the locked public squad, while verified transfer affordability and chip advice require current My Team information.

The interval-based activation experiment would have approved the GW11-trained smoother candidate with a current lift of −0.075 and interval of −0.644 to +0.462. The existing point-estimate threshold rejects it. The upper confidence bound alone cannot establish non-inferiority. Incumbent comparisons now refit the original input columns even when a challenger uses additional features.
