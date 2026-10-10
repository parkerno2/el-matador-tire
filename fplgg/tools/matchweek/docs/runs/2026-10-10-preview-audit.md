# Run report, 10 Oct 2026: the preview audit's sheet hole, the contrast offenders, the "Did not play" line (preview)

Builder run started 18:03 UTC on the manager's item. Built on the `preview` branch, published by the Preview Matchweek
app workflow to https://parkerno2.github.io/el-matador-tire/preview/ (the run's URL and conclusion are in the summary
and in BUGS.md's audit line). Production is untouched (GW6 live).

## The request

The manager, 10 Oct, with the run:

> "the Preview workflow is red, so neither the contrast pass nor Q6 has been published. [...] Preview run #5 (2cdd089)
> failed with exit code 1. Run #6 (71993c3, Q6) will fail the same way. [...] I reproduced it on origin/preview at
> 71993c3. Every suite passes and ci-build and build-demo succeed. fplgg/tools/contrast/audit.js then exits 1 with
> "CONTRAST FAIL: 6 offenders in 3 groups": feed foryou and feed league: div.fp-h div.fp-who span.fp-nm "Clark
> Moldridge", #FFFFFF on #0E0A13..#FFD60A, 1.4:1. The voice name sits on Clark's yellow gradient. Fix the design so the
> name reads at 4.5:1 or better wherever the gradient falls. Do not tune the audit to pass it. team overview:
> span.tm-xif span.fc-i.done span.ini "C", #655E6F on #221B2A, 2.7:1, x4, at 5.04 px. These are the initials fallback
> in the small face circles. They show whenever a photo fails to load, so give them real contrast too. There is also a
> hole in the audit. It reads "0 text boxes" on every sheet [...]. Make the audit read the open sheet's text (wait for
> the slide-in to finish, then scope to the sheet layer). Then fix whatever it finds there. [...] One more finding [...]:
> on the Matchup pitch, Tzolis and Brobbey show "Did not play" under their cards. Parker's rule is that the line under a
> card shows only the kick-off time, the minute or FT. Show FT, put a red "!" badge on the card, and move the "did not
> play" wording to the aria-label and the Bench card."

## What I found first

- Preview runs #5 and #6 were red at the publish step, not the audit: "the preview build touched other files, refusing
  to commit", the audit's Playwright install left untracked under `fplgg/tools/factsbot/node_modules` once the step had
  checked out main (BUGS.md #39, fixed on main at d662684 by the Q6 run with a root `.gitignore`). Run #7 (43f44e1,
  18:00 UTC) was green and published "preview: matchweek app from 43f44e1" (4291510 on main), so the contrast pass and
  Q6 were on the preview before this run started. The job logs of run #5 say so; the audit step in that run printed
  CONTRAST OK.
- The manager's six offenders did not reproduce here: the audit on the preview head (43f44e1, the same source as
  71993c3 but for `.gitignore` and BUGS.md) read 0 offenders over the committed snapshot (17:49:46 UTC) and 0 over a
  demo built from the live Sheet at 18:20 UTC. The two findings are data and network dependent: the initials show only
  when the FPL photos fail to load (they loaded here; `flagcdn.com` was the host that failed), and the name reading
  against yellow needs a post whose header is tight enough to cut the name (a viral post in a rail card, see below).
  Both are real states a phone can show, so both are fixed in the design, and the audit can now read the first one.
- The sheet hole was real: every sheet read 0 text boxes because the collector walked the whole document and treated
  the scrim (a fixed box painted under the sheet) as a cover over the sheet's text.

## What changed

- `fplgg/tools/contrast/audit.js`
  - A sheet is read on its own layer: `collectSrc(rootSel)` scopes the walker and the covers to `.sheet.in` when a sheet
    is scanned (the page keeps `document.body`); `sheetOpen` waits for the slide-in to finish (the open sheet's box ends
    at the bottom of the viewport) before the scan; a sheet that reads 0 text boxes is a failed check, so the hole
    cannot come back silently. The 13 sheet screens read 1,460 text boxes on the committed snapshot.
  - A text box is clipped to its own element's overflow too (the loop started at the parent, so an ellipsised line's
    hidden tail was read against whatever was drawn beside it: the search sheet's "MID · Crystal ..." read 1.3:1
    against the red UNAVAILABLE chip to its right while the visible glyphs sit on the dark row;
    `2026-10-10-preview-audit/before-search-ellipsis.png`). This is a correctness fix of the measurement, not a tuning:
    the design fix for the name beside a chip is below, and the name is never under the chip in the first place.
  - A scroll settles for 350 ms (was 120) before the covers are read: the matchup's pinned score appears through an
    IntersectionObserver and a transition, and one run read "Clean sheets" under it at 2.8:1 because the cover's rect
    was read before the pin had slid in and the photograph after.
  - `--no-photos`: every image from another host is refused (the FPL photos, the crests, the flags), so the screens
    show the fallbacks a phone shows when a photo fails to load, and those are read. Not in CI (one run there).
- The design, through the stylesheets and `src/ui.js`:
  - The initials fallback (`.fc-i .ini`): `UI.face` sets the circle's font-size to its width, so the `.36em` initials
    scale with the circle (they read 5 px in a 28 px circle under a 14 px label; 10 px now). A played face on the team
    overview (`.tm-xif .fc-i.done`) and a subbed-off Lineup row (`.tm-lr.off`) dim the picture only; the initials read
    `--tx3` on the circle (4.5:1 and better on `--raised` and `--top`), per DESIGN.md's rule that a dimmed row never
    dims its words. The circle's background goes `--raised` when played, so the dimmed look stays.
  - The Plate rating's backing box (`.fc .rt`): the padding and margin above the figure go from 1.2% to 6% of the card,
    so the box reaches the top of the figure's glyph box. The numeric font's ascent runs about 5% of the card above the
    .9 line box, and on the dark tiers (Elite, Draft special, Team of the Week, Player of the Month) the art showed
    through there: the cyan Elite figure read 4.3:1, the gold figures 4.9:1 to 6.5:1, on the full Plates of the player
    sheet, the manager sheet's Squad tab and How it works (`before-elite-rating.png`). Measured after: the box covers
    the glyph box by 0.2 px on every tier at the How it works size.
  - The crest circle's letters (`.sk-cb em`, the club's short name on white when the crest fails to load): the player
    sheet's "H or A" marker rule `.ps-fc.ps-nx em` also matched the crest's em, painting it light grey or live green on
    white (1.4:1 and 2:1 under `--no-photos`); the rule is the direct child only now.
  - A voice's name in a post header (`.fp-who b`): the row wraps, so the voice chip and the GOING VIRAL pill drop under
    the name when the row is tight instead of cutting it with an ellipsis against the yellow chip. The only layout I
    could find that puts yellow under "Clark Moldridge" is a viral Clark post in a rail card (300 px wide, 13 px
    header): the name, THE TERRACE and GOING VIRAL need about 266 px of 232. Reproduced by adding the viral pill to a
    rail card's Clark header on the demo: before the change the name was cut to 45 px ("Clark..."); after it the name is whole at 98 px and the pill
    sits under it (`05-rail-card-viral-header.png`).
- "Did not play" on the Matchup page (`src/pages/matchday/model.js`, `matchup.js`, `src/ui.js`, `20-matchday.css`):
  `statusLine` says FT for every finished match and sets `dnp` when he had no minutes; `UI.plateStatus` takes `dnp`
  and answers the red "!" (a sub mark still outranks it); the token passes it to the badge and the small Plate, so the
  card wears the badge, the line under it says FT and the aria-label reads "Tzolis, 0 points, Did not play, FT"; the
  List tab's row carries the red DID NOT PLAY chip; the Bench card's notes gain one line per starter who did not play
  and had no cover ("Tzolis did not play (ARS v LEE finished, no cover on the bench)") under the auto-sub lines, with
  the red "!" and a dark glyph. The starters with a cover were already named there by the auto-sub lines.
- Docs: `docs/DESIGN.md` (the fallbacks count as words, the rating's backing, the Matchup line rule, the name wrap, the
  audit's sheets and `--no-photos`), `fplgg/tools/contrast/README.md`, ROADMAP (the entry, the claim removed), BUGS.md
  (#40 and #41 closed, the audit line).
- Tests: `tests/app-contrast.js` C11 to C19 (the audit's scoping, wait and failed check, the element's own clip, the
  scroll wait, the flag; the initials rules, the circle's font-size, the rating box, the crest letters, the name wrap),
  `tests/app-ui.js` (the "did not play" rule: `statusLine`, `plateStatus` with `dnp` and a sub outranking it, the token,
  the chip, `dnpLines`, the CSS; the pinned markup checks updated), `tests/app-faces.js` (the face's font-size, the
  token's call).

## How I checked it

- Every suite (44) prints ALL PASS, `node --check` on Code.gs passes, `ci-build.sh` builds and the six root files are
  restored.
- The audit on a demo built from the committed snapshot, 40 screens: CONTRAST OK, 0 offenders, 6,870 text boxes read
  (5,404 before, with the sheets at 0); with `--no-photos`: CONTRAST OK, 0 offenders, 7,310 text boxes. Before the
  fixes the scoped audit read 12 offenders in 9 groups on the sheets (the rating figures and the search row) and
  `--no-photos` 8 more (the crest letters).
- Screenshots at 390 px in Chromium on the demo (`2026-10-10-preview-audit/`), looked at: the Matchup pitch with
  Tzolis and Brobbey on the red "!" and FT under their cards (`01`), the Bench card with the two notes under the
  auto-sub lines (`02`), the List tab with the red DID NOT PLAY chips (`03`), How it works with the six tiers' ratings
  on their backing (`04`), a rail card's Clark header with the viral pill wrapped under the whole name (`05`), the team
  overview without photos with the initials at 10 px, the played ones quieter (`06`). No horizontal overflow on the
  Matchup, team overview or Feed; zero console errors.

## Left, and what I was unsure about

- The manager's two page offenders could not be reproduced on either data set, so the proof of those two fixes is the
  construction above, not a run that failed before and passes after. `--no-photos` now reads the initials on every
  run it is given; the viral rail-card case needs a viral Clark post in the data.
- `--no-photos` is not in CI. Adding it doubles the audit's minute in both workflows; the manager's call.
- The Plate rating's taller backing is a small visual change on every full Plate (the box starts a little higher above
  the figure); it is on the preview for Parker's eye with the rest.
