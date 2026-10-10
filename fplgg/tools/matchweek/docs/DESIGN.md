# Matchweek design rules (Parker, 10 Oct 2026)

The rules every screen follows, written down once so a session never has to guess. They bind every page, sheet,
card and Feed post, on the league app, the preview and the demo alike. The tokens are in
`fplgg/tools/matchweek/src/css/01-tokens.css`; the audit that enforces the contrast rules is
`fplgg/tools/contrast/audit.js` (its README says how to run it), and `tests/app-contrast.js` checks the tokens and the
stylesheets without a browser.

## 1. Contrast: stats and numbers are clear at a glance

Measured as WCAG contrast of the text colour against what is painted behind it, after compositing (opacity, a
gradient, a photo, a hairline, a scrim, a layer on top). Text over a photo or a gradient is measured against both the
darkest and the lightest part behind it, and the lower ratio counts.

| What | At least | Why |
|---|---|---|
| A number or a stat: the numeric font (class `n`) or numeric text (`4.4`, `66-40`, `12′`, `3rd`, `55%`) | 7:1 | Read at a glance, at any size |
| Every other piece of text | 4.5:1 | |
| Display type, 24 px and up, that is not a number | 3:1 | A headline, a page title |
| Outlined display type (a `-webkit-text-stroke` of 1 px or more in another colour, the Feed's tabloid cards) | the fill against its outline, by the rule above | The glyph sits on its own outline |

- Text on the Plate cards counts too, on every tier (gold, silver, blue, cyan Elite, Team of the Week, Player of the
  Month): the rating and position sit on a backing box, the projection bubble is solid, the arrows, the position and
  the initials take a colour per tier (`02-components.css`, the Plate's text block).
- A dimmed row dims its picture, never its words: the words take a quieter colour that still passes
  (`--tx3`, `--tx4`, `--num2`), because opacity on text fails every rule.
- The quiet number is `--num2` (#C4BBD2): 7:1 on every surface up to `--top`. The quiet label is `--tx3` (#A398B2):
  4.5:1 on the same surfaces. A number set inside a quiet label (`.sub .n`, `.k .n`, the gameweek of a row, a record
  under a name) reads `--num2`.
- The status colours read 7:1 as a figure on every surface up to `--top` and take dark figures (`--base`) as a fill, so
  a coloured number and a chip pass alike: `--win` #40D085, `--doubt` #F5B942, `--loss` #FF9598, `--live` #19D27A.
  White on red reads 3.3:1, so nothing is white on `--loss`.
- `--you` and `--b300` are #9AB0FF: 7:1 on `--top` and on the highlighted "you" rows.
- The compact Matchweek wordmark line in the app bar reads `--tx2`, because the team-colour headers behind it vary.

## 2. Purple is the accent, not a surface for stats

- Purple (`--p900` to `--p100`) is for tabs, buttons and active states only: the active pill, the primary button, the
  active nav icon, a focus ring.
- Never the background behind a number, and never the colour of a number. Stats sit on dark neutral cards
  (`--card`, `--raised`, `--top`, the stats scope's `--st-*` in `65-stats.css`). The Feed's match bubbles, the article
  kicker, the Week grid's heat and the League hero use the dark tints or the brand blue (`--b700`, `--b500`) instead.
- A count on an active tab sits on a white badge with dark figures (`.pills .on .ct`).
- The Plate tiers' own art (gold, silver, blue, cyan, purple) is the look to keep; the audit measures the Plate's text
  for contrast and exempts the tier art from the purple rule.

## 3. Status colours are green, amber and red, and nothing else means status

- Green (`--win`, `--live`): on, confirmed, live, a good run. Amber (`--doubt`): likely, doubtful, a middling run.
  Red (`--loss`): out, off, injured, a poor run.
- The card tiers' colours (gold, silver, blue, cyan, purple) are never used for status, and the status colours are
  never used as tiers.
- One status badge per card, top left (`UI.plateStatus`, `statusBadge`): a dark glyph (`--base`) on the status colour,
  no tag, frame or swap icon. List views carry one text chip in the same three colours.

## 4. Copy

- No explanatory captions for obvious things (the copy pass of 10 Oct 2026): labels that name things, data states and
  empty states stay; the methodology lives in Menu, How it works.
- No emoji in the UI. No em or en dashes in generated text.

## Checking a change

- `node tests/app-contrast.js`: the tokens' pairs, the stats scope, the Plate's text block, the Gameweek Show's
  stylesheet colours, this file's token names. In the CI gate.
- `node fplgg/tools/contrast/audit.js`: every page, sub-tab and sheet of the built demo in headless Chromium at 390 px,
  every visible text box read against the pixels behind it (see `fplgg/tools/contrast/README.md`). Runs in CI on the
  preview build and the league build, and fails the run on any offender.
