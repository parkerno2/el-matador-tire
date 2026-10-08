# Matchweek bug list

The rolling bug list for the app (`fplgg/tools/matchweek/`) and the Apps Script backend (`Code.gs`). The scheduled Matchweek checks in Claude Code (recap check, preview check, audit) read it at the start of every run and keep it up to date.

How to use it:
- Each bug has a number, a priority and a one-line description, followed by the evidence and what would fix it. P1 means the league sees something wrong now, P2 means it will go wrong or already is wrong in a way nobody sees yet, P3 means a nuisance.
- A new bug takes the next free number (the highest number used anywhere in this file plus one).
- When a bug is fixed, move it to Closed with the date and the commit hash. Never delete an entry.
- Anything uncertain goes in Open with what was seen and what would confirm it, not into a fix.
- Each audit run adds a dated line to the Audit log, newest first.

## Open

- **#26 P2 (Parker): GitHub runs this repo's scheduled workflows hours late, so the Monitor's 15-minute cadence and the Facts bot's 3-hour cadence do not hold through GitHub alone.**
  - Seen 8 Oct 2026: the daily faces workflow (cron 09:17 UTC) ran at 14:47, 18:29, 15:58 and 16:31 UTC on 4 to 7 Oct, 5 to 9 hours late each day; the Monitor (`*/15`) and the Facts bot (`23 */3`) had no scheduled run in the 90 minutes after they landed, only the dispatched ones. GitHub documents that scheduled runs can be delayed under load; for this repo the delay is routinely hours.
  - Fix, shipped 8 Oct 2026: `site/worker.mjs` plus cron triggers in `site/wrangler.jsonc`. Cloudflare's cron fires on time; each tick calls GitHub's workflow_dispatch API for `monitor.yml` (every 15 minutes) or `facts.yml` (minute 23 every 3 hours). Dispatched runs start within seconds (observed today).
  - Needs Parker (one time): a fine-grained GitHub token with Actions: Read and write on parkerno2/el-matador-tire only (GitHub, Settings, Developer settings, Personal access tokens, Fine-grained tokens, Generate new token; Repository access: Only select repositories, el-matador-tire; Repository permissions: Actions: Read and write), stored as the Worker secret `GITHUB_TOKEN` (Cloudflare dashboard, Workers & Pages, matchweek, Settings, Variables and Secrets, Add, type Secret). Until then every tick is a no-op and the Monitor runs only when GitHub gets to it. Close this entry once the Monitor's runs show the `schedule`-like cadence (dispatched every 15 minutes).
  - 14:06 UTC: the Worker is live with both crons (https://matchweek.gg/__worker answers `{"worker":"matchweek","crons":[...],"token":false}`), but it does not see a `GITHUB_TOKEN`. A dashboard variable of type Text is deleted by the next `wrangler deploy` (Workers Builds runs one on every push to site/); a type Secret survives. So the secret must be added as type Secret, under the Worker named matchweek, with exactly that name; `/__worker` then says `"token":true` within a minute.
- **#8 P2: the second match of a double gameweek has no provisional bonus.** Showing it needs per-fixture BPS, which Code.gs does not write yet.
  - Latent until the first double gameweek.
- **#25 P3: the Clubs tab's Str att/def H/A columns are 0 for all 20 clubs.**
  - Latent: nothing reads those columns yet.
  - Fix them before anything starts using them.
- **On-device iPhone checks still pending:**
  - card faces;
  - images in the bottom sheets;
  - the status bar colour in the installed PWA.

  These can only be checked on a real phone, so they stay open until Parker looks.

## Closed

- **#27 P1: every writer's reply was cut off on the Claude 5.5 models, so no article, show script or feed post could be written since v3.13 (8 Oct, 02:05 UTC).** Closed 8 Oct 2026, Code.gs v3.20, commit 13b7dfb. claude-sonnet-5-5 and claude-haiku-5-5 think before they answer unless told otherwise, and the thinking counts against max_tokens; the feed writer allowed 900 tokens, the show writer 2,000 and the articles 6,000, so every reply ended at max_tokens before its JSON closed. Evidence: the GW6 preview (preview-gw6-90c43d) failed all 3 tries between 12:01 and 15:46 UTC with "The reply was cut off before the JSON ended" on every attempt, and ?health=1 showed 0 feed posts all day with the writer on. Fix: emtModelParams turns thinking off for the quick synchronous calls (Sonnet 5.5 between_tools, Haiku 5.5 disabled, Opus 5.5 effort low; nothing for the 4.5 fallbacks), the batch calls keep thinking with max_tokens 8,000 (research) and 16,000 (writing, punch-up), a model that refuses a parameter is asked once more without it, and an article that failed under an older Code.gs is tried once more by a newer one, so the GW6 preview restarts by itself. Tests: tests/codegs/v320.js.
- **#3 P3: `readTab('GW Stats')` pulled the whole tab.** Closed 8 Oct 2026 (ROADMAP A5, the commit "App: the GW Stats read leaves out rows nothing uses"). The app's sheet reader (`src/data/tabs.js`) now reads GW Stats with the gviz query `select * where G > 0 or F is not null`: a player who was neither owned nor on the pitch that gameweek is left out, which the engine cannot tell from a missing row (every aggregate skips a missing row and a zero-minute row alike, and no row has points without minutes); owned players keep their zero-minute rows, so ownership and "did not play" history are intact. The read checks that the header puts Owner in F and Mins in G and otherwise reads the whole tab as before, saying so in the console. Measured on the live sheet: 1,636 of 3,216 rows (334, 337, 327, 322 and 316 for GW1 to GW5), 219 KB instead of 410 KB; the built app loads the same counts, with all 98 owned zero-minute rows present.
  - Was: it loaded every row, about 640 a gameweek because Code.gs writes every player in FPL's live feed, played or not; by GW38 that would have been about 3 MB per app open. A lazy-history read (the current gameweek first, the rest after the first paint) was considered and rejected: it would paint form and luck numbers from partial history for a moment.
- **#5 P2: gviz returns the first sheet for an unknown tab name.** Closed 8 Oct 2026, commit d69d3ce (ROADMAP A5). The app's sheet reader (`src/data/tabs.js`, installed over the engine's `readTab`) checks every tab's header row against the columns the engine needs and refuses a mismatch: a required tab shows the "could not reach the league data" screen, an optional one falls back to empty, never to another sheet's rows. Code.gs reads its own hidden tabs by name through `getSheetByName`, which is not affected; the monitor and the scheduled checks validate headers over gviz themselves.
  - Was: `gviz/tq?...&sheet=<Tab>` for a tab that does not exist returns the first sheet (the draft grades, header `Rank,Team,Manager,Grade,...`) with HTTP 200 instead of an error. Seen 8 Oct 2026: Articles, RecapFacts, ShowFacts and ShowScripts all returned the draft grades sheet, because none of those tabs had been created yet.

## Audit log

- **2026-10-08** (backend session, 16:30 UTC): the GW6 preview had failed 3 of 3 tries with every reply cut off at max_tokens; root cause the Claude 5.5 models' default thinking (#27, fixed in v3.20, which also restarts the article). The matchweek.gg Worker sees no GITHUB_TOKEN binding at all (/__worker lists ASSETS only), so #26 waits on the secret being attached to the Worker named matchweek.
- **2026-10-08** (backend session, 14:05 UTC): #3 closed: the GW Stats read is trimmed to the rows the engine uses, measured and smoke-tested in the built app. The matchweek.gg Worker gained /__worker, which says whether it is deployed with its crons and whether its token is set.
- **2026-10-08** (backend session, check-in 13:47 UTC): no scheduled run of the Monitor or the Facts bot in 90 minutes; the daily faces workflow's history shows GitHub runs this repo's cron 5 to 9 hours late. Logged as #26; the matchweek.gg Worker cron now dispatches both workflows on time once Parker adds its token. The live Code.gs is v3.19 (installed from `release` at 13:31); the GW6 preview is being written from the Facts bot's facts.
- **2026-10-08** (backend session, ROADMAP A0 to A5): Code.gs v3.15 to v3.18 shipped through the new CI gate (the live script moves to the `release` branch); the Facts bot wrote the GW6 preview facts at 12:07 UTC and the live script read them; the monitor's first run passed every check; the status page is live at matchweek.gg/status; phones now report script errors; the app's sheet reader validates headers (#5 closed, commit d69d3ce) and shows a banner when the data is stale. #3 measured and left open with a plan (see its entry).
- **2026-10-08** (set-up): list started. Health endpoint `?health=1` answered from the cloud with `version v3.13` (the v3.14 self-update was still pending), `articles.last` empty, show GW6 22 of 22 clips. Confirmed #5 live: see its entry.
