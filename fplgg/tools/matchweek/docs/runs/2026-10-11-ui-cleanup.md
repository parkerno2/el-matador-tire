# Run report, 11 Oct 2026: the UI cleanup (eight fixes, straight to the league)

A one-off job from the manager session, started 23:24 UTC. Parker reviewed every screen at phone size on 11 Oct and
said "All" to eight fixes; the patch was kept on the branch `parkerno2-patch-3` as `incoming/ui-cleanup.patch`
(Parker's commit 27b18c2, 23:18 UTC). Parker, in this session: "I'm explicitly asking you to approve it." On that
word the change went to main without a preview step, inside the GW6 live window (GW6 is unfinished until Monday's
COV v NEW). After this El Matador is frozen: fixes only; product work moves to parkerno2/matchweek-app.

## The request
The manager's job, quoted: "ship the UI cleanup straight to El Matador production (main), no preview step. After this,
El Matador is FROZEN: fixes only, nothing else." The patch "touches 22 files and adds tests/app-cleanup.js"; the
docs are "the test entry for tests/app-cleanup.js", the frozen line under the CLAUDE.md title and this report;
"Touch nothing else, and do not change Code.gs."

## The eight changes
1. **One top row.** The page title, then the state pill, search and your crest (`appbar` in `src/ui.js`,
   `02-components.css`). The Matchweek plate row and the title row were two rows, a fifth of the phone before any
   content. A hero page (My team's overview, the League overview) passes its hero as the body under the row; the
   row's title is then not the page's h1. My team's hero loses its "My team" kicker: the team name, then the manager
   with the Club button beside him (`team/head.js`, `30-team.css`). Matchday loses its gameweek aside; League's
   sub-pages carry the crest before the title.
2. **One live signal.** The state pill says it. No LIVE or FT on the League hero's progress, no blinking current
   week, no live tag on the table (`league.js`, `league/overview.js`), no live aside on the Results heading.
3. **Tabs that fit.** The switcher is one track whose segments share the width, the active one a purple pill inside
   it (`.pills`). My team's Fixtures is folded into Season, which opens with what is next; `#/team/fixtures` still
   lands there through the page's `alias` map, which `parse` in `src/main.js` follows before it checks the sub-page.
   Matchday's Premier League is PL, League's Overview is Table. The contrast audit and the gallery walk the five team
   tabs (`contrast/audit.js`, `gallery/gallery.js`; `tests/app-contrast.js` C1 and `tests/app-gallery.js` G2
   updated).
4. **The Squad numbers labelled.** The rating small in a box with OVR always under it (and the form arrow); the
   points big, marked pts (`team/squad.js`, `30-team.css`).
5. **Explainer copy gone.** All matchups' "Predicted until the deadline" (every card says PREDICTED); the Transfers
   how-to (the state and its times stay; the rules moved to How it works, `sheets/menu.js`); the Squad health aside;
   the Results footnotes.
6. **The Results grid whole at both ends.** `mountResults` measures the grid at the far end and pads the last column
   until a whole column sits against the team names, measured again after the fonts load; a position at the far end
   means "follow the latest weeks"; a fade off the names' edge hides a column scrolling under them
   (`league/results.js`, `40-league.css`).
7. **The Stats chart draws only the picked managers** (`league/chart.js`); the scale still spans every manager.
8. **The press prompt in the app's colours**: a neutral card, white text, a purple Press button (`feed.js`,
   `50-feed.css`). Lime stays Archizio's own, in his posts and his thread.

Files: 22 touched plus `tests/app-cleanup.js` (new, source checks for all eight), `CLAUDE.md` (the test entry, the
frozen line) and this report. Code.gs untouched.

## How it was verified
- The patch applied cleanly on main's head 3b32778 (`git apply`, 23 files, 185 insertions, 85 deletions).
- `npm ci && bash ci-build.sh`: built; the six root files restored afterwards (CI builds them).
- Every `tests/app-*.js` (24, `app-cleanup.js` among them), `tests/site.js`, `tests/monitor.js`, `tests/parity.js`,
  `tests/supabase.js`, `tests/worker.js`, `tests/status.js`, `tests/factsbot.js`: ALL PASS. Every
  `tests/codegs/v*.js` and `show.js`: ALL PASS; `tests/codegs/test.js` exit 0; `node --check` on a copy of Code.gs.
- The demo build (leak, EA and image checks clean), the contrast audit (0 offenders across 41 screens, 7,198 text
  boxes) and the gallery in Chromium (82 screenshots of 41 screens in two states, 0 findings) on the demo built from
  this tree.
- Screens looked at from that gallery at 390 px: Matchday overview (one top row, the pill the only live signal, five
  tabs in one track), My team overview (the hero under the row, the manager and Club button on one line), Squad
  (79 OVR in its box, 13 pts), Season (opens with Your clubs, next five), Transfers (the state line only), League
  Table (the hero, GW6 OF 38 without LIVE), Results (a whole GW3 column against the names, PF and PA whole, the fade),
  Stats (one picked line, no grey context), Feed.

## Proof of shipping
Filled in below once the workflow runs for the commit finished.
