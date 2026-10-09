# The demo league on matchweek.gg (`site/public/demo/`)

Parker, 8 Oct 2026: "Demo league also needs to be fixed. It's on the old one." Until then `site/public/demo.html` and `app.html` were a frozen single-file copy of the old FPL Companion app. Now the demo is the current Matchweek app, built from the same source, on a frozen and anonymised snapshot of the league's tabs. Nothing here needs anyone's computer: the Build Matchweek app workflow writes it on every app change and once a day, and Cloudflare redeploys matchweek.gg on the commit.

## What is here

| File | What it does |
|---|---|
| `names.js` | The eight fictional entries (team, manager, initials) and the pure rules: `mapping(standingsRows, inis)` derives real-to-fictional from the live rows themselves (teams sorted by name, each given the fictional entry at the same index), `anonymiseTabs`, `substituteCode` (the engine's built-in TEAMS, FIRST, derby and series tables, the app's copy), `leaks` (the check). No real name is written in this folder, ever. |
| `snapshot.js` | Reads every tab the engine reads from the Sheet over gviz exactly as the app does (`out:json`, the formatted value, the GW Stats trimmed query, the header check). |
| `build-demo.js` | The build. Snapshot, anonymise, bundle the app with `__MW_DEMO__` (esbuild define; identifiers kept so the name substitution only touches strings and initials keys), substitute the names in `core.js`, `app.js` and `app.css`, write `index.html` (its own title, no manifest, no service worker), copy `icons/`, `voices/` and `press/` (never `faces/`), `node --check`, then the leak check and the EA check over the whole of `site/public`. `--check` runs the leak check alone. When the Sheet cannot be read the demo is left as it was and the build passes (the root build never fails for the demo's sake); `--strict` fails instead. |
| `check-headless.js` | Playwright in headless Chromium at 390 px against the built demo: home screen, League table, a team, a player sheet and its Ratings tab, the Feed, no console errors, no request to the Sheet, Apps Script or Supabase, none for an EA face or data file. Not in the CI gate (needs a browser). |

Tests without network or browser: `node tests/app-demo.js`.

## What the demo does differently (all behind `DEMO` in `src/data/tabs.js`)
- Data: `data/<tab>.json` beside the page, `{ cols, rows }` as gviz hands them over; the URL flag and localStorage are ignored; a tab without a file is empty; `readMeta` answers 0 (no stale banner on frozen data).
- Writes: the Specials snapshot has no API URL row, so `D.api` is blank and every call to the web app is off (posting, reactions, polls, claims, facts, articles, the show's audio); `authRead` answers null; a tap that would write says "This is the demo league, so posting is off."; the identity sheet offers "follow this team" only; the menu has no classic app and links the legal pages one folder up.
- No service worker, no error reporting, the "Demo league" label on every page, the title "Matchweek demo".

## The anonymiser
- Players and clubs stay real (public Premier League data). Team names, manager names and first names become fictional, consistently in the tabs and in the code.
- A cell equal to a real team or manager name is mapped; team and full names inside any string cell are replaced as whole words; first names and surnames only in the free-text columns (Text, Facts, Teams, Notes, Value...).
- Managers lose their photo and display name. Specials loses the API URL. Social keeps reactions and votes, no quotes. Posts keeps the voices' posts (Kind `ai`), anonymised. The Gameweek Show (`show/`) and the articles (served by the web app) are left out: both name real managers in speech and text.
- The leak check reads the real names from the live Standings tab at run time and fails the build when one appears as a whole word anywhere under `site/public`. A first name a footballer in the Players tab shares (Jacob, Ethan) is not checked, and no first name is checked inside the data files of the player tabs; team names, full names and surnames always are.

## No EA assets (Parker, 9 Oct 2026)
The public demo carries nothing of EA's: `faces/` (the FC face renders) is not copied and the demo's `core.js` has an empty `FC_FACES`, so every player goes through FPL's photo and then initials; the `EA Map` and `FC27` tabs are not read or written; the Rosters `OVR` column (Code.gs builds it on the FC27 base) is blanked, so the engine's rating from the FPL projection (`ovrOf`: 62 to 96 on projected points) stands in everywhere a rating shows, and the player sheet's Ratings tab says so instead of listing attributes. The build's EA check (`eaScan`, after the leak check, in `--check` mode too) fails when a file byte-identical to one in `faces/`, a `faces/` folder, a `<code>.png` of `FC_FACES`, or a file named `fc27` or `ea-map` is anywhere under `site/public`. The El Matador app itself keeps its EA faces and ratings.

## Known limits (ROADMAP, Q2)
- The derby names are the league's own (The Mr. Marks Bowl, El Jlásico...) with the surnames substituted; whether a public demo should carry them is Parker's call.
- The snapshot moves once a day, so the demo's gameweek follows the league's with up to a day's lag; a build on an app change refreshes it too.
