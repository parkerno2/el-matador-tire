// The UI cleanup of 11 Oct 2026 (Parker said "All" to eight fixes after a review of every screen at phone size):
//  1. one top row: the page title, the state pill, search and your crest (the Matchweek plate row and the title row
//     were two rows, a fifth of the phone before any content); a hero page keeps its own h1 under the row;
//  2. one live signal: no "LIVE" on the League hero's progress, no live tag on the table, no live aside under titles;
//  3. tabs that fit: the switcher is one track whose segments share the width; My team folds Fixtures into Season
//     (#/team/fixtures still lands there), Matchday's Premier League is PL, League's Overview is Table;
//  4. the Squad list labels its two numbers: the rating small in a box over OVR, the points marked pts;
//  5. explainer copy gone: All matchups' "Predicted until the deadline", the Transfers how-to (now on How it works),
//     the Squad health aside, the Results footnotes;
//  6. the Results grid opens with a whole column against the team names and fades under the edge;
//  7. the Stats chart draws only the picked managers;
//  8. the Feed's press prompt in the app's colours (lime stays Archizio's own, in his posts and thread).
// Plain Node, source checks.   node tests/app-cleanup.js
const fs = require('fs');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (!cond && info ? '  ' + info : '')); };
const MW = __dirname + '/../fplgg/tools/matchweek/';
const rd = f => fs.readFileSync(MW + f, 'utf8');
const UI = rd('src/ui.js'), MAIN = rd('src/main.js'), COMP = rd('src/css/02-components.css'), TEAMCSS = rd('src/css/30-team.css'), LGCSS = rd('src/css/40-league.css'), FEEDCSS = rd('src/css/50-feed.css');
const MD = rd('src/pages/matchday.js'), LG = rd('src/pages/league.js'), TEAM = rd('src/pages/team.js'), FEED = rd('src/pages/feed.js');
const ALL = rd('src/pages/matchday/all.js'), LOV = rd('src/pages/league/overview.js'), RES = rd('src/pages/league/results.js'), CHART = rd('src/pages/league/chart.js');
const HEAD = rd('src/pages/team/head.js'), SQUAD = rd('src/pages/team/squad.js'), TX = rd('src/pages/team/transfers.js'), MENU = rd('src/sheets/menu.js');
const fn = (src, name) => { const i = src.indexOf('export function ' + name + '('); return i < 0 ? '' : src.slice(i, src.indexOf('\n}\n', i) + 2); };

console.log('--- 1. one top row');
const bar = fn(UI, 'appbar'), ph = fn(UI, 'pageHead');
check('the bar carries the title, then the state pill, search and the crest; no Matchweek plate, no league name', /class="pt"/.test(bar) && bar.indexOf('pt-t') < bar.indexOf('statePill()') && bar.indexOf('statePill()') < bar.indexOf('data-open="search"') && !/mwMark/.test(bar) && !/El Matador Tire/.test(bar));
check('pageHead puts the row first and a hero or back link under it; the row\'s title is the h1 unless the hero has one', /appbar\(\{ title, lead: opt\.lead, hero: \/<h1\[\\s>\]\/\.test\(opt\.body \|\| ''\) \}\) \+ \(opt\.body \|\| ''\)/.test(ph) && /tag = opt\.hero \? 'div' : 'h1'/.test(bar) && !/aside/.test(ph));
check('the row is one line: the title never wraps, a smaller title on a narrow phone', /\.abar \.pt-t\{[^}]*white-space:nowrap/.test(COMP) && /@media \(max-width:374px\)\{\.abar \.pt-t\{font-size:23px\}\}/.test(COMP) && !/\.abar \.lg/.test(COMP));
check('My team: the title in the row, the crest before it on the sub-pages; the hero has the team name with the manager and the Club button under it, no "My team" kicker',
  /UI\.pageHead\('My team', \{ bg: F\.head, under, body \}\)/.test(HEAD) && /UI\.pageHead\('My team', \{ bg: F\.headS, lead: UI\.crest\(team, 30\) \}\)/.test(HEAD) && /class="tm-mrow"><span class="tm-mgr">/.test(HEAD) && !/tm-kick/.test(HEAD));
check('League: the crest before the title on the sub-pages, no aside; the hero without its "League" kicker', /pageHead\('League', \{ bg: [^}]*lead: UI\.leagueCrest\(28\) \}\)/.test(LG) && !/<span class="k">League<\/span>/.test(LG) && !/class="aside"/.test(LG));
check('Matchday: the title alone, no gameweek aside under it', /UI\.pageHead\('Matchday'\)/.test(MD) && !/function aside\(/.test(MD));

console.log('--- 2. one live signal');
check('the League hero\'s progress says "GW6 of 38" without LIVE or FT, its current week does not blink', !/live-c">LIVE<\/em>' : prov \? ' <em>FT<\/em>'/.test(LG) && /'<i class="cur" style="left:'/.test(LG));
check('the table carries no live tag (the provisional tag stays)', !/lg-tag live/.test(LOV) && /lg-tag prov">Provisional/.test(LOV));
check('the Results heading counts the gameweeks played, no live aside', /UI\.sh\('Scores by gameweek', \{ aside: G\.gws\.filter\(x => !x\.live\)\.length \+ ' played' \}\)/.test(RES));

console.log('--- 3. tabs that fit');
check('the switcher is one track: no gaps, segments share the width, the active one a purple pill inside it', /\.pills\{[^}]*gap:0/.test(COMP) && /\.pills a,\.pills button\{[^}]*flex:1 0 auto;[^}]*font-size:12px/.test(COMP) && /\.pills \.on::before\{[^}]*inset:3px;[^}]*background:var\(--p500\)/.test(COMP) && /\.pills>:first-child\{border-radius:999px 0 0 999px/.test(COMP));
check('My team has five tabs; Season opens with the old Fixtures page; #/team/fixtures is an alias of Season',
  !/id: 'fixtures'/.test(TEAM) && /season: t => fixturesPage\(t\) \+ seasonPage\(t\)/.test(TEAM) && /alias: \{ fixtures: 'season' \}/.test(TEAM));
check('the router follows a page\'s aliases before it checks the sub-page', /let sub = parts\[1\] \? \(mod\.alias && mod\.alias\[parts\[1\]\]\) \|\| parts\[1\] : '';/.test(MAIN));
check('Matchday says PL, League says Table', /\{ id: 'pl', label: 'PL' \}/.test(MD) && /\{ id: 'overview', label: 'Table' \}/.test(LG));

console.log('--- 4. the Squad list labels its numbers');
check('the rating sits small in its box with OVR always under it (and the form arrow); the points carry pts',
  /'<div class="tm-ovr"><b class="n">' \+ o \+ '<\/b><span class="k">OVR'/.test(SQUAD) && /seasonPts\(p\) \+ '<small>pts<\/small><\/b>'/.test(SQUAD)
  && /\.tm-ovr\{[^}]*background:var\(--raised\)/.test(TEAMCSS) && /\.tm-ovr b\{font-size:15px/.test(TEAMCSS));

console.log('--- 5. explainer copy gone, data states kept');
check('All matchups: no "Predicted until the deadline" line (the cards say PREDICTED); the provisional line stays', !/Predicted until the deadline/.test(ALL) && /Provisional until FPL confirms/.test(ALL));
check('Transfers: the state and its times, no how-to; the how-to is on How it works', !/instant pickups/.test(TX) && !/helps you choose/.test(TX) && /'Until the deadline, '/.test(TX) && /free agents are instant pickups until the deadline/.test(MENU));
check('Squad health has no aside; the Results grid has no footnote', /UI\.sh\('Squad health'\)/.test(SQUAD) && !/count once the gameweek is over/.test(RES) && !/is provisional until FPL confirms it\.<\/div>/.test(RES));

console.log('--- 6. the Results grid');
check('it opens on the latest weeks with a whole column against the names and PF, PA whole at the far end, snaps to columns and fades under the edge',
  /const add = Math\.ceil\(cut\.getBoundingClientRect\(\)\.right - edge\);/.test(RES) && /for \(let i = 0; i < 4; i\+\+\)/.test(RES) && /document\.fonts\.ready\.then\(align\)/.test(RES) && /c\.style\.paddingRight = \(parseFloat\(getComputedStyle\(c\)\.paddingRight\) \+ add\) \+ 'px'/.test(RES)
  && /\.lg-grid \.tm::after\{[^}]*left:100%/.test(LGCSS));

console.log('--- 7. the Stats chart');
check('only the picked managers draw; no grey context lines', /o\.series\.filter\(s => s\.on\)\.forEach/.test(CHART) && !/class="ctx"/.test(CHART));

console.log('--- 8. the press prompt in the app\'s colours');
check('a neutral card, white text, a purple Press button; lime only in Archizio\'s own thread heads',
  /<em class="fcta-go">Press<\/em>/.test(FEED) && /\.fcta\{[^}]*background:var\(--card\);border:1px solid var\(--line\)/.test(FEEDCSS) && /\.fcta b\{color:var\(--tx\)\}/.test(FEEDCSS) && /\.fcta-go\{[^}]*background:var\(--p500\)/.test(FEEDCSS));

check('no emoji and no em or en dash in the copy this pass added', !/[\u{1F300}-\u{1FAFF}—–]/u.test(bar + fn(UI, 'pageHead') + (TX.match(/sub: [^\n]*/g) || []).join('')));
console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
