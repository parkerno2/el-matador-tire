# Porting Matchweek's changes to El Matador

Parker, 24 Oct 2026: "none of the changes i am seeing are on the el matador app can we make that one a 1:1 replica of whatever you're working on? or port it over on the same link? ... i don't want my friends to have to reinstall it", and "it can be different than other leagues but that's fine".

So El Matador takes the product's screen changes (the private repository parkerno2/matchweek-app) on the same link. The installed app updates in place through its service worker, and the saved settings keep their names, so nobody reinstalls or picks their team again.

## What came over (24 Oct 2026)

- **M2 (numbers and states).** Its own commits only, from the M1 tip (7e1a6e0) to agent/M2-20261012, so none of the product's multi-league or sign-in plumbing (M1, M4) came with it. It brings:
  - Proj, xP and Pts as one word each;
  - the legend sheet (`src/sheets/legend.js`) and one reading of availability (`src/pages/avail.js`);
  - money in the league's currency (`league.json` `currency`: USD);
  - true minus signs and plain hyphens where an en or em dash was;
  - settled win chances and the all-play rework in the engine;
  - auto-subs only after the deadline.
- **The product's fixes of 24 Oct.**
  - The photo warm-up runs only behind the service worker.
  - A player's Matches tab opens with Coming up, his club's next five gameweeks.
  - A folded card on the player page opens its body by class, because M2's legend button sits between the row and the body.

## What El Matador keeps that the product dropped

- The Sheet as its data source (`src/data/tabs.js` `readRaw`, `readSheet`), with Supabase behind `?data=supabase`.
- The Apps Script features: feed posts, the Gameweek Show, articles, sign-in and social, error reports.
- The editorial posts and FC 27 ratings (`league.json` `ratings: "ea"`). The legend and How it works read `HOUSE`, so the demo still says house ratings.
- Every saved setting under its `emt-` key.
- The pitch cards with no FT under a finished player (Parker approved, 11 Oct).
- Baha's market as the wooden spoon market (`spoonTeam()` falls back to Baha's team). The saved feed post ID stays `baha:`.

## How to port the next change

1. Clone the product read-only. Take the product's version of a file before the change (the base) and after it (theirs). El Matador's file is ours.
2. Merge each file with `git merge-file --diff3 ours base theirs`.
3. Read every conflict. Two kinds come up again and again:
   - The product's comments say "the owner" where El Matador's say Parker. Take the product's code, keep either comment.
   - The product's code is league-agnostic: team counts, `words()`, `money()`, `PERIODS.length`, `byes()`. Take it. With eight teams it gives the same text.
4. Never take the product's side where El Matador has code the product removed. Above all, keep the Sheet reader, the editorial import and the FC 27 grid. A missing import does not fail the build, so list the undefined names before and after the merge with eslint's `no-undef` and compare the two lists.
5. Two renames came from the product's copy step. The projection class is `prj`, not `pj` (a manager's initials). The market is `spoon`, not `baha`.
6. An engine change goes in `core.gen.js` and in `src-prod/base.js` alike, for the functions the tests compare (`autoSubs`, the LEAGUE lines).
7. Check it with:
   - every suite in `tests/` and `tests/codegs/`;
   - the contrast audit and the gallery at 390 and 360 px on a demo built to a scratch folder;
   - `fplgg/tools/preview/check-headless.js` on a preview built to a scratch folder, on the live data;
   - the Facts bot on both builds (`MW_APP_URL`), comparing the facts, so the Apps Script writers get what they got before.
