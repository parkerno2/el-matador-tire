// The polish pass of 11 Oct 2026 (P1, Parker's notes after the release-readiness review, built on the preview branch for
// his approval): the explanatory subtitles gone from the menu, the team picker, the club identity sheet and the pages
// (labels that name things, data states and empty states stay); the one-time intro (src/intro.js: three screens, one
// line each, only on a device that has never used the app, skippable, never shown again, nothing added elsewhere); the
// Feed's reaction buttons labelled with no trash can, the voice line "Written by Claude for <voice>" alone, the demo's
// article cards opening real pages or not shown; content text at 11 px or larger and pinch-to-zoom back on; the Q4
// review's three findings (a surname never broken, the gallery's first screen in one state, the 360 px cuts). Plain Node.
//   node tests/app-polish.js
const fs = require('fs'), path = require('path'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const ROOT = path.join(__dirname, '..'), MW = path.join(ROOT, 'fplgg/tools/matchweek');
const rd = f => fs.readFileSync(path.join(MW, f), 'utf8');
const SRC = {};
const walk = d => fs.readdirSync(d).forEach(f => { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(js|css)$/.test(f)) SRC[path.relative(MW, p)] = fs.readFileSync(p, 'utf8'); });
walk(path.join(MW, 'src'));
const JS = Object.keys(SRC).filter(f => f.endsWith('.js')).map(f => SRC[f]).join('\n'), CSS = Object.keys(SRC).filter(f => f.endsWith('.css')).map(f => SRC[f]).join('\n');

console.log('--- S the subtitles (Parker: "the other subtitles definitely need to be killed")');
const gone = [
  'The app opens on your matchup, your lineup and your club’s colours', 'Cards, ratings, projections, auto-subs, luck and the money', 'Any Premier League player, or a team',
  'Refreshes every 90 seconds while games are on', 'Live scores can trail the TV by a few minutes', 'The previous version, everything still in place',
  'Pick once and My team opens on your club, in your colours', 'Managers who sign in from the menu can change their club’s colours', 'Never blocked. Your crest and name always travel with your colour',
  'Shows beside your name on your club’s page', 'Under 32 px the crest turns into a simple shape', 'as the league will see them. In matchups you are always blue', 'on their next refresh. Change it whenever you like',
  'FPL usually confirms within a few hours', 'bonus and late stat changes can still move points', 'from 5,000 simulated seasons. Most likely', 'Bars show each side’s win chance',
];
const left = gone.filter(t => JS.indexOf(t) > -1);
check('S1 every removed subtitle is gone from the app (' + gone.length + ' checked)', left.length === 0, left.join(' | '));
const MENU = rd('src/sheets/menu.js');
check('S2 the menu rows How it works and Search have no subtitle; the Data card keeps the updated line and the refresh button', /rowLink\('data-open="menu:how"', 'info', 'How it works'\)/.test(MENU) && /rowLink\('data-open="search"', 'search', 'Search'\)/.test(MENU) && /Updated ' \+ ago\(\)/.test(MENU) && /Refresh now/.test(MENU));
check('S3 the labels, data states and empty states stay: Pick your team, Provisional, Estimated bonus is counted, Finished gameweeks only, Nobody has kicked off, the How it works page', /<b>Pick your team<\/b>/.test(MENU) && /Provisional\./.test(SRC['src/pages/matchday/overview.js']) && /Estimated bonus is counted\./.test(SRC['src/pages/matchday/week.js']) && /Finished gameweeks only\./.test(SRC['src/pages/league/results.js']) && /Nobody has kicked off/.test(SRC['src/pages/matchday/overview.js']) && /function howView/.test(MENU) && /Auto-subs/.test(MENU));

console.log('--- I the one-time intro');
const INTRO = rd('src/intro.js'), MAIN = rd('src/main.js'), ICSS = rd('src/css/64-intro.css');
const firstWrite = MAIN.search(/localStorage\.setItem\(/), fresh = MAIN.indexOf('const FRESH');
check('I1 main.js reads FRESH (no emt- key at all) before its first write to localStorage, and shows the intro after the first render', fresh > -1 && fresh < firstWrite && /indexOf\('emt-'\) === 0/.test(MAIN) && /render\(\{ keepScroll: true \}\); showIntro\(FRESH\);/.test(MAIN));
/* intro.js in a vm: the ESM import and exports stripped, a fake browser */
function introCtx(o) {
  const store = Object.assign({}, o.store || {});
  const ctx = { console, UI: { mwMark: () => '<i class="mwm"></i>' }, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, store,
    location: { search: o.search || '' }, navigator: { webdriver: !!o.webdriver }, Date, RegExp, String, Object, Array, document: null };
  ctx.document = { body: { appendChild(el) { ctx.mounted = el; } }, addEventListener() { }, removeEventListener() { },
    createElement: () => { const el = { innerHTML: '', className: '', listeners: {}, addEventListener(t, f) { this.listeners[t] = f; }, remove() { ctx.removed = true; }, querySelector: () => null }; return el; } };
  vm.createContext(ctx);
  vm.runInContext(INTRO.replace(/^import [^\n]+\n/m, '').replace(/^export (const|function) /gm, '$1 ') + '\nthis.X = { KEY, SCREENS, wanted, forced, screenHTML, showIntro };', ctx);
  return ctx;
}
let C = introCtx({});
check('I2 three screens, one line each, naming Matchday, picking your team and How it works; no em or en dash, no emoji', C.X.SCREENS.length === 3 && C.X.SCREENS.every(s => s.t.length <= 60 && /^[^.!?]+\.$/.test(s.t)) && /Matchday/.test(C.X.SCREENS[0].t) && /Pick your team/.test(C.X.SCREENS[1].t) && /How it works/.test(C.X.SCREENS[2].t) && !/[–—]|[\u{1F300}-\u{1FAFF}]/u.test(C.X.SCREENS.map(s => s.k + s.t).join('') + C.X.screenHTML(0) + C.X.screenHTML(2)));
check('I3 shown only on a fresh device: fresh and no key yes; not fresh no; fresh but a headless browser no; fresh but emt-intro set no', C.X.wanted(true) === true && C.X.wanted(false) === false && introCtx({ webdriver: true }).X.wanted(true) === false && introCtx({ store: { 'emt-intro': '2026-10-11' } }).X.wanted(true) === false);
check('I4 ?intro=1 shows it on demand (a review), whatever the device', introCtx({ search: '?intro=1' }).X.wanted(false) === true && introCtx({ search: '?x=1&intro=1', store: { 'emt-intro': 'x' } }).X.wanted(false) === true && introCtx({ search: '?intro=10' }).X.wanted(false) === false);
const h0 = C.X.screenHTML(0), h1 = C.X.screenHTML(1), h2 = C.X.screenHTML(2);
check('I5 the first screen has Skip and Next, the second Next only, the last Done; a dialog with the line as its label', /data-intro="skip">Skip</.test(h0) && /data-intro="next">Next</.test(h0) && !/skip/.test(h1) && /data-intro="next"/.test(h1) && !/skip/.test(h2) && /data-intro="done">Done</.test(h2) && /role="dialog" aria-modal="true" aria-labelledby="intro-t"/.test(h0) && /id="intro-t"/.test(h0));
C = introCtx({});
check('I6 showIntro mounts it once, Skip removes it and writes emt-intro; a second call shows nothing', C.X.showIntro(true) === true && !!C.mounted && (C.mounted.listeners.click({ target: { closest: () => ({ dataset: { intro: 'skip' } }) } }), C.removed === true) && /^\d{4}-\d{2}-\d{2}T/.test(C.store['emt-intro']) && C.X.showIntro(true) === false, JSON.stringify(C.store));
C = introCtx({});
check('I7 Next, Next, Done walks the three screens and remembers', C.X.showIntro(true) && (C.mounted.listeners.click({ target: { closest: () => ({ dataset: { intro: 'next' } }) } }), /data-intro="next"/.test(C.mounted.innerHTML) && !/skip/.test(C.mounted.innerHTML)) && (C.mounted.listeners.click({ target: { closest: () => ({ dataset: { intro: 'next' } }) } }), /data-intro="done"/.test(C.mounted.innerHTML)) && (C.mounted.listeners.click({ target: { closest: () => ({ dataset: { intro: 'done' } }) } }), C.removed === true && !!C.store['emt-intro']));
const zi = s => { const m = new RegExp(s + '\\{[^}]*z-index:(\\d+)').exec(CSS); return m ? +m[1] : -1; };
check('I8 the intro layer sits above the sheets and under the toast; purple only on the active dot and the button; the line 22 px on the card', zi('\\.intro') > zi('\\.sheet') && zi('\\.intro') < zi('\\.toast') && /\.intro-dots i\.on\{background:var\(--p300\)\}/.test(ICSS) && /\.intro-t\{[^}]*font-size:22px/.test(ICSS) && /\.intro-p\{[^}]*background:var\(--card\)/.test(ICSS));
const introElsewhere = Object.keys(SRC).filter(f => f.endsWith('.js') && !/^src\/(main|intro)\.js$/.test(f) && /emt-intro|showIntro|intro\.js|intro=1/.test(SRC[f]));
check('I9 nothing else in the app mentions the intro (How it works stays where it is)', introElsewhere.length === 0 && /data-open="menu:how"/.test(MENU), introElsewhere.join(', '));

console.log('--- F the Feed');
const RENDER = rd('src/feed/render.js'), SOCIAL = rd('src/feed/social.js'), AIP = rd('src/feed/ai-posts.js'), FEEDCSS = rd('src/css/50-feed.css');
check('F1 every reaction button carries its word (frx-l) and the aria-label; the thumbs-down replaces the trash can', /<span class="frx-l">' \+ x\.label \+ '<\/span>/.test(RENDER) && /aria-label="' \+ x\.label/.test(RENDER) && !/M4 6\.8h16/.test(RENDER) && /M17 13\.6l-3\.6 6\.4/.test(RENDER) && /\.frx-l\{font-size:11px/.test(FEEDCSS));
check('F2 the five reactions keep their words in the log (fire, laugh, clown, eyes, bin) and their labels', /k: 'fire', label: 'Fire'/.test(SOCIAL) && /k: 'laugh', label: 'Funny'/.test(SOCIAL) && /k: 'clown', label: 'Clown'/.test(SOCIAL) && /k: 'eyes', label: 'Watching'/.test(SOCIAL) && /k: 'bin', label: 'Bin it'/.test(SOCIAL));
check('F3 the line under a voice post is "Written by Claude for <voice>" alone, no tab names', /facts: 'Written by Claude for ' \+ \(\{ archizio: 'Archizio', clark: 'Clark', malcolm: 'Malcolm' \}\[voice\]\),/.test(AIP) && !/· from/.test(AIP));
const demo = require(path.join(ROOT, 'fplgg/tools/demo/build-demo.js'));
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'mw-polish-')); fs.writeFileSync(path.join(tmp, 'recap-gw1.html'), '<!doctype html>');
const sample = "const RECAPS=[\n  {gw:1,href:'recap-gw1.html',title:'One',\n   sub:'a'},\n  {gw:2,href:'recap-gw2.html',title:'Two',\n   sub:'b'}\n];\nconst PREVIEWS=[\n  {gw:2,href:'preview-gw2.html',title:'P',\n   sub:'c'}\n];\nconst X=1;";
const outS = demo.demoArticles(sample, tmp);
check('F4 demoArticles keeps an article whose page exists one folder up (href ../recap-gw1.html) and drops the rest', /const RECAPS=\[\n  \{gw:1,href:'\.\.\/recap-gw1\.html',title:'One',\n   sub:'a'\}\n\];/.test(outS) && /const PREVIEWS=\[\];/.test(outS) && /const X=1;/.test(outS));
const CORE = rd('core.gen.js'), real = demo.demoArticles(CORE, demo.SITE);
const hrefs = [...real.matchAll(/const (?:RECAPS|PREVIEWS)=\[([\s\S]*?)\];/g)].flatMap(m => [...m[1].matchAll(/href:'([^']+)'/g)].map(x => x[1]));
check('F5 on the real core every demo article card opens a page under site/public (' + hrefs.length + ' kept of ' + (CORE.match(/href:'(?:recap|preview)-gw\d+\.html'/g) || []).length + ')', hrefs.length > 0 && hrefs.every(h => /^\.\.\//.test(h) && fs.existsSync(path.join(demo.SITE, h.slice(3)))), hrefs.join(', '));
check('F6 the demo build applies it to core.js', /demoArticles\(demoCore\(core\), SITE\)/.test(fs.readFileSync(path.join(ROOT, 'fplgg/tools/demo/build-demo.js'), 'utf8')));

console.log('--- R readability');
const small = [];
Object.keys(SRC).filter(f => f.endsWith('.css')).forEach(f => {
  [...SRC[f].matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].forEach(m => { if (+m[1] < 11) small.push(f + ': ' + m[0]); });
  [...SRC[f].matchAll(/font:\s*\d{3}\s+(\d+(?:\.\d+)?)px(\/\d+px)?/g)].forEach(m => { if (+m[1] < 11 && m[0] !== 'font:900 8px/12px') small.push(f + ': ' + m[0]); });
  [...SRC[f].matchAll(/\.[a-z-]+[^{]*\{[^}]*font-size:\s*(?:\.\d+|0\.\d+)(?:em|rem)[^}]*\}/g)].forEach(m => { if (!/\.fc-i \.ini\{/.test(m[0])) small.push(f + ': ' + m[0].slice(0, 60)); });   /* the initials in a face circle are the photo's fallback and scale with the circle */
});
check('R1 no text under 11 px in any stylesheet (px sizes, font shorthands and em sizes; the 12 px assist dot\'s glyph, the Plate\'s clamp and the face circle\'s initials are glyph markers that scale with their mark)', small.length === 0, small.slice(0, 12).join(' | '));
const TPL = rd('index.template.html'), TOK = rd('src/css/01-tokens.css');
check('R2 pinch-to-zoom is on: no user-scalable=no or maximum-scale in the viewport, no gesture handler in main.js, touch-action manipulation', !/user-scalable|maximum-scale/.test(TPL) && /<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">/.test(TPL) && !/gesturestart/.test(MAIN) && /\*\{touch-action:manipulation\}/.test(TOK) && !/touch-action:pan-x pan-y/.test(CSS));

console.log('--- Q the Q4 review findings');
const MDCSS = rd('src/css/20-matchday.css'), MATCHUP = rd('src/pages/matchday/matchup.js'), SHEETCSS = rd('src/css/60-sheets.css'), SEARCH = rd('src/sheets/search.js'), LGCSS = rd('src/css/40-league.css'), FEED = rd('src/pages/feed.js');
check('Q1 the Matchup list name keeps a word whole (overflow-wrap normal, keep-all, no hyphens) on two lines at most, and a surname of 10 letters or more takes the smaller size', /\.md-hc b\{[^}]*-webkit-line-clamp:2[^}]*overflow-wrap:normal;word-break:keep-all;hyphens:none\}/.test(MDCSS) && /\.md-hc b\.lng\{font-size:11\.5px/.test(MDCSS) && /String\(x\.p\.Player\)\.length >= 10 \? ' class="lng"'/.test(MATCHUP));
check('Q2 the 360 px cuts: the search name wraps with its chip on the line under it, the stats leader line wraps, the auto-pick team name takes two lines, the thread preview is a secondary line, the mini strip label wraps', /\.sr-m b\{[^}]*-webkit-line-clamp:2[^}]*word-break:keep-all\}/.test(SHEETCSS) && /<span class="sr-m"><b>' \+ esc\(p\.Player\) \+ '<\/b><span class="sr-m2">' \+ availChip\(status\)/.test(SEARCH) && !/\.lg-mt \.tx span\{[^}]*nowrap/.test(LGCSS) && /\.od-n\{[^}]*-webkit-line-clamp:2/.test(FEEDCSS) && /class="fth-t"><b>[^\n]*<span class="sub ell">/.test(FEED) && !/\.mini-ap>\.f-mono\{[^}]*nowrap/.test(FEEDCSS));
const GAL = fs.readFileSync(path.join(ROOT, 'fplgg/tools/gallery/gallery.js'), 'utf8');
check('Q3 the gallery writes the followed team before the page loads (an init script), so Chromium and WebKit photograph the same state', /context\.addInitScript\(t => \{ try \{ if \(t && !localStorage\.getItem\('emt-myteam'\)\)/.test(GAL) && !/page\.reload\(/.test(GAL));

console.log('--- D the docs');
const DESIGN = fs.readFileSync(path.join(MW, 'docs/DESIGN.md'), 'utf8'), CLAUDE = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');
check('D1 DESIGN.md carries the 11 px floor, pinch-to-zoom, the intro rule and the broken-word rule', /11 px/.test(DESIGN) && /inch/.test(DESIGN) && /intro/.test(DESIGN) && /broken/.test(DESIGN));
check('D2 CLAUDE.md and the tests README name this suite', /tests\/app-polish\.js/.test(CLAUDE) && /app-polish\.js/.test(fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8')));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
