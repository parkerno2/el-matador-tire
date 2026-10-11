# 11 Oct 2026: pictures that stay put, the rating backing, the club codes (BUGS #49 to #51)

## The request
Parker, 11 Oct 2026, 16:27 UTC, on his iPhone during GW6 (LIV v MCI at 45'), with a screenshot of Ndiaye's player sheet:
"The images are still disappearing sporadically when I click into someone and when I scroll and what's this weird
artifact by the rating area? Also some weird text poking through under the man city and Liverpool mini bubbles there.
Take a look please"

## What was wrong (reproduced in Chromium at 402 px on the built demo, stand-in images and the real fonts)
1. **Photos blanking.** While a match is on the app reloads every 90 s, and `render` and `refreshSheet` redrew the page
   and the open sheet with innerHTML. After one `MW.reload`, 0 of 15 pictures on the page and 0 of 18 in a player sheet
   were the same elements: every photo, badge and flag was fetched and decoded again. On top, every Plate photo carried
   `filter: drop-shadow` (a compositing layer per picture on iOS), and the sheet's big Plate decoded asynchronously as it
   slid in.
2. **The rating artifact.** The rating's backing (the contrast pass of 10 Oct) started at 3.8 cqw: on the card's top
   edge (4.0) and over its inner keyline (6.31), with a square corner sticking out past the card's cut corner.
3. **The text under the crests.** The club circle's fallback code sat under the badge; "MCI" is 21 px wide in an 18 px
   circle around a 13 px badge.
4. Seen on the way: the light beam behind the sheet's Plate ended in a hard horizontal line beside the card.

## What changed
- `src/swap.js` (new): `swapHTML(el, html)` keeps every loaded `<img>` across a redraw (same src, new attributes
  copied, src never set again). `src/main.js` uses it for the page and the sheet.
- `src/css/02-components.css`: `.fc .face img{filter:none}`; the rating backing is `.fc .rt::before`, from 7.3 cqw,
  its top left corner cut parallel to the card's; the box's padding and margin 2.5% at the top (was 6%).
- `src/sheets/player.js`: the sheet's Plate decodes its photo synchronously.
- `src/sheets/kit.js` and `src/css/60-sheets.css`: the circle is marked `im` while it holds a badge and the code is
  hidden there; the badge's error handler removes the mark, so a failed badge still shows the code. `.ps-beam` fades out.

## How it was checked
- `tests/app-images.js` (new, in the gate): swapHTML on a fake container (kept, redrawn, attributes, src never set
  again), main.js uses it, no filter, sync decode, the circle markup and its error handler, the backing's geometry
  against the keyline and the audited band, the beam's mask. It crashes on the old code (no swap.js).
- `tests/app-contrast.js` P3 and C16 updated to the new backing rule.
- Every `tests/*.js` and `tests/codegs/*.js` ALL PASS, `tests/codegs/test.js` exits 0, Code.gs syntax ok, `ci-build.sh`
  and the demo build clean.
- The contrast audit on the demo with Saira Condensed, Archivo and Barlow Condensed loaded: CONTRAST OK, 0 offenders,
  42 screens, 7,602 text boxes.
- `fplgg/tools/preview/check-images.js --stub-images` (new, the browser half): 14 club circles right, sync decode and no
  filter, the backing at 7.30 cqw, a refresh keeps 15 of 15 page pictures and 18 of 18 sheet pictures, no page error.
- Screenshots before and after, looked at: the backing inside the keyline with its cut corner, the chips without
  letters at the sides, the beam fading.

## Not certain
The disappearing photos are an iPhone symptom this cloud cannot reproduce (no WebKit on iOS here). The refresh no longer
replaces any picture, and the two iOS layer costs are gone; Parker's phone is the final check.

## Follow-up the same afternoon: no box behind the rating
Parker, on the preview: "I don't know if I really want that box above the rating. It's super unnecessary."
- The box is gone on every tier: `.fc .rt` has no background, padding or ::before.
- Gold and silver figures read 7:1 on the card as they are. Without the box the audit failed 17 texts, all on the four
  dark tiers, whose fills are mid tones (elite: cyan 4.3:1; even white is 6.4:1).
- Those four tiers shade the card's top left corner instead: `.fc.spec::before` and the other three, a soft radial
  shade at the box's old darkness, clipped inside the inner keyline, under the photo and the figures, with no edges.
  The figure's audited band lies in its solid part (`tests/app-images.js` computes it).
- Checked: every suite ALL PASS; the contrast audit with the real fonts 0 offenders on 42 screens; `check-images.js`
  ALL PASS; the six tiers rendered side by side with and without the box and looked at.
- Applied by the builder (18:00 UTC) as a89db62 on `preview` from the manager's patch (sha256 f5ee013a205b94d2), main merged
  as fd8da19. Gates on the merged tree: every suite ALL PASS, node --check, ci-build.sh, the demo build, the contrast audit
  0 offenders on 42 screens, `check-images.js --stub-images` ALL PASS, the gallery in Chromium 84 shots OK. Preview
  Matchweek app run 27 green, Chromium and WebKit at 390 and 360 px:
  https://github.com/parkerno2/el-matador-tire/actions/runs/38161730221; published on main as 2517af3 ("preview:
  matchweek app from fd8da19"). The published player sheet shots (`preview/shots/snap/{chromium,webkit}/29, 32, 33`):
  no box behind the rating on the gold and silver cards, the elite card's figure on its corner shade with no edge.
