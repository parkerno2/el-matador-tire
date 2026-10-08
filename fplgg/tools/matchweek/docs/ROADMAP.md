# Matchweek roadmap (from 8 Oct 2026)

## In progress
One line per claim: "- <item id and title>: <who> started <ISO UTC time>". A builder skips anything claimed here in the last 4 hours, or committed in the last 3 hours without being ticked, and removes its line in the commit that ships the item.
- B2 Parity (Supabase against the Sheet, CI report): builder started 2026-10-08T19:50:00Z

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
- [ ] **B2 Parity:** league 45380 through Supabase matches the Sheet tab for tab across one live gameweek, in a CI report.
- [ ] **B3 Switch** the app's data source behind a flag, then retire the Sheet as the live path. Code.gs keeps the social, articles and show jobs until those move too.

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
