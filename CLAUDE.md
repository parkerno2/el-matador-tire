# El Matador Tire / Matchweek: notes for Claude sessions

This repo runs Parker's 8-manager FPL Draft league app (El Matador Tire). The product name is **Matchweek**. **Rule zero:** everything runs without Parker's computer, so never add a step that needs it.

## What lives where

| Piece | Source | How it deploys |
|---|---|---|
| League app (https://parkerno2.github.io/el-matador-tire/) | `fplgg/tools/matchweek/` (see its README) | Push to `main`. `.github/workflows/matchweek.yml` builds the six root files (`index.html app.js app.css core.js sw.js manifest.webmanifest`). Never edit those six by hand. |
| Apps Script backend (data refresh, logins, social, AI writer, Gameweek Show voice, recap/preview articles) | `Code.gs` at the root | Push to `main`. `.github/workflows/codegs.yml` runs every suite in `tests/codegs` (plus `tests/factsbot.js`) and, only when all pass, fast-forwards the **`release` branch**. The script's hourly self-update pulls `raw.githubusercontent.com/.../release/Code.gs` (v3.16+), saves it, makes a new version and redeploys the web app, so a push that breaks a suite never goes live (the Action's run is red instead). The version is the first `vX.Y` after `CHANGELOG` in the header, so bump it there. Never push to `release` by hand. |
| matchweek.gg (landing, demo, legal) | `site/public/`, config `site/wrangler.jsonc` | Cloudflare Workers Builds deploys on every push to `main`. |
| Gameweek Show scripts | `show/gw<N>.json`, optional (the repo copy wins over an AI-written one) | Apps Script voices new lines with ElevenLabs within 15 min. |
| Faces | `faces/` | `.github/workflows/faces.yml`, daily. |
| Monitor (no AI) | `fplgg/tools/monitor/` | `.github/workflows/monitor.yml`, every 15 min: the app loads, the sheet and `?health=1` answer, the data is fresh (`data.updated`: 2 h, 20 min while a match is live), the FPL API answers, the self-update is not refused or in error. A check that fails twice 4 min apart opens one GitHub issue labelled `outage` (assigned to Parker, which notifies him); the monitor closes it on recovery. |
| Facts bot (the gameweek facts without a phone) | `fplgg/tools/factsbot/` | `.github/workflows/facts.yml`, every 3 h and on dispatch: loads the live app headless, computes `MW.facts.preview()` and `MW.facts.recap()`, commits `facts/*.json` to the **`facts` branch** (orphan; main stays clean). Code.gs v3.15+ reads them when a phone's facts are missing or older. |

The data lives in the public Google Sheet `1rIj4A3-lkSfg1rTuAh3yJL-K7LP4EOYkwWZiItZaoHk`. Read any tab with `gviz/tq?tqx=out:csv&sheet=<Tab>`. Hidden tabs are readable by anyone with the ID, so anything not yet published (drafts in review mode, a rewrite in progress, the commissioner's notes) is stored encrypted (`EMT_ART_SEAL`).

## Rules
- **Secrets:** never put a key, token or password in the repo, a prompt or a message. Keys live in Apps Script Script Properties (`ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`), which Parker sets himself.
- **Design:**
  - no emoji in the UI;
  - every number shown is real and traceable to data;
  - the voices are fictional (Malcolm Tyre, Archizio Poblano, Clark Moldridge, Jive Tidlsey);
  - the palette is purple and blue (app tokens);
  - no em or en dashes in generated text.
- **Tone** (Parker, 8 Oct 2026): funny means **clever, not rude**, aimed at eight early-20s lads on football Twitter.
  - Every joke rests on a real fact: irony, a team name or cliché turned back on itself, a precise football-Twitter parallel, or a deadpan undercut. Reference line: "Fully fit. Just shite."
  - Swearing is seasoning only.
  - Hard limits: nothing about anyone's real life (looks, family, partners, jobs, money, health); no slurs of any kind; nothing sexual.
  - See `fplgg/tools/matchweek/docs/TONE.md`.
- **Articles** (Parker, 8 Oct 2026: "i don't want to approve it just go for it"): recaps and previews publish automatically once they pass the checks. Parker, as commissioner (team Cold Palmers, `EMT_COMMISH`), fixes things afterwards from his phone: ask for a rewrite of a live article (the live version stays up until the new one passes) or take it down. Script Property `EMT_ART_REVIEW = yes` brings back approve-before-publish; respect it when it is set.
- **Testing before you push:**
  - App: test changes with `cd fplgg/tools/matchweek && npm ci && bash ci-build.sh`.
  - Code.gs: run `node tests/codegs/<file>.js` for v315, v314, v313, v312, show and test; all must print ALL PASS (test.js prints rows). The CI gate runs the same suites and only a passing commit reaches `release`, which the live script installs within the hour; a red run means the league keeps the previous Code.gs until main is fixed.
  - Facts bot: `node tests/factsbot.js` (and `NODE_PATH=/opt/node22/lib/node_modules node fplgg/tools/factsbot/factsbot.js --out /tmp/facts` runs it for real against the live app).
  - Run `node --check` on a `.js` copy of Code.gs.

## Pipelines (Code.gs v3.17)
- **`aiTick`, every 15 minutes:**
  1. `aiWriterTick`: feed posts on Haiku.
  2. `showWriterTick`: show script on Sonnet, with a Haiku punch-up.
  3. `showTick`: ElevenLabs voice.
  4. `articleTick`: recap and preview through the Message Batches API: research with web search, writing on Sonnet, then a Haiku punch-up. An article that passes the checks goes live at once (with `EMT_ART_REVIEW = yes` it waits as a draft for the commissioner).
  5. `selfUpdateTick` (from the `release` branch since v3.16).
- **Facts:** phones send them (`showfacts` for previews and the show, `artfacts` for recaps), computed by the app's own engine, so articles match the screen. Since v3.15 the Facts bot sends the same facts from the cloud (`facts` branch); Code.gs takes whichever is newer and checks a repo file exactly as a phone's post.
- **Health:** `GET <web app>?health=1` (`articles.mode` is `auto` or `review`; `facts` says where the newest preview and recap facts came from, phone or repo; `data` has `updated` (the last refresh from FPL that finished), `attempted`, `live` and `liveSince`). Without a browser, read the Articles, ShowScripts, RecapFacts and ShowFacts tabs over gviz, and `https://raw.githubusercontent.com/parkerno2/el-matador-tire/facts/facts/index.json`.
- **Model chains:** every writer has a fallback chain (`EMT_*_MODEL` Script Property first), so a retired model falls through by itself.
