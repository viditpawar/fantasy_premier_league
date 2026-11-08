# GW10 squad review — 5 November 2026

**Update after the confirmed transfer:** João Pedro → N. Jackson is complete.
Keep Jackson and make no further transfer this week. The calculated bank is
£3.5m (£2.8m + £7.7m − £7.0m); the one free transfer has been used. The new
Pick Team screenshot confirms Jackson and the current XI, while the bank is
derived from the earlier confirmed values and current purchase price.

The refreshed advisor now uses that squad and zero remaining free transfers.
Its conservative XI matches the screenshot. Change the outfield bench order
to **Rúben, Cherki, Bijol**, with Kinsky as reserve goalkeeper: the screenshot
currently places Bijol ahead of Cherki.

**Mac Allister over Cherki is a low-confidence preference.** Mac played all 450
minutes in GW5–9, but scored only 12 points with 1.22 xG+xA; he has no season
league goal or assist. Cherki recorded 19 points and 1.57 xG+xA in 254 minutes,
but his latest three league appearances lasted 0, 45 and 35 minutes. Keep Mac
starting for a conservative choice unless credible final news supports Cherki
starting, in which case consider Cherki and move Mac to second outfield reserve.
Mac was already owned: this is a free starting-XI decision.

The raw GW10 index actually prefers Cherki, 3.1736 versus 2.4267. Their 0.7469
difference falls just inside the model's 0.75 margin for preferring regular
minutes. That policy is not a points forecast or a calibrated starting
probability. The model does not establish that Mac will outscore Cherki.
[City's official Leipzig team announcement](https://beta.mancity.com/news/mens/rb-leipzig-manchester-city-team-news-1-63929401)
confirms Cherki started on 4 November. That does not confirm the Forest XI or
justify declaring him permanently dropped. Both players are currently available
in the official FPL feed. No model thresholds were changed for this decision.

The updated state, prompt, context, reply and superseded saved advice are
preserved under the ignored `data/raw/gw10/post-jackson/` folder. The original
pre-transfer comparison follows as a dated record; its transfer suggestions
are no longer instructions to make another move.

## Original comparison before the transfer

**Recommendation: João Pedro → Evanilson for £6.4m, leaving £4.1m bank.**
Use one free transfer, take no hit and hold chips. Jackson is a close alternative
for a longer hold; Bijol → Van Hecke is the defensive alternative. These are
independent choices, not a three-transfer plan.

The deadline is **Friday 6 November, 11:30 a.m. America/Phoenix** (18:30 UTC).
This report records a dated decision; check fresh availability before acting.

## Confirmed inputs and method

The user's current Pick Team and Transfers screenshots establish all 15 players,
the lineup, £2.8m bank and individual selling prices. The user also confirmed one
remaining free transfer. These values match the local state file; its confirmation
source was updated to the supplied screenshots. Public FPL endpoints cannot
establish private current selling values or predeadline account changes.

The hosted warehouse was refreshed from official public FPL data on 5 November
at 18:55 UTC. The advisor used completed GW2–9 history, with GW5–9 used below
for a consistent five-week comparison. No incomplete gameweek entered form.
It considered 169 candidates and 724 legal single-transfer alternatives against
keeping and optimizing the squad across GW10–13. Individual player histories
independently reproduced the shortlisted forwards' minutes, points, xG and xA.

The experimental ranking remains disabled: over six evaluation weeks it returned
4.442 points per selection against the baseline's 4.533. This is a ranking
diagnostic, not a full transfer-strategy backtest. The active ranking uses observed
points with minutes, availability, fixture and bench safeguards. Its gains are
**index units, never expected points**. Underlying numbers inform the judgement
below without claiming that the inactive estimator has passed its gate.

## Transfer comparison

All recent statistics in this table cover completed GW5–9. xGI means xG + xA;
per-90 rates describe chances in minutes actually played, not future minutes.

| Incoming player | Price | Points | Minutes | xG | xA | xGI/90 | GW10 | Bank after selling Pedro |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| Evanilson | £6.4m | 36 | 419 | 2.89 | 0.50 | 0.73 | Ipswich away | £4.1m |
| N. Jackson | £7.0m | 39 | 438 | 1.92 | 0.30 | 0.46 | Man Utd away | £3.5m |
| Barry | £5.6m | 25 | 434 | 3.39 | 0.24 | 0.75 | Coventry home | £4.9m |
| Thiago | £7.8m | 27 | 450 | 1.65 | 1.13 | 0.56 | Brighton away | £2.7m |
| Isak | £9.2m | 28 | 324 | 1.56 | 0.20 | 0.49 | Palace away | £1.3m |

**Evanilson is my GW10 preference.** Pedro is officially injured, with 0% chance
and no confirmed return date. Evanilson adds a current starter and lets Rúben
become dependable cover. His 3.39 recent xGI exceeds Jackson's 2.22, with similar
minutes. His four season goals from 3.60 xG are less stretched than Jackson's
five from 2.16. Evanilson's last match lasted 75 minutes; a full match is not assured.
Bournemouth's next four are Ipswich away, Forest home, Fulham away and Brighton
home. Together with Tavernier, he would be the second Bournemouth player.

**Jackson wins the model's longer comparison.** Villa have Man Utd away, Sunderland
home, Ipswich away and Everton home, followed by Palace home and Coventry away.
His four-week optimized-XI gain is 24.813 index units against Evanilson's 19.920.
The immediate gains are almost tied: Evanilson 5.701, Jackson 5.573. Preferring
Evanilson for this week is a judgement based on underlying attack and fixtures,
not the model's highest four-week ranking or a proven points advantage. Ipswich
and Man Utd each conceded eight goals over GW5–9, so FPL's easier difficulty
rating for Ipswich does not independently establish a superior scoring chance.

Barry is a credible immediate punt with excellent underlying chances and Coventry
at home, but Brentford away and Liverpool home follow. Thiago has the harder
immediate fixture and four yellow cards. Isak is affordable, but the observed
recent evidence does not establish enough advantage to spend £2.8m more than
Evanilson.

**The defensive alternative is Bijol → Van Hecke, preserving Rúben.** Van Hecke
costs £5.0m, equal to Bijol's confirmed selling price, leaving £2.8m bank. He is
currently a Tottenham player, so Brighton's existing triple-up does not prevent
the move. He played 450 minutes for 35 points and 1.86 xGI in GW5–9; Bijol played
94 minutes for nine points. Spurs face Leeds away, Ipswich home, Sunderland away
and Fulham home. This option's four-week index gain is 26.226, and it wins the
model's bench-cover tie-break. Selling Rúben scores 26.666 but removes reliable
reserve cover. Van Hecke's 15-point GW9 haul deserves caution. I rank the move
behind a forward replacement because it retains the unavailable £7.7m Pedro.

Rolling is legal and would preserve flexibility through the international break,
but the current bench has no outfielder meeting the recent-minutes safeguard.
Replacing Pedro improves both the XI and cover, so I prefer using the free move.

## Every owned player

| Player | GW5–9 points | Minutes | xGI | GW10 | Decision |
| --- | ---: | ---: | ---: | --- | --- |
| Raya | 25 | 450 | 0.00 | Hull home | Start; six season clean sheets, 54 season points |
| Rúben | 11 | 450 | 0.56 | Forest away | Keep as first substitute after a forward move |
| Bogle | 14 | 421 | 0.87 | Spurs home | Start in the model's three-defender selection |
| De Cuyper | 37 | 408 | 1.20 | Brentford home | Start; retain despite shared Brighton exposure |
| Tarkowski | 25 | 450 | 0.09 | Coventry home | Start for fixture and minutes, not attacking volume |
| Tavernier | 26 | 400 | 2.56 | Ipswich away | Start; vice-captain |
| Neto | 28 | 431 | 1.72 | Sunderland away | Start; established recent minutes |
| Groß | 27 | 430 | 1.46 | Brentford home | Start; four yellow cards, currently eligible |
| Cherki | 19 | 254 | 1.57 | Forest away | Conditional start if credible news supports minutes |
| Haaland | 35 | 439 | 3.57 | Forest away | Start and captain |
| Kostoulas | 27 | 365 | 1.30 | Brentford home | Start; latest appearances 90 and 71 minutes |
| Kinsky | 22 | 450 | 0.00 | Leeds away | Reserve goalkeeper; 38 season points |
| Mac Allister | 12 | 450 | 1.22 | Palace away | Conservative model starter ahead of Cherki |
| Bijol | 9 | 94 | 0.02 | Spurs home | Last outfield substitute; uncertain minutes |
| João Pedro | 14 | 161 | 1.00 | Sunderland away | First sale; injured with no confirmed return date |

## Lineup and captaincy

After Pedro → Evanilson, use **3-4-3**:

- **GK:** Raya.
- **DEF:** De Cuyper, Tarkowski, Bogle.
- **MID:** Tavernier, Groß, Neto, Mac Allister.
- **FWD:** Evanilson, Kostoulas, Haaland **(C)**.
- **Outfield bench:** Rúben, Cherki, Bijol, in that order.
- **Reserve goalkeeper:** Kinsky. **Vice-captain:** Tavernier.

Jackson's alternative uses the same structure with Jackson replacing Evanilson.
For Bijol → Van Hecke, use 4-4-2 with Van Hecke, De Cuyper, Tarkowski and Bogle
in defence; the midfield stays the same, Kostoulas and Haaland start up front,
and the outfield bench is Rúben, Cherki, Pedro.

Mac Allister over Cherki is the closest free lineup decision. Mac Allister has
regular minutes but little attacking return; Cherki has more upside per minute,
but his last three weeks produced 0, 45 and 35 minutes. The model prefers regular
minutes. Consider Cherki instead if credible final news supports a start. Even a
brief cameo prevents an autosub; Rúben cannot automatically cover a low-minute
appearance. The conservative XI is a policy choice, not a calibrated forecast.

Haaland's recent 3.57 xGI in 439 minutes and first place in City's penalty order
support the armband. Tavernier has 2.56 xGI and recent appearances of 86 and 90
minutes. De Cuyper has the higher raw captain index, 7.548 versus 6.907, but only
1.20 recent xGI, with clean-sheet returns contributing heavily to form. I prefer
Haaland's attacking volume; price is not used as evidence.

Hold chips: a legal XI is available, the bench has injury/minutes problems and
there is no strong measured case here for Triple Captain. The screenshots do not
confirm the complete playable chip list; the old list was not silently reused.
One more Groß yellow would trigger the relevant five-yellow ban, but he is not
currently suspended. No paid hit is supported by this uncalibrated ranking.

## Saved website advice and checks

The reply and original saved advice are preserved under the ignored
`data/raw/gw10/` folder, alongside the context, prompt and source responses.
The standard advisor `--check` must pass before `--apply`. Saving writes only
the GW10 advice row in the configured hosted warehouse; it does not execute an
FPL transfer or change the user's official lineup. The existing dynamic Transfers
page reads that row without a frontend rebuild.

The advisor/model regression suite passed **131 tests**. Post-save verification
checks the public read-only data path, the current-advice status, all three legal
post-transfer XIs, bank values, distinct retained captains and every owned player.

Sources: [official FPL players and availability](https://fantasy.premierleague.com/api/bootstrap-static/),
[fixtures](https://fantasy.premierleague.com/api/fixtures/),
[Evanilson history](https://fantasy.premierleague.com/api/element-summary/79/),
[Jackson history](https://fantasy.premierleague.com/api/element-summary/166/),
[Van Hecke history](https://fantasy.premierleague.com/api/element-summary/112/),
[Barry history](https://fantasy.premierleague.com/api/element-summary/249/),
[Thiago history](https://fantasy.premierleague.com/api/element-summary/106/),
[Isak history](https://fantasy.premierleague.com/api/element-summary/379/).
