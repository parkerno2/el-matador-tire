# Review report, 11 Oct 2026: go live with the preview (9bf827e) on the league

**Verdict: PASS.** Merged into main with a normal merge (`git merge --no-ff 9bf827e`), as the manager's item allowed inside the GW6 live window. The proof of shipping is at the end; nothing is called live above it until it was.

## The request
Parker, 11 Oct 2026, about 18:15 UTC: "Let's go all live." The approval covers everything on the `preview` branch that is not on main, three items:
- P1 part 2, the app polish (the three Q4 review findings, every explanatory subtitle removed, the one-time intro, the Feed's labelled reactions and voice line, 11 px text and pinch to zoom; the commits f393ab1 and 642e3af, the run report `2026-10-11-p1-app-polish.md`);
- Sheet images (d54efbd: a live refresh keeps every loaded picture, no filter on the Plate photos, the club code only for a missing badge; BUGS.md #49 to #51, the run report `2026-10-11-sheet-images.md`);
- Rating without a box (a89db62: no backing box behind the Plate rating, the four dark tiers shade the card's corner instead).
The manager's item for this run: a REVIEW MODE pass that ends in a merge; he and Parker allow the merge inside the GW6 live window.

## What was merged (git log main..9bf827e, 19 commits; 59 files outside preview/)
origin/preview's head was c628b6a (docs only after fd8da19). Main had moved since by two docs commits (5fc7c0b, the claim a6679c5), so main was merged into preview first as 9bf827e (the only change beyond c628b6a is the claim line in ROADMAP.md), the Preview run for it went green, and exactly 9bf827e is what was merged. The source changes: `src/intro.js`, `src/swap.js`, `src/main.js`, the stylesheets (`01-tokens`, `02-components`, `20-matchday`, `30-team`, `40-league`, `45-alltime`, `50-feed`, `55-show`, `57-articles`, `60-sheets`, `64-intro`), the pages and sheets that lost their subtitles (`menu.js`, `picker.js`, `identity.js`, `week.js`, `overview.js`, `money.js`, the Feed's `render.js` and `ai-posts.js`), `sheets/kit.js`, `sheets/player.js`, `sheets/search.js`, `index.template.html` (the viewport), the gallery `fplgg/tools/gallery/`, both workflows, `fplgg/tools/demo/build-demo.js` (the demo's article cards), `fplgg/tools/preview/check-images.js`; the tests `tests/app-gallery.js`, `tests/app-images.js`, `tests/app-polish.js` and the suites that follow them; DESIGN.md, CLAUDE.md, BUGS.md, ROADMAP.md and the run reports.

## The gates, on 9bf827e, 18:16 to 18:24 UTC
- Every suite by the CI pattern: 52 ran, every one ALL PASS (`tests/codegs/test.js` at exit 0; `app-polish.js`, `app-images.js`, `app-gallery.js` among them); `node --check` on a copy of Code.gs; `ci-build.sh` built (20261011181615) and the six root files restored, a clean tree.
- The demo built from the committed snapshot (`build-demo.js --data site/public/demo/data`: leak check clean on 31 files, EA check clean, image check clean, 8 allowed); the contrast audit as the Preview workflow runs it: `CONTRAST OK: 0 offenders in 0 groups across 42 screens, 7178 text boxes read`.
- `fplgg/tools/preview/check-images.js --stub-images`: ALL PASS (14 club circles right, the sheet's Plate decoded synchronously with no filter, no box behind the rating and the corner shade on a dark tier only, a refresh keeps 15 of 15 page pictures and 18 of 18 sheet pictures, no page error).
- The gallery in Chromium on the same build: `GALLERY OK: 84 screenshots of 42 screens, 2 states, 13266 texts read` at 390 px and `GALLERY OK: 84 screenshots of 42 screens, 2 states, 13257 texts read` at 360 px (0 findings at either width; the noted lines are the en dashes in figures, BUGS.md #43, and secondary lines that give way). WebKit is not installable in this environment; the Preview run proves that half.
- The published preview is this branch: Preview Matchweek app run 29 for 9bf827e, green, Chromium and WebKit at 390 and 360 px: https://github.com/parkerno2/el-matador-tire/actions/runs/38163067817, and the commit "preview: matchweek app from 9bf827e (preview)" on main is 2205d88.
- The source diff adds no em or en dash outside comments; no emoji; no secret.

## The screens, looked at myself
Every one of the 42 Chromium screens of the snapshot state at 390 px, one by one on contact sheets and the changed ones at full size; the before-kick-off state and the 360 px set as contact sheets; the intro's three screens taken with `?intro=1` on the built demo at 390 px (the scratchpad script also proved Skip and Done write `emt-intro`, the card is gone after Done, and the page had 0 errors).
- The intro: three cards at the bottom of the dimmed Matchday page, the wordmark and a kicker, one line each at 22 px ("Matchday shows your matchup, live." / "Pick your team from the menu." / "How it works lives in the menu."), three dots, Skip and Next on the first, Done on the last.
- The menu: Haaland Oates's card with "Following, not signed in" and the sign-in button, Switch team, How it works and Search as plain rows without subtitles, the Data card with "Updated just now" and Refresh now only, the footer line.
- The Matchup list at 390 and 360 px: "Donnarumma" whole on one line beside Raya, the meta line under each name.
- The Feed post sheet: the five reactions as tiles with their word under the icon (Fire, Funny, Clown, Watching, Bin it); the match board without the "Bars show..." footer; Share and All matchups.
- The player sheets: no box behind the rating on the gold card (Lammens 79) and the silver card (Meslier 72); on the blue card (O'Reilly 87) the figure sits on the corner shade with no visible edge; the status badge top left; the club circle under the Plate carries the badge without a code poking out.
- Feed > Articles in the demo: GW1 to GW3 recap cards and "Not published yet: GW5 recap and GW6 preview".
- No player twice in any team view, no NaN, undefined or null, no sideways scroll at either width, no em dash in prose, no EA asset (the demo's Ratings tab reads the house ratings), every sheet rendered in full.

## Observations, none blocking
- The search sheet's player rows cut their secondary line with an ellipsis when the status chip takes the room ("GKP · C..." for Sánchez at 390 px; at 360 px "MID · Crystal Palace" by 55 px). The line was `sub ell` on main before this change too, the gallery notes a secondary line that gives way and does not fail it, and the name itself is whole. Recorded as BUGS.md #52 for a later run.
- `src/main.js` carries the sheet lock's old comment after the intro import (cosmetic).
- Headless WebKit paints the translucent nav bar without its blur, as every earlier gallery noted; a phone blurs it.

## Proof of shipping
- The merge commit: 58ee52b "Merge the approved preview (9bf827e) into main: P1 part 2, sheet images, rating without a box", pushed to main at 18:27 UTC; the tree outside preview/ identical to 9bf827e (`git diff --stat 9bf827e 58ee52b -- . ':!preview'` empty), every suite ALL PASS on it once more before the push.
- Code.gs tests and release, run 51, green: https://github.com/parkerno2/el-matador-tire/actions/runs/38163862568
- Build Matchweek app, run 37, green (the gate, the contrast audit and the gallery in Chromium and WebKit on the demo just built, then the build commit): https://github.com/parkerno2/el-matador-tire/actions/runs/38163862540
- The build commit da6abd8 "build: matchweek app from 58ee52b" on main, with `app.js?v=20261011182716` in index.html.
- The league app, https://parkerno2.github.io/el-matador-tire/, fetched with a cache buster: build stamp `app.js?v=20261011182716` from 18:37 UTC (18:36 still served 20261011143249). The live `app.js` carries the intro's key, the picture-keeping redraw and the "Bin it" label and none of the removed subtitles; `index.html`'s viewport is `width=device-width,initial-scale=1,viewport-fit=cover`; `app.css` has no rating backing rule.
- Then this report, ROADMAP.md (the three items moved from preview to live, the claims removed) and BUGS.md (#52, the audit line) in the docs commit after it.
