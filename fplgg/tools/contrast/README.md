# The contrast audit

Parker, 10 Oct 2026: "I think we need to do a contrast pass on the entire app to make sure that it's following the
rules that we've outlined." The rules are `fplgg/tools/matchweek/docs/DESIGN.md`. This folder enforces them, not by eye.

| File | What |
|---|---|
| `audit.js` | Opens the built demo league (the current app on the frozen, anonymised snapshot) in headless Chromium at 390 px, with the page's clock fixed at the snapshot's own time, walks every page and sub-tab (Matchday's overview, every matchup with its Formation, List, Stats and History tabs, All matchups, Premier League, Week; My team's six pages with the Lineup as pitch and list; the League's five pages; the Feed's four tabs) and opens the sheets (a player who is owned, a free agent, a doubt, with the Matches and Ratings tabs; a manager with Season and Squad; the menu and How it works; search; club identity; a Feed post). On every screen, scrolled a viewport at a time, it collects every visible text box, makes the text transparent, photographs the viewport and reads the pixels under each box (the darkest, the lightest and the median, at the 2nd, 98th and 50th percentile), so gradients, photos, hairlines, scrims, overlapping layers and opacity are all accounted for. A text box is clipped to its clipping ancestors (an ellipsised run's hidden tail is not read) and away from fixed and sticky bars it does not belong to; the top and bottom 15% of a line box (the leading) are left out. A number (the numeric font, class `n`, or numeric text) needs 7:1 against both the darkest and the lightest pixel, other text 4.5:1, display type of 24 px and up 3:1; outlined display type (a `-webkit-text-stroke` of 1 px or more in another colour) is read fill against outline. A number is never on purple and never purple (the Plate tiers' art excepted). It also checks that the matchup team bars and the My team header carry the manager's name under the team name, and that an owned player's sheet shows his owner, not "Free agent". Exits 1 with the list of offenders (screen, selector, text, colours, ratio, rule). |
| `lib.js` | The pure rules: colour parsing, WCAG luminance and contrast, compositing, the purple test, which rule a text falls under, a reading and its verdict, the grouping of offenders. Unit-tested in `tests/app-contrast.js`. |

## Run it locally

A demo build is needed. Build one from the committed snapshot (no Sheet read) into the scratch folder, then audit it:

    cd fplgg/tools/matchweek && npm ci && cd -
    node fplgg/tools/demo/build-demo.js --data site/public/demo/data --out /tmp/mw-demo/demo
    NODE_PATH=/opt/node22/lib/node_modules node fplgg/tools/contrast/audit.js --dir /tmp/mw-demo --shots /tmp/mw-shots --crops /tmp/mw-crops --report /tmp/mw-report.json

Playwright with Chromium is needed (`NODE_PATH=/opt/node22/lib/node_modules` in the builder's environment; in CI the
Facts bot's `fplgg/tools/factsbot/package.json` installs it). About a minute for the 40 screens.

- `--shots DIR` writes one screenshot per screen, `--crops DIR` a close-up of each offending text (one per selector and
  colour, the first 80), `--report FILE` the JSON of every offender with its rect, `--list N` caps the printed groups.
- `--at ISO` fixes the page's clock elsewhere than the snapshot's time (the state of the gameweek follows the data, so
  a time before the deadline shows the pre-kick-off screens, the snapshot's own time what it caught).
- `--only sheets` skips the pages (for a quick look at the sheets); `MWA_DEBUG=1` logs every step.

## In CI

- `.github/workflows/preview.yml`: after the gate, the demo is built from the preview branch's source on the committed
  snapshot and audited before the preview is published; an offender makes the run red and nothing is published.
- `.github/workflows/matchweek.yml`: after the league build and the demo build, the fresh demo is audited before the
  commit; an offender makes the run red and nothing is committed.

The Gameweek Show's screens need a voiced show, which the demo does not carry, so `tests/app-contrast.js` checks the
show's stylesheet colours against its stage instead.
