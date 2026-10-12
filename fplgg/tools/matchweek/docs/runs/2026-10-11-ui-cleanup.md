# The UI cleanup of 11 Oct 2026

Request (Parker, 11 Oct 2026, after a review of every screen at phone size): "All" to eight fixes, then "Make the changes in El Matador Tire" straight to production, after which El Matador is frozen (fixes only).

## What changed
1. One top row: the page title, the state pill, search and your crest (src/ui.js appbar and pageHead). The Matchweek plate row and the separate title row are gone, about 60 px back on every screen. A hero page (My team Overview, League Table) keeps its own h1 under the row; the "My team" and "League" kickers are gone, and the Club button sits beside the manager's name.
2. One live signal: the top pill. No LIVE on the League hero's progress label, no live tag on the table, no live asides under titles or on the Results heading.
3. Tabs that fit: the switcher is one track whose segments share the width (src/css/02-components.css). My team folds Fixtures into the top of Season, and #/team/fixtures stays an alias (src/main.js parse follows a page's alias). Matchday says PL, League's Overview tab says Table. Every switcher fits at 360 and 390 px, the sheets' included.
4. Squad list: the rating sits small in its box with OVR always under it, and the points carry "pts".
5. Explainer copy gone: All matchups' "Predicted until the deadline", the Transfers how-to (the waiver rules are now on How it works), the Squad health aside, the Results footnotes. Data states stay.
6. The Results grid opens on the latest weeks with a whole column against the team names and PF, PA whole at the far end, and fades under the names' edge.
7. The Stats chart draws only the picked managers; the scale still spans everyone.
8. The Feed's press prompt uses the app's colours (a neutral card, white text, a purple Press button); lime stays Archizio's own.

## Verification
- tests/app-cleanup.js (new) and every tests/app-*.js pass; ci-build.sh builds.
- Contrast audit with the real fonts: 0 offenders across 41 screens. Gallery in Chromium with the real fonts: 0 findings over 82 screenshots.
- Tab fit measured in the browser at 360 and 390 px on every page and the manager sheet, and the Results grid checked for cut columns at both ends.
- Shipped from Parker's Chrome on his instruction, after the scheduled builder's commit was blocked by its safety check (the instruction had come from the manager, not from Parker).
