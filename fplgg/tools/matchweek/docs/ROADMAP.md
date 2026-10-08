# Matchweek roadmap (from 8 Oct 2026)

## In progress
One line per claim: "- <item id and title>: <who> started <ISO UTC time>". A builder skips anything claimed here in the last 4 hours, or committed in the last 3 hours without being ticked, and removes its line in the commit that ships the item.
- Q1 ElevenLabs v4 Turbo with more emotion for the Gameweek Show: builder started 2026-10-08T23:34:55Z

The agreed direction (assessment 6 Oct, Parker's decisions since):
- **Everything runs in the cloud.** Nothing needs Parker's computer, and Cowork isn't used for shipping.
- **Backend is Claude's call.** Parker said "backend stuff is all you".
- **Articles publish themselves.**
- **Tone:** clever, not rude.
- **El Matador** moves onto the product pipeline and becomes league #1 on Matchweek.

How items are worked:
- Top to bottom: the first unchecked item without a "needs Parker" flag is next.
- Every item ships behind passing tests through CI, and is logged in BUGS.md or the CHANGELOG.
- Items marked **(Parker)** need a decision or an account action from him.

## Shipped on Parker's request (outside the lettered sections)
- **8 Oct 2026, club crests on the Lineup list** (builder, the commit "App: club crests on the Lineup list view"). Parker: "the lineup list screen should have the badge of the player or of the club that they're playing." My team > Lineup, List: each row (the XI and the bench) shows the player's club crest (16 px) before the club's short name and the opponent's crest (14 px) inside the fixture chip in all three states (the difficulty chip, the live score, the final score; a blank gameweek stays as it was). The crests are the PL badges the Plates already wear (the engine's `badgeImg` through `UI.badge`, `oppChip`'s new `crest` option in `src/pages/team/bits.js`), and one that fails to load hides itself so the text stays. Nothing else in the row changed; checked headless at 390 px and 360 px on the live data, every row on one line, no horizontal scroll. Tests: `tests/app-crests.js`. Left for Parker's eye: how it reads on his phone.
- **8 Oct 2026, "fix everything"** (builder, Code.gs v3.25, commit 5dc4f1f). 1. The CI gate found its app suites through a list pinned in `tests/codegs/v315.js`, so every new `tests/*.js` turned the gate red until someone edited the pin (three red runs on 8 Oct); the loop in `.github/workflows/codegs.yml` now runs every `tests/codegs/*.js` and `tests/*.js` by pattern (helpers skipped) and v315 asserts the pattern against the files on disk, never a list. 2. ElevenLabs credits (BUGS.md #30): the balance is read before a render voices anything, a gameweek has a character cap, a refusal holds the renders until the reset with an hourly balance read, and `?health=1` plus the status page say it in plain words. 3. The status page lists an article's older failed or dropped attempts as "earlier attempts" once a live one exists. 4. The feed writer's 0 of 6 was a quiet day (nothing due since the GW6 build-up post of 7 Oct), not a fault; `?health=1` `ai.last` now records what each run saw. 5. BUGS.md #26 carries the exact click path for the Worker secret. Tests: `tests/codegs/v325.js`, `tests/status.js`.
- **8 Oct 2026, Plates, player photos and the Feed's first impression** (builder, the commit "App: FPL photos framed by the head, the small Plate on the Lineup pitch and in the show's XI, one Manager of the Month post"). FPL's photos (half body, head at the top) were framed like the FC cutouts (bottom aligned), so a face circle showed a shirt with the head cut off (Bogle and Barnes on Archizio's Free Agent Watch); the shared chain now marks them (`class="fpl"`: `faceImgHTML` in core.gen.js and src-prod/base.js, `UI.chainImg`, `cut()`) and the CSS frames them by the head on every surface (`.fc-i`, `.jc-f`, `.dd-face`, `.fct-stk`, the Plate's `.face`). The small Plate (`UI.plateMini`: the Plate without the overall rating, its bubble kept as always, `UI.plateNum` and `UI.plateBubble`; Parker, second note: "Bubbles still on the plate card always") is the card on My team > Lineup's pitch and bench (a five-man line stays on one row, cards capped at 84 px), on the Matchday matchup screen (both XIs, 64 px, five across at 390 px) and in the Gameweek Show's XI scene; Lineup's list view shows the number alone, no pill. The Feed carries one Manager of the Month post at a time (a period's winner until the next gameweek finishes, then the current race; `src/feed/curate.js`), out of ALWAYS and ranked last, one voice post on the subject in Everyone and For you, and none in the first screenful of Everyone on a first visit. Tests: `tests/app-faces.js`, `tests/app-feed.js`. Left for Parker's eye: the framing on a real phone (BUGS.md, on-device checks).

## A. Reliability (now)
- [x] **A0 Facts without phones.** (Shipped 8 Oct 2026: Code.gs v3.15, `.github/workflows/facts.yml`, `fplgg/tools/factsbot/`; the files live on the `facts` branch.) Today the GW preview, recap and show only start once a signed-in manager opens the app.
  - Add a GitHub Action ("Facts bot"), every 3 h plus on dispatch.
  - It loads the live app headless in Chromium, computes `MW.facts.preview()` and `MW.facts.recap()` with the app's own engine, and commits `facts/preview-gw<N>.json` and `facts/recap-gw<N>.json` when they change.
  - Code.gs reads those raw files from the repo whenever phone facts are missing or older. The repo is the trust anchor, so no secret is needed.
  - Tests in `tests/codegs/`.
- [x] **A1 CI gate for Code.gs.** (Shipped 8 Oct 2026: `.github/workflows/codegs.yml`; `release` created from main at v3.15, Code.gs v3.16 reads from it.)
  - Run every `tests/codegs/*.js` on each push that touches Code.gs or tests.
  - The self-update reads Code.gs from a `release` branch that CI fast-forwards only when the suites pass. A broken push to main can then never reach the live script.
- [x] **A2 Monitor (no AI).** (Shipped 8 Oct 2026: `.github/workflows/monitor.yml`, `fplgg/tools/monitor/`, Code.gs v3.17 `data` in health. The error spike check is wired and starts counting with A4. GitHub's scheduler runs this repo's cron workflows hours late, so `site/worker.mjs` starts the Monitor and the Facts bot on time from matchweek.gg's Worker cron. **(Parker: the `GITHUB_TOKEN` secret on the matchweek Worker, see BUGS.md #26; until then the Monitor runs only when GitHub gets to it.)**) A GitHub Action every 15 min checks:
  - the app loads (status 200 and a build stamp);
  - the web app's `?health=1` is ok;
  - the data is fresh: add `data.updated` (the last successful refreshAll or liveTick) to health. Thresholds: 2 h normally, 20 min while matches are live;
  - the FPL API responds;
  - the self-update state isn't `refused` or `error`.

  On failure it opens or updates a GitHub issue labelled `outage`, which notifies Parker; it closes the issue when the check recovers.
- [x] **A3 Live status page.** (Shipped 8 Oct 2026: https://matchweek.gg/status.html reads `?health=1`, the Facts bot's index and the open outage issues.) `site/public/status.html` reads `?health=1` in the browser and shows each pipeline in plain words.
- [x] **A4 In-app error reporting.** (Shipped 8 Oct 2026: `src/errors.js`, Code.gs v3.18 `clienterror` and the hidden Errors tab, `?health=1` errors, the monitor's spike check at 20 in 24 h.)
  - `window.onerror` and `unhandledrejection` POST `clienterror` to the web app: rate-limited, no personal data, build stamp, route, message and stack, truncated.
  - Errors go to a hidden Errors tab.
  - `?health=1` gains an error count for the last 24 h.
  - The monitor opens an issue on a spike.
- [x] **A5 Data guards.** (Shipped 8 Oct 2026, all in `src/data/tabs.js`: the header guard (#5), the GW Stats trim (#3: 219 KB instead of 410 KB, lossless for the engine, measured in BUGS.md) and the stale banner.)
  - [x] #5: validate each tab by its header row in the app's readTab, showing an empty state rather than wrong data.
  - [x] #3: trim the GW Stats fetch.
  - [x] A stale-data banner when `data.updated` is old.
- [x] **A6 #8 Per-fixture BPS in Code.gs**, so double-gameweek bonus can be estimated per match. Must ship before the first double gameweek. (Shipped 8 Oct 2026: Code.gs v3.21 writes the hidden `Fixture BPS` tab every refresh, the current gameweek's BPS and bonus per match from the draft live feed's fixtures with the classic fixtures feed per match when fresher; the engine (`src-prod/base.js`, `core.gen.js`) reads it, optional, and ranks a club's second match on its own BPS; a club's only match keeps the GW Stats path. Tests: `tests/codegs/v321.js`, `tests/app-bonus.js`. The first double gameweek is the live check: the matchup page should show provisional bonus for both of a doubled club's matches.)
- [x] **A7 #25 Clubs strength mirror:** re-source it from FPL's new fields, or drop it. (Shipped 8 Oct 2026: Code.gs v3.22. FPL's classic bootstrap-static now carries 0 in every attack and defence strength and its 1 to 5 fixture difficulty in `strength_overall_home` and `_away` (a club's home figure is the difficulty of hosting it, the away figure the difficulty of visiting it: the fixture feed's `team_h_difficulty` and `team_a_difficulty`, checked on all 30 fixtures of GW6 to GW8). The Clubs tab drops the four zeroed columns and keeps `Str H` and `Str A`; the engine (`src-prod/v10.js`, `v12.js`, `base.js`, `core.gen.js`) reads them for the fixture difficulty pills and the projection's strength prior, with its built-in table as the fallback, refreshed to FPL's values of 8 Oct 2026 (it had drifted for 7 of the 20 clubs). Tests: `tests/codegs/v322.js`, `tests/app-fdr.js`.)

## B. One pipeline (Supabase)
- [ ] **B1 Inventory** the Supabase project `vcokquhzqpqvwrybndnr`: is the ingest alive, are its functions deployed, is row-level security on. **(Parker: a Supabase access token or service key as a GitHub Actions secret and a Claude Code environment variable.)**
- [ ] **B2 Parity:** league 45380 through Supabase matches the Sheet tab for tab across one live gameweek, in a CI report. (The report shipped 8 Oct 2026: `.github/workflows/parity.yml`, `fplgg/tools/parity/`, every 3 h and on dispatch; the run's summary and the artifact `parity-report-<run>` hold it. Supabase's `tabs` function is public and read only, so no secret was needed. The first report, 19:55 UTC: 7 of 18 tabs agree, 7 differ, 4 are not on Supabase; the gaps are BUGS.md #29.) **Left (Parker: the gaps are on the ingest side, which needs B1's Supabase access):** read the reports over GW6 (10 to 12 Oct 2026) for the live columns, and tick this item only when a report says "Every tab agrees with the Sheet".
- [ ] **B3 Switch** the app's data source behind a flag, then retire the Sheet as the live path. Code.gs keeps the social, articles and show jobs until those move too. (First slice shipped 8 Oct 2026, `src/data/tabs.js`: `?data=supabase` in the app's URL reads every engine tab from the Supabase project's public `tabs` function on that phone, kept in localStorage until `?data=sheet`; the rows are shaped like gviz's and pass the same header guard and the same GW Stats trim; the tabs the web app writes (Managers, Social, Posts, Specials with the API URL) stay on the Sheet, a tab Supabase lacks or fails to serve falls back to the Sheet and the console says so, `MW.data.report()` lists the source of each tab, and the stale banner follows Supabase's Meta. Checked headless on the live data: the League page is identical from both sources. Tests: `tests/app-data.js`. **Left:** the default stays the Sheet until a parity report says every tab agrees (B2, Parker); then flip the default, keep the Sheet as the fallback for a while, and only then retire it.)

## C. Beta for other leagues
- [ ] **C1 `league.json`:** teams, aliases, derbies, seeded series, pot and MOTM periods move out of `core.gen.js` into config.
- [ ] **C2 Per-league URL** `matchweek.gg/l/{slug}`, registration from the wizard, accounts (Supabase magic link), claim your team, roles. **(Parker: sign-in method.)**
- [ ] **C3 House ratings** replace the EA ones in anything strangers see (rights-clean mode).
- [ ] **C4** Per-league health page, onboarding copy, README, ARCHITECTURE and RUNBOOK.

## D. Product (needs Parker's eye before it ships)
- [ ] **D1** Tone pass on the app's built-in voice lines (the template posts in `src/feed/*`), to the TONE.md standard.
- [ ] **D2** Lab v3: schedule luck (all-play record, close-game record) next to performance luck.
- [ ] **D3** Lineup graphic and the "Matchday through the week" states from design round 2.
- [ ] **D4** Home-screen name and icon (still "FPL Companion").
