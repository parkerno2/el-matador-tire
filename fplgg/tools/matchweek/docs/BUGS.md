# Matchweek bug list

The rolling bug list for the app (`fplgg/tools/matchweek/`) and the Apps Script backend (`Code.gs`). The scheduled Matchweek checks in Claude Code (recap check, preview check, audit) read it at the start of every run and keep it up to date.

How to use it:
- Each bug has a number, a priority and a one-line description, followed by the evidence and what would fix it. P1 means the league sees something wrong now, P2 means it will go wrong or already is wrong in a way nobody sees yet, P3 means a nuisance.
- A new bug takes the next free number (the highest number used anywhere in this file plus one).
- When a bug is fixed, move it to Closed with the date and the commit hash. Never delete an entry.
- Anything uncertain goes in Open with what was seen and what would confirm it, not into a fix.
- Each audit run adds a dated line to the Audit log, newest first.

## Open

- **#5 P2: gviz returns the first sheet for an unknown tab name.** `gviz/tq?...&sheet=<Tab>` for a tab that does not exist returns the first sheet (the draft grades, header `Rank,Team,Manager,Grade,...`) with HTTP 200 instead of an error. Anything that reads a tab by name, the app included, must check the header row before using the rows.
  - Seen 8 Oct 2026: Articles, RecapFacts, ShowFacts and ShowScripts all returned the draft grades sheet, because none of those tabs had been created yet.
  - Fix: validate by columns. Know the expected header of each tab and treat a mismatch as "tab missing".
- **#8 P2: the second match of a double gameweek has no provisional bonus.** Showing it needs per-fixture BPS, which Code.gs does not write yet.
  - Latent until the first double gameweek.
- **#3 P3: `readTab('GW Stats')` pulls the whole tab.** It loads every row, not just the gameweeks it needs, so it gets slower as the season goes on.
- **#25 P3: the Clubs tab's Str att/def H/A columns are 0 for all 20 clubs.**
  - Latent: nothing reads those columns yet.
  - Fix them before anything starts using them.
- **On-device iPhone checks still pending:**
  - card faces;
  - images in the bottom sheets;
  - the status bar colour in the installed PWA.

  These can only be checked on a real phone, so they stay open until Parker looks.

## Closed

(none yet)

## Audit log

- **2026-10-08** (set-up): list started. Health endpoint `?health=1` answered from the cloud with `version v3.13` (the v3.14 self-update was still pending), `articles.last` empty, show GW6 22 of 22 clips. Confirmed #5 live: see its entry.
