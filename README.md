# El Matador Tire / Matchweek

The 8-manager FPL Draft league app (league 45380), and the product it is becoming: **Matchweek**, at https://matchweek.gg. Everything in this repo runs in the cloud; nothing needs anyone's computer.

| What | Where | Read |
|---|---|---|
| The league app | https://parkerno2.github.io/el-matador-tire/ (the six root files, built by a workflow) | `fplgg/tools/matchweek/README.md` |
| Its source | `fplgg/tools/matchweek/` (`src/`, `league.json`, the engine `core.gen.js`) | the same README |
| The backend | `Code.gs` (Apps Script on the league's Google Sheet: data refresh, logins, social, the feed writer, the Gameweek Show, the articles, the self-update) | its header's CHANGELOG, `fplgg/tools/matchweek/docs/ARTICLES.md` |
| matchweek.gg | `site/` (the landing page, the setup wizard, the status page, the demo league, legal pages, the Worker) | `site/README.md`, `fplgg/tools/demo/README.md` |
| The cloud jobs | `fplgg/tools/monitor/`, `fplgg/tools/factsbot/`, `fplgg/tools/parity/`, `.github/workflows/` | `fplgg/tools/factsbot/README.md`, `fplgg/tools/parity/README.md` |
| The show scripts | `show/gw<N>.json` | the CHANGELOG, `docs/TONE.md` |
| Tests | `tests/` (plain Node; the CI gate runs them all) | `tests/README.md`, `tests/codegs/README.md` |

## Docs

- `CLAUDE.md`: the rules every change obeys, what lives where, what to run before a push.
- `fplgg/tools/matchweek/docs/ARCHITECTURE.md`: how the pieces fit: the Sheet and its tabs, the app, Code.gs and its triggers, the workflows, the branches, the trust model.
- `fplgg/tools/matchweek/docs/RUNBOOK.md`: where to look when something seems off, the symptoms and what to do, the Script Properties that change behaviour, when not to ship.
- `fplgg/tools/matchweek/docs/ROADMAP.md`: what is next and what shipped.
- `fplgg/tools/matchweek/docs/BUGS.md`: what is known to be wrong, and the audit log.
- `fplgg/tools/matchweek/docs/TONE.md`: the voices and the tone every writer follows.
- `fplgg/tools/matchweek/docs/ARTICLES.md`: the recap and preview pipeline and its contracts.

## Branches

`main` is everything. `release` is the last `Code.gs` that passed every suite; the live script installs from it. `facts` holds the Facts bot's files. Only the workflows write the last two.
