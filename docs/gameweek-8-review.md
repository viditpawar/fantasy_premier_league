# Gameweek 8 review — 25 October 2026

## What the saved advice got wrong

The saved GW8 reply treated an 11.2-point difference in a ranking index as
evidence that Rúben to Van Hecke would repay a four-point hit. That index was
not an expected-points forecast. It also suggested Van Hecke while De Cuyper,
Groß and Kostoulas were already owned, violating the Brighton club limit.
The repository already rejected these two classes of invalid advice before
this follow-up; the saved GW8 row predates that validation.

That reply also used price-based captain defaults and described a 50% player
as unavailable. Those are unsupported shortcuts. Current availability and
captain eligibility checks remain enforced, with a new minutes shortlist.

At the first read-only audit, the warehouse showed 26 GW8 points, a 27-point
average and nine bench points. **GW8 was unfinished.** These are intermediate
scores, not final results. Kinsky's nine points versus Raya's seven identify
a realized goalkeeper difference, not proof that Kinsky was the correct
predeadline choice. Current injury news must not be substituted for historical
predeadline knowledge when judging the earlier recommendation.

## Changes

- A legal XI is optimized for each of the next four gameweeks. Every transfer
  is compared with keeping and optimizing the current squad, including bench
  cover. Improving an unused bench player's score alone is insufficient.
- Eligible single-transfer alternatives must gain at least 1.5 index units
  across the horizon and 0.25 in the target week. These are explicit policy
  thresholds, not predicted points or a basis for taking a hit.
- Candidates need at least three observed fixtures and an average of 60
  minutes per fixture in their latest two nonblank gameweeks. Missing history
  stays unknown; a single missed match does not prove permanent absence.
- The starting XI, ordered outfield bench and reserve goalkeeper are supplied
  in the context and saved evidence. Captains must be retained starters in
  that XI; when enough reliable choices exist, low-minute options are excluded.
- Unknown or more than six-hour-old warehouse data prevents saving advice.
  The website checks both warehouse freshness and the 24-hour squad snapshot,
  and marks advice from the previous model for review.
- Live ingestion preserves xG/xA when supplied, and records fixture counts.
  Historical ingestion now sums both matches in a double instead of letting
  the second upsert overwrite the first. Price and ownership remain snapshots;
  they are not summed. Doubles no longer masquerade as one opponent or venue.
- New regressions cover these decisions, plus a read-only `--evaluate`
  command. Browser QA artifacts are excluded from lint; the existing portal
  mount check now uses React's hydration snapshot instead of setting state
  directly in an effect.

## Experimental ranking and measured results

The experimental ranking blends observed attacking returns with xG/xA where
available, caps isolated hauls, shrinks small samples toward a positional
prior, and adjusts for recent minutes and current availability. Missing xG is
not treated as zero. Coefficients are policy choices, not fitted parameters.

A walk-forward check used 4,551 completed player-gameweek rows from GW1–7.
Official event API xG/xA was matched to warehouse rows only when both points
and minutes agreed (all 4,551 matched). Each target week used only earlier
results, with the same eligible candidate pool for both rankings. The top
five players per position were compared using actual points per fixture.
No live prices, ownership, injuries or news entered the historical rankings.

| Evaluation week | Experimental return per selection | Baseline return per selection |
| --- | ---: | ---: |
| GW4 | 4.95 | 5.25 |
| GW5 | 4.90 | 5.30 |
| GW6 | 3.75 | 3.15 |
| GW7 | 4.85 | 5.50 |
| All 80 selections | 4.6125 | 4.8000 |

**The experimental ranking did not outperform the baseline.** No parameters
were retuned to these results. It stays inactive unless at least six evaluation
weeks are available and its mean return exceeds the baseline by at least 0.15.
This activation gate is a monitoring policy, not statistical significance or
proof of transfer profitability. Observed form with double normalization,
minutes and availability safeguards remains the fallback. The lineup and
transfer-decision protections operate regardless of the selected ranking.

This diagnostic evaluates rankings; it does not simulate purchase/sale prices,
banked free transfers, autosubs or chips across a season. It is not a full
strategy backtest and cannot establish calibrated expected points. The
four-week comparison assumes the supplied minutes/availability evidence
continues; it cannot forecast recovery dates or rotation announcements.

## Verification and operation

`python -m pytest -q`, `ruff check`, `npm test`, TypeScript, ESLint and the
production Next.js build are the verification commands. A separate isolated
Postgres URL is required for the destructive schema-permission integration
test; it remains skipped when that test database is unavailable.

The default local DSN points at stopped Docker Postgres. The separately
configured Supabase session pooler is reachable. Verification can select it
for the current process without editing `.env` or silently falling back to
another database. Public read-only FPL/Supabase queries supplied the audit;
no FPL transfers were executed.

The three additive warehouse columns were applied through that configured
pooler, then the normal public-data ingest completed successfully. A read-only
end-to-end advisor run confirmed fresh data, GW9 targeting, the inactive
experimental model and a valid 4-3-3 research XI. It correctly rejected the
expired current-state file. A fresh research prompt is saved locally at
`data/raw/advisor-research-prompt.txt`; the original state, prompt and reply
were preserved. No replacement advice was saved against an unconfirmed squad.

Final checks passed: 122 Python tests, 37 JavaScript tests, Ruff, TypeScript,
ESLint and the production build. One isolated Postgres test was skipped.
Headless Chrome checked overview and advisor pages at 1440px and 390px with
live read-only data. Legacy advice showed its review notice and unknown
transfer allowance; neither page had overflow or browser runtime errors.
Frontend source changes remain local until deployed through the normal flow.

The saved current-state confirmation is from 24 October at 07:00 UTC and is
older than the allowed 24 hours. It must be confirmed again from My Team;
changing its timestamp alone does not establish the current squad or funds.
Generate fresh advice after confirming it. Old prompts and replies are not
reused under the new context fingerprint.

FPL source references: [official scoring and transfer FAQ](https://fantasy.premierleague.com/help/faqs),
[official live event data](https://fantasy.premierleague.com/api/event/7/live/).

## Follow-up: complete squad and bench review

The original comparison included all 15 players, but its structured evidence
only contained the lineup before a transfer. It also ranked substitutes by
their score without explicitly inspecting usable cover. Those gaps are now
fixed in `minutes-fixtures-v3`:

- Each independent transfer supplies its own legal XI, formation, ordered
  outfield bench and separate reserve goalkeeper. Validation accounts for all
  15 players exactly once and ensures both captains start after every option.
- Candidate truncation happens after full-squad comparison. The refreshed GW9
  run assessed 146 eligible candidates and 609 legal independent alternatives.
- A lineup within 0.75 index units of the maximum can prefer more players with
  established minutes. Transfers within the existing material-gain threshold
  of 1.5 index units can prefer usable bench cover and a more reliable XI.
  These are explicit risk policies, not fitted probabilities or points costs.
- Known full-gameweek minutes are resolved under the goalkeeper, outfield
  formation and bench-priority rules. Any minutes prevent automatic
  substitution, including a cameo in the second match of a double.
- Every lineup has a single-absence cover check using available reserves with
  established minutes. This is a stress scenario, not an appearance forecast.
- Bench Boost checks minutes for all 15 players. Ready substitutes cannot
  conceal a nominal starter who is not playing.
- The advisor page source shows the primary post-transfer XI with separate
  comparison panels for keeping the squad and choosing each alternative.

The saved GW9 primary changed from **Mac Allister to Manzambi** to **Cherki to
Manzambi**. Both have the same revised four-week index gain. Selling Cherki
starts Stach and retains Mac Allister as a first substitute with established
minutes; selling Mac Allister leaves Cherki, doubtful João Pedro and low-minute
Bijol as the outfield reserves. Cherki to Manzambi leaves GBP 5.2m in the bank.
This remains provisional while GW8 is unfinished and Manzambi's recent starting
sample is short. The experimental estimator remains inactive.

Updated regression results: 139 Python tests and 39 JavaScript tests pass;
one isolated Postgres test is skipped. The web checks cover the post-transfer
display regression and legacy fallback. TypeScript, lint and production build
pass. Advice was validated through `--check` and saved through `--apply` to the
hosted warehouse. Interface changes still require normal deployment.

The revised local advisor and overview also passed headless Chrome checks at
1440px and 390px. The primary panel displayed Cherki to Manzambi, Stach and
Kostoulas in the XI, Mac Allister first on the outfield bench, Kinsky separately
as reserve goalkeeper, and three expandable lineup comparisons. There was no
horizontal overflow or browser runtime error.
