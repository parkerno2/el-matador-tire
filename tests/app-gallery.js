// The screenshot gallery and the invariant checks (Parker's Q4, 10 Oct 2026: "the scheduled agents seem sloppy, we need a
// better way to oversee them"): fplgg/tools/gallery/lib.js (the pure rules: NaN, undefined and null as words; em and en
// dashes; a player twice in one team view; the readable list; the index page) and the CI wiring of the headless walker
// fplgg/tools/gallery/gallery.js in the Preview and Build workflows (both browsers installed, the gallery run before
// anything is published, the preview's shots committed beside it, the build's kept as an artifact). Plain Node, no browser.
//   node tests/app-gallery.js
const fs = require('fs'), path = require('path');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const L = require(path.join(ROOT, 'fplgg/tools/gallery/lib.js'));

console.log('--- W words that mean a value was never computed');
check('W1 NaN, undefined and null as whole words are caught', L.badWords('NaN') === 'NaN' && L.badWords('xP undefined') === 'undefined' && L.badWords('null pts') === 'null' && L.badWords('(NaN)') === 'NaN');
check('W2 words that contain them are not (nullify, Nancy, undefinedness is not a word the app writes)', L.badWords('nullify') === '' && L.badWords('Nancy') === '' && L.badWords('Annulled') === '' && L.badWords('') === '');
check('W3 a real number passes', L.badWords('45.6') === '' && L.badWords('3-1-1 W-D-L') === '');

console.log('--- D the dash rule');
check('D1 an em dash anywhere fails', L.dashKind('a — b') === 'fail' && L.dashKind('one—two') === 'fail');
check('D2 an en dash in prose fails (a space beside it)', L.dashKind('words – more words') === 'fail' && L.dashKind('GW6 – live') === 'fail' && L.dashKind('a – b') === 'fail');
check('D3 an en dash tight in a figure is noted, not failed (BUGS.md #43)', L.dashKind('14–29') === 'noted' && L.dashKind('46.2–48.1') === 'noted' && L.dashKind('W–D–L') === 'noted' && L.dashKind('3⁠–⁠1⁠–⁠1') === 'noted');
check('D4 a spaced score and a minus are figures too', L.dashKind('PROJ FINAL 37.8 – 45.2') === 'noted' && L.dashKind('3 – 1') === 'noted' && L.dashKind('–1, unbeaten in four') === 'noted' && L.dashKind('(–2)') === 'noted');
check('D5 the blank value alone is noted', L.dashKind('–') === 'noted' && L.dashKind(' – ') === 'noted');
check('D6 no dash: nothing', L.dashKind('3-1-1') === '' && L.dashKind('') === '' && L.dashKind(null) === '');
check('D7 a figure beside prose still fails on the prose dash', L.dashKind('14–29 – and counting') === 'fail');

console.log('--- T a player twice in one team view');
check('T1 the surfaces are the Matchup pitch, list and bench, the Lineup pitch, bench and list, the manager sheet\'s pitch and bench', L.TEAM_VIEW_SEL === '.md-pitch, .md-bench, .md-list, .tm-pitch, .tm-bench, .tm-list, .ms-pitch, .ms-bench');
const dup = L.duplicates([{ code: '1', where: 'md-pitch' }, { code: '2', where: 'md-pitch' }, { code: '1', where: 'md-bench' }, { code: 3, where: 'md-bench' }, { code: '3', where: 'md-bench' }]);
check('T2 a code on the pitch and the bench is a duplicate, with both places; a number and its string are one code', dup.length === 2 && dup[0].code === '1' && dup[0].where.join('+') === 'md-pitch+md-bench' && dup[1].code === '3' && dup[1].where.length === 2, JSON.stringify(dup));
check('T3 fifteen different codes are none', L.duplicates(Array.from({ length: 15 }, (_, i) => ({ code: String(100 + i), where: 'tm-pitch' }))).length === 0 && L.duplicates([]).length === 0);
const app = { matchup: rd('fplgg/tools/matchweek/src/pages/matchday/matchup.js'), lineup: rd('fplgg/tools/matchweek/src/pages/team/lineup.js'), manager: rd('fplgg/tools/matchweek/src/sheets/manager.js') };
check('T4 the Matchup pitch card and the bench carry the player code the gallery reads (data-open="player:")', /class="md-tk" data-open="player:' \+ esc\(x\.code\)/.test(app.matchup) && /class="md-pitch"/.test(app.matchup) && /class="card md-bench"/.test(app.matchup) && /class="card md-list"/.test(app.matchup));
check('T5 the Lineup pitch, bench and list and the manager sheet\'s pitch and bench exist by those names', /class="tm-pitch"/.test(app.lineup) && /class="card tm-bench"/.test(app.lineup) && /class="card tm-list"/.test(app.lineup) && /ms-pitch/.test(app.manager) && /ms-bench/.test(app.manager));
check('T6 the Plates on them open the player sheet, so they carry his code (UI.plate and plateMini without noOpen)', /data-open="player:' \+ esc\(p\.Code\)/.test(rd('fplgg/tools/matchweek/src/ui.js')));

console.log('--- R the readable list');
const F = [{ kind: 'dash', screen: 'feed league', browser: 'webkit', state: 'snap', detail: 'div.x: "a — b"' }, { kind: 'duplicate', screen: 'matchup 1 formation', browser: 'chromium', state: 'pre', detail: 'code 5 on md-pitch and md-bench' }, { kind: 'duplicate', screen: 'team lineup pitch', browser: 'webkit', state: 'pre', detail: 'code 5 on tm-pitch and tm-bench' }];
const lines = L.lines(F);
check('R1 one heading per kind with its count, the duplicates first, one line per finding with the screen, browser and state', lines[0] === 'a player twice in one team view (2)' && lines[1] === '  matchup 1 formation [chromium, pre]: code 5 on md-pitch and md-bench' && lines[3] === 'an em or en dash in UI text (1)' && lines.length === 5, JSON.stringify(lines));
check('R2 every kind has words', ['duplicate', 'text', 'dash', 'overflow', 'clipped', 'console', 'ea', 'sheet', 'screen'].every(k => L.KIND_WORDS[k]) && L.lines([]).length === 0);

console.log('--- I the index page');
const shots = [{ state: 'pre', browser: 'chromium', screen: 'matchday overview', file: 'pre/chromium/01-matchday-overview.jpg' }, { state: 'pre', browser: 'webkit', screen: 'matchday overview', file: 'pre/webkit/01-matchday-overview.jpg' }, { state: 'snap', browser: 'chromium', screen: 'matchday overview', file: 'snap/chromium/01-matchday-overview.jpg' }, { state: 'snap', browser: 'chromium', screen: 'league <alltime>', file: 'snap/chromium/02-league-alltime.jpg' }];
const html = L.indexHtml(shots, { build: '20261011', from: 'abc1234', branch: 'preview', snapshot: '2026-10-10T21:38:45Z', width: 390, browsers: ['chromium', 'webkit'], states: ['pre', 'snap'], stateLabels: { pre: 'Before kick-off', snap: 'At the snapshot' }, findings: [], noted: [{ screen: 'x', detail: 'y' }] });
check('I1 one page, every screenshot in order, the browsers side by side, lazy images, the build and the verdict on top', /<!doctype html>/.test(html) && html.indexOf('pre/chromium/01') < html.indexOf('pre/webkit/01') && html.indexOf('pre/webkit/01') < html.indexOf('snap/chromium/01') && /loading="lazy"/.test(html) && /build 20261011 from abc1234 \(preview\)/.test(html) && /every check passed/.test(html));
check('I2 a browser without a screenshot says so; a screen name is escaped', /no screenshot/.test(html) && /league &lt;alltime&gt;/.test(html) && !/league <alltime>/.test(html));
check('I3 no external script, font or style; no emoji; no em or en dash', !/<script/.test(html) && !/https?:\/\//.test(html) && !/[–—]/.test(html) && !/[\u{1F300}-\u{1FAFF}]/u.test(html));
check('I4 the noted list is folded under a summary that names BUGS.md #43', /<details><summary>Noted, not failed: 1 /.test(html) && /#43/.test(html));
const bad = L.indexHtml(shots, { browsers: ['chromium'], states: ['snap'], findings: F });
check('I5 findings on top with the readable list, the verdict red', /3 findings/.test(bad) && /class="bad"/.test(bad) && /a player twice in one team view \(2\)/.test(bad));

console.log('--- G the walker and the CI wiring');
const G = rd('fplgg/tools/gallery/gallery.js'), PREV = rd('.github/workflows/preview.yml'), BUILD = rd('.github/workflows/matchweek.yml');
check('G1 the walker runs both browsers by default, two states where the data allows, and photographs as jpeg', /arg\('--browsers', 'chromium,webkit'\)/.test(G) && /STATES\.pre = /.test(G) && /type: 'jpeg'/.test(G));
check('G2 the walker visits the same screens as the contrast audit (every matchup, the team pages, the six League pages, the four Feed tabs, the sheets)', /matchup ' \+ \(i \+ 1\) \+ ' formation/.test(G) && /\['squad', 'transfers', 'fixtures', 'season'\]/.test(G) && /\['overview', 'results', 'money', 'derbies', 'stats', 'alltime'\]/.test(G) && /\['league', 'foryou', 'articles', 'messages'\]/.test(G) && /'player sheet, owned'/.test(G) && /'manager sheet'/.test(G) && /'menu'/.test(G) && /'search'/.test(G) && /'club identity'/.test(G) && /'feed post'/.test(G));
check('G3 the checks: duplicates, the words, the dashes, overflow, clipped text, console errors, EA assets, a sheet that shows no text', /L\.duplicates\(r\.codes\)/.test(G) && /badWords\(text\)/.test(G) && /dashKind\(text\)/.test(G) && /find\('overflow'/.test(G) && /find\('clipped'/.test(G) && /find\('console'/.test(G) && /find\('ea'/.test(G) && /find\('sheet'/.test(G) && /EA_RE = \/\\\/faces\\\/\|fc27\|ea\[-_\]\?map\/i/.test(G));
check('G4 a finding makes the run red (exit 1) and the readable list is printed; the index and the report are written', /process\.exit\(findings\.length \? 1 : 0\)/.test(G) && /L\.lines\(findings\)/.test(G) && /'index\.html'\), L\.indexHtml\(shots, meta\)/.test(G) && /'report\.json'/.test(G));
check('G5 the preview workflow installs webkit and chromium, runs the gallery into the preview\'s shots/ after the audit and before the publish step', /playwright install --with-deps webkit chromium/.test(PREV) && /gallery\/gallery\.js --dir \/tmp\/mw-demo --out \/tmp\/mw-preview\/shots/.test(PREV) && PREV.indexOf('contrast/audit.js') < PREV.indexOf('gallery/gallery.js') && PREV.indexOf('gallery/gallery.js') < PREV.indexOf('Publish it as preview/ on main'));
check('G6 the preview workflow keeps the gallery as an artifact too, so a red run still shows its screens', /name: gallery/.test(PREV) && /path: \/tmp\/mw-preview\/shots/.test(PREV));
check('G7 the build workflow installs both browsers, runs the gallery on the fresh demo before the commit and keeps it as an artifact', /playwright install --with-deps webkit chromium/.test(BUILD) && /gallery\/gallery\.js --dir site\/public --out \/tmp\/mw-gallery/.test(BUILD) && BUILD.indexOf('gallery/gallery.js') < BUILD.indexOf('Commit the build') && /name: gallery/.test(BUILD) && /path: \/tmp\/mw-gallery/.test(BUILD));
check('G8 the build commits nothing from the gallery (site/public/demo and the six root files only)', !/mw-gallery/.test(BUILD.slice(BUILD.indexOf('Commit the build'))) && /FILES="index\.html app\.js app\.css core\.js sw\.js manifest\.webmanifest site\/public\/demo"/.test(BUILD));
check('G9 the preview publish step still refuses anything outside preview/ (the shots live inside it)', /grep -v -E '\^\.\. preview\/\.\+\$'/.test(PREV));

check('G10 the followed team is written by an init script on the context before the page\'s first script runs, so Chromium (a hash change is a same-document navigation) and WebKit load the same state once, with no reload (the Q4 review, finding 2); a page that still opens unfollowed is a finding', /context\.addInitScript\(t => \{ try \{ if \(t && !localStorage\.getItem\('emt-myteam'\)\) localStorage\.setItem\('emt-myteam', t\)/.test(G) && /teamOnDisk = \(st\[0\] && st\[0\]\.Team\)/.test(G) && !/page\.reload\(/.test(G) && /the page opened in the state nobody follows/.test(G));
check('G11 a word broken across lines is a finding of its own (a surname on two lines, finding 1): the collector reads one-word texts over more than one line box, the walker files it, the list names it', /out\.broken\.push/.test(G) && /getClientRects\(\)/.test(G) && /find\('broken'/.test(G) && L.lines([{ kind: 'broken', screen: 's', browser: 'chromium', state: 'snap', detail: 'b: "Donnarumma" on 2 lines' }]).join('\n') === 'a word broken across lines (1)\n  s [chromium, snap]: b: "Donnarumma" on 2 lines');
check('G12 both workflows run the gallery at 390 px and again at 360 px (finding 3), the two indexes linked to each other', /gallery\.js --dir \/tmp\/mw-demo --out \/tmp\/mw-preview\/shots --alt 360\/index\.html/.test(PREV) && /gallery\.js --dir \/tmp\/mw-demo --out \/tmp\/mw-preview\/shots\/360 --width 360 --alt \.\.\/index\.html/.test(PREV) && /gallery\.js --dir site\/public --out \/tmp\/mw-gallery --alt 360\/index\.html/.test(BUILD) && /gallery\.js --dir site\/public --out \/tmp\/mw-gallery\/360 --width 360 --alt \.\.\/index\.html/.test(BUILD) && /m\.alt \?/.test(rd('fplgg/tools/gallery/lib.js')));

console.log('--- C the docs');
const DESIGN = rd('fplgg/tools/matchweek/docs/DESIGN.md'), CLAUDE = rd('CLAUDE.md'), README = rd('fplgg/tools/gallery/README.md');
check('C1 DESIGN.md names the gallery, its checks and the preview\'s shots page', /fplgg\/tools\/gallery\/gallery\.js/.test(DESIGN) && /preview\/shots\//.test(DESIGN) && /twice/.test(DESIGN) && /NaN/.test(DESIGN) && /WebKit/.test(DESIGN));
check('C2 CLAUDE.md names the gallery test and the gallery in the workflows', /tests\/app-gallery\.js/.test(CLAUDE) && /fplgg\/tools\/gallery\/gallery\.js/.test(CLAUDE));
check('C3 the gallery README says how to run it and what each check means', /gallery\.js --dir/.test(README) && /BUGS\.md #43/.test(README) && /WebKit/.test(README));
check('C4 no emoji, em or en dash in the gallery\'s own files (the dashes it names are written as code points or inside the rule text)', !/[\u{1F300}-\u{1FAFF}]/u.test(G + README) && !/[–—]/.test(G.replace(/\/\*[\s\S]*?\*\//g, '').replace(/'[^'\n]*'/g, '')));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
