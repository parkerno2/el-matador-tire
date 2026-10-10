# Review report, 10 Oct 2026: the approved preview (30f189e) to the league

**Verdict: PASS.** Merged into main with a normal merge (`git merge --no-ff 30f189e`), as the manager's message allowed inside the GW6 live window.

## The request
Parker, 10 Oct 2026, about 18:57 UTC, after seeing the manager's screenshots of the preview built from 30f189e: "Yep, looks good to me". The manager's item for this run: "Merge exactly commit 30f189e into main with a normal merge. Do not merge whatever origin/preview points to later. Run every gate on the merged main first."

## What the merge brings (git log main..30f189e, 20 commits, 56 files)
- The UI pass (`1049058`): subs and availability as one badge per card, the Matchup page without its legend and switch, the player sheet's order, form colours and folds, the copy pass (48 captions removed).
- The stats surfaces in high contrast (`ce28a49`) and the whole-app contrast pass (`51aa288`, `c308186`): `docs/DESIGN.md`, the tokens, the Plate's text block, the audit `fplgg/tools/contrast/audit.js` wired into the Preview and Build workflows.
- Q6 (`71993c3`): the League Overview table with the columns #, crest, Team, W-D-L, PF, Pts, Title and no prize amounts; the Manager of the Month race led by the month's real points, the projection the small figure, updating on every live refresh.
- The audit fix (`bb3fec9`): the sheets read by the audit, the Plate rating's backing box, the initials and the crest circle, and the Did not play rule (FT, the red "!" badge, the List chip, the Bench note).
- Tests new on main: `tests/app-contrast.js`, `tests/app-ui.js`, `tests/app-overview.js`; the browser checks `fplgg/tools/preview/check-headless.js` and `check-overview.js`.

## The gates, on the merged main, before the push
- Every `tests/codegs/*.js` and `tests/*.js` suite: ALL PASS (21 Code.gs suites with `test.js` at exit 0, 23 app and tool suites), `node --check` on a copy of Code.gs, `ci-build.sh` (the six root files restored after).
- The contrast audit as the Preview workflow runs it (the demo built from the committed snapshot, `fplgg/tools/contrast/audit.js --dir`): CONTRAST OK, 0 offenders across 40 screens and 6,870 text boxes read, every sheet read.
- The published preview was this commit: the newest "preview: matchweek app from 30f189e" commit on main (3341cbf) names origin/preview's head, and its Preview Matchweek app run 9 is green: https://github.com/parkerno2/el-matador-tire/actions/runs/38075740798.

## The screens, looked at myself (the merged build on the demo snapshot, Chromium at 390 px, 0 page errors, no horizontal overflow)
- League > Overview: the table reads #, crest, Team, W-D-L, PF, Pts, Title; no prize amount, no prize band; the form dots and the first name (or You) under the team name; a two-line team name whole ("Wirtz Case Scenario").
- League > Overview, scrolled: the Manager of the Month race headed "Points LIVE", the month's points the big figure, the projection the small figure under it, the win chance, the marker on the bar; no $30 tag.
- Matchday > Matchup: the pitch starts under the Formation, List, Stats, History tabs; the xP pill in the team bar; no legend; one line under a card (the kick-off).
- The manager sheet: the header, the four figures, the form chips in green, grey and red, the week's matchup, the Lineup with the small Plates (rating and position on their backing boxes).

## Observations, none blocking (as approved)
- The manager sheet's figures use typographic dashes inside numbers ("W–D–L", "14–29", "46.2–48.1", "5–2"); the League table uses hyphens ("3-1-1"). This predates the change and Parker approved the screens; DESIGN.md's dash rule is written for generated text. Worth one decision from Parker on whether UI scores should use the hyphen everywhere (noted in BUGS.md).

## Proof of shipping
The "Code.gs tests and release" and "Build Matchweek app" runs for the merge push, and the production build stamp, are added to this report by the docs commit that follows the green runs.
