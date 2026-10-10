# Matchweek architecture (ROADMAP C4, 10 Oct 2026)

How the pieces fit, for someone who has to run or change Matchweek without having built it. CLAUDE.md at the repo root has the rules; this page has the shape. Where this page and the code disagree, the code is newer: every path and Script Property named here is checked against the repo by `tests/app-docs.js`, but behaviour is only as current as the last person who read it.

Rule zero (Parker, October 2026): everything runs without his computer. Every piece below runs in Google's, GitHub's or Cloudflare's cloud, and the only hand steps left are a push to `main`, a Script Property in the Apps Script editor, or a tap in the app.

## The pieces

```
FPL Draft API ──> Code.gs (Apps Script, triggers) ──> the Google Sheet (tabs) ──> the app (GitHub Pages)
                     ^   |                                    ^                      |
   phones (logins,   |   |  Claude (articles, feed posts,     |                      |  facts (showfacts, artfacts)
   posts, facts) ────┘   |  show script), ElevenLabs (voice)  |                      v
                         v                                    |              the Facts bot (Action, facts branch)
                   hidden tabs: Articles, ShowScripts, ShowAudio, Posts ...

GitHub Actions: Build Matchweek app, Code.gs tests and release, Monitor, Facts bot, Supabase parity
Cloudflare Worker (matchweek.gg): the public site, the demo, the status page, cron that starts the Monitor and the Facts bot
Supabase (vcokquhzqpqvwrybndnr): the second data pipeline, compared with the Sheet by the parity report (ROADMAP B)
```

| Piece | Where | Runs on | Deploys by |
|---|---|---|---|
| The league app | `fplgg/tools/matchweek/` (source), the six root files `index.html app.js app.css core.js sw.js manifest.webmanifest` (build) | GitHub Pages, https://parkerno2.github.io/el-matador-tire/ | a push to `main` under `fplgg/tools/matchweek/` or `fplgg/tools/demo/`; `.github/workflows/matchweek.yml` builds and commits the six files and the demo |
| The backend | `Code.gs` | Google Apps Script bound to the league's Sheet, as a web app | a push to `main`; `.github/workflows/codegs.yml` runs every suite and fast-forwards `release`; the script's hourly self-update installs `release` |
| The data | the public Google Sheet `1rIj4A3-lkSfg1rTuAh3yJL-K7LP4EOYkwWZiItZaoHk` | Google Sheets; read by anyone over gviz | Code.gs writes it |
| matchweek.gg | `site/public/` (pages), `site/worker.mjs`, `site/wrangler.jsonc` | Cloudflare Workers | Cloudflare Workers Builds on every push to `main` that touches `site/` |
| The demo league | `site/public/demo/` (build), `fplgg/tools/demo/` (generator) | matchweek.gg | written by the Build Matchweek app workflow with the root build, and once a day for the snapshot |
| The cloud jobs | `fplgg/tools/monitor/`, `fplgg/tools/factsbot/`, `fplgg/tools/parity/` | GitHub Actions | `.github/workflows/monitor.yml`, `facts.yml`, `parity.yml` |
| The show scripts | `show/gw<N>.json` | read by Code.gs from `main` | a push |
| Player images and voices | `faces/`, `voices/`, `press/` | GitHub Pages with the app | a push |

## The data: the Sheet and its tabs

The Sheet is the data store and the only thing every piece shares. Code.gs rewrites the FPL tabs from the Draft API on a trigger (`refreshAll` every hour, `liveTick` every 10 minutes while a match is on); the app reads them over gviz (`gviz/tq?tqx=out:csv&sheet=<Tab>`, or `out:json` in the app) with no login. Anything not yet public (a draft article, a rewrite in progress) is stored encrypted (`EMT_ART_SEAL`), because a hidden tab is still readable by anyone with the Sheet id.

The tabs the app's engine reads, with the columns the header guard requires, are the `TABS` list in `fplgg/tools/matchweek/src/data/tabs.js`: Rosters, Standings, H2H Fixtures, Matchweeks, Club Fixtures, Clubs, Specials, EA Map, FC27, Transactions, Predictions, GW Stats, Players, GW Log, Managers, Social, Posts, Fixture BPS. A tab whose header does not match is refused (the app shows an empty state, never another sheet's rows: gviz answers an unknown tab name with the first sheet, BUGS.md #5). GW Stats is read with a query that leaves out rows nothing uses (#3).

Who writes what:
- **From FPL, by Code.gs:** Rosters, Standings, H2H Fixtures, Matchweeks (with the waiver deadline), Club Fixtures, Clubs (with FPL's difficulty in `Str H` and `Str A`), Transactions, Predictions, GW Stats, Players, GW Log, Fixture BPS (per-match BPS for a double gameweek), Meta (the last refresh, read by the app's stale banner and the parity report).
- **By phones through the web app:** Managers (logins, colours, display names), Social (reactions, votes, quotes), Posts (the voices' posts and the rumours), Specials (the `API URL` row the app reads the web app's address from; its `POTM player` and `POTM month` rows are written by Code.gs from `fplgg/tools/matchweek/data/potm.json` on the `release` branch, v3.30, a hand edit for the same month kept), Errors (what phones reported).
- **By the pipelines:** Articles and ArticleWork (recaps and previews), ShowScripts, ShowAudio and ShowFacts (the Gameweek Show), RecapFacts (recap facts). The engine never reads these; the app asks the web app for them.
- **Frozen:** EA Map and FC27 (the EA ratings for the league's own app; the demo and any `house` league read neither, ROADMAP C3).

## The app

`fplgg/tools/matchweek/` is the source of truth (its README has the file map). `ci-build.sh` bundles `src/` with esbuild into `app.js`, concatenates `src/css/*.css` into `app.css`, and writes `core.js` as the `const LEAGUE={...}` header from `league.json` (checked by `tools/league.js`) followed by the engine `core.gen.js`. The engine is a classic script extracted from the old app's source in `src-prod/` (`tools/extract.js`); an engine change goes in both `src-prod/` and `core.gen.js` by hand, and the tests hold them in step.

The app is four pages behind a hash router (`src/main.js`: Matchday, My team, League, Feed) with bottom sheets (`src/sheets/`: player, manager, identity, search, menu, kit). The Feed (`src/feed/`) carries the four fictional voices' posts, the articles' reader and the Gameweek Show's player; its rules (what leads, what is pinned, one Manager of the Month post) are in `src/feed/curate.js`. `src/data/tabs.js` is the data layer: the Sheet by default, Supabase behind `?data=supabase` (ROADMAP B3), the frozen JSON tabs in the demo (`__MW_DEMO__`), the header guard, the stale banner. `src/errors.js` posts script errors to the web app (`clienterror`), rate-limited, with no personal data.

The config is `league.json` (ROADMAP C1): teams, aliases, derbies, seeded series, Manager of the Month periods, the pot and `ratings` (`ea` or `house`). Another league is another `league.json` and another Sheet; the Sheet id itself is still in the engine until B3.

The service worker (`sw.js`) is network-first for pages and code and cache-first for images; `?v=BUILD` on the two scripts busts caches on every build. The demo has no service worker.

## The backend: Code.gs

One Apps Script file bound to the Sheet, deployed as a web app (Execute as Me, Anyone). Its address is the Specials tab's `API URL` row. Three time-based triggers, installed by `setup()`:

| Trigger | Every | Does |
|---|---|---|
| `refreshAll` | hour | rewrites the FPL tabs, Meta's `updated`; the Player of the Month rows of Specials from the repo's `fplgg/tools/matchweek/data/potm.json` (`emtPotmSync`, one read an hour; `?health=1` `potm`) |
| `liveTick` | 10 min | the same while a club match is on, by the Club Fixtures tab's kick-off times (`liveWindow`); `?health=1` `data.live` and `liveWhy` say so |
| `aiTick` | 15 min | `aiWriterTick` (feed posts and the daily floor), `showWriterTick` (the show script), `showTick` (the voice), `articleTick` (recaps and previews), `selfUpdateTick` (install `release`), each in its own try and its own lock |

The web app answers `GET` with `?health=1` (the pipelines' state, no secrets), `?articles=1` and `?article=<id>` (live articles), `?show=<gw>` (the show's takes); and `POST` actions through `emtHandle`: `login`, `claim`, `save`, `reset`, `status`, `refresh` (logins and profiles), `social` (reactions, votes, quotes, rumours), `showfacts`, `artfacts` (the facts), `articles`, `articlemod` (the commissioner's approve, rewrite, take down), `clienterror`. A manager signs in with a team and a PIN; PIN hashes live only in Script Properties (`EMT_SECRET`, `EMT_PIN_<team>`), never in a tab.

The writers and their contracts are in ARTICLES.md (recap and preview: the facts, the research through the Message Batches API with web search, the article JSON, the checks, auto-publish and review mode) and in the Code.gs header's CHANGELOG (the feed writer's four triggers and daily floor, the show's writer, punch-up, voicing cap and credit guard). Every writer has a model chain (`EMT_AI_MODEL`, `EMT_SHOW_MODEL`, `EMT_ARTICLE_MODEL`, `EMT_PUNCH_MODEL` first, then the defaults in the code), so a retired model falls through by itself. TONE.md is the voice bible every prompt carries.

The keys live in Script Properties and nowhere else: `ANTHROPIC_API_KEY` (every writer) and `ELEVENLABS_API_KEY` (the show's voice). Nothing in the repo, the Actions or the Worker holds either. The Script Properties that change behaviour are listed in RUNBOOK.md.

The self-update (`selfUpdateTick`, since v3.16): every hour the script fetches `Code.gs` from the `release` branch on raw.githubusercontent.com, and when the copy differs from the editor's and the first `vX.Y` after `CHANGELOG` in its header is not older than the running `EMT_VERSION`, saves it through the Apps Script API, makes a new version and redeploys the web app in place (the deployment at the `API URL`, or `EMT_SELF_DEPLOYMENT`). `?health=1` `self` says `current: vX.Y`, `updated to`, `refused` (the repo copy throws as it loads, or carries an older version; nothing changed), `off` (not set up), `half` (the code is in, the web app switches on the next check), `drift` (edited by hand since the last update; left alone until the repo changes) or `error`. The version is why every Code.gs change bumps the first CHANGELOG entry and `EMT_VERSION` together.

## The cloud jobs (GitHub Actions)

| Workflow | File | When | What |
|---|---|---|---|
| Build Matchweek app | `.github/workflows/matchweek.yml` | a push under `fplgg/tools/matchweek/` (docs excepted) or `fplgg/tools/demo/`; daily 06:41 UTC; dispatch | `npm ci`, `ci-build.sh`, `fplgg/tools/demo/build-demo.js`, then commits the six root files and `site/public/demo/` as `el-matador-build` |
| Code.gs tests and release | `.github/workflows/codegs.yml` | a push touching `Code.gs`, `tests/`, the app's `src/`, the engine, the cloud jobs or the Worker; dispatch | `node --check`, every `tests/codegs/*.js` and `tests/*.js` by pattern (helpers skipped, at least 20 suites), then fast-forwards `release` to the commit |
| Monitor | `.github/workflows/monitor.yml` | every 15 min; dispatch | `fplgg/tools/monitor/monitor.js`: the app loads, the Sheet and `?health=1` answer, the data is fresh (2 h, 20 min live), the FPL API answers, the self-update is not refused or in error, no error spike; a check that fails twice 4 min apart opens one issue labelled `outage` assigned to the repo owner, closed on recovery |
| Facts bot | `.github/workflows/facts.yml` | minute 23 every 3 h; dispatch | `fplgg/tools/factsbot/factsbot.js`: loads the live app headless, computes the preview and recap facts with the app's engine, commits `facts/*.json` and `facts/index.json` to the orphan `facts` branch |
| Supabase parity | `.github/workflows/parity.yml` | minute 41 every 3 h; dispatch | `fplgg/tools/parity/parity.js`: every engine tab from the Sheet and from Supabase's public `tabs` function, compared; the report is the run's summary and an artifact |
| Preview Matchweek app | `.github/workflows/preview.yml` | a push to the `preview` branch; dispatch | the same gate as Code.gs tests and release, `ci-build.sh` (the six files restored), then `fplgg/tools/preview/build-preview.js` and a commit of the folder `/preview/` on `main`, so GitHub Pages serves that branch's app at `/el-matador-tire/preview/` for Parker's eye on the live data; the league app is untouched (`sw.js` passes `/preview/` requests straight to the network) |
| Build app | `.github/workflows/build.yml` | the old app's paths; dispatch | the classic app (`classic.html`), kept for rollback; it never writes `index.html` |

GitHub runs this repo's scheduled workflows hours late (BUGS.md #26). The Worker's cron (`site/wrangler.jsonc`) starts the Monitor and the Facts bot on time through the workflow_dispatch API once its `GITHUB_TOKEN` secret is set; `https://matchweek.gg/__worker` says whether it is.

## Branches

| Branch | Holds | Written by |
|---|---|---|
| `main` | everything; the app's source, Code.gs, the site, the docs, the builds | people and Claude sessions (pushes), the build workflow (the six root files and the demo), the preview workflow (the folder `/preview/`) |
| `preview` | a build for Parker's eye before it reaches the league: the app's source with a change he asked to see first | Claude sessions; the preview workflow publishes it as the folder `/preview/` on `main`, and a merge into `main` ships it |
| `release` | the last `Code.gs` that passed every suite; the live script installs from it | the Code.gs tests and release workflow only, fast-forward only |
| `facts` | `facts/*.json`, the Facts bot's output; orphan, so `main` stays clean | the Facts bot only |

Never push to `release` or `facts` by hand, and never force-push.

## The public site and the demo

`site/public/` is matchweek.gg: the landing page, `setup.html` (the create-your-league wizard, static for now), `status.html` (reads `?health=1`, the facts index and the open outage issues in the browser and says in words what is working), the legal pages, the sample recaps and `demo/`. The Worker serves them untouched and answers `/__worker`. The demo is the current app built with `__MW_DEMO__` on a frozen, anonymised snapshot: every real team, manager and first name becomes a fictional one derived from the rows themselves, players and clubs stay real, no EA asset is carried, every write is off; the build's leak check reads the real names from the live Standings tab when it runs and fails on any of them under `site/public` (`fplgg/tools/demo/README.md`).

## The trust model

- The Sheet is public and read only to the world; only Code.gs writes it.
- The web app writes only what a signed-in manager asked for; the commissioner (`EMT_COMMISH`, Cold Palmers by default) alone can approve, rewrite or take down an article.
- The repo is the trust anchor for code and facts: the live script installs only a commit that passed the gate, and reads facts files from a branch only the Facts bot writes.
- No secret is in the repo, a prompt, a message, an Action or the Worker, apart from the Worker's own `GITHUB_TOKEN` for dispatching workflows. The two API keys are Script Properties Parker sets.
- Nothing fetches new player faces; the public demo carries no EA asset.

## Tests

Plain Node, no dependencies, all in `tests/`: `tests/codegs/*.js` load Code.gs in a vm with mocked Apps Script services (one file per version, `harness.js` shared); `tests/app-*.js` load the app's modules in a vm; `tests/factsbot.js`, `tests/monitor.js`, `tests/parity.js`, `tests/worker.js`, `tests/status.js` cover the cloud jobs, the Worker and the status page; `tests/app-docs.js` checks that this page, RUNBOOK.md and the READMEs name only files, workflows and Script Properties that exist. CLAUDE.md lists what to run before a push; the gate runs all of it.
