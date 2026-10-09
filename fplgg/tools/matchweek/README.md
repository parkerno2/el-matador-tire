# Matchweek app (index.html since 7 Oct 2026)

The league app at https://parkerno2.github.io/el-matador-tire/ is the Matchweek front end. The old app is still at `classic.html` for rollback.

## What ships

| File | What it is |
|---|---|
| `index.html` | A shell: fonts, `#app`, the Plate card gradient defs, `core.js?v=BUILD`, `app.js?v=BUILD` |
| `core.js` | The data engine, extracted from the classic app (`tools/extract.js`). It's a classic script, so its globals (`D`, `TEAMS`, `PROFILE`…) are bare `let`/`const` and are not on `window` |
| `app.js` | The UI: ES modules in `src/`, bundled by esbuild into an IIFE (es2020) |
| `app.css` | `src/css/*.css`, concatenated in name order |
| `sw.js` | VERSION `emt-v20-BUILD`. Navigations and js/css/html/json are network-first; images are cache-first; data from other origins goes straight to the network |
| `manifest.webmanifest` | Same name as before ("FPL Companion"), base colour #0E0A13 |

The data comes from the Google Sheet through gviz by default. `?data=supabase` in the app's URL switches this phone to the Supabase project's public `tabs` function (ROADMAP B3, `src/data/tabs.js`: the same tab names and columns, the rows shaped like gviz's, the same header guard; the tabs the web app writes (Managers, Social, Posts, Specials) and any tab Supabase lacks stay on the Sheet; `MW.data.report()` in the console says where each tab came from; `?data=sheet` goes back). Logins and profiles go through the Apps Script in `Code.gs` (v3.7 adds custom club colours and patterns).

## Source

This folder is the source of truth. Edit it here; never edit the six root files by hand (the next build overwrites them).

| Path | What it is |
|---|---|
| `src/` | The UI as ES modules, bundled into `app.js`. `src/css/*.css` become `app.css` |
| `league.json` | The league's config (ROADMAP C1): teams (manager, first name, initials, short name, colour, projection prior), aliases (a former team name), derbies, seeded series, Manager of the Month periods, the pot, and `ratings` (`ea`: the FC27 overall where there is one; `house`: Matchweek's own from the FPL projection, no EA tab read, ROADMAP C3). `tools/league.js` checks it and writes the `const LEAGUE={...}` header |
| `core.gen.js` | Becomes `core.js` with the LEAGUE header in front; the engine builds TEAMS, TEAM_ALIAS, MATCH, SEED, FIRST, SHORTOF and PERIODS from `LEAGUE` and refuses to load without it |
| `index.template.html`, `sw.template.js`, `manifest.template.webmanifest` | Become `index.html`, `sw.js`, `manifest.webmanifest`; `__BUILD__` is replaced by the build stamp |
| `package.json`, `package-lock.json` | Pin esbuild 0.28.2 for the build |
| `ci-build.sh` | The build. Writes the six files straight into the repo root and nothing else |
| `build.sh` | The older local build into `out/`, plus the QA harness site (`out/site`), which symlinks faces/icons from `/home/claude/emt`; change that path to wherever the repo is checked out |
| `tools/` | Extractor (`extract.js` → `core.gen.js`, `cardcss.js` → `plate.gen.css`) and QA tools (`sweep.py`, `mw.py`, `compare.py`; they need Playwright and the harness). Own `package.json` (acorn, postcss, esbuild) |
| `src-prod/` | The classic app's source, input to the extractor |
| `BRIEF.md`, `DATA-SAMPLE.json` | Design constraints and contracts, sample data |

Layout of `src/`: `main.js` (router `#/page/sub/args`, bottom sheets, refresh cadence, `window.MW`), `ui.js` (shared helpers: crests, team colours, plates, title odds with `warmOdds`), `pages/{matchday,team,league,feed}.js` plus their subfolders, `sheets/` (player, manager, identity, search, menu, kit), `feed/` (the four voices), `css/`.

Until 8 Oct 2026 the source lived in `matchweek-src.tar.gz` (still in git history). On unpacking, `ci-build.sh` rebuilt the live `app.js`, `app.css`, `core.js` and `manifest.webmanifest` byte for byte; `index.html` and `sw.js` differed only in the build stamp.

## The demo league

matchweek.gg/demo/ is this app built with `__MW_DEMO__` (esbuild define) on a frozen, anonymised snapshot of the league's tabs: `fplgg/tools/demo/build-demo.js`, run by the same workflow after `ci-build.sh` and once a day. `src/data/tabs.js` (`DEMO`) is where the demo behaves differently (its data source, every write off, no service worker, the label). See `fplgg/tools/demo/README.md`.

## Deploying

Push a change under `fplgg/tools/matchweek/` to `main`. The **Build Matchweek app** workflow (`.github/workflows/matchweek.yml`) runs `npm ci` and `ci-build.sh` here and commits the six root files as el-matador-build (`build: matchweek app from <sha>`). Actions tab → Build Matchweek app → Run workflow rebuilds without a source change. `?v=BUILD` busts the caches, and the new SW clears old caches when it activates. A phone that had the old app open may need one pull-to-refresh.

To build by hand:

```bash
cd fplgg/tools/matchweek
npm ci
bash ci-build.sh                   # → ../../../{index.html,app.js,app.css,core.js,sw.js,manifest.webmanifest}
```

## Rollback

Upload `classic.html` as `index.html`. The new `sw.js` works with it.

## Don't

- Don't run the "Build app" workflow's ship step or `port_preview_to_prod.py` and expect them to update `index.html`. The workflow now writes `classic.html` only, and the port script refuses `index.html`.
- `core.gen.js` comes from the classic app's source (`src-prod/`). Regenerate it with `cd tools && node extract.js` only when the engine itself changes, then check the numbers against `classic.html`.
- Don't upload or edit `index.html`, `app.js`, `app.css`, `core.js`, `sw.js` or `manifest.webmanifest` at the repo root by hand: change the source here and let the workflow build them, or the next build undoes the edit.
