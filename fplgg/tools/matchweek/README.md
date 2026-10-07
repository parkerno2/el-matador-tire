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

The data still comes from the Google Sheet through gviz. Logins and profiles still go through the Apps Script in `Code.gs` (v3.7 adds custom club colours and patterns).

## Source

`matchweek-src.tar.gz` holds the full source: `src/`, the templates, `build.sh`, `core.gen.js`, the extractor and QA tools, and `BRIEF.md` (the design constraints and contracts). Checked on 7 Oct 2026: it rebuilds the live `app.js`, `app.css` and `core.js` byte for byte, and `index.html` and `sw.js` differ only in the build stamp.

```bash
mkdir matchweek && tar -xzf matchweek-src.tar.gz -C matchweek && cd matchweek
(cd tools && npm install)          # esbuild, acorn, postcss
bash build.sh out                  # → out/{index.html,app.js,app.css,core.js,sw.js,manifest.webmanifest}
```

`build.sh` also makes a QA harness site in `out/site`. It symlinks the repo's faces/icons from `/home/claude/emt`; change that path to wherever the repo is checked out. `tools/sweep.py` opens every route and sheet before kick-off, live and after full time, at the widths you give it. It reports errors and horizontal overflow and takes screenshots. It needs Playwright.

Layout of `src/`: `main.js` (router `#/page/sub/args`, bottom sheets, refresh cadence, `window.MW`), `ui.js` (shared helpers: crests, team colours, plates, title odds with `warmOdds`), `pages/{matchday,team,league,feed}.js` plus their subfolders, `sheets/` (player, manager, identity, search, menu, kit), `feed/` (the four voices), `css/`.

## Deploying

1. `bash build.sh out`
2. Upload the six files from `out/` to the repo root on GitHub (Add file → Upload files) and commit. `?v=BUILD` busts the caches, and the new SW clears old caches when it activates.
3. A phone that had the old app open may need one pull-to-refresh.

## Rollback

Upload `classic.html` as `index.html`. The new `sw.js` works with it.

## Don't

- Don't run the "Build app" workflow's ship step or `port_preview_to_prod.py` and expect them to update `index.html`. The workflow now writes `classic.html` only, and the port script refuses `index.html`.
- `core.gen.js` comes from the classic app's source (`src-prod/`). Regenerate it with `cd tools && node extract.js` only when the engine itself changes, then check the numbers against `classic.html`.
