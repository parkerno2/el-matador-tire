# Articles in the cloud: recaps and previews without Parker's computer (Code.gs v3.13 and the app)

## Why
Matchweek (the El Matador Tire FPL Draft league app) has weekly long-form articles: a **recap** after each gameweek and a **preview** before each deadline. Until now a Claude session on Parker's computer wrote a draft, Parker approved it in chat, and then hand-built HTML pages were uploaded through his Chrome. That stalled: the app says "Not published yet: GW5 recap and GW6 preview". Parker's bar is that **everything keeps running with his computer off**.

The new pipeline works like the Gameweek Show pipeline that already runs in the cloud (Code.gs v3.12):
1. Signed-in managers' phones send the facts. The app computes them from its own engine, so the article matches what the league sees.
2. Apps Script asks Claude to research the real football (web search) and write the article as JSON, through the **Message Batches API**. UrlFetchApp has a hard timeout of about 60 seconds, so no long synchronous calls are allowed.
3. The draft waits for the **commissioner** (Parker). He reads it in the app and can approve it, ask for a rewrite with a note, or drop it.
4. Once approved, every manager can read it in the app. The reader is native and the numbers on screen come from the app's own data.

~~Parker's rule stands: he reads every draft before anyone else sees it.~~ Changed in v3.14 (below): Parker, 8 Oct 2026, "i don't want to approve it just go for it i think for those from now on".

## v3.14: articles publish themselves (Code.gs v3.14 and the app)
- **Auto-publish is the default.** When an article passes the checks (after the punch-up, where v3.13 made the draft), `emtArtDone` publishes it: status `live`, the article as plain `'j:'` json, Approved (UTC) now, Log `Published automatically`. Approve, the automatic publish and the live swap share `emtArtLiveFields`. The list cache is cleared on every change, so `?articles=1` shows it at once.
- **Review mode.** Script Property `EMT_ART_REVIEW = yes` (case and spaces ignored) brings back the v3.13 flow unchanged: a sealed draft, approved in the app. In review mode a live article can be taken down but not rewritten (`articlemod redo` answers `live`).
- **Rewrite of a live article** (commissioner only, `articlemod` op `redo`, note up to 400 characters, 3 rewrites an article, queued in `EMT_ART_QUEUE` while another job runs):
  - The row keeps status `live` and its Article cell keeps the live version, so `?articles=1` and `?article=` go on serving it. The Note cell gets `pend: 'writing'` (`emtArtLiveRw`); the job carries `live: true` and goes straight to the write phase from the stored research, with the published version and the note in the prompt.
  - The new version is written in ArticleWork like any rewrite (sealed while it waits for its punch-up). When it passes, `emtArtDone` swaps it into the Article cell: Written and Model updated, Approved kept (the first publish), `pend` cleared, Log `The new version replaced the live one`.
  - When it fails (3 tries, 36 hours, no facts, no model), `emtArtFail` leaves the live version exactly as it was and sets `pend: 'failed'`; the Log says `the rewrite failed, so the live version stays up as it was`. A failed rewrite is never restarted by itself; he can ask again while rewrites are left.
  - A lost job is found again through `pend` (`emtArtNext`). A drop during the rewrite takes the article down, seals it, clears `pend` and cancels the batch.
- **Contract additions.** `?articles=1`: `review` (read fresh, never from the cache) and each live article's `written` (changes when a rewrite replaces the text, so phones refetch). `?article=<id>`: `auto` (published without a manual approval). `POST articles` (commissioner): `review` and `live: [{id, gw, kind, redos, note, rewrite: '' | 'writing' | 'failed', error?}]`; everyone else still gets `{ok, commish:false, drafts:[]}`. `?health=1`: `articles.mode` (`auto` | `review`), `job.live`, `last[].rewrite`. `articlesStatus()`: a `Mode:` line and any rewrite in progress.
- **App.** A live sheet article ends with a **Commissioner** panel for him only: Ask for a rewrite (the same note box as drafts) and Take down (in-app confirm, never `window.confirm`). While a rewrite runs the reader keeps the live version, with a quiet "Rewrite in progress" line only he sees. "Waiting for your read" shows only when there is a draft (review mode) or a failed article (Try again). The waiting line says "GW6 preview: being written" and never mentions his read in auto mode. The credit line says "Checked automatically before it went out." for an auto-published article. A server without `review` (v3.13) counts as review mode.
- **Tests:** `tests/codegs/v314.js` (51 checks); `v313.js` now ends its flows live and runs its approval and draft sections with `EMT_ART_REVIEW = yes`.

## Ground rules for every agent
- Never run `git reset`, `git checkout -- .` or `git clean` in /home/claude/emt. An uncommitted Code.gs was once lost that way.
- Don't commit, push or deploy anything. Don't use Chrome or browser tools. The main session deploys.
- No API keys anywhere. Code reads `ANTHROPIC_API_KEY` from Script Properties through the existing `emtAiKey()`.
- Product design rules:
  - no emoji anywhere in the UI or in prompts' example outputs;
  - every number shown is real (traceable to data);
  - the voices are fictional;
  - the palette is purple and blue (the app's existing tokens);
  - no em dashes or en dashes in generated article text.
- Backups exist: `scratchpad/gs/Code.v312.before-v313.gs` and `/home/claude/next-build/src.before-articles.bak/`.
- The scratchpad is `/tmp/claude-0/-home-claude/4118de0b-e063-5600-b2cd-be0d31b44131/scratchpad` (called SP below).

## The contract between the app and Apps Script (both sides must match exactly)

### Facts, from app to server
- **Preview facts:** these reuse the existing `showfacts` action and payload, i.e. `computeFacts()` in `src/feed/showfacts.js`, extended with the extra keys below.
  - The app's send window widens from 30 h to **54 h** before the deadline. Keep it at one post per 3-hour slot.
  - On the server, `emtShowFacts` must accept posts up to 54 h before the deadline. Check whether it limits timing today.
  - `showWriterTick` keeps its own 22 h, 6 h-fresh rules.
- **Recap facts:** a new action:
  `POST {action:'artfacts', team, token, gw, kind:'recap', facts:'<json string>'}`
  - It uses the same auth (`emtVerify`), the same 20-minute per-manager rate limit and the same ≤60000-character cap as showfacts.
  - It is stored in a new hidden tab `RecapFacts`, with the same head and chunking as ShowFacts (`EMT_FACTS_HEAD`).
  - The server validates it:
    - `kind === 'recap'`;
    - every H2H Fixtures row of that gw is Finished;
    - the facts have exactly those fixtures (home/away names);
    - each fixture's `hs`/`as` equals the sheet's Home pts / Away pts.

    If any of these fails, it returns `{ok:false, error:'notdone'|'fixtures'|'scores'|...}`.
  - The app sends recap facts when a manager is signed in and every H2H fixture of the latest finished gw (`D.gwsDone`) is finished, up to 5 days after that gw's last club fixture, at most once per 3-hour slot (localStorage key `emt-recapfacts`).

**Recap facts shape.** Keys are compact. Omit a field only when the app truly doesn't have it.
```json
{
  "kind": "recap", "gw": 6,
  "table": [{"pos":1,"team":"Cold Palmers","mgr":"Parker","w":4,"d":0,"l":2,"pts":12,"pf":300,"pa":250,"gwPts":55}],
  "fixtures": [{
    "home": "Cold Palmers", "away": "Devils U21s", "derby": "The Nolan Derby",
    "hs": 55, "as": 42,
    "rec": {"home": 3, "away": 1, "d": 0},
    "H": {"team": "Cold Palmers", "mgr": "Parker", "pts": 55, "xp": 48.2, "bonus": 6, "formation": "3-4-3",
          "xi": [{"code":"223094","name":"Haaland","pos":"FWD","club":"MCI","pts":13,"mins":90,"g":2,"a":0,"cs":0,"bonus":3,"xp":9.1,"sub":null}],
          "bench": [{"code":"...","name":"...","pos":"DEF","club":"...","pts":2,"mins":90,"used":false}]},
    "A": {"team": "Devils U21s", "mgr": "PJ", "pts": 42, "xp": 40.1, "bonus": 2, "formation": "4-4-2", "xi": [], "bench": []}
  }],
  "pl": [{"home":"Arsenal","away":"Chelsea","hs":2,"as":1,"ko":"2026-10-10T11:30:00Z"}],
  "rosters": {"Cold Palmers": ["Haaland (MCI)", "Saka (ARS)"]},
  "free": [{"code":"...","name":"...","pos":"MID","club":"...","pts":9}],
  "moves": [{"gw":6,"team":"Cold Palmers","in":"Player A","out":"Player B","kind":"waiver"}],
  "next": {"gw": 7, "deadline": "2026-10-17T10:00:00Z", "fixtures": [{"home":"...","away":"...","derby":null}]},
  "quotes": [{"team":"Cold Palmers","mgr":"Parker","line":"..."}]
}
```
Field notes:
- `rec` is the all-time series after this result.
- In `xi`, `sub` is "in" for an auto-sub who came on, "out" for a starter who was subbed off, otherwise null.
- `free` is the top 8 unowned players by this gameweek's points.
- `moves` lists transactions since the previous gameweek's deadline.
- `quotes` are this gameweek's press-room quotes.

**Preview facts.** These are today's `computeFacts()` output (gw, deadline, table, fixtures with win, rec, H/A sides with xi, flags, opp, proj, formation, results, plus quotes), plus these new keys:
```json
{
  "kind": "preview",
  "collisions": [{"home":"Cold Palmers","away":"Devils U21s","games":[{"pl":"Arsenal v Chelsea","ko":"2026-10-10T11:30:00Z","H":["Saka","Raya"],"A":["Palmer"]}]}],
  "slate": [{"home":"Arsenal","away":"Chelsea","ko":"2026-10-10T11:30:00Z"}],
  "rosters": {"Cold Palmers": ["Haaland (MCI)"]},
  "moves": []
}
```
- `collisions` lists, for each league fixture, every real Premier League game this gameweek that has rostered players from **both** sides (starters and bench). This "who has who" map is the backbone of a preview.
- `slate` is every PL fixture this gameweek with its kickoff.

### Article JSON (Claude writes it, the server validates it, the app renders it)
```json
{
  "gw": 6, "kind": "recap",
  "title": "Bruno drops 23 in the Hasbulla Derby, and a penalty hits the post",
  "sub": "Four matches, the numbers behind them, and the waiver watch",
  "lede": "Two or three sentences that set up the week.",
  "matchups": [{
    "home": "<exact team name>", "away": "<exact team name>",
    "kicker": "The Nolan Derby",
    "star": {"code": "223094", "label": "Star of the match"},
    "story": "Two or three sentences: what happened and why, for someone who didn't watch.",
    "bullets": ["one line", "one line", "one line"],
    "number": {"value": "23", "caption": "Bruno's points, the most by any player this week"}
  }],
  "around": [{"h": "Around the league", "body": "A short paragraph.", "bullets": ["optional", "lines"]}],
  "sources": [{"name": "Sky Sports", "url": "https://www.skysports.com/..."}],
  "foot": "Scores are provisional until FPL confirms bonus."
}
```
Rules:
- There is one matchup per fixture, with names exactly as in the facts.
- `star.code` must be a player in that matchup's XI. For a recap it may also be a bench player, but only if the label is "The zero".
- Labels:
  - recap: "Star of the match" or "The zero";
  - preview: "Player to watch", "The limbo" (a doubt) or "The zero".
- `number.value` must be a number that appears in the facts.
- `around` has 1 to 4 sections:
  - recap: "Around the league", "Waiver watch", "Next up";
  - preview: "The slate", "Transfer clock", "Waiver wire".
- There are 2 to 12 sources, with real URLs from the research. The research may come back empty (see Writer below); then sources can be empty.
- Total words across all text fields: 600 to 1400.

### Serving and approval (server to app)
- `GET ?articles=1` returns:
  ```
  {ok:true, live:[{id,gw,kind,title,sub,approved}], waiting:[{gw,kind,status,since}], commish:'Cold Palmers'}
  ```
  - `live` is sorted newest first.
  - `waiting` covers status research, writing or draft. It carries metadata only and never content.
- `GET ?article=<id>` returns `{ok:true, id, gw, kind, approved, written, a:<article JSON>}` for **live** articles only. Otherwise it returns `{ok:false, error:'notfound'}`.
- `POST {action:'articles', team, token}` requires auth.
  - It returns `{ok:true, commish:boolean, drafts:[{id,gw,kind,status,written,model,note,redos,a:<article JSON or null while still writing>}]}`.
  - Drafts are returned only when the team is the commissioner; everyone else gets `drafts: []`.
- `POST {action:'articlemod', team, token, id, op, note}` is commissioner only.
  - `op: 'approve'`: the draft goes live and the approval time is recorded.
  - `op: 'redo'`: the server rewrites it with Parker's note (at most 400 characters, cleaned). It re-runs only the writing phase, reusing the research. At most 3 redos per article.
  - `op: 'drop'`: the article is dropped and is not rewritten automatically.
  - It returns `{ok:true, status}` or `{ok:false, error}`.
- **Commissioner** = Script Property `EMT_COMMISH` if it is set, otherwise `'Cold Palmers'` (Parker Nolan's team).

## Server: Code.gs v3.13. Edit only /home/claude/emt/Code.gs.
- **CHANGELOG:** add a v3.13 entry at the top of the header CHANGELOG. Self-update reads the version from the first `vX.Y` after CHANGELOG, so this matters. The entry needs a short plain-English summary and any setup. There should be no new setup: no new OAuth scopes, nothing for Parker to click.
- **`articleTick(startedAt)`:** called from `aiTick` in its own try/catch, after `showTick` and before `selfUpdateTick`.
  - It takes the script lock with tryLock, as the others do.
  - It skips when the run is already late (follow the `EMT_SHOW_WRITE_LATE_MS` pattern).
  - Script Property `EMT_ARTICLES_PAUSED = yes` pauses it.
  - It runs only when `emtAiOn()` (the key is set).
- **State:** one job at a time, kept in Script Property `EMT_ART_JOB` as `{id, gw, kind, phase:'research'|'write', batch, tries, redos, startedAt, note}`.
- **Hidden tab `Articles`:** head `['Id','GW','Kind','Status','Written (UTC)','Model','Facts received (UTC)','Research','Article','Note','Approved (UTC)','Log']`.
  - JSON cells start with the `EMT_JSON_MARK` ('j:'). Research is plain text, up to 45000 characters, with a 'b:' or similar marker so it can never read as a formula. Reuse `emtCell` where it fits.
  - Status is one of research, writing, draft, live, dropped, failed.
  - The `id` is `<kind>-gw<gw>-<6 random hex>`.
- **When to start a job:**
  - **Recap:** gw = the latest gw whose H2H rows are all Finished. Conditions: no Articles row for (gw, recap) in any status other than failed with tries left; RecapFacts for that gw received within the last 24 h; within 5 days of the gw finishing.
  - **Preview:** gw = the next gw with a deadline between now and 50 h ahead. Conditions: no Articles row for (gw, preview); ShowFacts for that gw received within the last 12 h (`emtShowFactsLatest`).
  - If both are due, the recap goes first.
- **Phase 1, research.** Submit a batch to `POST https://api.anthropic.com/v1/messages/batches`, with headers `x-api-key`, `anthropic-version: 2023-06-01`, content-type json, and one request whose custom_id is the job id plus '-r'.
  - Tool: `{type:'web_search_20250305', name:'web_search', max_uses:10}`. Model from the model chain (below), max_tokens 3000.
  - System prompt: research notes for a fantasy-football article.
    - **Recap:** for every real PL fixture in `pl`, how it happened (scorers and how, assists, red cards, missed penalties, VAR, manager quotes), plus news about rostered players who started on the bench or didn't play.
    - **Preview:** team news and pressers for every fixture in `slate`, injuries and doubts for rostered players with flags, and transfer or manager sagas touching rostered players. Date-check everything.
    - Output: plain-text notes grouped by fixture, each fact with its source name. End with a `SOURCES:` list of `name | url` lines.
  - The user message holds the trimmed facts it needs (pl/slate, the rostered names involved, the flags), not the whole facts.
- **Polling:** each tick, `GET /v1/messages/batches/<id>`.
  - When `processing_status === 'ended'`, fetch `results_url` (same headers) and parse the JSONL for our custom_id.
  - `succeeded`: concatenate all text blocks (citations make several), then store Research and the sources.
  - `stop_reason === 'pause_turn'`: submit a continuation batch with the assistant content appended unchanged. At most 2 continuations.
  - `errored` with web search unavailable or not enabled (HTTP 400 `invalid_request_error`): continue with empty research and log 'research unavailable: …'.
  - Other errors count as a try.
  - Batch older than 6 h: give up on it, count a try.
- **Phase 2, writing.** Submit a batch with custom_id job id plus '-w'. No tools, max_tokens 6000.
  - System prompt: the house style below.
  - User message: the full facts JSON, the research notes, the article JSON contract, and on a redo Parker's note plus the previous article.
- **Validation (`emtArticleCheck`).** The model output is parsed by taking the first '{' to the last '}'. Checks:
  - the schema and lengths above;
  - fixture names exact and complete;
  - star codes in the right XI or bench;
  - labels from the allowed set;
  - no '—' or '–'; no emoji (any char in the emoji ranges); no hashtags;
  - no first person ("I", "we", "our", "us" as words, outside quoted manager lines);
  - the **number guard**: every number in the text fields must appear in the facts or in the research notes. Reuse or adapt `emtShowNums` and `emtShowAllowed`. Small counting numbers 0 to 11 and years 2025 to 2027 are fine. Numbers inside quoted manager lines are exempt if the quote is in the facts' quotes;
  - `number.value` in the facts;
  - word count 600 to 1400.
- **On a failed check:** resubmit phase 2 once with the error list (that counts as part of the same try). At most 3 tries per job. After that, status failed with the log in Log.
- **On a passed check:** status draft, with Written, Model, Article.
- **Model chain:**
  - Add a helper `emtModelChain(prop, defaults)`: the Script Property value first if set, then the defaults.
  - Articles: `EMT_ARTICLE_MODEL`, defaults `['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-sonnet-4-5']`.
  - When a request fails because the model doesn't exist or is retired (HTTP 404 `not_found_error`, or a 400 mentioning the model), try the next model.
  - Apply the same chain to the existing writers:
    - show writer: `EMT_SHOW_MODEL`, defaults `['claude-sonnet-5-5', 'claude-sonnet-4-5']` (change `EMT_SHOW_WRITER_DEFAULT`);
    - AI writer: `EMT_AI_MODEL`, defaults `['claude-haiku-5-5', 'claude-haiku-4-5']`.

    (Claude Sonnet 4.5 retires 30 Nov 2026 and Haiku 4.5 soon after. Without the chain, the pipelines would die silently.) Keep existing behaviour otherwise, and keep the old tests passing.
- **Redo:** on `articlemod redo`, status goes to writing, note is stored, redos++, and a job is queued at phase write with the stored research. If another job is running, the redo waits its turn: queue it in Script Property `EMT_ART_QUEUE` as a small list.
- **Endpoints:** `doGet` gets `?articles=1` and `?article=<id>` (above). `emtHandle` gets `artfacts`, `articles` and `articlemod`.
- **`doGet ?health=1`:** returns no secrets, only `{ok:true, version, self: EMT_SELF_STATE, show: <the existing showStatus summary, or a short form>, articles: {job, last: <the last 3 Articles rows, metadata only>}, ai: {day, count}}`. Cloud monitors read pipeline health from it without anyone's computer.
- **Menu:** add "Articles: status" (logs the job and the latest rows) and "Articles: write now" (runs `articleTick` ignoring the window guards: the preview for the next gw, or the recap for the latest finished gw).
- **Logging:** write Logger.log lines that a human can read.
- **Tests: SP/gs/v313.js.** Use the same harness style as SP/gs/v312.js: vm, mock Sheet, mock UrlFetchApp, PropertiesService, LockService. Mock the Batches API (create, poll, results JSONL) and the Messages API. Cover:
  - an artfacts accept, and its rejects (notdone, scores mismatch, rate limit, auth);
  - a recap job end to end through research, then write, then draft;
  - a preview job from ShowFacts;
  - pause_turn continuation;
  - research errored with web search disabled, which continues;
  - an invalid article (dash, wrong star, bad number), which retries and then fails after 3 tries;
  - redo with a note;
  - approve and drop;
  - non-commish `articles` returning no drafts;
  - `?articles=1` and `?article=` returning only live articles and no draft content;
  - `?health=1`;
  - the model chain falling through on a 404;
  - aiTick calling `articleTick` without breaking the others.

  Use SP/show/facts.json (real GW6 facts) as the base for preview facts, and build a realistic recap facts fixture.
- **Old tests:** also run SP/gs/test.js, ai.js, show.js and v312.js; all must still pass. Update their expectations only where the model-default change requires it, and say so.
- `node --check` the file, as is done for Code.gs today: copy it to a .js and check it.

## House style for the writer prompt (from Parker's feedback on GW1 to GW4; do not relitigate)
- It is not a stats dump. Recap: "official summary of every single game, why did it happen, for someone that didn't watch". Football first, stats as seasoning. xP appears only where it answers "was this real?"
- An objective third-person narrator. Never first person, never "we" or "our". Managers are named by first name (`mgr`), clubs by team name.
- Use the league's derby names; they lead the kicker. With no derby name, use a plain kicker.
- Recap per matchup: kicker, then the star (or "The zero" for a memorable failure), a 2 to 3 sentence story, 3 one-line bullets, and a "Number of the match" with caption.
- Preview per matchup: built around **who has who**, from the collisions: same-club stacks, direct duels (his striker against your keeper), split back lines. Forward-looking, with last week only as one-line seasoning. "Player to watch", or "The limbo" when the story is a doubt. Predicted scores are labelled as predicted and never look like real scores. Keep numbers that drift (win %, projections) to a minimum; the screen shows the live figures.
- Jokes are minimal and dry. No forced bits, no repeated pet phrase, no cute unexplained coinages.
- **No contradictions.** Check player ownership against rosters: never suggest picking up a rostered player and never imply one is a free agent. Each fact is stated once. Scorelines stay consistent.
- Banter stays inside the league: picks, form, table, quotes, trades. Nothing about looks, family, health, money, work or anyone's life outside the league. Quotes come only from managers' real press-room lines in the facts, never invented. Real footballers appear only as footballers.
- About 1,100 words, a 90-second read.
- **Foot:**
  - recap: "Scores are provisional until FPL confirms bonus and stat corrections." plus any dispute;
  - preview: "Predicted scores come from each side's projected XI; flags can change at Friday's pressers."

## App: edit only /home/claude/next-build/src (and its CSS)
- **Build:** `cd /home/claude/next-build && ./build.sh dist`. It bundles with esbuild; the CSS is `src/css/*.css` concatenated.
- **Globals:** core.gen.js provides classic globals (D, TEAMS, FIRSTOF, hpWin, mpxWinPct, teamProj, projOf, autoSubs, formation, SEED, LIVEH2H, pairKey, derbyName, gwDeadline, authRead, authPost, authBuildReq, RECAPS, PREVIEWS, and others). Read core.gen.js, which is large, with grep.
- **Harness:** `tools/mw.py` gives `MW(state='pre'|'live'|'ft'|'now', api=callback)` with ctx.route overrides. `tools/sweep.py OUTDIR 320,390 pre,live,now` runs pages at phone widths and reports errors, scrollW and render_ms. Read both tools to learn them.
- **Facts:**
  1. Extend `src/feed/showfacts.js`: add `computeRecapFacts()` and `maybeSendRecapFacts()`, matching the contract above exactly.
  2. Add `collisions`, `slate`, `rosters`, `moves` and `kind:'preview'` to `computeFacts()`, and widen its window to 54 h.
  3. Use the app's own engine, the same functions the matchup page and League pages use, for points, xP, auto-subs, bonus and series, so the recap's numbers equal what the app shows.
  4. Hook it the same way `maybeSendFacts` is hooked in main.js.
- **Articles in the Feed:** Feed → Articles is `articles()` in src/pages/feed.js.
  - Merge the built-in RECAPS/PREVIEWS, which keep linking to their HTML pages, with **live sheet articles** from `D.api + '?articles=1'`. Cache the response in localStorage with try/catch and refresh it on Feed mount (`warm`).
  - A sheet article opens the native reader at the route `#/feed/articles/<id>`. Follow the router conventions in main.js and pages/feed.js.
  - Live articles also appear as Feed posts, where `src/feed/build.js` makes `recap:`/`preview:` items, linking in-app.
  - The "Not published yet" note uses `waiting`, e.g. "GW6 preview: written, waiting for the commissioner's read" or "GW6 recap: being written". The commissioner is shown by first name via FIRSTOF(commish).
- **The reader** (new file, e.g. src/feed/article.js, plus CSS in a new src/css file). It is a premium native page in the app's design language: tokens, UI helpers, crests, faces. Look at how matchup.js and post-sheet.js render faces, crests and chips, and reuse those helpers. It contains:
  - a header with a GW pill, Recap or Preview, the title, the sub and the lede;
  - one block per matchup:
    - the kicker;
    - the score header from the app's own data: the real H2H result for a recap, and for a preview the predicted score from the app's projection engine, labelled PREDICTED;
    - the star strip with face, name, club and the label, plus the player's real GW points for a recap or projection for a preview;
    - the story, the 3 bullets;
    - chips computed by the app: recap gets xP for both sides, bonus for both sides and the series; preview gets Predicted, Flags for both sides and the series;
    - the number tile;
  - the around sections, a sources list (linked, opening in a new tab) and the foot;
  - a small line: "Written with AI from league data and match reports. Approved by <commish first name>."

  It must work at 320 to 430 px wide with no horizontal scroll. Back goes to Feed → Articles.
- **Commissioner review:** when the signed-in team gets `commish:true` from `POST articles`:
  - Feed → Articles shows a "Waiting for your read" section on top, one card per draft with status draft. Drafts still being written show as "being written".
  - The reader in draft mode has a banner, "Draft. Only you can see this until you approve it.", and three actions:
    - **Approve and publish**;
    - **Ask for a rewrite**, which opens a small text box of at most 400 characters plus Send;
    - **Drop it**, behind a confirm step done in-app, never `window.confirm`.
  - Each action calls `articlemod`, then refreshes. Use the app's existing toast or notice pattern if there is one.
- **Legal links:** the menu sheet (src/sheets/menu.js) gets small links to `privacy.html` and `terms.html` (repo-root pages; the main session uploads them).
- **Tests:**
  - Build.
  - In the harness, mock `?articles=1`, `?article=<id>` and the POST actions through ctx.route on D.api. Screenshot at 390 px:
    - Feed → Articles with a live article and a waiting one;
    - the reader for a recap and for a preview;
    - the commissioner draft view with actions (sign in through the harness or stub `authRead`).
  - Confirm no console errors and scrollW equals W.
  - Run the existing sweep `tools/sweep.py SP/articles/sweep 320,390 pre,live,now`; it must stay clean.
  - Dump a real computed recap facts JSON (harness state 'ft', or whichever has a finished gw) to SP/articles/recap-facts.sample.json, and preview facts to SP/articles/preview-facts.sample.json. Check that their sizes are under 60000 characters.
- Write screenshots to SP/articles/shots/.

## Done means
- Every test passes.
- The final message lists the files changed, what was tested and anything left open.
- Be honest about anything unverified.
