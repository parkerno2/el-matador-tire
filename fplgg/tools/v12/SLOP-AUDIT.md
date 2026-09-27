# v12 anti-slop audit (26 Sep 2026)

Parker's ask: "Streamline menus, anti AI slop UI." Direction: keep the identity (Plate cards, crests, pitch, brand plum as the one accent), strip the tells, fewer and calmer menus.

**How this was measured.** Every screen was rendered at 390px with the mock harness (frozen 27 Sep sheet, plus the mid-GW5 live scenario) twice: BEFORE = original base + v10 frame + the other v12 modules (proj, match, stats, fixtures), without v12-ui; AFTER = patched base and v10 + all v12 modules. A computed-style probe walked every visible element outside the cards and logged gradients, radial gradients, box shadows, radii over 14px, side stripes, backdrop blur, text shadows, drop-shadow filters and hover rules; a string scanner read every string literal in index-PREVIEW.html and fplgg/tools/v10/*.js (comments skipped) for em dashes and emoji or decorative glyphs; a controls probe listed every button, toggle, input and tappable row per screen.

**What shipped (for review, nothing deployed):**
- `fplgg/tools/league-patches/patch_v12_clean.py <root>`: one idempotent, asserted copy patch. 139 edits (130 content edits plus one marker per file): index-PREVIEW.html 75, v10-delta.js 20, v10-auth.js 11, v10-graphic.js 8, v10-show.js 8, v10-refresh.js 7, v10-history.js 4, v10-results.js 4, v10-derbies.js 2. `--check` verifies without writing; a second run is a no-op.
- `fplgg/tools/v12/v12-ui.css`: the visual pass (loaded last).
- `fplgg/tools/v12/v12-ui.js`: three wraps a stylesheet cannot do (bug ground, Lab filter crests + Reset, Players owner crests). Top-level names: `uixBugHTML`, `uixRenderLab`, `uixRenderXIs`.

## Counts

| | Before | After |
|---|---|---|
| Em dashes in UI strings (base + v10 JS, string literals and markup) | 102 | 11, none reachable (see list below) |
| Emoji / decorative glyphs in UI strings | 70 (📰 🔭 🎬 🔊 🔇 🧪 ★ ▶ ● ✎ ✕ ▸ ↻ ↺ 〰 ▮ ⛰ ⣿ ⚠ ✓ ✗ → plus functional ▲ ▼ ↑ ↓ ▴ ▾) | 21: functional direction marks and the PREVIEW-only 🧪 |
| Em dashes visible on the 12 rendered screens | 28 (FAQ 18, My team 3, player sheet 2, manager sheet 2, Lab 1, matchup 1, Players 1) | 1 (sheet data, see below) |
| Glyphs visible on the 12 rendered screens | 10 (Lab ▮ ⛰ ↺, graphic ★ ★ ↻ ✕, live Matchday ● ●, lineup ↻) | 0 |
| Page errors (harness, all screens, both scenarios) | 0 | 0 (only the expected show/gwN.json CORS line) |

**What is left after the patch, and why:**
- Dead code, never called: `goldenBoot()` (index-PREVIEW.html ~1909, "…count — a benched haul is a crime, not a credit") and `renderXIs_legacy()` (~2196-2204, "do not port").
- PREVIEW-only November simulator (🧪 Simulate November, "November ON — tap to restore", its "—" placeholder): stripped by build_v10.py / port_preview_to_prod.py, whose anchors assert on these exact strings, so they stay.
- Hidden markup: the two `.hero p` lines (Players, How it works), `display:none` since v11.
- crest.js line 45: an SVG comment inside a template string, never rendered.
- `#ptr` initial text "↓ Pull to refresh": never shown (the toast text is always set before it appears; the pull gesture went in v11).
- Functional marks kept on purpose: ▲ ▼ rating-form arrows (card renderer, locked) and their FAQ legend, ▲ sub-in arrow, ↑ ↓ transaction in/out, ▲ ▼ Squad health "Trending up/down", ▴ ▾ on the (hidden) All 20 clubs button.
- Visible on My team: "Waiver · Denied — invalid" and "Waiver · do". This is the Transactions sheet's Result column written by the old Code.gs. Code.gs v3.5 (already in the repo) maps the codes to "Denied (invalid)", "Denied (drop gone)" and so on; the rows fix themselves after the repaste and the next refreshAll. No app change needed.

## Tells found (Parker's 30-item checklist)

Status: **done** = fixed in this release; **rec** = recommended, not implemented; **keep** = identity or data, deliberately left; **n/a** = not present.

| # | Checklist item | Where (file · selector or string) | Before | Fix | Status |
|---|---|---|---|---|---|
| 1 | Harsh gradients | index-PREVIEW `.top`, v10-delta.css `.top`, `#gwbody .stage`, `.myhead`, `.sh-left`, `.lgfx`, next-GW sheet header (`#07304F` teal) | 3-stop blue #2E5BFF to plum, electric blue corner, plus a glow shadow; the next-GW sheet had its own teal gradient | One calmer chrome gradient `--uix-chrome` (#302C86 → #4A1A5F → #37003C) on every dark header surface, no glow | done |
| 1 | Harsh gradients | base `.recapcard`, v10-delta.css `.recapcard.show` | blue-to-plum gradient cards | flat plum #34104E (same as the bugs) | done |
| 1 | Harsh gradients | base `.trow.lead` (Table leader) | gold gradient row | plain row | done |
| 1 | Harsh gradients | `#tablebody .stage` (The Market) | purple stage with radial sheen around a white card | plain card under a plain question line | done |
| 1 | Harsh gradients | `.labhead` (Lab header) | dark gradient bar | white header, hairline | done |
| 1 | Harsh gradients | `.mgrid .mt` (Lab manager tiles, My team picker) + `:before` sheen | 150deg team-colour gradient + diagonal sheen | flat team colour (55% mix with ink), no sheen | done |
| 1 | Harsh gradients | `.gwpill.final`, `.pot div` | gold gradients | flat gold / list rows | done |
| 1 | Gradients kept | `.bar .fl` bug flanks, pitch stripes, `h2.v10:after` gold rule, Market conic dial | | team-colour flanks and pitch are identity; the rule is the house header; the dial is a chart | keep |
| 1 | Dead CSS | base `.hero` per-view gradients, `body[data-view]` pastel gradients | already overridden (heroes hidden, ground flat) | delete in a future base cleanup | rec |
| 2 | Lucide icons | v10-delta.js `V10_VIEWS` nav paths (zap, shirt, trophy, search, flask-conical) and the header refresh icon (rotate-cw) | stock Lucide outlines | see Recommendations: custom set or text-only nav | rec |
| 3 | Pure white background | ground | already #F6F5F8 (v9) | | n/a |
| 4 | Rainbow colouring | base `.ownp` owner chip on Players rows | 8 coloured initials pills (BK, CT, JS…) | the owner's crest (v12-ui.js), tap still opens the manager sheet | done |
| 4 | Rainbow colouring + acronym circles | base `.labmono` Lab manager filter | 8 initials circles in 8 colours | crests on white squares, plum when selected | done |
| 4 | Rainbow colouring | manager tiles in team colours | | team colours are identity | keep |
| 5 | Drop shadows | `.card`, `.faqsec`, `.acc`, `.prw`, `.pfind`, `.minirecs>div`, `.xstats div`, `.mcard.bug`, `.stage`, `.top`, `#ptr`, `.sheet`, `.helpfoot button`, `.recapcard`, `.mgrid .mt`, `.pot div`, `button.watch.elev`, `.fdr`, `.mx .lt`, `.mx .vsbug` | soft 5-40px shadows everywhere | `box-shadow:none`, 1px `#E8E4EE` hairlines | done |
| 5 | Drop-shadow filters | `.top .brand svg`, `.lgfoot svg` (wordmark), `.fxs img`, `.fxblk img`, `.au-big svg`, graphic crests | `filter:drop-shadow` | `filter:none` | done |
| 6 | Three cards in a row | base `.profstats` (My team + manager sheet: Projected / Best GW / Points for) | three grey tiles | one white strip, hairline dividers | done |
| 6 | Three cards in a row | v12-stats player sheet "Form and value" 3 x 2 tiles | | other module, see "Other modules" | rec |
| 7 | Emojis | 📰 🔭 🎬 recap/preview/show kickers, 🔊 🔇 show mute, ★ Claim / Star man, ▶ PLAY / Read, ● LIVE / ON THE PITCH, ✎ Edit team, ✕ Close, ▸ Skip, ↻ ↺ Replay / Reset, 〰 ▮ ⛰ ⣿ Lab views, ⚠ flagged player, ✓ ✗ clean sheet | | words only (Mute / Unmute, Live, Replay, Reset, "Flagged", "Clean sheet" / "No clean sheet") | done |
| 8 | Liquid glass | base `.ov` | `backdrop-filter:blur(3px)` behind sheets | flat scrim rgba(27,20,32,.62) | done |
| 9 | Em dashes | 102 in strings (full list in the appendix) | | period, colon, comma or "to"; "—" empty placeholders become "–" (the Players list's placeholder) | done |
| 10 | Inter / Geist / Space Grotesk | fonts | Manrope + Saira Condensed; Archivo Black only inside the Matchweek wordmark SVG | | n/a |
| 11 | Coloured left stripe | base `.recapcard` (gold 4px), `.recapcard.prev` (green), v10-delta.css `.recapcard.show` (gold, !important), base `.provnote` (gold 4px), `.trow.lead` (inset gold 3px), v10-delta.css `.fxblk .fxrow:before` (FDR stripe, player sheet fixtures), v10-graphic.css `.mx .km` / `.km.a` (team colour 4px L/R), `.mx .lt` (gold 4px), `.mx .hit` (gold 3px) | | all removed; key men keep their team colour as a 7px dot before "Key man" | done |
| 12 | Fake testimonials | | | | n/a |
| 13 | Bento grids | base `.pot` (FAQ prize tiles) | 2 x 3 pastel-gold tile grid | a plain list, amount right-aligned | done |
| 13 | Bento grids | Lab "The managers" 2 x 4 tile grid | | identity tiles; cutting them is a menu decision, see Recommendations | rec |
| 14 | Terminal window | | | | n/a |
| 15 | "It's not X, it's Y" | "Team of the Week is earned, not imported", "rated 85+, earned not given", "Earned, not given." | | rewritten to the plain rule | done |
| 16 | Checkmark bullets | ✓ / ✗ in the clean-sheet line of the points breakdown | | words | done |
| 17 | Three pricing tiers | | | | n/a (Matchweek site: see Legal) |
| 18 | No real product demos | | | | n/a (Matchweek site should use real league screens) |
| 19 | Soft corner radius | `.labmet` 17px, `.gwtabs` 16px, `.ownp` 12px, `.chip`, `.fdr` 999px, `#gwbody .stage .backbtn` 20px, `.btoggle`, `.allclubs`, `button.watch.elev`, `#ptr`, `.helpfoot button`, `.recapcard .go`, `.sheet` 18px, `#tablebody .stage` 18px | pill-soft | controls 8px, chips 6px, sheets 14px; circles stay circles (crests, avatars) | done |
| 20 | Purple and black | brand plum + near-black nav | | brand identity (Parker's call); plum is now the only accent and the ground stays light | keep |
| 21 | No skeleton loaders | index-PREVIEW `#gwbody` first paint | "Loading the gameweek…" text | static grey bars (kicker, card, three bug blocks) styled by `.uix-skel`, 1.2s opacity pulse, off under prefers-reduced-motion; renderScoreboard replaces it | done |
| 21 | No skeleton loaders | Table / Players / Lab / My team first paint | "Loading…" lines | same pattern, if wanted | rec |
| 22 | Radial orbs | bug ground (bugHTML inline `radial-gradient … !important`, two team-colour orbs) | glowing orbs behind every matchup | flat plum #34104E (v12-ui.js rewrites the inline style); team-colour flanks kept | done |
| 22 | Radial orbs | `.sh-left:before` sheen, `#tablebody .stage`, `.lgfx.done` / `.lgfx.mx.done` overlay grounds | radial glows | chrome gradient only | done |
| 23 | Dot grids | | | | n/a |
| 24 | Sparkle icons | | ★ removed (see 7); crest art untouched | | n/a |
| 25 | Animated arrows | | chevrons are static | | n/a |
| 26 | No TOS | league app | | not needed for a private 8-manager league | n/a |
| 26 | No privacy policy | FAQ | nothing | short "Privacy" section in How it works: no ads or analytics; the phone keeps the followed team and sign-in; a claimed team's photo, colours, crest and name go to the public-link sheet; PINs are hashes in script properties, never in the sheet (facts from Code.gs v3.5 auth block and v10-auth.js) | done |
| 26 | TOS + privacy | matchweek.gg product site | | needs both before anything is sold; not written here | rec |
| 27 | Hover animations | base `.faqsec/.gwblk/.minirecs/.xstats :hover` lift, `.mgrid .mt:active` / `.clubgrid button:active` press-scale, transitions | | none | done |
| 27 | Hover animations | base `.fc:hover` card lift (desktop pointer only) | | card is locked; Parker to decide | rec |
| 28 | Neon colours | `.gwpill.live` #3DF59B, `.score em.live`, `.mcard.gx .st.live`, `.bug .lab.live`, `.mx .vsbug .tg.live` (#3DF59B / #5CF0A5 mint) | | pill #19D27A, live text #4FD08E everywhere | done |
| 28 | Neon colours | FDR palette `FDRCOL` #01FC7A / #FF1751 (Next five grid, player sheet pill, card bubble in Fixture mode) | FPL's own FDR colours | see Recommendations (it also paints a card bubble) | rec |
| 29 | Basic pastel colours | `.chip` family (#FBE3E6, #E2F5EC, #F7E0EA, #E0EDFF), `.provnote` pastel-yellow gradient, `.pot` tiles | | neutral #F3F0F6 chips with coloured text, solid chips where the colour means something (gold OVR, claret POTM, dark TOTW); provnote white with hairline | done |
| 29 | Pastel data tints | Table "Scores by gameweek" heatmap | | encodes win/loss per cell | keep |

**Other small fixes found on the way (copy or layout):**
- Table leader line read "1 pts clear of …" → "1 pt clear" (v10-delta.js).
- Matchup graphic score box said PREDICTED twice (tag above, label below) → the tag shows only when it adds something (live: "Live" over "Proj final …"). v10-graphic.js.
- Matchup Expected-view note used "→" arrows → "Played: … Yet to play: …".
- Manager sheet header: form chips sat under the close button and squeezed the name onto two lines → chips drop to their own line under the name.
- Lab manager tiles cut "Star man" off mid-number ("Tarkowski · 43 pt") → label on its own line, name and points wrap inside the tile.
- Player sheet: the green "FIT" chip (shown for every fit player) hidden; a flagged status chip still shows.
- Players search: points column aligned whether the row ends in a crest or FREE.

## Menus and controls

Cut = removed now. Merge / cut (rec) = recommended, not implemented (it would remove a view or change behaviour). Keep = earns its place.

**Everywhere**

| Control | Decision | Note |
|---|---|---|
| Header: Matchweek wordmark + league name | keep | brand |
| Header: GW status pill (GW6 · 13d 6h / LIVE / FINAL) | keep | status only; neon live green calmed |
| Header: refresh button | keep | forces a sheet refresh during live games; icon is Lucide (rec) |
| Header: avatar / crest → My team | keep | |
| Bottom nav: Matchday, My team, Table, Players, Lab | keep | icons are Lucide (rec) |
| Footer "How it works" button | keep, **cut on the FAQ page** | it linked to the page you were on |
| Toast (#ptr) | keep | restyled: plum, 8px, no shadow; copy without dashes ("Updated 4 min ago") |

**Matchday (#gw)**

| Control | Decision | Note |
|---|---|---|
| ‹ GAMEWEEK N › stepper (v12-fixtures) | keep | one plum selected segment; radius now 8px |
| DERBIES sub-tab | merge (rec) | the only other sub-tab; could become a "Derbies" link row next to "All articles" at the foot of the stack |
| Show card: Play (only when a preview exists) | keep | stripe, gradient, shadow gone |
| Score bugs (tap → matchup) + fact-line expander | keep | orbs gone |
| Recent news cards / All articles row | keep | shadow gone |
| Premier League: SHOW ALL + row expanders | keep | |
| "Back to GWn" (browsing another GW) | keep | |

**Matchup (#gw/N)**

| Control | Decision | Note |
|---|---|---|
| ‹ Matchday back | keep | 8px radius |
| PROJECTED \| FIXTURE toggle (card bubble mode) | keep | same control on My team and the manager sheet; plum selected (was gold on the dark stage) |
| Actual \| xP toggle (GWs with xP) | keep | same style |
| Watch the preview | keep | |
| SHOW BENCHES | merge (rec) | My team and the manager sheet always show the bench; the matchup could show both benches collapsed under the pitch the same way and drop the toggle |

**My team (#team)**

| Control | Decision | Note |
|---|---|---|
| Claim your team (banner) | merge (rec) | with "Not Parker? Switch team" into one "Your team" action on the avatar |
| Next line (→ matchup) | keep | |
| PROJECTED \| FIXTURE, Watch the lineup | keep | |
| Next five collapsible header | keep | |
| Results rows (→ past matchup), fixtures rows (→ browser) | keep | |
| Not Parker? Switch team | merge (rec) | see above |
| Picker (no team chosen): Claim your team + 8 tiles | keep | ★ glyph cut, tiles flat |

**Table (#table)**

| Control | Decision | Note |
|---|---|---|
| Standings rows (→ manager sheet) | keep | leader row no longer gold-striped |
| MOTM history / Upcoming fixtures accordions | keep | |

**Players (#xis)**

| Control | Decision | Note |
|---|---|---|
| Search | keep | placeholder "Search any player" (was "Search any player — who owns him?") |
| Trades & waivers accordion | keep | |
| Top free agents: Total \| Average | keep | |
| FREE chip on every Top free agents row | **cut** | every row in that list is free; FREE stays in search results |
| "The ten best unowned players this season — waiver ammunition." | **cut** | the header and the toggle say it |
| Owner chip (tap → manager sheet) | keep | crest instead of initials |
| Club grid + "All 20 clubs ▾" | cut (rec) | already `display:none` in v10; delete the dead markup |

**Lab (#ana)**

| Control | Decision | Note |
|---|---|---|
| Header tagline "pick who · pick what · the chart answers" | **cut** | filler |
| "tap a name for the full profile" on The managers | **cut** | tiles are obviously tappable |
| Managers \| League scope | keep | |
| Manager filter (8) | keep | crests instead of initials circles; recommend cutting the row entirely (tap a bar already focuses a manager) |
| Metric chips: Points, Luck, Win margin, Points against, Bench waste | keep | 8px; the row scrolls sideways at 390px |
| View: Bars \| Race (Managers), Wins race \| Spread (League) | keep | glyphs cut |
| Reset | **cut until needed** | shows only after a Managers view was changed; hidden in League scope (the Managers tab is the way back) |
| The managers tile grid (8) | cut (rec) | duplicates the Table and the manager sheet; the Lab would open straight on the chart |
| Luck index: Performance \| Results | keep | |
| "Tap a bar to focus that manager." | keep | the only hint that bars are tappable |

**How it works (#faq)**: no controls besides the header; footer button cut here.

**Player sheet**: × close, the card, chips (OVR, position, drafted, status). "FIT" chip cut. **Manager sheet**: ×, next line, PROJECTED \| FIXTURE, cards, results rows. Keep all.

**Lineup graphic / show overlay**: Replay, Skip, Close, Mute / Unmute, Read the full preview. Keep; glyphs (↻ ▸ ✕ 🔊 🔇 ▶) replaced by words.

## Other modules' surfaces (not edited, one-line consistency fixes excepted)

| File · selector | Tell | Suggested fix |
|---|---|---|
| v12-stats.css / .js · player sheet "Form and value" (6 tiles, 3 x 2) | tile grid (three-in-a-row / bento feel) | one hairline list like "Season numbers" (label left, number right), or a single strip of three with dividers like `.profstats` now |
| v12-stats · "Points by position" GKP / DEF / MID / FWD chips | pill radius on four boxed chips | 8px radius, or one row with hairline dividers |
| v12-fixtures.js `fbxTidyCurrent` · show card with no preview article | title "The lineups and talking points for all four matchups" repeats the v10 subline "Lineups, the players to watch and the talking points · about 90 seconds" | title "Gameweek N preview" (or the article title when one exists) and keep the subline, or shorten the subline to "About 90 seconds" |
| v12-match.css `.mpxg3>b u` | mint #3DF59B live text | set to #4FD08E (done as a one-line override in v12-ui.css; move it into v12-match.css when that file is next touched) |
| v10-derbies.css `.gwtabs` (used by v12-fixtures) | 16px pill radius | set to 8px (done as a one-line override in v12-ui.css) |

## Recommendations not implemented

1. **Nav and header icons.** The five nav icons and the refresh icon are stock Lucide paths. Options: (a) text-only tabs with the existing plum active bar (calmest, zero new art); (b) a small custom set tied to the product: the manager's own crest for My team, a Plate-card silhouette for Players, three standings rows for Table, bars for Lab, the Matchweek bolt for Matchday. Needs Parker's eye either way.
2. **FDR palette.** FPL's #01FC7A / #FF1751 read neon. Calmer ramp that keeps the meaning: easy #2FB36A, medium #E7E7E7, hard #E0485E, very hard #80072D. One change (`FDRCOL` values in v10-delta.js plus the `.fleg` legend swatches) moves the Next five grid, the player sheet pill and the Fixture-mode card bubble together. Left alone because it repaints a bubble inside the locked card and the league knows FPL's colours.
3. **Card hover lift** (`.fc:hover` translateY + scale, desktop only). Locked card; Parker to decide.
4. **Lab trim.** Cut the manager filter row (tap-a-bar already focuses) and the managers tile grid (duplicates Table and profiles) so the Lab opens on the chart with two control rows instead of four.
5. **Matchup benches.** Replace SHOW BENCHES with an always-visible bench strip like My team.
6. **One identity entry point.** Merge "Claim your team" and "Not Parker? Switch team" into the header avatar.
7. **Derbies** as a link row under the Matchday stack instead of a sub-tab beside the GW stepper.
8. **Skeletons** on Table, Players, Lab and My team first paint (same `.uix-skel` pattern).
9. **Dead code cleanup** in the base: `goldenBoot`, `renderXIs_legacy`, the hidden club grid and hero markup, the per-view `body[data-view]` and `.hero` gradients.
10. **Title odds noise.** The Table's title percentages are Monte Carlo and moved by one point between two renders of the same data (28% vs 27%, 34% vs 35%). Seeding the simulation from the data (e.g. GW + standings) would keep the numbers still between refreshes.
11. **Legal for the product.** matchweek.gg needs a Terms of Service and a Privacy Policy before anything is sold (accounts, PINs, photos, any payment); the league app's FAQ section is enough for the league.

## Screenshots

`/tmp/claude-0/slop/`: `before-<screen>.png`, `after-<screen>.png`, and `cmp/<screen>.png` (before left, after right). Screens: `gw`, `gw-live` (mid-GW5), `gw-showcard` (show card forced on), `gw0`, `gw0-live`, `team`, `team-picker`, `table`, `xis`, `xis-search`, `ana`, `ana-lab-focus`, `ana-league`, `faq`, `sheet-player`, `sheet-manager`, `lineup`, `graphic`, `graphic-xi`, `skeleton` (first paint, data load held back), `toast`.

## Appendix: every copy edit in patch_v12_clean.py

Line numbers are in the original files. "–" (en dash) placeholders replace "—" where a value is missing.

| # | File:line (original) | Tell | Edit label | Before | After |
|---|---|---|---|---|---|
| 1 | index-PREVIEW.html:726 | no skeleton | gwbody skeleton | `<div id="gwbody"><p class="state">Loading the gameweek…</p></div>` | `<div id="gwbody"><div class="uix-skel" role="status" aria-label="Loading the gameweek"><i class="k"></i><i class="c"></i><div class="b"><i></i><i><…` |
| 2 | index-PREVIEW.html:892 | glyph ✓✗ | bdOf clean sheet | `add('Clean sheet '+(r.CS?'✓':'✗')+' (xGC '` | `add((r.CS?'Clean sheet':'No clean sheet')+' (xGC '` |
| 3 | index-PREVIEW.html:922 | glyph ✓✗ | projLbl | `.replace('Clean sheet ✗ ','Clean sheet ').replace('Clean sheet ✓ ','Clean sheet ')` | `.replace('No clean sheet ','Clean sheet ')` |
| 4 | index-PREVIEW.html:1255 | em dash | avgOf placeholder | `  if(!D.started)return'—';⏎  return(seasonTot(p)` | `  if(!D.started)return'–';⏎  return(seasonTot(p)` |
| 5 | index-PREVIEW.html:1260 | em dash | nextFixture placeholder | `  if(!f)return'—';⏎  return f.Home===club` | `  if(!f)return'–';⏎  return f.Home===club` |
| 6 | index-PREVIEW.html:1595 | em dash | profile best placeholder | `:1.9rem">'+(best?best.p:'—')+'</b>` | `:1.9rem">'+(best?best.p:'–')+'</b>` |
| 7 | index-PREVIEW.html:1596 | em dash | profile record placeholder | `st.W+'–'+st.D+'–'+st.L:'—')+'</b><span>W – D – L</` | `st.W+'–'+st.D+'–'+st.L:'–')+'</b><span>W – D – L</` |
| 8 | index-PREVIEW.html:1934 | em dash | mgr tile avg placeholder | `>'+(g?(pf/g).toFixed(1):'—')+'</b><i>pts / gw</i></` | `>'+(g?(pf/g).toFixed(1):'–')+'</b><i>pts / gw</i></` |
| 9 | index-PREVIEW.html:1935 | em dash | mgr tile best placeholder | `+'<span><b>'+(best\|\|'—')+'</b><i>best gw</i></s` | `+'<span><b>'+(best\|\|'–')+'</b><i>best gw</i></s` |
| 10 | index-PREVIEW.html:1936 | em dash | mgr tile record placeholder | `st.W+'–'+st.D+'–'+st.L:'—')+'</b><i>w · d · l</i>` | `st.W+'–'+st.D+'–'+st.L:'–')+'</b><i>w · d · l</i>` |
| 11 | index-PREVIEW.html:2059 | em dash | MOTM history placeholder | `o='<span class="who"><em>—</em></span>'` | `o='<span class="who"><em>–</em></span>'` |
| 12 | index-PREVIEW.html:2413 | em dash | xpgrid proj placeholder | `'+(ep2!==null?fmt1(ep2):'—')+'</b><span>PROJ (FPL)<` | `'+(ep2!==null?fmt1(ep2):'–')+'</b><span>PROJ (FPL)<` |
| 13 | index-PREVIEW.html:2414 | em dash | xpgrid xG placeholder | `>'+(hr?hr.xG.toFixed(2):'—')+'</b><span>AVG xG</spa` | `>'+(hr?hr.xG.toFixed(2):'–')+'</b><span>AVG xG</spa` |
| 14 | index-PREVIEW.html:2415 | em dash | xpgrid xA placeholder | `>'+(hr?hr.xA.toFixed(2):'—')+'</b><span>AVG xA</spa` | `>'+(hr?hr.xA.toFixed(2):'–')+'</b><span>AVG xA</spa` |
| 15 | index-PREVIEW.html:2416 | em dash | xpgrid cs placeholder | `h.exp(-hr.xGC)*100)+'%':'—')+'</b><span>CS ODDS</sp` | `h.exp(-hr.xGC)*100)+'%':'–')+'</b><span>CS ODDS</sp` |
| 16 | index-PREVIEW.html:2422 | em dash | itemized total placeholder | `'+(ep2!==null?fmt1(ep2):'—')+'</span></div>'` | `'+(ep2!==null?fmt1(ep2):'–')+'</span></div>'` |
| 17 | index-PREVIEW.html:2427 | em dash | played cs placeholder | `h.exp(-gr.xGC)*100)+'%':'—';` | `h.exp(-gr.xGC)*100)+'%':'–';` |
| 18 | index-PREVIEW.html:2435 | em dash | breakdown x placeholder | `class="x2">'+(b.x==null?'—':` | `class="x2">'+(b.x==null?'–':` |
| 19 | index-PREVIEW.html:1294 | glyph 📰 | base recap emoji | `<div class="rk">📰 Gameweek '+r.gw+' recap<s` | `<div class="rk">Gameweek '+r.gw+' recap<s` |
| 20 | index-PREVIEW.html:1302 | glyph 🔭 | base preview emoji | `<div class="rk">🔭 Gameweek '+p.gw+' preview` | `<div class="rk">Gameweek '+p.gw+' preview` |
| 21 | index-PREVIEW.html:1284 | em dash | preview gw4 sub | `and the injury clock \u2014 now with Malcolm Tyre in` | `and the injury clock, now with Malcolm Tyre in` |
| 22 | index-PREVIEW.html:1336 | em dash | base provnote | `"><b>All matches finished — provisional result.</b> '` | `"><b>All matches finished. Provisional result.</b> '` |
| 23 | index-PREVIEW.html:1355 | glyph ● | base scoreboard live | `ULL TIME · PROVISIONAL':'● LIVE'):'TAP FOR LINEUPS')` | `ULL TIME · PROVISIONAL':'LIVE'):'TAP FOR LINEUPS')` |
| 24 | index-PREVIEW.html:1391 | glyph ● | matchup live | `ULL TIME · PROVISIONAL':'● LIVE'):(dl?` | `ULL TIME · PROVISIONAL':'LIVE'):(dl?` |
| 25 | index-PREVIEW.html:1388 | em dash | asubnote locked | `ady counted in proj final — FPL makes auto-subs offi` | `ady counted in proj final. FPL makes auto-subs offi` |
| 26 | index-PREVIEW.html:1390 | em dash | asubnote likely | `s flagged out don\'t play — counted in proj final only. If the flagged player logs a minute, he\'s back and the bench order re-settl` | `s flagged out don\'t play. Counted in proj final only; if a flagged player logs a minute, the bench order re-settl` |
| 27 | index-PREVIEW.html:1406 | glyph → | xnote arrows | `font-weight:500">Played → what the performance deserved (xP) · yet to play → projected (PROJ). Converges to pure xP when the gameweek ends.</div>` | `font-weight:500">Played: what the performance deserved (xP). Yet to play: projected (PROJ). All xP once the gameweek ends.</div>` |
| 28 | index-PREVIEW.html:1524 | em dash | luck results caption | ` <b>all-play</b> schedule — your score against all seven rivals every week (win 3 · draw 1 · loss 0). <b style="color:var(--good)">+</b> = the fixt…` | ` <b>all-play</b> schedule: your score against all seven rivals every week (win 3 · draw 1 · loss 0). <b style="color:var(--good)">+</b> means the f…` |
| 29 | index-PREVIEW.html:1512 | copy/accuracy | luck perf caption | `Actual points vs expected points, season to date. <b style="color:var(--good)">+</b> = performances running hot, <b style="color:var(--bad)">−</b> …` | `Actual vs expected points, season to date, bonus excluded. <b style="color:var(--good)">+</b> running hot, <b style="color:var(--bad)">−</b> deserv…` |
| 30 | index-PREVIEW.html:1602 | em dash | profile legend | `s="sh-note"><span style="color:'+col+';font-weight:700">—</span> actual (excl. bonus) · <span style="color:'+colX+';font-weight:700">- -</span> exp…` | `s="sh-note"><span style="display:inline-block;width:14px;border-top:2.5px solid '+col+';vertical-align:middle;margin-right:3px"></span>actual (excl…` |
| 31 | index-PREVIEW.html:1603 | em dash | profile bonus note | `') sit outside both lines — with them, actual is '` | `') sit outside both lines; with them, actual is '` |
| 32 | index-PREVIEW.html:1626 | em dash | picker note | `Pick your team once — this phone remembers, and My team opens straight onto your squad. Switch any time.` | `Pick your team once. This phone remembers it.` |
| 33 | index-PREVIEW.html:1802 | em dash | lab margin foot | `'Season sum of winning/losing margins — positive = won by more than you los` | `'Season sum of winning and losing margins. Positive means you won by more than you los` |
| 34 | index-PREVIEW.html:1814 | em dash | lab legend | `'<span style="color:#2E5BFF;font-weight:700">—</span> actual score · <span style="color:#5B1A66;font-weight:700">- -</span> what the performances des` | `'<span style="display:inline-block;width:14px;border-top:2.5px solid #2E5BFF;vertical-align:middle;margin-right:3px"></span>actual score · <span st…` |
| 35 | index-PREVIEW.html:1840 | em dash | lab spread foot | `ore, one row per gameweek — how bunched is the league?')` | `ore, one row per gameweek.')` |
| 36 | index-PREVIEW.html:1873 | glyph ▮⛰⣿〰 | lab view labels | `const VN={trend:'〰 Trend',bars:'▮ Bars',race:'⛰ Race',spread:'⣿ Spread'};` | `const VN={trend:'Trend',bars:'Bars',race:'Race',spread:'Spread'};` |
| 37 | index-PREVIEW.html:1875 | glyph ↺ | lab reset | `style="margin-left:auto">↺ Reset</button>` | `style="margin-left:auto">Reset</button>` |
| 38 | index-PREVIEW.html:1944 | copy/accuracy | lab tagline | `"labhead"><b>THE LAB</b><span>pick who · pick what · the chart answers</span></div>` | `"labhead"><b>THE LAB</b></div>` |
| 39 | index-PREVIEW.html:1946 | copy/accuracy | lab managers hint | `+'<h2>The managers <small>tap a name for the full profile</small></h2>'` | `+'<h2>The managers</h2>'` |
| 40 | index-PREVIEW.html:1950 | em dash, glyph → | lab how-to | `+'<p><b>Projected</b> = forecast before a match, frozen at the deadline. <b>Expected (xP)</b> = what a performance deserved once played — goals→xG,…` | `+'<p><b>Projected</b>: the forecast before a match. <b>Expected (xP)</b>: what a performance deserved once played, from xG, xA and clean-sheet odds…` |
| 41 | index-PREVIEW.html:2033 | em dash | motm live note | `s gameweek\'s live scores — same numbers as the scoreboard. Settl` | `s gameweek\'s live scores, same as the scoreboard. Settl` |
| 42 | index-PREVIEW.html:2048 | em dash | odds note | `-season projections only — odds sharpen once real scores arrive'` | `-season projections only until real scores arrive'` |
| 43 | index-PREVIEW.html:2094 | glyph ⚠ | players news flag | `+(p.News?' · ⚠':'')+'</em></span>'` | `+(p.News?' · <b style="color:#C62828;font-weight:700">Flagged</b>':'')+'</em></span>'` |
| 44 | index-PREVIEW.html:2100 | em dash | players missing tab | `t landed in the sheet yet — repaste Code.gs and run re` | `t landed in the sheet yet. Repaste Code.gs and run re` |
| 45 | index-PREVIEW.html:2133 | em dash | players no moves | `No moves yet — pickups, drops and denied ` | `No moves yet. Pickups, drops and denied ` |
| 46 | index-PREVIEW.html:2141 | em dash | free agents caption (cut: the header and Total | Average say it) | `+fas.map(plrRow).join('')⏎     +'<p class="mnote">The ten best unowned players this season — waiver ammunition.</p>':'';` | `+fas.map(plrRow).join(''):'';` |
| 47 | index-PREVIEW.html:2144 | em dash | players search placeholder | `holder="Search any player — who owns him?"` | `holder="Search any player"` |
| 48 | index-PREVIEW.html:2224 | em dash | activity empty (#act) | `No trades or waivers yet — once the first moves process, every pickup, drop and den` | `No trades or waivers yet. Every pickup, drop and den` |
| 49 | index-PREVIEW.html:2296 | glyph ● | pl snapshot | `<span class="lv">● ON THE PITCH</span>` | `<span class="lv">ON THE PITCH</span>` |
| 50 | index-PREVIEW.html:2358 | em dash | faq silver | `'<b>Silver</b> — rated under 78'` | `'<b>Silver</b>: rated under 78'` |
| 51 | index-PREVIEW.html:2359 | em dash | faq gold | `'<b>Gold</b> — rated 78–84'` | `'<b>Gold</b>: rated 78–84'` |
| 52 | index-PREVIEW.html:2360 | em dash, not-X-its-Y | faq elite | `'<b>Elite</b> — rated 85+, earned not given'` | `'<b>Elite</b>: rated 85+'` |
| 53 | index-PREVIEW.html:2361 | em dash | faq spec | `'<b>Draft special</b> — round 1–2 picks, league ` | `'<b>Draft special</b>: round 1–2 picks, league ` |
| 54 | index-PREVIEW.html:2362 | em dash | faq r2 | `'<b>Round 2 vintage</b> — same colours, later letter'` | `'<b>Round 2 pick</b>: same colours, R2 tag'` |
| 55 | index-PREVIEW.html:2363 | em dash | faq totw | `'<b>Team of the Week</b> — a 10+ point haul, lasts ` | `'<b>Team of the Week</b>: a 10+ point haul, lasts ` |
| 56 | index-PREVIEW.html:2364 | em dash | faq potm | `b>Player of the Month</b> — the league’s monthly pick'` | `b>Player of the Month</b>: the Premier League award'` |
| 57 | index-PREVIEW.html:2365 | em dash | faq gold 2 | `'<b>Gold</b> — the league’s broad middle class'` | `'<b>Gold</b>: the most common tier'` |
| 58 | index-PREVIEW.html:2367 | em dash | faq pot head | `+'<h2>The pot — $1,200</h2>` | `+'<h2>The pot: $1,200</h2>` |
| 59 | index-PREVIEW.html:2373 | em dash | faq ratings 1 | `carries a <b>base OVR</b> — career profile blended` | `carries a <b>base OVR</b>: career profile blended` |
| 60 | index-PREVIEW.html:2373 | em dash | faq ratings 2 | `te a Silver into Gold art — or relegate a Gold.` | `te a Silver into Gold art, or relegate a Gold.` |
| 61 | index-PREVIEW.html:2374 | copy/accuracy | faq points on cards | `eweek points from kickoff, updating hourly. Before the deadline you see each manager’s projected best XI; once the deadline passe` | `eweek points from kickoff. Before the deadline you see each manager’s last lineup carried forward; once the deadline passe` |
| 62 | index-PREVIEW.html:2375 | not-X-its-Y | faq special 1 | `<b>Team of the Week is earned, not imported:</b> haul 10+ points` | `<b>Team of the Week:</b> haul 10+ points` |
| 63 | index-PREVIEW.html:2375 | em dash | faq special 2 | `It lasts one week — until your next match finishes, where you keep it with another hau` | `It lasts one week, until your next match finishes: keep it with another hau` |
| 64 | index-PREVIEW.html:2376 | em dash | faq money head | `<h3>The money — $1,200</h3>` | `<h3>The money: $1,200</h3>` |
| 65 | index-PREVIEW.html:2376 | em dash | faq money body | `at $30 each — most points in the period, August folds into September.` | `at $30 each: most points in the period, with August folded into September.` |
| 66 | index-PREVIEW.html:2378 | em dash | faq projected vs expected | `<p>Before a player’s match kicks off you see his <b>projected</b> points — FPL’s forecast, frozen at the deadline. Once he’s played, that flips to …` | `<p><b>Projected</b> points are the app’s forecast before a player’s match: his expected minutes, his underlying numbers and the fixture. <b>Expecte…` |
| 67 | index-PREVIEW.html:2379 | em dash | faq data | ` API on a rolling refresh — the app re-pulls` | ` API on a rolling refresh: the app re-pulls` |
| 68 | index-PREVIEW.html:2379 | copy/accuracy | faq privacy | `sn’t know yet.</p></div>';⏎}` | `sn’t know yet.</p></div>'⏎   +'<div class="faqsec"><h3>Privacy</h3><p>No ads, no analytics. This phone remembers which team you follow and, if you …` |
| 69 | index-PREVIEW.html:2386 | em dash | tier potm | `Player of the Month award — this card lasts until the ` | `Player of the Month award. This card lasts until the ` |
| 70 | index-PREVIEW.html:2387 | em dash | tier totw | ` 10+ points this gameweek — the black &amp; gold lasts` | ` 10+ points this gameweek. The black &amp; gold lasts` |
| 71 | index-PREVIEW.html:2389 | em dash, not-X-its-Y | tier elite | `return'Elite tier — rated 85+ on current form. Earned, not given.';` | `return'Elite tier: rated 85+ on current form.';` |
| 72 | index-PREVIEW.html:2390 | em dash | tier gold | `return'Gold tier — rated 78–84.';` | `return'Gold tier: rated 78–84.';` |
| 73 | index-PREVIEW.html:2391 | em dash | tier silver | `return'Silver tier — rated under 78.';` | `return'Silver tier: rated under 78.';` |
| 74 | index-PREVIEW.html:2457 | em dash, glyph → | sheet xp note | `' Expected numbers swap luck for underlying stats — goals→xG, assists→xA, clean sheets→e<sup>−xGC</sup>, defensive contribution→his hit-rate in pri…` | `' Expected numbers use underlying stats: xG for goals, xA for assists, e<sup>−xGC</sup> for clean sheets, his prior hit-rate for defensive contribu…` |
| 75 | v10-delta.js:301 | copy/accuracy | leader margin plural | `(num(lead['League Pts'])-num(sec['League Pts']))+' pts clear of '` | `((d=>d+(d===1?' pt':' pts'))(num(lead['League Pts'])-num(sec['League Pts'])))+' clear of '` |
| 76 | v10-delta.js:91 | glyph ● | bug live tag | `e:'<span class="tg live">● Live</span>'` | `e:'<span class="tg live">Live</span>'` |
| 77 | v10-delta.js:116 | em dash | provnote | `"><b>All matches finished — provisional result.</b> ` | `"><b>All matches finished. Provisional result.</b> ` |
| 78 | v10-delta.js:120 | glyph ● | section live tag | `e:'<span class="tg live">● Live</span>'` | `e:'<span class="tg live">Live</span>'` |
| 79 | v10-delta.js:122 | glyph 🎬 | show card emoji | `<div class="rk">🎬 Gameweek '+D.gw+' preview` | `<div class="rk">Gameweek '+D.gw+' preview` |
| 80 | v10-delta.js:122 | em dash | show card title | `'Every matchup, every lineup — the week in about a minute'` | `'Every matchup and lineup in about a minute'` |
| 81 | v10-delta.js:122 | glyph ▶ | show card play | `<span class="go">▶ PLAY</span></a>';` | `<span class="go">PLAY</span></a>';` |
| 82 | v10-delta.js:205 | em dash | health up placeholder | `'<span class="hr"><span>—</span></span>')+'</div>'` | `'<span class="hr"><span>–</span></span>')+'</div>'` |
| 83 | v10-delta.js:206 | em dash | health down placeholder | `'<span class="hr"><span>—</span></span>')+'</div><` | `'<span class="hr"><span>–</span></span>')+'</div><` |
| 84 | v10-delta.js:212 | em dash | next five blank | `)return '<span class="x">—</span>';` | `)return '<span class="x">–</span>';` |
| 85 | v10-delta.js:259 | em dash | team tile placeholder | `let gwTxt='—',gwSub='This gameweek';` | `let gwTxt='–',gwSub='This gameweek';` |
| 86 | v10-delta.js:262 | em dash | team tile proj placeholder | `EP?fmt1(teamProj(mine)):'—';` | `EP?fmt1(teamProj(mine)):'–';` |
| 87 | v10-delta.js:359 | em dash | projected note 1 | `op:8px">Projected lineups — FPL publishes picks at t` | `op:8px">Projected lineups. FPL publishes picks at t` |
| 88 | v10-delta.js:359 | copy/accuracy | projected note 2 | `+'. Until then this is each manager’s last lineup carried forward, with new signings slotted by projection and flagged players covered.</div>'` | `+'; until then each manager’s last lineup carries forward, with new signings and flagged players covered by projection.</div>'` |
| 89 | v10-delta.js:478 | glyph ↻ | lineup replay | ` class="watch" id="lgre">↻ Replay</button></div>'` | ` class="watch" id="lgre">Replay</button></div>'` |
| 90 | v10-delta.js:497 | glyph 📰 | recap emoji | `<div class="rk">📰 Gameweek '+r.gw+' recap<s` | `<div class="rk">Gameweek '+r.gw+' recap<s` |
| 91 | v10-delta.js:501 | glyph 🔭 | preview emoji | `<div class="rk">🔭 Gameweek '+p.gw+' preview` | `<div class="rk">Gameweek '+p.gw+' preview` |
| 92 | v10-delta.js:533 | em dash | claim note | ` photo, colours and crest — or just pick one to follow.'` | ` photo, colours and crest, or pick one to follow.'` |
| 93 | v10-delta.js:534 | glyph ★ | claim star | `tch elev" data-claim="1"><span class="pl">★</span>Claim your team</button>` | `tch elev" data-claim="1">Claim your team</button>` |
| 94 | v10-graphic.js:86 | copy/accuracy | vsbug duplicate tag | `'<div class="vsbug"><span class="tg'+(st==='live'?' live':'')+'">'+tag+'</span>` | `'<div class="vsbug">'+(tag===lab?'':'<span class="tg'+(st==='live'?' live':'')+'">'+tag+'</span>')+'` |
| 95 | v10-graphic.js:47 | glyph ★ | star man article | `if(p)return {p,k:'★ Star man · '+p.Player,t:c` | `if(p)return {p,k:'Star man · '+p.Player,t:c` |
| 96 | v10-graphic.js:51 | em dash | star man line | `m '+mins+' minutes so far — '+FIRSTOF(team)` | `m '+mins+' minutes so far, '+FIRSTOF(team)` |
| 97 | v10-graphic.js:53 | glyph ★ | star man key | `return {p,k:'★ Star man · '+p.Player,t:l` | `return {p,k:'Star man · '+p.Player,t:l` |
| 98 | v10-graphic.js:84 | glyph ● | final live tag | `={pred:'Predicted',live:'● Live',prov:'Provisional',` | `={pred:'Predicted',live:'Live',prov:'Provisional',` |
| 99 | v10-graphic.js:147 | glyph ↻▸ | graphic skip/replay | `ss="watch" id="lgnx">Skip ▸</button>':'<button class="watch" id="lgre">↻ Replay</button>'` | `ss="watch" id="lgnx">Skip</button>':'<button class="watch" id="lgre">Replay</button>'` |
| 100 | v10-graphic.js:148 | glyph ✕ | graphic close | ` class="watch" id="lgcl">✕ Close</button></div>'` | ` class="watch" id="lgcl">Close</button></div>'` |
| 101 | v10-show.js:48 | glyph ▶ | show read | `"watch elev" id="shread"><span class="pl">▶</span>Read the full preview</bu` | `"watch elev" id="shread">Read the full preview</bu` |
| 102 | v10-show.js:73 | glyph ▸✕🔊 | show footer | `hmute" aria-label="Mute">🔊</button><button class="watch" id="shnx">Skip ▸</button><button class="watch" id="lgcl">✕ Close</button>` | `hmute" aria-label="Mute">Mute</button><button class="watch" id="shnx">Skip</button><button class="watch" id="lgcl">Close</button>` |
| 103 | v10-show.js:79 | glyph 🔇🔊 | show mute toggle | `textContent=SHOWA.muted?'🔇':'🔊';` | `textContent=SHOWA.muted?'Unmute':'Mute';` |
| 104 | v10-show.js:97 | glyph ↻ | show end replay | `);if(nx){nx.textContent='↻ Replay';` | `);if(nx){nx.textContent='Replay';` |
| 105 | v10-show.js:108 | glyph ↻ | show article replay | `);if(nx){nx.textContent='↻ Replay';nx.onclick=()=>op` | `);if(nx){nx.textContent='Replay';nx.onclick=()=>op` |
| 106 | v10-show.js:114 | glyph ▸ | show skip | `(nx){nx.textContent='Skip ▸';nx.onclick=()=>showSkip` | `(nx){nx.textContent='Skip';nx.onclick=()=>showSkip` |
| 107 | v10-show.js:139 | glyph ★ | show star man | `if(p)return {p,k:'★ Star man · '+p.Player,t:S` | `if(p)return {p,k:'Star man · '+p.Player,t:S` |
| 108 | v10-auth.js:26 | em dash | auth timeout | `'Timed out — check your signal and try ` | `'Timed out. Check your signal and try ` |
| 109 | v10-auth.js:27 | em dash | auth unreachable | `Couldn’t reach the server — try again.'` | `Couldn’t reach the server. Try again.'` |
| 110 | v10-auth.js:39 | glyph ✎ | auth edit | `s="watch" data-claim="1">✎ Edit team</button>` | `s="watch" data-claim="1">Edit team</button>` |
| 111 | v10-auth.js:93 | em dash | auth wrong | `err('Wrong PIN — try again.')` | `err('Wrong PIN. Try again.')` |
| 112 | v10-auth.js:94 | em dash | auth locked | `err('Too many tries — locked for '` | `err('Too many tries. Locked for '` |
| 113 | v10-auth.js:95 | em dash | auth claimed | `err('Already claimed — sign in with your PIN, or ` | `err('Already claimed. Sign in with your PIN, or ` |
| 114 | v10-auth.js:96 | em dash | auth unclaimed | `err('Not claimed yet — set a new PIN to claim it.` | `err('Not claimed yet. Set a new PIN to claim it.` |
| 115 | v10-auth.js:158 | em dash | auth photo shrink | `photo won’t shrink enough — try a simpler one.'` | `photo won’t shrink enough. Try a simpler one.'` |
| 116 | v10-auth.js:167 | em dash | auth expired | `err('Your sign-in expired — sign in again.')` | `err('Your sign-in expired. Sign in again.')` |
| 117 | v10-auth.js:168 | em dash | auth photo large | `('That photo is too large — choose another.')` | `('That photo is too large. Choose another.')` |
| 118 | v10-history.js:22 | em dash | history empty | `">No gameweeks played yet — his history builds here from the first kickoff.</p>` | `">No gameweeks played yet.</p>` |
| 119 | v10-history.js:25 | em dash | history blank opp | `:'<span class="oc">—</span>';` | `:'<span class="oc">–</span>';` |
| 120 | v10-history.js:32 | em dash | history note | ` the performance deserved — bonus left out, as everywhere in the app.` | ` the performance deserved, with bonus left out.` |
| 121 | v10-refresh.js:12 | em dash | refresh offline | `'Couldn’t reach the sheet — showing what it has')` | `'Couldn’t reach the sheet. Showing the last update')` |
| 122 | v10-refresh.js:17 | em dash | refresh ran | `say('Sheet updated — loading…')` | `say('Sheet updated. Loading…')` |
| 123 | v10-refresh.js:18 | em dash | refresh busy | `say('Already updating — try again in a moment')` | `say('Already updating. Try again in a moment')` |
| 124 | v10-refresh.js:19 | em dash | refresh fresh | `say('Fresh — updated '+` | `say('Updated '+` |
| 125 | v10-refresh.js:20 | em dash | refresh failed | `Couldn’t update the sheet — showing what it has')` | `Couldn’t update the sheet. Showing the last update')` |
| 126 | v10-refresh.js:22 | em dash | refresh unreachable | `t reach the sheet updater — showing what it has')` | `t reach the sheet updater. Showing the last update')` |
| 127 | v10-derbies.js:43 | em dash | unnamed summary | `+' pairings — the naming committee has work to do</summary>` | `+' pairings</summary>` |
| 128 | v10-results.js:35 | em dash | results empty | `">No gameweeks played yet — the season’s results build here from GW1.</p>` | `">No gameweeks played yet.</p>` |
| 129 | v10-results.js:43 | em dash | results xp blank | `ass="xp">'+(r.xp===null?'—':` | `ass="xp">'+(r.xp===null?'–':` |
| 130 | v10-results.js:75 | em dash | grid blank | `return '<td class="none">—</td>';` | `return '<td class="none">–</td>';` |

Edits by file (excluding the marker line each file gets): index-PREVIEW.html 74, v10-delta.js 19, v10-graphic.js 7, v10-show.js 7, v10-auth.js 10, v10-history.js 3, v10-refresh.js 6, v10-derbies.js 1, v10-results.js 3 · total 130
