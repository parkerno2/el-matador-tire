# El Matador Tire / Matchweek: notes for Claude sessions

This repo runs Parker's 8-manager FPL Draft league app (El Matador Tire). The product name is **Matchweek**. **Rule zero:** everything runs without Parker's computer, so never add a step that needs it.

## What lives where

| Piece | Source | How it deploys |
|---|---|---|
| League app (https://parkerno2.github.io/el-matador-tire/) | `fplgg/tools/matchweek/` (see its README) | Push to `main`. `.github/workflows/matchweek.yml` builds the six root files (`index.html app.js app.css core.js sw.js manifest.webmanifest`). Never edit those six by hand. |
| Apps Script backend (data refresh, logins, social, AI writer, Gameweek Show voice, recap/preview articles) | `Code.gs` at the root | Push to `main`. The script's hourly self-update pulls `raw.githubusercontent.com/.../main/Code.gs`, saves it, makes a new version and redeploys the web app. The version is the first `vX.Y` after `CHANGELOG` in the header, so bump it there. |
| matchweek.gg (landing, demo, legal) | `site/public/`, config `site/wrangler.jsonc` | Cloudflare Workers Builds deploys on every push to `main`. |
| Gameweek Show scripts | `show/gw<N>.json`, optional (the repo copy wins over an AI-written one) | Apps Script voices new lines with ElevenLabs within 15 min. |
| Faces | `faces/` | `.github/workflows/faces.yml`, daily. |

The data lives in the public Google Sheet `1rIj4A3-lkSfg1rTuAh3yJL-K7LP4EOYkwWZiItZaoHk`. Read any tab with `gviz/tq?tqx=out:csv&sheet=<Tab>`. Hidden tabs are readable by anyone with the ID, so unapproved article drafts are stored encrypted (`EMT_ART_SEAL`).

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
- **Articles:** Parker, as commissioner (team Cold Palmers, `EMT_COMMISH`), approves every recap and preview draft in the app before the league sees it. Never publish around that.
- **Testing before you push:**
  - App: test changes with `cd fplgg/tools/matchweek && npm ci && bash ci-build.sh`.
  - Code.gs: run `node tests/codegs/<file>.js` for v313, v312, show and test; all must print ALL PASS. A broken Code.gs on `main` goes live within the hour.
  - Run `node --check` on a `.js` copy of Code.gs.

## Pipelines (Code.gs v3.13)
- **`aiTick`, every 15 minutes:**
  1. `aiWriterTick`: feed posts on Haiku.
  2. `showWriterTick`: show script on Sonnet, with a Haiku punch-up.
  3. `showTick`: ElevenLabs voice.
  4. `articleTick`: recap and preview through the Message Batches API: research with web search, writing on Sonnet, then a Haiku punch-up. The draft waits for the commissioner.
  5. `selfUpdateTick`.
- **Facts:** phones send them (`showfacts` for previews and the show, `artfacts` for recaps), computed by the app's own engine, so articles match the screen.
- **Health:** `GET <web app>?health=1`. Without a browser, read the Articles, ShowScripts, RecapFacts and ShowFacts tabs over gviz.
- **Model chains:** every writer has a fallback chain (`EMT_*_MODEL` Script Property first), so a retired model falls through by itself.
