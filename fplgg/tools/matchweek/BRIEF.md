# Matchweek front end — build brief (read all of it before writing code)

You are building one area of the new front end for **El Matador Tire**, an 8-manager FPL Draft league app (installed by the league as the PWA "FPL Companion"). It replaces the production app as soon as it is done, so it must be complete, correct and polished. The owner, Parker, was explicit: "No half measures. Audit everything and make it as good as possible." "Mature and sophisticated." "Don't settle for mediocre." Treat that as the bar for every pixel, number and sentence.

## 1. Principles from Parker (the constraint ledger — every one is binding)

1. **Three references.** FIFA/FC **Career Mode** for identity (your club becomes the theme; faces and Plate cards are the imagery; the social layer of voices). **FotMob** for the beauty and ease of stats (clean rows, coloured chips, lineups on a real pitch). **ESPN Fantasy** for prioritisation and hierarchy (the most important thing is biggest and first).
2. **Purple and blue are the core.** Dark base. Team colours are complementary accents in fixed places only: crests, a glow behind a crest, your own club's header and lineup pitch. In any matchup or comparison, **you = blue (#7A95FF), the opponent = light grey (#D3CADF)**; never two team colours side by side as data colours.
3. **Four core pages** (Matchday, My team, League, Feed). Each opens on an **overview of at most three blocks**, the most important one biggest. Everything else sits in sub-pages behind the pill switcher, or in sheets. Don't blast information up front.
4. **Formations matter.** The matchup is **both teams on one pitch, FotMob style**: opponent attacking down from the top, you attacking up from the bottom, faces in rings, points bubbles.
5. **Plate cards are locked.** Use the real `card()` renderer (via `UI.plate(p, width)`), never a redrawn stand-in. The lineup shows Plate cards on a pitch **tinted in your team colour**.
6. **Player page keeps the Plate card hero**; below it FotMob-style sections (next match, form chips, season tiles, match log, fixtures, FC 27 ratings as coloured numbers with bars).
7. **League:** the **full table is the hero graphic** (all eight teams, never demoted). Second: **Manager of the Month race as a tracker and a projection.** Third: the **$1,200 prize pool**, escalated (podium, payouts across 38 gameweeks). It's a 38-week league.
8. **Feed:** four fictional voices, each with its **own visual language**, a mix of Twitter-style and image posts, never stale or plain. Archizio Poblano (insider: black/white/lime #C6FF00, Archivo condensed 900), Clark Moldridge (The Terrace: red #E8222E / yellow #FFD60A, Anton with black outline, sticker face cut-outs), Malcolm Tyre (the booth: house purple/blue, Barlow Condensed scorebugs), Jive Tidlsey (assistant manager, only you: slate #1D3A31 tactics board, chalk #EEF3EA, chalk yellow #EAD27A, JetBrains Mono + one Caveat note). Voice looks stay **inside their own posts**; the app chrome stays purple and blue. Fictional characters only, **no invented quotes from real people**, no real catchphrases.
9. **Club identity:** any manager can change their colours easily (12 presets + Mono, or any custom colour, kept readable automatically; never blocked, only suggested).
10. **Pro polish with personality.** Loves the app's colours, the cards and the data depth. Hates gamer-font cheese, acronym-circle logos, filler. No emoji in the UI. No checkmark bullets. Plain, short copy in sentence case; no em dashes in sentences (en dash for scores and ranges is fine: 14–7, GW6–9). W–D–L always labelled.
11. **Every number is real** and matches the engine. Never fabricate a stat, a quote or a projection. If data is missing, say so gracefully.

## 2. Settled data semantics (don't relitigate)
- Per player: **PROJ** (FPL `ep_this`, frozen pre-deadline) before his match; **live points** while his match is on; banked **PTS** after. **xP** = what the performance deserved (bonus excluded). Never blur PROJ and xP.
- Matchup sub-line: PREDICTED (pre-deadline) → PROJ FINAL (mid-GW: actual for started + PROJ for the rest) → xP (GW finished).
- Win chance: `hpWin(fixture)` → {h,d,a,muH,muA,sd}. Title odds: `simulate()` (10,000 seasons) — updates at full time, not mid-game.
- Luck has two separate components: Performance (actual excl. bonus vs xP, `luckAgg()`) and Results (all-play, `schedLuck()`); never blended.
- Join players on `Code`, never id. Sheet values are strings; always `num()` them.
- Deadlines are stored in UTC; show local time to the user.
- Tiebreak: points for. H2H 3/1/0. Money: 1st $600, 2nd $180, 3rd $60, leader after GW19 $90, Manager of the Month 9 × $30 (periods in `PERIODS`).

## 3. Architecture (static site, no server, GitHub Pages)
- `core.js` — GENERATED, read-only: the production engine, verbatim. Declares globals: `D` (all data), `TEAMS`, `num`, `fin`, `esc`, `card`, `hpWin`, `hpPlayer`, `hpLive`, `hpTeam`, `hpTeamSd`, `teamProj`, `teamXP`, `simulate`, `luckAgg`, `schedLuck`, `xiOf`, `benchOf`, `squadOf`, `effXiOf`, `autoSubs`, `mscore`, `liveScoreOf`, `effPtsOf`, `derbyName`, `series`, `formOf`, `fdrOf`, `nextClubFixture`, `nextFixture`, `epOf`, `projOf`, `xpOf`, `bdOf`, `gwsRow`, `histRow`, `tierOf`, `ovrOf`, `dynOvr`, `formDelta`, `seasonTot`, `avgOf`, `plrAvg`, `plrPseudo`, `searchPlayers`, `nameMatch`, `PERIODS`, `PROFILE`, `CREST`, `AUTH`, `authRead`, `authPost`, `authBuildReq`, `authErrText`, `computeProvBonus`, `fxStarted`, `fxFinished`, `mpxData`/`mpx*` (matchup analytics), `tsxCalc` (team season), `psx*` (player sheet parts), `fbx*` (fixtures by week), `goldenBoot`, `mgrSeries`, `benchByGw`, `xiPtsMap`, `rankBars`, `leagueStats`, `squadHealth`, `nextFive`, `posAfter`, `teamResults`, `resFixtures`, `derbyRows`, `derbyMeta`, `RECAPS`, `PREVIEWS`, `gwDeadline`, … Full source: `/home/claude/next-build/core.gen.js` (grep it). These are **bare globals** (`let`/`const`), so in module code write `D`, `TEAMS`, `num(...)` directly, **never `window.D`**.
- The old production UI source, for feature parity and to learn how the engine is used: `/home/claude/next-build/src-prod/{base,v10,v12}.js` and `css0-2.css` (base = original app, v10/v12 = later layers that override base). Read the old renderer for your area before you design yours (e.g. `renderScoreboard`, `renderMatch`, `openProfile`, `renderTable`, `renderXIs`, `plStrip`, `openSheet`, `renderLab`, `luckCard`, `openClaim`, `openTeamEditor`, `resultsHTML`, `derbiesHTML`, `histHTML`, `tsxSeasonHTML`, `psxPreHTML`, `fbxWeekHTML`, `mpxBlock`). **Everything the old app shows must have a home in yours** unless it was dead code.
- Data dictionary with real sample rows: `/home/claude/next-build/DATA-SAMPLE.json`. Data loads once (`loadData()`), refreshes every 5 min (90 s while live); pages re-render from `D` on each refresh, so **render functions must be pure** (no fetching, no timers) and fast (< 40 ms).
- New front end source (ES modules, bundled with esbuild into one `app.js`; CSS files concatenated in name order into `app.css`):
  - `src/main.js` — boot, hash router (`#/page/sub/args…`), sheets, refresh, global taps. **Owned by the lead; don't edit.**
  - `src/ui.js` — shared helpers (read it fully): `esc, n, f1, pct, short, first, PRESETS, teamColors(team), crest(team, px), leagueCrest, glow(team, side), player(code), face(p|code, px, {ring,bg}), stack(list, px, max), plate(p, width), club, badge, flag, statusChip(p), chance(p), you(), setYou(team), signedIn(), week(), untilText, when, day, statePill, icon(name, size, color), appbar, pageHead(title, {bg, body, aside, under}), pills(items), sh(title, {more, href, aside}), navBar, wbar(a,d,b), empty(t,s), toast(msg)`. **Owned by the lead; don't edit.** If you need another shared helper, write it inside your own area and list it in your report as a candidate for ui.js.
  - `src/css/01-tokens.css`, `02-components.css` — tokens and shared components (read both; use the tokens, never raw hex for brand/state colours). **Owned by the lead.**
  - `src/css/00-plate.gen.css` — the locked card CSS. Read-only.
- Page module contract (`src/pages/<page>.js`): `export default { title, subs: [{id, label}], render(sub, args) → html string, mount?(root, sub, args) }`. `render` returns the whole page including its header (use `UI.pageHead` or your own header that includes `UI.appbar()`), then `UI.pills(...)` for the sub-page switcher, then the content. The bottom bar is added by main.js. `mount` wires local interactions (segmented toggles, expanders) with event delegation on `root`; to re-render the current page call `window.MW.render({keepScroll:true})`.
- Sheet contract (`src/sheets/<name>.js`): `export default { render(arg) → html, mount?(el, arg), cls? }`. Open with markup `data-open="player:244851"`, `data-open="manager:Cold Palmers"`, `data-open="identity"`, `data-open="search"`, `data-open="menu"`, `data-open="post:<id>"`, or JS `window.MW.openSheet(kind, arg)`. Close with `data-close`. Navigate with `<a href="#/team/lineup">` or `data-go="#/…"`.
- Feed contract (`src/feed/index.js`, owned by the Feed builder; others import it):
  `buildPosts()` → Post[] newest first (memoised per data load); `renderPost(post, {compact})` → html; `postsFor(team)`; `jiveTodo(team)` → up to 3 `{html, faces:[code], action:{label, href|open}}`, data-grounded; `jiveCall(team)` → a selection-call post or null; `unread()` → number.
  If you are not the Feed builder, create a **stub** of this file in your working copy so your area builds, and don't deliver it.
- Routes in use: `#/matchday/{overview|matchup|all|pl|week}`, `#/matchday/matchup/<fixtureIndex>`, `#/team/{overview|lineup|squad|transfers|fixtures|season}`, `#/league/{overview|results|money|derbies|stats}`, `#/feed/{foryou|league|articles|messages}`, `#/feed/messages/<thread>`.

## 4. Visual system (design boards are the spec)
- Boards (HTML + rendered PNG) in `/home/claude/next-build/design/`. **Round 2 boards (`R2*.png`) are the approved look**: R2Matchday, R2Matchup, R2Team, R2Lineup, R2League, R2Player, R2Notes. Round 1b boards: Feed, Messages, Voices, Identity, Colour, Structure, Data, Home, Formation. Round 1 boards (Matchday, Matchup, MyTeam, Player, League, Week, Main) are greyscale structure studies with useful content lists (Week = how Matchday changes through the week). Look at the PNGs with the Read tool.
- Tokens: base #0E0A13, card #17121D, raised #221A2C, top #2D2339, line #3A2F47; text #FFF / #D3CADF / #A398B2; purple 900/700/500/300/100 #37003C #5B2D8E #7B52D3 #A88BEB #CDBDF0; blue 700/500/300 #1E3DD6 #2E5BFF #7A95FF; live #19D27A, win #2FBF71, loss #F0595E, doubt #F5B942, gold #FFD23F (money and prize places only).
- Type: Archivo (UI; `font-stretch:82%` + weight 800 uppercase for display titles, class `.wide`), Barlow Condensed for numbers (class `.n`), Saira Condensed only inside Plate cards. Voices bring their own fonts inside their posts (Anton, Caveat, JetBrains Mono, Archivo at 62% width).
- Crests: always `UI.crest(team, px)` (badge rule: under 32 px a simple accent shape, 32 px and up deep fill + keyline + white emblem). Faces: `UI.face(p, px)`. Cards: `UI.plate(p, w)`.
- Sizes: phone first, 390 px reference, must work 320–430 px and centre at ≤560 px on desktop. Tap targets ≥ 40 px. Gutter 12 px for cards, 16 px for text. Section heads use `UI.sh`. Use the shared `.card`, `.row`, `.chip`, `.pb`, `.tile(s)`, `.seg`, `.btn`, `.empty` classes.
- Motion: subtle and purposeful only (no gimmicks). Respect reduced motion.

## 5. Week states you must handle (test all three)
- `pre`: before the GW6 deadline (real data, Fri 9 Oct 6 pm CT). GW5 finished; GW6 predicted. `week().mode === 'pre'`.
- `live`: made-up GW6 Saturday mid-games (`D.liveNow`), fixtures partly played, live scores and auto-subs.
- Also code for `locked` (deadline passed, no ball kicked), and `prov` (all PL games finished, FPL not closed: `D.provOver`), and the start of the season (`D.gwsDone===0`) without crashing; empty states read well.

## 6. Build and test
- Work in your own copy: `cp -r /home/claude/next-build/src /home/claude/next-build/work/<area>/src` (if it doesn't exist yet), edit only your files there.
- Build: `/home/claude/next-build/build.sh /home/claude/next-build/work/<area>/out /home/claude/next-build/work/<area>/src`
- Harness (Playwright, phone size, real fonts, local data; PL photos/badges/flags are placeholders by design):
```python
import sys; sys.path.insert(0, '/home/claude/next-build/tools')
from mw import MW
with MW('pre', site='/home/claude/next-build/work/<area>/out/site') as m:   # or 'live'
    p = m.open('#/league/overview')            # waits for data + first render
    p.screenshot(path='/home/claude/next-build/work/<area>/shots/x.png', full_page=True)
    p.click('text=Results'); p.wait_for_timeout(300)
    print(m.errors)                             # page errors and console errors
```
  Widths: `MW(..., width=320)` and `width=430` too. Look at every screenshot with the Read tool (crop and zoom into details with PIL when needed). Layout bugs, clipped text, overflow and ugly wraps are bugs.
- Cross-check numbers against the engine (`p.evaluate("() => hpWin(D.fx.find(...))")`) and against the old app where relevant (`/home/claude/next-build/dist/site/classic.html` is production; open it with `m.ctx.new_page().goto(harness.BASE+'classic.html')`).
- Zero console errors. `node --check` passes (the build runs it).

## 7. Definition of done for your area
- Every sub-page and sheet in your area exists, is complete, matches the round 2 look, and handles pre / live / locked / prov / empty states.
- Audit pass done: you re-read the principles above and checked each screen against them, at 320, 390 and 430 px, in pre and live states.
- Final reply (short): files delivered (paths inside your working copy), what each sub-page shows, numbers you verified and how, known gaps, and any shared-helper or token requests. Save your best screenshots under `/home/claude/next-build/work/<area>/shots/` and list them.
