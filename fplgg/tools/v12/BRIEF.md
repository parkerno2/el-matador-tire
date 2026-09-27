# v12 build brief (El Matador Tire league app): read fully before touching anything

## The product and the person
- An 8-manager FPL Draft league app ("FPL Companion", installed as a PWA by the league). Owner: Parker. It is also the proof of concept for a paid commissioner product (Matchweek), so it must read as a commercial-grade app.
- Parker's standing constraints (all still apply): he loves the app's colours, the Plate cards, the crests and the data depth; he hates gamer-font cheese, acronym-circle logos, clutter, "Claude-esque" generic design, filler copy, hedging captions. Straightforward labels ("Records", not "The mechanic that decides it"). He approves everything visually before deploy.
- **Locked assets ride through untouched:** the Plate card system (`card()`, `.fc` and every class inside a card: `.face .pts .meta .nm .fc .tag`), crests (`crestSVG`, `crestOf`), the pitch, the manager colours. Never redraw a card, never reuse a card-internal class name for layout.

## Anti-slop rules (Parker's checklist, applies to every pixel and every string you add)
No emojis (🎬 📰 🔭 ▶ ● ★ ✓ as decoration). No em dashes in user-visible copy (use a period, comma, colon, or "to"). No "it's not X, it's Y" copy. No harsh or stacked gradients on new surfaces, no radial orbs, no glows, no heavy drop shadows (hairline borders instead), no coloured left stripes, no neon, no pastel fills, no bento grids, no three-feature-cards-in-a-row, no checkmark bullets, no sparkle icons, no animated arrows, no hover animations, no liquid glass / backdrop blur. Modest radii (the app uses ~10-14px on cards; do not go rounder). Sentence case copy, short. One idea per row. If a number is shown, it must be real and reproducible from the sheet data.

## Design tokens (match these, do not invent new ones)
- Ground `#F6F5F8` flat. Cards white, `1px solid var(--line)` where `--line:#E8E4EE`, ink `var(--ink)` `#1B1420`, secondary `var(--mid)` `#665D72`.
- Brand: `--p1:#37003C`, `--p2:#5B1A66`, `--p3:#2E5BFF`, gold `#FFD23F`. Selected control: plum `#2E0F3A` with white text (ONE selected-control style everywhere). Good `#0E8A5F` / bad `#C62828` (text); result pills W `#19D27A`-family green, L red, D grey, as in `.form span`.
- Type: Manrope for UI; **Saira Condensed for every number** (use class `num` or `font-family:'Saira Condensed'`). Section headers use the existing `h2.v10` style (uppercase kicker with the gold rule), do not invent another header style.
- Phone first (390px). Full-bleed elements use -8px side margins on phones (the wrap gutter is 8px). Any fixed/sticky element keeps `env(safe-area-inset-*)`.

## Architecture (no server, no build step for the app itself)
- Google Sheet (written hourly by Apps Script `Code.gs`) → JSONP gviz reads in the page → everything computed client-side.
- Source of the app = `index-PREVIEW.html` (base, ~2,600 lines) + `fplgg/tools/v10/*.js|css` (v10 frame, appended) + `fplgg/tools/v12/*.js|css` (this release, appended last). Build: `python3 fplgg/tools/v12/build_v12.py index-PREVIEW.html` → `v12.html` (preview). Production is built with `--prod` (not your job).
- Override model: later scripts redefine earlier functions (`renderMatch=function(){...}` wrapping the previous one, or `const __x=fn;fn=function(){__x();...}`). Function declarations in the base are reassignable; `const`/`let` names are NOT (re-declaring one is a SyntaxError that kills the whole v12 script). **Before adding any top-level name, grep index-PREVIEW.html, fplgg/tools/v10/*.js and fplgg/tools/v12/*.js for it.** Use your module's prefix for every top-level name.
- `loadAll()` re-renders every tab after each data refresh (5-minute tick, visibility return, refresh button). Anything that touches `location` must check which view is showing (`SUB` is shared by all routes). Keep renders idempotent.
- Hash routes: `#gw` Matchday, `#gw/N` matchup N of this GW (index into `D.fx.filter(f=>num(f.GW)===D.gw)`), `#team` My team, `#table`, `#xis` Players, `#ana` Lab, `#faq`.
- Sheets/overlays: `#sheet` + `#ov`, `openSheet(p)` (player), `openProfile(team)` (manager sheet; `openProfile(team,intoEl)` = page mode on My team), `closeSheet()`, `pushOverlay()` (one history entry so the phone back button closes the sheet).

## Data you can use (all already loaded in `D`)
- `D.gw` current GW, `D.gwsDone` finished GWs, `D.dlPassed`, `D.provOver`, `D.hasEP`.
- `D.ro` Rosters rows (current squads): `Team, Manager, Player, Code, Pos, Club, Status, News, Drafted ('R6.7' round.pick | 'WV' waiver | 'FA'), Season pts, GW pts, GW mins, Best XI, GW XI ('XI'|'BEN' once the deadline passes), Slot, OVR, Nation, TOTW`.
- `D.st` Standings (`Team, W, D, L, Pts For, Pts Against, League Pts`), `D.fx` H2H Fixtures (`GW, Home, Home pts, Away, Away pts, Finished`), `D.mw` Matchweeks, `D.cf` Club Fixtures (`GW, Home, Away, Kickoff (UTC), Finished, Home goals, Away goals, Started, Mins`), `D.tx` Transactions (`GW, Team, In, Out, Type, Result, When (UTC)`), `D.gl` GW Log (per GW per team per player: `GW, Team, Player, Code, Pos, Club, GW pts, GW mins, Started ('XI'|'BEN'), TOTW`; GW1 rows use the old team name `Maize ‘n’ Mount` for I Am a Baleba, `canonTeam` fixes it on read), `D.gwsByGw[gw][code]` GW Stats rows (`Mins, Pts, G, A, CS, GC, YC, RC, Saves, Bonus, BPS, DefCon, xG, xA, xGC, Starts, Owner, Club, Pos`), `D.plr` Players (all FPL players: `Owner` team or 'FREE', `Season pts, Status, News, Draft rank`), `D.predByGw[gw][code]` FPL's EP.
- Helpers: `num, fin, dt, esc, fmt1, ORD, mscore(f)→{hs,as2,done,liveNow}, derbyName(a,b), series(a,b), formOf/formHTML(team), crestOf(team,px), mg(team,sm), badgeImg(club,px), flagImg, clubName(c), TEAMS[team]={ini,mgr,col,...}, FIRSTOF(team), SHORTOF[team], squadOf(team), xiOf(team), benchOf(team), effXiOf(team,true), autoSubs(team,likely), lineupsLocked(), fxStarted(club), fxFinished(club), effPtsOf(f,team), teamProj(team), liveScoreOf(team), myTeam(), gwDeadline(gw), fdrOf(club,f), fdrPill(n), koFmt(date), luckAgg(...)` (grep for exact signatures).

## The projection engine (v12-proj.js, already built, validated). Use it, do not reimplement.
- `hpPlayer(p,gw)` → `{pts, parts:{app,goals,assists,cs,gc,saves,defcon,bonus,cards}, pStart, eMin, avail, eSt (mins per start), q60, pSub, r:{xg,xa,bon,yc,sv,dc} per 90, sel}`. `p` = a roster row (or Players row). Any gw ≥ D.gw.
- `hpLive(p)` → `{pts (proj final: so far + remaining), rem, state:'pre'|'live'|'bench'|'off'|'done'|'blank'}` for the current GW.
- `epOf(code)` now returns the house projection (rounded .1). `fplEpOf(code)` = FPL's own EP. `projOf(p)` live-aware. `teamProj(team)` proj final for this GW. `hpTeam(team,gw)` any GW. `hpTeamSd(team,gw)`. `hpWin(f)` → `{h,d,a,muH,muA,sd,done}` probabilities for a H2H fixture. `hpSd(mu)` per-player spread.
- Backtest facts you may quote in a footnote: GW2-5, 2,587 player-weeks, average miss 1.14 pts vs FPL 1.32; submitted XIs within 0.3 pts of actual on average.

## Test harness (headless, no network)
- `node fplgg/tools/mock/shot.js --html v12.html --hash gw --out /tmp/claude-0/x.png [--full] [--eval "js"] [--scenario fplgg/tools/mock/scenario-live-gw5.js --now 2026-09-19T15:40:00Z]` renders against the frozen 27 Sep sheet (international break, GW6 upcoming). The live scenario rewinds to mid-GW5. Fonts and images are stubbed: use it for layout, logic and errors only. Output JSON lists page errors: there must be none from your module (the show/gwN.json CORS line is expected).
- `--eval` runs after boot, e.g. `"location.hash='gw/0'"` or `"openProfile('Cold Palmers')"`; add `--wait2 1200` to wait after it.
- Node check every JS file you write: `node --check file.js`.

## Deliverable format
- Write ONLY your own files (listed in your task). If you need a base change, write an idempotent asserted patch script in `fplgg/tools/league-patches/` (see `patch_v12_base.py` for the pattern: `rep(old,new,label)` asserting exactly one match) and say so; do not hand-edit index-PREVIEW.html or v10 files.
- Build v12.html, run the harness on every surface you touched (normal state AND the live scenario where relevant), look at the screenshots yourself, fix what looks wrong.
- Final report: files written, what each change does, every number you introduced and how you verified it against the data, screenshot paths, anything you were unsure about or deliberately left out.
