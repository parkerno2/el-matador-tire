# Review report, 10 Oct 2026: Q5, all-time manager stats, second pass (the preview branch at 1401894)

**Verdict: PASS, 0 findings.** The one finding of the 20:00 UTC review (`docs/runs/2026-10-10-review-q5.md`: a team
name cut in the manager sheet's Seasons table at 360 px) is fixed on the branch at 28e0e7c and holds on the live data
and the demo at 360 and 390 px. Every gate, the contrast audit, an independent recomputation of every figure on both
data sets, the Derbies agreement on all eight sheets and the screens pass. Parker approved the surface at about
19:58 UTC (recorded in ROADMAP), and the manager's message for this run allows the merge inside the GW6 live window,
so this pass merges exactly 1401894 into main. The merge and its proof are recorded in ROADMAP's Q5 entry.

## What was reviewed
The preview branch's six commits not on main (`git log main..origin/preview`): 7725298 "Preview: all-time manager stats
(Parker's Q5)", 1f9795b and 9fafe8a (main merged in), ecc3904 (the run report), 28e0e7c "Preview: a team name in the
sheet's Seasons table takes two lines, never a cut (the Q5 review finding)", 1401894 (the fix's run report). 23 files
against main, 722 insertions; the code: `src/alltime.js`, `src/pages/league/alltime.js`, `src/pages/league.js`,
`src/sheets/manager.js`, `src/css/45-alltime.css`, `src/css/02-components.css`, `tools/history.js`, `ci-build.sh`,
the preview and demo builds, the audit's walk, `tests/app-alltime.js`, `fplgg/tools/preview/check-alltime.js`.
The request: Parker, 10 Oct 2026, "We should also have all time stats for managers somewhere too", then "Where are the
historical stats?", then "Fix it" on the 360 px finding; the manager's Q5 item and the fire message of this run
("REVIEW. Run REVIEW MODE on origin/preview at 1401894 ... on a PASS merge exactly 1401894 into main with a normal
merge"). The builder's reports: `docs/runs/2026-10-10-q5-alltime.md`, `docs/runs/2026-10-10-q5-fix.md`.

## The gates, run on the preview branch (1401894) by the reviewer
- Every `tests/codegs/*.js` and `tests/*.js` suite by the gate's own loop: 47 suites, every one ALL PASS
  (`tests/codegs/test.js` exit 0), `tests/app-alltime.js` among them. `node --check` on a copy of Code.gs: ok.
  `ci-build.sh`: built, the six root files restored after.
- The contrast audit as the Preview workflow runs it (`build-demo.js --data site/public/demo/data`, then
  `fplgg/tools/contrast/audit.js`): CONTRAST OK, 0 offenders across 42 screens and 7,160 text boxes; League > All-time
  175 boxes, the sheet's All-time tab 162 boxes read on its own layer. The demo's leak check clean (31 files), the EA
  check clean.
- The branch's own browser half, `fplgg/tools/preview/check-alltime.js`: ALL PASS over 8 sheets at 360 and 390 px on
  the live data and on the demo ("The Soaring Gulls" and "Kobbie Mainoo Fan" on 2 lines in 102 px at 360 px, 1 line
  in 132 px at 390 px; "In It to McGinn It" 1 line at both).
- The published preview is this branch: `preview/build.json` on main reads `from 1401894`, the newest
  "preview: matchweek app from 1401894 (preview)" commit on main is 209568b, and its Preview Matchweek app run 14 is
  green (https://github.com/parkerno2/el-matador-tire/actions/runs/38083748830).
- A three-way merge test of main and 1401894 (`git merge-tree`): no conflict.

## The screens, looked at by the reviewer
Headless Chromium at 390 px and 360 px, on the live league data (a preview built from the branch into the session's
scratchpad) and on the demo snapshot. WebKit could not be installed on this network (the Playwright download fails, as
on every run since 10 Oct), so there is no WebKit screenshot; that is a gap of the environment, not of the change.
The reviewer's own walk (`walk.js` in the session's scratchpad, not committed) ran 168 checks per width per data set,
all passing on the live data and the demo at 390 and 360 px:
- League > All-time: eight rows, each manager once, in the order league points then points per match (Parker 43
  26-0-17 78 1.81 43.3, CJ 43 25-0-18 75 1.74 45.0, Ethan 43 21-1-21 64 1.49 41.7, PJ 43 20-0-23 60 1.40 42.8, Bryant 43
  19-0-24 57 1.33 41.9, Baha 43 17-2-24 53 1.23 38.7, Jacob 5 2-1-2 7 1.40 42.6, Nate 5 2-0-3 6 1.20 36.6), every figure
  equal to an independent recomputation in the page from the `HISTORY` global plus the 20 finished H2H Fixtures rows
  of 2026/27 (GW1 to GW5); "2 seasons" or "1 season" under each name, one trophy beside Parker's; every row opens the
  manager sheet; the Pts header lit by default.
- The record tiles against the same recomputation: 84 (Bryant, 2025/26 GW7 v Parker), 61-15 by 46 (CJ, 2025/26 GW31 v
  Bryant), the 7-match winning run (Parker, GW22 to GW28), the 8-match losing run (Baha, GW11 to GW18).
- The sorts: a tap on P, W-D-L, PPM or Avg sorts descending with the header lit and `aria-sort`, the sorted column lit
  on every row, a second tap flips it, no sideways scroll after; the order is kept in localStorage.
- Every manager's sheet, All-time tab (all eight, both data sets, both widths): his line equal to the recomputation
  (played, W-D-L, points, per match, for, against, a gameweek, won), the highest and lowest score, the biggest win and
  heaviest defeat with their margins, the runs, the all-play record, one Seasons row per season newest first with the
  points adding up to his total, every team name whole on at most two lines, every head-to-head row equal to SEED plus
  this season's finished meetings (the Derbies page's own sum) and to the recomputation from the fixtures, with the
  for and against; a head-to-head row opens that manager's sheet; the five tabs fit; no NaN, undefined or null; no em
  or en dash in the panel; no clipped text; the sheet and the page do not scroll sideways.
- League > Overview with the sixth pill: no sideways scroll (the pills row scrolls on its own, as before).
- 0 console errors on every walk.
- The screenshots in this folder (the live data unless named demo): `01` and `02` the table at 390 and 360 px, `03`
  sorted by PPM, `04` a manager sheet's All-time tab at 360 px, `05` and `06` the Seasons table at 360 px with
  "The Soaring Gulls" and "Kobbie Mainoo Fan" on two lines, `07` the demo's at 360 px ("Wirtz Case Scenario").

## Parker's notes, checked literally
1. The file exactly as given: `history/2025-26.json` is the same file main already carries (the 20:00 review checked
   it byte for byte, 5,564 bytes); `tools/history.js` re-runs the three checks on every build and `tests/app-alltime.js`
   proves a slip fails.
2. One model keyed by manager, never by team name: `src/alltime.js` keys by `ini`; EG's 2025/26 reads "Maize 'n' Mount"
   on his sheet under his current name; every listed figure is present.
3. Where: League > All-time (one table, sortable by P, W-D-L, Pts, PPM and Avg, the two new managers in with their
   one season) and the manager sheet's All-time tab (his line, the records, the finishes by season, his 2025/26 first
   pick and best player from `allstar`, head to head). Number-first; the captions are data states ("Finished gameweeks
   only.", "* so far, finished gameweeks only.") and the all-play line's order.
4. Tests: `tests/app-alltime.js`, 47 checks.
5. Built on the preview branch, reviewed twice, approved by Parker: yes.
6. The 20:00 finding: a team name in the Seasons table takes two lines and is never cut (the League table's rule),
   held by `tests/app-alltime.js` B6 and seen on both data sets at 360 px.

## Findings
None.

## Notes, not findings
- The sheet's header strip still joins its figures with en dashes ("W–D–L", "24–30") while the All-time panel reads
  hyphens: BUGS.md #43, Parker's call, unchanged.
- The all-play record reads W-L-T (the file's order) while the other records read W-D-L; the caption says so.
- `fplgg/tools/demo/build-demo.js` carries two comments on one line after the history require (cosmetic).
- Chromium only (WebKit unavailable on this network).

## Written by this review
- This report and its folder.
- The merge of 1401894 into main (a normal merge), with every gate run again on the merged tree before the push; the
  proof (the Code.gs tests and release and Build Matchweek app runs, the production build stamp) in ROADMAP's Q5 entry
  and BUGS.md's audit line.
