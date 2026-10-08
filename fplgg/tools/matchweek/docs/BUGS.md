# Matchweek bug list

The rolling bug list for the app (`fplgg/tools/matchweek/`) and the Apps Script backend (`Code.gs`). The scheduled Matchweek checks in Claude Code (recap check, preview check, audit) read it at the start of every run and keep it up to date.

How to use it:
- Each bug has a number, a priority and a one-line description, followed by the evidence and what would fix it. P1 means the league sees something wrong now, P2 means it will go wrong or already is wrong in a way nobody sees yet, P3 means a nuisance.
- A new bug takes the next free number (the highest number used anywhere in this file plus one).
- When a bug is fixed, move it to Closed with the date and the commit hash. Never delete an entry.
- Anything uncertain goes in Open with what was seen and what would confirm it, not into a fix.
- Each audit run adds a dated line to the Audit log, newest first.

## Open

- **#8 P2: the second match of a double gameweek has no provisional bonus.** Showing it needs per-fixture BPS, which Code.gs does not write yet.
  - Latent until the first double gameweek.
- **#3 P3: `readTab('GW Stats')` pulls the whole tab.** It loads every row, not just the gameweeks it needs, so it gets slower as the season goes on.
  - Measured 8 Oct 2026 (GW6, 5 gameweeks played): 3,217 rows, 410 KB as CSV (the JSONP the app reads is larger), about 640 rows a gameweek because Code.gs writes every player in FPL's live feed, played or not. Predictions is 234 KB and FC27 193 KB; the rest of the load is under 100 KB each. By GW38 GW Stats alone would be about 3 MB per app open.
  - Not trimmed in A5, on purpose: the engine reads every gameweek of it (form, the Lab's luck, season totals, player history, ownership history, the recap facts), and a row with 0 minutes is not the same to it as no row, so dropping gameweeks or rows changes what the app shows. All 26 columns are read.
  - Fix that keeps the numbers: load the current and the previous gameweek first (gviz `tq=select * where A >= <gw-1>`), paint, then fetch the rest with `where A < <gw-1>` and merge into `D.gwsByGw` with one re-render; or have Code.gs keep a compact per-gameweek JSON the app fetches once per finished gameweek and caches. Both need `__loadBase` in `core.gen.js` (the engine, extracted from `src-prod/`), so they are an engine change, not an app one.
- **#25 P3: the Clubs tab's Str att/def H/A columns are 0 for all 20 clubs.**
  - Latent: nothing reads those columns yet.
  - Fix them before anything starts using them.
- **On-device iPhone checks still pending:**
  - card faces;
  - images in the bottom sheets;
  - the status bar colour in the installed PWA.

  These can only be checked on a real phone, so they stay open until Parker looks.

## Closed

- **#5 P2: gviz returns the first sheet for an unknown tab name.** Closed 8 Oct 2026, commit d69d3ce (ROADMAP A5). The app's sheet reader (`src/data/tabs.js`, installed over the engine's `readTab`) checks every tab's header row against the columns the engine needs and refuses a mismatch: a required tab shows the "could not reach the league data" screen, an optional one falls back to empty, never to another sheet's rows. Code.gs reads its own hidden tabs by name through `getSheetByName`, which is not affected; the monitor and the scheduled checks validate headers over gviz themselves.
  - Was: `gviz/tq?...&sheet=<Tab>` for a tab that does not exist returns the first sheet (the draft grades, header `Rank,Team,Manager,Grade,...`) with HTTP 200 instead of an error. Seen 8 Oct 2026: Articles, RecapFacts, ShowFacts and ShowScripts all returned the draft grades sheet, because none of those tabs had been created yet.

## Audit log

- **2026-10-08** (backend session, ROADMAP A0 to A5): Code.gs v3.15 to v3.18 shipped through the new CI gate (the live script moves to the `release` branch); the Facts bot wrote the GW6 preview facts at 12:07 UTC and the live script read them; the monitor's first run passed every check; the status page is live at matchweek.gg/status; phones now report script errors; the app's sheet reader validates headers (#5 closed, commit d69d3ce) and shows a banner when the data is stale. #3 measured and left open with a plan (see its entry).
- **2026-10-08** (set-up): list started. Health endpoint `?health=1` answered from the cloud with `version v3.13` (the v3.14 self-update was still pending), `articles.last` empty, show GW6 22 of 22 clips. Confirmed #5 live: see its entry.
