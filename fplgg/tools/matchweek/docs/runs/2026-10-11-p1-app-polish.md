# Run report, 11 Oct 2026: P1 part 2, the app polish (the `preview` branch, for Parker's approval)

The manager's item for the 14:47 Chicago run (started 15:13 UTC): P1, the polish pass from Parker's notes of 11 Oct
after the release-readiness review. Part 1 (Code.gs v3.32, the feed posts checked) is `2026-10-11-p1-feed-checks.md`.
This part is the app half, built on the `preview` branch, which Parker reviews there; it reaches main only through a
REVIEW MODE pass and his word. Screenshots in `2026-10-11-p1-polish/`.

## The request, in the order it was given
1. Fix the three open Q4 review findings: the 15 cut-off texts at 360 px in the gallery; the "Donnarumm/a" break
   mid-word; the gallery's screen 01 showing different states in Chromium and WebKit. Tick them.
2. Kill every remaining explanatory subtitle (Parker: "the other subtitles definitely need to be killed"): the four in
   the menu, then the whole app and the sheets to the standard of the 10 Oct copy pass; every removed string listed in
   the commit message. Labels that name things stay.
3. A one-time intro (Parker: maybe an intro, but do not elevate that information for everyone, because it gets "read
   once" and the app is "sort of self explanatory"): only on the very first open of a device that has never used the
   app, skipped if any of the app's stored keys exist; at most 3 short screens, one line each (what Matchday shows, pick
   your team, where How it works lives); skippable on the first screen and never shown again; nothing new anywhere
   else, How it works where it is.
4. Feed: label the reaction buttons or use icons whose meaning is plain, no trash can; the line under a voice post says
   only "Written by Claude for <voice>"; in the demo, article cards open real pages or are not shown (six led to 404s).
   Nothing new in the Feed.
5. Readability: content text at 11 px or larger, pinch-to-zoom back on, nothing breaking because of it.

## What changed

### 1. The Q4 review findings (all three ticked in ROADMAP.md)
- **A surname is never broken** (`src/css/20-matchday.css` `.md-hc b`): `overflow-wrap:normal; word-break:keep-all;
  hyphens:none` on the two-line clamp, and a surname of 10 letters or more (Donnarumma, Branthwaite) takes 11.5 px
  (`.lng`, set in `src/pages/matchday/matchup.js`), so it fits the 80 px centre column's neighbours at 360 px on the
  runner's wider fonts; Gibbs-White and J.Rak-Sakyi may break at their hyphen, which is a word boundary. The gallery
  now fails **a word broken across lines** as a finding kind of its own (`fplgg/tools/gallery/gallery.js`: an element
  whose own text is one word drawn on more than one line box; `lib.js` names it in the list).
- **The gallery's first screen** (`gallery.js`): after writing the followed team to localStorage the walker reloads the
  page, because a hash change alone is a same-document navigation in Chromium and a reload in WebKit; both browsers now
  photograph the followed team.
- **The 360 px cuts** (BUGS.md #44, closed on the branch): the search row's name wraps to two lines with its status
  chip on the line under it (`src/sheets/search.js`, `60-sheets.css` `.sr-m b`, `.sr-m2`), the League > Stats leader
  line wraps (`40-league.css` `.lg-mt .tx span`), the Feed's auto-pick panel team name takes two lines (`50-feed.css`
  `.od-n`, Parker's rule for team names), the Feed thread rows' preview is a secondary line (`src/pages/feed.js`, class
  `sub`, which the gallery notes rather than fails, as the one-line preview is the design), the mini strip's label
  wraps (`.mini-ap>.f-mono`), and the pitch card's kick-off label wraps (`.md-sl`, a cut the 11 px floor had made). Both
  workflows run the gallery at 390 px and again at 360 px (`shots/360/`, the two index pages linked to each other with
  `--alt`).

### 2. The subtitles (every removed string)
From the menu (`src/sheets/menu.js`):
- "The app opens on your matchup, your lineup and your club’s colours." (under Pick your team)
- "Cards, ratings, projections, auto-subs, luck and the money" (under How it works)
- "Any Premier League player, or a team" (under Search)
- "Refreshes every 90 seconds while games are on. Live scores can trail the TV by a few minutes." and its quiet-day
  form "Refreshes every 5 minutes, and every 90 seconds while games are on. Live scores can trail the TV by a few
  minutes." (the Data card; "Updated x min ago" and Refresh now stay)
- "The previous version, everything still in place" (under Open the classic app)

From the team picker (`src/pages/team/picker.js`):
- "Pick once and My team opens on your club, in your colours. This phone remembers it."
- "Managers who sign in from the menu can change their club’s colours, crest and name. Everyone in the league sees it
  straight away." (under Sign in to edit your club; the label and the Menu button stay)

From the club identity sheet (`src/sheets/identity.js`):
- "Under 32 px the crest turns into a simple shape in your accent, so it still reads in a list."
- "Your header, a table row and a matchup chip, as the league will see them. In matchups you are always blue."
- "Never blocked. Your crest and name always travel with your colour." (the clash card's last line; the clash copy
  itself stays)
- "Shows beside your name on your club’s page." (under Photo)
- "Everyone in the league sees it on their next refresh. Change it whenever you like." (under Save club identity; the
  "Saved." status line after a save stays, it is a state)

From the pages and the Feed:
- "FPL usually confirms within a few hours; bonus and late stat changes can still move points, and the table updates
  when it does." (Matchday > Week, provisional full time; "All matches finished. Provisional full time." and
  "Estimated bonus is counted." stay, they are data states)
- "FPL usually confirms within a few hours." (Matchday overview; "Provisional. Bonus is estimated from live BPS." stays)
- "The chance <team> ends the season bottom, from 5,000 simulated seasons." (League > Money's market; "Most likely 8th:
  <team>, <pct>." stays, it is the data)
- "Bars show each side’s win chance now." and "Bars show each side’s win chance. Scores are the model’s projection."
  (the Feed's match board footer; the percentages sit at both ends of the bar)
- the " · from <tabs>" tail of the voice line (item 4 below)

Kept on purpose: the data states and empty states ("No match", "Nobody has kicked off", "Finished gameweeks only.",
"Likely lineups until the deadline.", "All-time records include the league’s earlier seasons."), the Messages notes
that say where a message goes ("What you say to Archizio goes on the record for the whole league", the rumour mill's),
the search sheet's empty-state hint (a club or a manager can be searched, which the placeholder does not say), and
"You’re signed in as X. Sign out to follow another team." (a state that explains a disabled grid). The methodology is on
How it works, untouched.

### 3. The one-time intro (`src/intro.js`, `src/css/64-intro.css`, `src/main.js`)
- `main.js` reads `FRESH` (no key starting `emt-` in localStorage) before its first write, so a device that has ever
  used the app (El Matador's current users all carry `emt-subs` at least) never sees it. After the first render
  `showIntro(FRESH)` runs once.
- Three screens, one line each: "Matchday shows your matchup, live." / "Pick your team from the menu." / "How it works
  lives in the menu." A card at the bottom of the screen over a dimmed page: the wordmark, a kicker, the line at 22 px
  on `--card`, three dots (the active one `--p300`), Skip (first screen only) and Next, Done on the last. Skip, Done and
  Escape write `emt-intro` and it never shows again.
- A headless browser (`navigator.webdriver`) never sees it, so the gallery, the contrast audit and the checks read the
  pages; `?intro=1` in the URL shows it on demand for a review (that is how the screenshots were taken, and how Parker
  can see it on the preview from a phone that already uses the app).
- Nothing else in the app mentions it (`tests/app-polish.js` I9); How it works stays in the menu.

### 4. The Feed
- The reaction buttons (`src/feed/render.js` `reactBar`, `50-feed.css` `.frx-b`): each is a tile with the line icon
  over its word (Fire, Funny, Clown, Watching, Bin it), the count beside the icon; the trash can is a thumb down. The
  words in the social log (`fire`, `laugh`, `clown`, `eyes`, `bin`) are unchanged, so every reaction already made still
  shows.
- The line under a voice post (`src/feed/ai-posts.js`) is "Written by Claude for <voice>" alone; the tabs the writer
  read stay in the Posts tab's Facts column.
- The demo's article cards (`fplgg/tools/demo/build-demo.js` `demoArticles`): the hand-built RECAPS and PREVIEWS in
  `core.gen.js` point at pages beside the league app, which the demo folder does not have (`recap-gw1.html` from
  `/demo/` was a 404: three recaps and three previews). In the demo an article keeps its card only when its page exists
  under `site/public` and opens it one folder up (`../recap-gw1.html`, the anonymised pages); the three previews have no
  page anywhere and are not shown. Feed > Articles in the demo now lists GW1 to GW3 recaps with "Not published yet: GW5
  recap and GW6 preview", and every link resolves (checked in the browser, `07-feed-articles.jpg`).

### 5. Readability
- No `font-size` or `font` shorthand under 11 px in any stylesheet (94 declarations raised from 7.5 to 10.5 px; the
  `.md-v` "v" from .6em). Three glyph markers that scale with their mark are not text and stay: the Plate's status
  glyph (a clamp from 10 px), the 12 px assist dot's letter, the initials in a face circle (the photo's fallback, .36 of
  the circle). What the raise broke was found by the gallery and fixed: the pitch card's kick-off label at 360 px.
- Pinch-to-zoom: the viewport is `width=device-width,initial-scale=1,viewport-fit=cover` (no `maximum-scale`, no
  `user-scalable=no`), the iOS gesture handler in `main.js` is gone, and `01-tokens.css` sets `touch-action:
  manipulation` (pan and pinch stay, double-tap zoom stays off). The sheets' lock and the Show's `touch-action:none`
  are untouched.

### Docs and tests
- `tests/app-polish.js` (new, 25 checks): the removed strings gone and the kept labels present; the intro's rules run
  in a vm (fresh only, headless never, the key, `?intro=1`, Skip and Next and Done, the layer order); the reactions, the
  voice line, `demoArticles` on a sample and on the real core against `site/public`; the 11 px scan of every
  stylesheet; the viewport, the gesture handler and `touch-action`; the three Q4 fixes; the docs.
  `tests/app-gallery.js` G10 to G12 (the reload, the broken-word kind, the 360 px runs). `tests/app-demo.js` and
  `tests/app-contrast.js` follow the new call and the stylesheet order (`64-intro.css` sits before the stats scope).
- `docs/DESIGN.md` (section 4 and the new section 5: readability), `CLAUDE.md`, `tests/README.md`,
  `fplgg/tools/gallery/README.md`, BUGS.md (#44 closed on the branch, the audit line), ROADMAP.md (the three findings
  ticked).

## How it was verified (all on this branch, after a merge of main)
- 51 suites by the CI pattern ALL PASS (`tests/app-polish.js` and `tests/codegs/v332.js` among them), `tests/codegs/test.js`
  exit 0, `node --check` on Code.gs, `cd fplgg/tools/matchweek && bash ci-build.sh` built and the six root files restored.
- The demo built from the committed snapshot (leak check, EA check and image check clean), then the gallery in Chromium:
  `GALLERY OK: 84 screenshots of 42 screens, 2 states` at 390 px and the same at 360 px (the branch read 11 findings at
  360 px before this change, 19 after the 11 px raise and before the `.md-sl` fix, 0 after), and the contrast audit
  `CONTRAST OK: 0 offenders across 42 screens, 7178 text boxes read`. WebKit is not installable here; the Preview run
  proves that half.
- The intro in a real browser (the script `shots.js` in the session's scratchpad, Chromium at 390 px): a fresh device
  with `navigator.webdriver` masked sees it; Skip writes `emt-intro` and a reload shows nothing; a device with
  `emt-subs` set sees nothing; headless without the flag sees nothing; `?intro=1` shows it; 0 page errors.
- Screens looked at by me at 390 px (`2026-10-11-p1-polish/`): the three intro screens (01 to 03), the menu without
  its subtitles (04), the Matchup list with Donnarumma whole (05), a Feed post's labelled reactions (06), Feed >
  Articles in the demo (07), the search sheet (08); and at 360 px the search row with its chip under the name (09) and
  the pitch before kick-off with the kick-off label on two lines (10).

## Left undone, said plainly
- Parker has not seen it: this is a preview for his approval. The intro is shown to him with `?intro=1` on the preview
  link, since his phone already carries the app's keys.
- The review's "Owen Whitlock · 2nd" and "Wirtz Case Scenario" cuts are fixed by wrapping; at 360 px the stats leader
  line takes two lines on a fictional name of that length.
- The README of the gallery says the builder's environment has Chromium only; the WebKit screens of this change are the
  Preview run's.

## Proof of shipping
Filled in after the push: the Preview Matchweek app run for the commit, and the "preview: matchweek app from <sha>"
commit on main.
