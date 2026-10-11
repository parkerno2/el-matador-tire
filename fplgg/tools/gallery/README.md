# The gallery and the invariant checks

Parker, 10 Oct 2026 (Q4): "the scheduled agents seem sloppy, we need a better way to oversee them." Twice that day a run
called a preview published while its workflow was red, and screens were shown that were not the work. This folder is
the gate the runs cannot skip: every screen photographed in two browsers before anything is published, and the review
invariants checked on every one of them by a machine, with a readable list when one fails.

| File | What |
|---|---|
| `gallery.js` | Opens the built demo league (the current app on the frozen, anonymised snapshot) at 390 px in headless Chromium and WebKit, in two states where the data allows (before kick-off: the page's clock 2 hours before the gameweek's deadline; at the snapshot's own time: live or full time), walks the same screens as the contrast audit (every page and sub-tab, every matchup, the player, manager, menu, How it works, search, club identity and Feed post sheets), photographs each one and checks it. Writes `OUT/<state>/<browser>/NN-screen.jpg`, `OUT/index.html` and `OUT/report.json`, prints the findings and exits 1 when there is one. |
| `lib.js` | The pure rules: the words that mean a value was never computed, the dash rule, the duplicate rule for a team view, the readable list, the index page. Unit-tested in `tests/app-gallery.js`. |

## The checks, screen by screen

| Check | What fails | What is noted, not failed |
|---|---|---|
| A player twice in one team view | The same player code on two of the Matchup pitch, list and bench, My team > Lineup's pitch, bench and list, the manager sheet's pitch and bench (BUGS.md #37: Tzolis in the XI and on the bench at once). | The highlight strips (the Matchup's decisive players, the manager sheet's top scorer) may repeat a player. |
| NaN, undefined, null | Any of the three as a whole word in visible text. | |
| Horizontal overflow | The page wider than the viewport, or an open sheet's content wider than the sheet. | |
| Clipped text | A text wider than its box while the box hides its overflow (an ellipsis, a line clamp or a plain cut) on a primary line: a name, a team, a figure. Parker's rule for the League table (Q6) is that a team name may take two lines and is never cut, and a player's name is read the same way. | A secondary line (class `sub`, the meta line under a name) gives way to the name by design. |
| Console errors | Any console error or page error during the walk. A photo, crest or flag host unreachable from the runner's network is reported as a note, not a finding. | |
| A word broken across lines | An element whose own text is one word (no space; a hyphen is a place a word may break) drawn on more than one line: a surname split in two ("Donnarumm" / "a", the Q4 review of 11 Oct 2026). A word is kept whole with `overflow-wrap: normal; word-break: keep-all` and given room or a smaller size. | |
| EA assets | Any request for `faces/`, `fc27` or `ea-map` (the demo carries none; Parker, 9 Oct 2026). | |
| Em and en dashes | An em dash anywhere, or an en dash in prose (a word on either side of it) in UI text. | An en dash inside a figure (`14–29`, `W–D–L`, `37.8 – 45.2`, a minus, the blank value) is BUGS.md #43 and waits for Parker's word. |
| A screen that did not render | A page with fewer than five pieces of text, a sheet that shows no text or does not open, the walk stopping. | |

The contrast rules are the contrast audit's business (`fplgg/tools/contrast/audit.js`), which runs beside the gallery
in both workflows and is not repeated here.

## Run it locally

A demo build is needed (from the committed snapshot, no Sheet read):

    cd fplgg/tools/matchweek && npm ci && cd -
    node fplgg/tools/demo/build-demo.js --data site/public/demo/data --out /tmp/mw-demo/demo
    NODE_PATH=/opt/node22/lib/node_modules node fplgg/tools/gallery/gallery.js --dir /tmp/mw-demo --out /tmp/mw-gallery --browsers chromium

- `--browsers chromium,webkit` (the default is both; the builder's environment has Chromium only, so WebKit is proven by
  the workflow run), `--states pre,snap`, `--width 390` (the workflows run 390 and then 360 into `shots/360/`; `--alt
  <path>` puts a link to the other width on the index page), `--quality 70` (the JPEG quality), `--only sheets`, `MWG_DEBUG=1` logs every step.
- About 90 seconds per browser for the 42 screens in two states; 84 screenshots of about 1.7 MB per browser and state.

## In CI

- `.github/workflows/preview.yml`: after the gate and the contrast audit, on the branch's app over the committed
  snapshot, into the preview's `shots/` (390 px) and `shots/360/` (360 px), which the publish step commits with the preview, so
  https://parkerno2.github.io/el-matador-tire/preview/shots/ shows every screen of the published preview on one page
  (the browsers side by side, the findings on top). A finding makes the run red and nothing is published; the gallery is
  the run's artifact `gallery` either way, so a red run still shows its screens.
- `.github/workflows/matchweek.yml`: after the league build, the demo build and the contrast audit, on the fresh demo, at
  390 and 360 px;
  a finding makes the run red and nothing is committed; the gallery is the run's artifact `gallery`.
