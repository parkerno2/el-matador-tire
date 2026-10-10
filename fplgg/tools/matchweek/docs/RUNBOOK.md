# Matchweek runbook (ROADMAP C4, 10 Oct 2026)

What to look at when something seems off, and what to do, without anyone's computer: every step here is a page in a browser, a Script Property in the Apps Script editor, a tap in the app, or a push to `main`. ARCHITECTURE.md says how the pieces fit; BUGS.md holds what is known to be wrong; CLAUDE.md holds the rules every change obeys. The scheduled builder runs these checks three times a day and records them in BUGS.md's Audit log.

## Where to look

| Question | Where |
|---|---|
| Is anything broken right now? | https://matchweek.gg/status.html says it in words. Behind it: the web app's `?health=1` (its URL is the Specials tab's `API URL` row), the open GitHub issues labelled `outage`, and the facts index `https://raw.githubusercontent.com/parkerno2/el-matador-tire/facts/facts/index.json` |
| Is the data fresh? | `?health=1` `data.updated` (the last refresh that finished), `attempted`, `live`, `liveWhy`. Fresh means under 2 hours, under 20 minutes while a match is on |
| Which Code.gs is live? | `?health=1` `version` and `self`. It should equal the first `vX.Y` after `CHANGELOG` in `Code.gs` on the `release` branch within about 2 hours of the commit that changed it |
| Did the last push go green? | the Actions tab: Build Matchweek app (the app and the demo) and Code.gs tests and release (the gate) |
| What are the writers doing? | `?health=1`: `articles` (`mode`, `job`, `last`), `show` (`clips` against `expected`, `render`, `credits`, `cap`, `hold`), `ai` (`count` today, `last`, `floor`), `facts` (where the newest facts came from, phone or repo), `errors` (what phones reported in 24 hours) |
| The rows behind that | the Sheet over gviz: `https://docs.google.com/spreadsheets/d/1rIj4A3-lkSfg1rTuAh3yJL-K7LP4EOYkwWZiItZaoHk/gviz/tq?tqx=out:csv&sheet=<Tab>` with the tab name URL-encoded. For Articles add `&tq=select%20A,B,C,D,E,F,G,K,L` and never read columns H to J of a row that is not live. gviz answers an unknown tab name with the first sheet (its header starts `Rank,Team,Manager,Grade`), so check the header first |
| The Apps Script log | the Apps Script editor's Executions page (the writers log in plain words); the menu's `Articles: status` writes the job and the latest rows to the log |

## Symptoms

### An outage issue is open
The Monitor opened it: the same check failed twice, 4 minutes apart, and the issue names which (the app, the Sheet, `?health=1`, the data's age, the FPL API, the self-update, an error spike). The Monitor closes it by itself on recovery. Read the check's detail, then the matching entry below. The Monitor's own runs may be hours apart while BUGS.md #26 stands (GitHub's scheduler); the Worker's cron fixes that once its `GITHUB_TOKEN` secret is set.

### `?health=1` does not answer, or answers without `ok: true`
The web app is down or throwing. The Executions page in the Apps Script editor shows the failing run and its line. The usual cause is a Code.gs that passed its tests but throws on the real Sheet: fix it on `main` (the gate and the self-update take it live within the hour), or, if the fix is not at hand, set the Script Property `EMT_SELF_UPDATE` to `off` and paste the previous `Code.gs` from the `release` branch's history into the editor, then Deploy, Manage deployments, edit the deployment at the `API URL` to a new version.

### The data is stale
`data.updated` is old and `attempted` is newer: `refreshAll` runs but fails; the Executions page says why (FPL's API down, a quota, a changed FPL field). `attempted` old too: the hourly trigger is gone; run `setup()` once from the editor, which reinstalls all three triggers. The FPL API itself answers at `https://draft.premierleague.com/api/game`; while FPL is down nothing here can refresh, and the app shows its stale banner.

### The self-update says refused, error, off, half or drift
- `refused: the repo has vX but this project runs vY, which is newer`: the Code.gs on `release` carries an older version number than the editor's. A push to `main` with the next free version fixes it.
- `refused: the repo copy has ...`: the file on `release` throws as it loads. The gate should have caught it; fix `main`.
- `off`: the self-update is not set up (the Apps Script API or its permission); the header's SETUP notes say what to click.
- `half`: the code is in and the web app switches on the next hourly check. Nothing to do.
- `drift`: the editor was edited by hand since the last update. The self-update leaves it alone until `release` changes or the menu's `Update Code.gs from GitHub now` is run, which installs the repo copy over the hand edit.
- `error`: read the message; it names the API call that failed.
Set `EMT_SELF_UPDATE` to `off` to stop the hourly check altogether; delete it to resume.

### A push to `main` turned Code.gs tests and release red
The league is safe: `release` only moves on a green run, so the live script keeps the previous version. Open the run, read which suite failed, fix `main`. Every suite runs locally with plain Node (CLAUDE.md, Testing before you push); the gate runs `tests/codegs/*.js` and `tests/*.js` by pattern and refuses fewer than 20 suites.

### A push turned Build Matchweek app red
The app did not change (the six root files are committed only by a green build). The usual causes: `league.json` fails a check in `tools/league.js`, an engine file out of step with `src-prod/`, or the demo's leak check found a real name under `site/public` (the log names the file and the word). Fix `main`; Actions, Build Matchweek app, Run workflow rebuilds without a source change.

### An article is stuck, failed or missing
- `articles.job` in research or writing for more than 6 hours: a batch that never ended. The job gives up on a batch older than 6 hours by itself and counts a try (3 tries a job); the Log column says what each try saw.
- `failed`: read the Log (the research line says when a budget ran out; the writing lines list the checks that failed). A row stays failed under the Code.gs version that failed it (3 tries, then no more); a newer Code.gs tries it once more by itself. The menu's `Articles: write now` starts the preview for the next gameweek or the recap for the latest finished one, ignoring the window guards.
- no row for a preview under 50 hours from a deadline, or for a recap within 5 days of a finished gameweek: the facts are missing. `?health=1` `facts` says where the newest came from; the Facts bot's index (above) says what the cloud sent. Actions, Facts bot, Run workflow with `force: yes` writes both kinds whatever the windows.
- A live article is wrong: Parker, signed in as the commissioner, opens it in the app and uses the Commissioner panel at its end: Ask for a rewrite (a note of up to 400 characters, at most 3 rewrites an article; the live version stays up until the new one passes) or Take down. The Script Property `EMT_ART_REVIEW` set to `yes` brings back approve-before-publish for every new article.
- Pause all article jobs: `EMT_ARTICLES_PAUSED` set to `yes`.

### The Gameweek Show is not there, or plays old lines
A show appears in the app only when every line has a current voiced take (`show.clips` equals `show.expected` and `stale` is 0); until then only the commissioner sees a quiet line with the count.
- `show.script` false and `source` repo: the script is `show/gw<N>.json` in the repo, which wins over an AI-written one; a changed file is voiced within 15 minutes.
- No script within 22 hours of the deadline: the writer needs preview facts under 6 hours old (`show.facts`), and `EMT_SHOW_PAUSED` must not be `yes`. `show.tries` counts the writer's attempts; the Executions page says why they failed.
- `show.render.ok` false: `render.error` says what ElevenLabs answered. `hold` set: a credit refusal; nothing renders until the reported reset, with an hourly balance read, and the menu's `Render the Gameweek Show now` lifts the hold after a top-up. `capped` true: this gameweek's script version used its allowance (its length plus a quarter, at most 3 versions a gameweek); `EMT_SHOW_GW_CAP_<gw>` caps the gameweek as a whole when set.
- `credits.from` is `count` with a 401 note: the ElevenLabs key lacks `user_read`, so the balance is counted locally against `EMT_SHOW_MONTHLY_LIMIT` (default 10,000 characters a month). A key with `user_read` makes it exact.
- `render.fallback` set: ElevenLabs refused v4 Turbo with a 400 or 422, so this gameweek is pinned to `eleven_multilingual_v2` (`EMT_SHOW_MODEL_GW_<gw>`). `EMT_TTS_MODEL` sets the model for every gameweek; `show.model.from` says `property` when it does.
- To replace a script by hand: commit `show/gw<N>.json` (the shape of `show/gw6.json`; audio tags in square brackets go to the voice only, at most two subtle ones a show). The old show is hidden until the new one is fully voiced.

### The Feed is quiet, or a voice is wrong
- `ai.count` is 0 on a quiet day is normal until 14:00 Chicago; after it the daily floor writes up to 2 posts from the data that changes daily (`ai.floor.why` says what it did: `wrote 2`, a quiet lane, or `live`, since the floor is off while a gameweek is live). `ai.last.error` names a failed call. The per-run cap is 2 and the per-day cap 6.
- `ai.on` false: no `ANTHROPIC_API_KEY`, or `EMT_AI_PAUSED` is `yes`.
- A post breaks TONE.md: the writers' prompts carry the tone block and the number guard drops a post with a number outside the facts; a post that got through is a prompt problem, which is a Code.gs change under the tone rules, not a Script Property. Never change the voices' names, lanes or tone without Parker.

### Errors reported by phones
`?health=1` `errors.h24` counts what phones posted to `clienterror` in 24 hours (`net24` of them network failures); the Monitor opens an issue at 20 in 24 hours. The hidden Errors tab holds the build stamp, the route, the message and a truncated stack, no personal data. A spike after a build means the build; Build Matchweek app, Run workflow on a fixed `main` ships the fix.

### The Monitor or the Facts bot has not run for hours
GitHub runs this repo's cron hours late (BUGS.md #26). Actions, Monitor (or Facts bot), Run workflow starts one now. The lasting fix is the Worker secret `GITHUB_TOKEN` (the click path is in #26); `https://matchweek.gg/__worker` answers `"token": true` once it is set, and the runs then come every 15 minutes and every 3 hours.

### The demo on matchweek.gg is old or shows a real name
The demo is rebuilt by every Build Matchweek app run and once a day at 06:41 UTC from a fresh snapshot; Run workflow refreshes it now. The build fails before committing when a real team, manager or first name appears under `site/public`, so a name on the live demo means the leak check's list (the live Standings tab) did not carry it: add the rule to `fplgg/tools/demo/names.js` and rebuild. Never edit `site/public/demo/` by hand.

### Supabase differs from the Sheet
The parity report (Actions, Supabase parity, the run's summary) is the reference; a difference is a report, not a failure. The gaps are on the ingest side, outside this repo (BUGS.md #29, ROADMAP B1 and B2). The app keeps the Sheet until a report says every tab agrees.

## Changing things

| To | Do |
|---|---|
| Ship an app change | edit `fplgg/tools/matchweek/src/` (the engine: `src-prod/` and `core.gen.js` together), run the tests and `ci-build.sh`, restore the six root files, push to `main`; the workflow builds and commits them and the demo |
| Ship a Code.gs change | a new first CHANGELOG entry with the next free version and `EMT_VERSION` to match, a `tests/codegs/v<version>.js`, every suite green, push to `main`; the gate fast-forwards `release` and the live script installs it within the hour |
| Change the league's teams, derbies, periods or pot | `fplgg/tools/matchweek/league.json`; `tools/league.js` refuses a bad one at build time; Code.gs keeps its own `MOTM_PERIODS` copy, which `tests/app-league.js` holds equal |
| Set a new API key | the Apps Script editor, Project Settings, Script Properties: `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`. Never in the repo, a prompt or a message |
| Change the commissioner | `EMT_COMMISH` (a team name; Cold Palmers when unset) |
| Set the Player of the Month | commit `fplgg/tools/matchweek/data/potm.json` on `main` (the newest month only: `month` as "September 2026", the FPL `code`, `player`, `club`, two `sources`); the gate checks it and the live script writes the Specials rows within the hour after the next refresh (`?health=1` `potm` says `from: file`). A hand edit of the Specials tab for the same month stands; the last read and any error are in `EMT_POTM` |
| Pin a writer to a model | `EMT_AI_MODEL`, `EMT_SHOW_MODEL`, `EMT_ARTICLE_MODEL`, `EMT_PUNCH_MODEL`; unset, each falls through its chain in the code. `EMT_PUNCH_OFF` set to `yes` skips the punch-up |
| Pause a pipeline | `EMT_AI_PAUSED` (feed posts), `EMT_SHOW_PAUSED` (the show's writer and voice), `EMT_ARTICLES_PAUSED` (articles), each `yes`; `EMT_SELF_UPDATE` set to `off` (the self-update) |
| Change the show's voice settings | `EMT_VOICE_ID`, `EMT_TTS_MODEL`, `EMT_SHOW_STABILITY` (0 to 1); the credit guard's `EMT_SHOW_MONTHLY_LIMIT` and `EMT_SHOW_GW_CAP_<gw>`. Never weaken the guard in code |
| Roll the app back | revert the source commit on `main` and let the workflow build; the old app is still served at `classic.html` for a reader who needs it |
| Roll Code.gs back | revert the commit on `main` with a new, higher version number (the self-update refuses an older one); the gate moves `release` and the script installs it |
| Start a job now | Actions, Run workflow (Monitor, Facts bot, Supabase parity, Build Matchweek app); the Apps Script menu (`Refresh now`, `Run the AI writer now`, `Render the Gameweek Show now`, `Update Code.gs from GitHub now`, `Articles: write now`) |

## When not to ship

Never ship code from a gameweek's deadline (the Matchweeks tab, `Deadline (UTC)`) until every H2H Fixtures row of that gameweek has `Finished` TRUE, unless it fixes an outage (an open `outage` issue, or `?health=1` not answering ok). Docs may go any time.
