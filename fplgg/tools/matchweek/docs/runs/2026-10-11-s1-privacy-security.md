# S1: the privacy and security fixes from the release-readiness review (11 Oct 2026, builder, 14:00 to 15:10 UTC)

## The request
The manager's item for this run, from an independent release-readiness review of 11 Oct: "urgent privacy and security
fixes ... Treat this as an outage-class fix. It may go straight to main inside the GW6 window, with every gate green and
PROOF OF SHIPPING. It changes nothing in the El Matador league app's behaviour." Three parts:
1. "THE PUBLIC DEMO EXPOSES A REAL PRIVATE PERSON ... nothing in it may identify or mock a real person": the photo
   `press/kmf-probe.png` under the Baha posts and market, a "PARKER'S OCTOBER" thumbnail, the derby names, "El Matador
   Tire" and the league id 45380; the leak check case-insensitive; an image allowlist; the banned strings.
2. "SUPABASE WRITE AND READ HOLES": a shared secret on `ingest` and `seed-statics`, sent by pg_cron; the `tabs` function
   on an allowlist, no FC27, EA Map, Managers, Social, Posts, no full real names in the config.
3. "THE SETUP WIZARD MISLEADS": Create must not claim anything is live; the landing page's claims made accurate.

Step 1 at 14:00 UTC: all healthy (no outage issue; `?health=1` ok at v3.31 equal to the release branch, data 6 minutes
old during CRY v NFO, show 22 of 22 clips, GW6 preview live, no stuck article job; Preview run 20, Code.gs run 47 and
Build run 34 green; the preview commit 2e602a1 names origin/preview's head 6cba556). Step 1b skipped as instructed.
The Q4 claim of 01:51 UTC had already been removed by the review run of 13:48 UTC.

## What changed, file by file
**Part 1, the demo (`fplgg/tools/demo/`, `src/`, `site/public/`)**
- `names.js`: `nameRegex` matches in any case (`giu`); `lookup` keeps capitals ("PARKER'S" becomes "DEC'S") and
  leaves a name written exactly as the real one (PJ) as the fictional name as given; `banMap(cfg)` turns the league's
  name (and its two-word form), every derby name of `league.json` and its FPL id into `{ real: fictional }`, the
  derbies to the neutral list `DERBIES` (16 names, "Derby N" beyond) and the id to 0; `ALL_KEYS` carries `ban`, so
  `replaceNames`, `substituteCode` and `anonymiseTab` replace them and `leaks` reports them; `TEXT_COLS` gains Media,
  Share and Links and `TEXT_TABS` makes every Posts column free text; `playerNames` (first name to the surnames that
  follow it) and `leaks` with a Map exempt a footballer's first name only in front of his surname; `anonymiseLeague`
  names the demo "Demo league", drops `fpl` and gives the neutral derby names.
- `build-demo.js`: `press/` is not copied (`ASSET_DIRS`); `IMAGE_ALLOW` (the four icons, the four voices) and
  `imageScan` fail the build on any other image under `site/public/demo` or anything in a press folder, after the EA
  check, in `--check` mode too; `m.ban = names.banMap(cfg)` and the Map exemption in the leak check.
- `fplgg/tools/matchweek/league.json`: `"fpl": 45380`, so the ban list derives the id from the league's config.
- `src/feed/build.js`: the editorial posts and the market post are not built when `DEMO`; `src/pages/league/money.js`:
  no market block in the demo; `src/pages/league/overview.js`: the link reads "Every prize" in the demo.
  The league app's behaviour is unchanged (every gate is on `DEMO`, false in the league build).
- `site/public/demo/`: rebuilt from a fresh snapshot at 14:16 UTC (16 tabs), `press/kmf-probe.png` deleted.
- `site/public/recap-gw1.html`, `recap-gw2.html`, `recap-gw3.html`: the three static demo recap pages passed through
  the same anonymiser (their kickers carried the league's derby names and the real short team names).

**Part 2, Supabase (`supabase/`, `fplgg/tools/parity/`)**
- `functions/ingest/index.ts`, `functions/seed-statics/index.ts`: `secretOk(req)` as the first thing `Deno.serve`
  does: 503 when `INGEST_SECRET` is unset, 401 when the header `x-ingest-secret` (or a Bearer token) is missing or
  wrong, compared in constant time.
- `functions/register-league/index.ts`: sends the secret when it kicks a league's first ingest; its note says "Saved to
  the beta list. We will email you when the league is ready."; no em dash in its messages.
- `functions/tabs/index.ts`: `TAB_ALLOW` (Rosters, Standings, H2H Fixtures, Matchweeks, Club Fixtures, Clubs,
  Transactions, Predictions, GW Stats, Players, GW Log, Fixture BPS, Meta: the app's `TABS` less `SHEET_ONLY` and the
  EA tabs), 403 for anything else before any read; `/league/{id}/config` through `publicConfig` (no `manager`, no
  `faqFace`, no `legacyDatasource`).
- `config.toml`: the comment says how each function is gated (`verify_jwt` stays off; the gates are in the code).
- `migrations/20261011140000_ingest_secret.sql`: `cron.alter_job` on `ingest-hourly` and `ingest-live` so both send
  the header from Vault (`vault.decrypted_secrets`, name `ingest_secret`); no secret in the file.
- Done on the project through the Management API, in this order, before the push: `vault.create_secret` (201),
  the function secret `INGEST_SECRET` (201), the migration applied (both jobs' commands carry the header; the
  value readable by the jobs' role). The deployed functions ignored the header until the deploy, so nothing broke in
  between.
- `fplgg/tools/parity/parity.js`: `UNSERVED` (Specials, EA Map, FC27, Managers, Social, Posts) left out of the
  comparison; the report compares the 12 served tabs.
- The app reads none of the refused tabs from Supabase: `SHEET_ONLY` (Managers, Social, Posts, Specials) stay on the
  Sheet whatever the source and `DEMO_EMPTY` (EA Map, FC27) are read from the Sheet only in the league app
  (`src/data/tabs.js`), so `?data=supabase` keeps working.

**Part 3, the wizard and the landing page (`site/public/`)**
- `setup.html`: step 7 reads "Join the beta with this league ... Leagues are switched on by hand, one at a time, and
  we email you when yours is ready. Nothing is switched on from this page."; Create still registers the league
  (the leagues table is the list) and then says "<name> is on the list. We will email you when your league is
  ready." with a link to the demo, never to app.html (`APP_HOME` removed); the server's note is not shown; every
  em and en dash in the copy and strings replaced (14; the code comments keep theirs); the placeholder no longer
  names the real league id.
- `index.html`: the hero reads "Send us your league ID and, once your league is set up, every manager gets the app";
  the beta card reads "One league ID and an email. Leagues are switched on by hand, one at a time. We email you
  when yours is ready."

**Tests**: `tests/app-demo.js` (+28 checks: the case rule, the ban map, the neutral derbies, the Posts columns, the
Map exemption, `imageScan`, the committed site scanned offline with the mapping from `league.json`, the DEMO gates),
`tests/supabase.js` (+8: the gate on both write functions, the kick's header, the allowlist against the app's own
list, the 403, the config strip, the migration without a secret), `tests/parity.js` (the served list),
`tests/site.js` (new, 10 checks). Docs: CLAUDE.md, `tests/README.md`, `docs/SUPABASE.md`, `fplgg/tools/demo/README.md`,
BUGS.md #45, #46, #47 (Closed) and #48 (Open), ROADMAP.

## How it was verified
- Every `tests/codegs/v*.js` and `show.js` ALL PASS, `tests/codegs/test.js` exit 0, every other `tests/*.js` ALL PASS
  (49 suites), `node --check` on Code.gs, `ci-build.sh` (the six root files restored), the demo built from a fresh
  snapshot with the leak check clean over 31 files, the EA check clean and the image check clean (8 allowed).
- The contrast audit on the built demo (`build-demo.js --data ... --out /tmp/mw-demo/demo`, then `audit.js`):
  0 offenders in 0 groups across 42 screens, 7,104 text boxes read.
- `fplgg/tools/demo/check-headless.js` (not in the gate): the same three player-sheet steps fail on main's committed
  demo as on this one, with 18 third-party images and fonts failing to load from this network; the rest passes
  (no request to the Sheet, Apps Script, Supabase, an EA face or file). Recorded as BUGS.md #48, not this change.
- Screenshots at 390 px in Chromium (this folder, `2026-10-11-s1/`): `01-demo-feed.png` (the Feed with neutral
  derby names, no editorial post, no market, no press image), `03-demo-league-money.png` (no market block),
  `04-setup-step7.png` (the honest last step), `05-landing-beta.png` (the beta card). The script also read the pages'
  text: the Feed carries no "BAHA", "FILES", "UNDER INVESTIGATION" or "market" and no image from `press/`; the
  Overview and Money pages say no "market"; step 7 says nothing "is live" and carries the on-the-list copy.

## Proof of shipping and the live checks
PROOF_PLACEHOLDER

## Unsure or left undone
- The Cloudflare edge may keep an old copy of `demo/press/kmf-probe.png` and the demo's `app.js` for a while after
  the deploy; the live check below says what it answered and when.
- `check-headless.js`'s three failing steps (BUGS.md #48) need a run on the runner to tell an offline artefact from a
  real regression.
- `register-league` still inserts the league and kicks its ingest (now with the secret); that is the "list". No email
  is collected by the wizard itself: the invite comes from the beta form on the landing page, which has the address.
