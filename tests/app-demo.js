// The demo league on matchweek.gg (Parker's Q2, 8 Oct 2026): the demo data source in fplgg/tools/matchweek/src/data/tabs.js,
// the anonymiser and leak check in fplgg/tools/demo/names.js, the demo build's index page and the workflow that ships it.
// Plain Node, no network, no browser: tabs.js runs in a vm with __MW_DEMO__ set, as the demo build sets it. Every name in
// this file is made up for the test; the real league's names are read from the live Sheet only at build time, never written.
//   node tests/app-demo.js
const fs = require('fs'), vm = require('vm'), path = require('path');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const src = read('fplgg/tools/matchweek/src/data/tabs.js').replace(/^export (function|const|let)/gm, '$1');
const names = require('../fplgg/tools/demo/names.js');
const build = require('../fplgg/tools/demo/build-demo.js');
const snap = require('../fplgg/tools/demo/snapshot.js');
const tick = () => new Promise(r => setImmediate(r));

/* tabs.js in a vm: demo true or false, files: { 'data/standings.json': { status, body } }, the Sheet's JSONP answered by hand */
function load(o) {
  o = o || {};
  const scripts = [], fetches = [], warns = [], store = {};
  const ctx = { console: { warn: m => warns.push(m), log: () => {}, info: () => {} }, JSON, String, Date, Math, Number, Object, Array, Set, Error, RegExp, isNaN, encodeURIComponent, Promise, SHEET: 'SHEET_ID',
    canonTeam: v => v, window: {}, setTimeout: () => 1, clearTimeout: () => {},
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    location: { search: o.search || '' }, AbortController: class { constructor() { this.signal = 'sig'; } abort() {} },
    fetch: url => { fetches.push(url); let a = (o.files || {})[url]; if (typeof a === 'function') a = a(); if (!a) a = { status: 404, body: 'not found' }; if (a.reject) return Promise.reject(new Error(a.reject)); return Promise.resolve({ status: a.status, ok: a.status >= 200 && a.status < 300, json: () => Promise.resolve(a.body) }); },
    document: { createElement: () => { const s = { remove() {} }; scripts.push(s); return s; }, head: { appendChild: () => {} } } };
  if (o.demo) ctx.__MW_DEMO__ = true;
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(src + '\n;this.__x = { TABS, QUERIES, DEMO, DEMO_DATA, DEMO_EMPTY, demoFile, readDemo, dataSource, dataReport, guardedReadTab, readMeta, pickSource };', ctx);
  return { x: ctx.__x, ctx, scripts, fetches, warns, store };
}
const GWS = 'GW,Code,Player,Pos,Club,Owner,Mins,Pts,G,A,CS,GC,OG,PS,PM,YC,RC,Saves,Bonus,BPS,DefCon,xG,xA,xGC,Starts,Final'.split(',');
const gwRow = (code, owner, mins) => { const o = {}; GWS.forEach(c => { o[c] = ''; }); Object.assign(o, { GW: '5', Code: code, Owner: owner, Mins: mins, Pts: '2' }); return o; };

(async () => {
  /* ---------- the demo data source ---------- */
  let L = load({ demo: true, files: {
    'data/standings.json': { status: 200, body: { cols: ['Team', 'Manager', 'W', 'D', 'L', 'Pts For', 'Pts Against', 'League Pts'], rows: [{ Team: 'Wirtz Case Scenario', Manager: 'Dec Rowley', W: '3', D: '0', L: '2', 'Pts For': '199', 'Pts Against': '201', 'League Pts': '9' }] } },
    'data/gw-stats.json': { status: 200, body: { cols: GWS, rows: [gwRow('1', 'Wirtz Case Scenario', '0'), gwRow('2', '', '90'), gwRow('3', '', '0')] } },
    'data/specials.json': { status: 200, body: { cols: ['Setting', 'Value'], rows: [{ Setting: 'POTM month', Value: 'August' }] } },
    'data/posts.json': { status: 200, body: { cols: ['When (UTC)', 'Id', 'Voice', 'Kind'], rows: [] } },
  } });
  check('DEMO is on when the build defines __MW_DEMO__, and the source is demo whatever the URL or storage say', L.x.DEMO === true && L.x.dataSource() === 'demo' && L.x.dataReport().source === 'demo');
  check('demoFile: the tab name as a slug under data/, the same name fplgg/tools/demo writes', L.x.demoFile('GW Stats') === 'data/gw-stats.json' && L.x.demoFile('H2H Fixtures') === 'data/h2h-fixtures.json' && L.x.demoFile('FC27') === 'data/fc27.json' && L.x.DEMO_DATA + names.slug('EA Map') === L.x.demoFile('EA Map'));
  let rows = await L.x.guardedReadTab('Standings');
  check('a tab is read from its JSON file, through the header guard', rows.length === 1 && rows[0].Team === 'Wirtz Case Scenario' && L.x.dataReport().tabs.Standings === 'demo', JSON.stringify(L.x.dataReport()));
  rows = await L.x.guardedReadTab('GW Stats');
  check('the GW Stats trim applies to the demo rows too (owned or played kept)', rows.length === 2 && rows.map(r => r.Code).join() === '1,2');
  rows = await L.x.guardedReadTab('FC27'); const rowsEa = await L.x.guardedReadTab('EA Map');
  check('the EA tabs are answered empty without a request (no EA data in the demo, 9 Oct 2026)', L.x.DEMO_EMPTY.join() === 'EA Map,FC27' && rows.length === 0 && rowsEa.length === 0 && !L.fetches.some(u => /fc27|ea-map/.test(u)) && L.x.dataReport().tabs.FC27 === 'demo (left out, empty)', L.fetches.join(' '));
  rows = await L.x.guardedReadTab('Fixture BPS');
  check('a tab without a file is empty, with the header the guard needs (an optional tab stays optional)', Array.isArray(rows) && rows.length === 0 && /^demo \(no file/.test(L.x.dataReport().tabs['Fixture BPS']));
  let err = ''; await L.x.guardedReadTab('Rosters').catch(e => { err = e.message; });
  check('a required tab without a file is empty too, not an error (the guard sees its header)', err === '', err);
  const sp = await L.x.guardedReadTab('Specials');
  check('Specials carries no API URL in the demo data, so D.api stays blank', !sp.some(r => r.Setting === 'API URL'));
  check('readMeta answers 0 in the demo: frozen data never shows the stale banner', (await L.x.readMeta()) === 0);
  check('nothing was asked of the Sheet (no JSONP script) or Supabase (no fetch outside data/)', L.scripts.length === 0 && L.fetches.every(u => u.startsWith('data/')), L.fetches.join(' '));
  L = load({ demo: true, search: '?data=supabase', files: { 'data/standings.json': { status: 500, body: {} } } });
  check('?data=supabase is ignored in the demo', L.x.dataSource() === 'demo' && !('mw-data' in L.store));
  err = ''; await L.x.guardedReadTab('Standings').catch(e => { err = e.message; });
  check('a file that fails to load rejects with the reason (no silent fallback to the Sheet)', /HTTP 500/.test(err) && L.scripts.length === 0, err);
  L = load({ demo: true, files: { 'data/standings.json': { status: 200, body: { cols: ['Rank', 'Team', 'Manager', 'Grade'], rows: [] } } } });
  err = ''; await L.x.guardedReadTab('Standings').catch(e => { err = e.message; });
  check('the header guard still refuses a demo file with the wrong columns', /wrong columns/.test(err), err);
  L = load({});
  check('without the define the league app is untouched: DEMO false, the Sheet by default', L.x.DEMO === false && L.x.dataSource() === 'sheet');

  /* ---------- the anonymiser (made-up names) ---------- */
  const standings = [{ Team: 'Zeta Zebras', Manager: 'Alice Quill' }, { Team: 'Team Bob', Manager: 'Bob Stone' }, { Team: 'Mountain Goats', Manager: 'PJ Stone' }];
  const m = names.mapping(standings, { 'Zeta Zebras': 'AQ', 'Team Bob': 'BS', 'Mountain Goats': 'PJ' }, { 'Zeta Zebras': 'Zebras', 'Team Bob': 'Bobs', 'Mountain Goats': 'Goats' });
  const inis = { 'Zeta Zebras': 'AQ', 'Team Bob': 'BS', 'Mountain Goats': 'PJ' }, shorts = { 'Zeta Zebras': 'Zebras', 'Team Bob': 'Bobs', 'Mountain Goats': 'Goats' };
  check('mapping: teams sorted by name take the fictional entries in order, so it is the same on every run', m.order.join('|') === 'Mountain Goats|Team Bob|Zeta Zebras' && m.teams['Mountain Goats'] === names.FICTIONAL[0].team && m.teams['Team Bob'] === names.FICTIONAL[1].team && m.teams['Zeta Zebras'] === names.FICTIONAL[2].team && JSON.stringify(names.mapping(standings.slice().reverse(), inis, shorts)) === JSON.stringify(m));
  check('mapping: the engine\'s short names follow the team too', m.short.Goats === names.FICTIONAL[0].short && m.short.Bobs === names.FICTIONAL[1].short && m.shorts['Team Bob'].from === 'Bobs' && m.shorts['Team Bob'].to === names.FICTIONAL[1].short && names.FICTIONAL.every(f => f.short && f.team.split(' ').includes(f.short)) && new Set(names.FICTIONAL.map(f => f.short)).size === 8);
  check('mapping: full names, first names, surnames and initials follow the team', m.mgrs['Alice Quill'] === names.FICTIONAL[2].mgr && m.first.Alice === names.words(names.FICTIONAL[2].mgr)[0] && m.sur.Quill === names.words(names.FICTIONAL[2].mgr)[1] && m.ini.AQ === names.FICTIONAL[2].ini && m.ini.PJ === names.FICTIONAL[0].ini);
  check('a shared surname maps once, to the first team that carries it', m.sur.Stone === names.words(names.FICTIONAL[0].mgr)[1]);
  check('the fictional entries are eight, with distinct teams, managers and initials, none equal to a test name', names.FICTIONAL.length === 8 && new Set(names.FICTIONAL.map(f => f.team)).size === 8 && new Set(names.FICTIONAL.map(f => f.ini)).size === 8 && new Set(names.FICTIONAL.map(f => f.mgr)).size === 8 && !names.FICTIONAL.some(f => f.team in m.teams || f.mgr in m.mgrs));
  const big = names.mapping(Array.from({ length: 10 }, (_, i) => ({ Team: 'Club ' + i, Manager: 'Person ' + i + ' Surname' + i })));
  check('a league of more than eight teams still comes out fictional (Team 9, Team 10)', Object.keys(big.teams).length === 10 && big.teams['Club 8'] === 'Team 9' && big.teams['Club 9'] === 'Team 10');

  check('replaceNames: whole words only, longest first (a team name that holds a first name wins), one pass', names.replaceNames('Team Bob v Zeta Zebras; Bob and Alice Quill and Quillon and Bobby', m) === names.FICTIONAL[1].team + ' v ' + names.FICTIONAL[2].team + '; ' + names.words(names.FICTIONAL[1].mgr)[0] + ' and ' + names.FICTIONAL[2].mgr + ' and Quillon and Bobby');
  const tabs = {
    Standings: { cols: ['Team', 'Manager', 'W'], rows: [{ Team: 'Team Bob', Manager: 'Bob Stone', W: '3' }, { Team: 'Zeta Zebras', Manager: 'Alice Quill', W: '2' }] },
    Players: { cols: ['Code', 'Player', 'Full name', 'Owner'], rows: [{ Code: '1', Player: 'Ramsey', 'Full name': 'Bob Ramsey', Owner: 'Team Bob' }, { Code: '2', Player: 'Stone', 'Full name': 'Alice Stone', Owner: '' }] },
    Specials: { cols: ['Setting', 'Value'], rows: [{ Setting: 'API URL', Value: 'https://script.google.com/x' }, { Setting: 'POTM month', Value: 'August' }] },
    Managers: { cols: ['Team', 'Color', 'Photo', 'Manager'], rows: [{ Team: 'Team Bob', Color: 'steel', Photo: 'data:image/jpeg;base64,xx', Manager: 'Bobby S' }] },
    Social: { cols: ['When (UTC)', 'Team', 'Kind', 'Target', 'Value'], rows: [{ 'When (UTC)': 't', Team: 'Team Bob', Kind: 'quote', Target: 'gw5', Value: 'Alice is finished' }, { 'When (UTC)': 't', Team: 'Zeta Zebras', Kind: 'react', Target: 'p1', Value: 'fire' }] },
    Posts: { cols: ['When (UTC)', 'Id', 'Voice', 'Kind', 'Teams', 'Text'], rows: [{ 'When (UTC)': 't', Id: 'ai:1', Voice: 'clark', Kind: 'ai', Teams: 'Team Bob|Zeta Zebras', Text: "Bob's bench beat Alice Quill. Bob Stone is finished." }, { 'When (UTC)': 't', Id: 'note', Voice: '', Kind: 'note', Teams: '', Text: 'memory' }] },
  };
  const out = names.anonymiseTabs(tabs, m);
  check('Standings: team and manager cells become the fictional names', out.Standings.rows[0].Team === names.FICTIONAL[1].team && out.Standings.rows[0].Manager === names.FICTIONAL[1].mgr && out.Standings.rows[1].Manager === names.FICTIONAL[2].mgr && out.Standings.rows[0].W === '3');
  check('Players: the owner is mapped, a footballer who shares a first name or surname keeps his', out.Players.rows[0].Owner === names.FICTIONAL[1].team && out.Players.rows[0]['Full name'] === 'Bob Ramsey' && out.Players.rows[1]['Full name'] === 'Alice Stone');
  check('Specials: the API URL row is gone, the rest stays', out.Specials.rows.length === 1 && out.Specials.rows[0].Setting === 'POTM month');
  check('Managers: no photo and no display name, the colours kept', out.Managers.rows[0].Photo === '' && out.Managers.rows[0].Manager === '' && out.Managers.rows[0].Color === 'steel' && out.Managers.rows[0].Team === names.FICTIONAL[1].team);
  check('Social: quotes are left out, reactions kept with the team mapped', out.Social.rows.length === 1 && out.Social.rows[0].Kind === 'react' && out.Social.rows[0].Team === names.FICTIONAL[2].team);
  const txt = out.Posts.rows[0].Text;
  check('Posts: only the voices\' posts, with every name form replaced in the text and the teams column', out.Posts.rows.length === 1 && out.Posts.rows[0].Teams === names.FICTIONAL[1].team + '|' + names.FICTIONAL[2].team && txt === names.words(names.FICTIONAL[1].mgr)[0] + "'s bench beat " + names.FICTIONAL[2].mgr + '. ' + names.FICTIONAL[1].mgr + ' is finished.', txt);
  check('anonymised tabs keep the shape the app reads ({ cols, rows })', Object.values(out).every(t => Array.isArray(t.cols) && Array.isArray(t.rows)) && out.Standings.cols.join() === 'Team,Manager,W');

  /* ---------- the code substitution ---------- */
  const code = "const SHORTOF={'Team Bob':'Bobs','Zeta Zebras':'Zebras'};const TEAMS={'Team Bob':{mgr:'Bob Stone',ini:'BS'},'Mountain Goats':{mgr:'PJ Stone',ini:'PJ'}};const MATCH={'BS|PJ':'The Stone Derby','PJ|AQ':'El Clasico'};const SEED={'AQ|BS':[1,2,0]};const FIRST={BS:'Bob',PJ:'PJ',AQ:'Alice'};const X=BS=>BS+1;const s='Will Bob finish 8th? Zeta Zebras to finish last';";
  const sub = names.substituteCode(code, m);
  const F = names.FICTIONAL, w = i => names.words(F[i].mgr);
  check('substituteCode: TEAMS keys and managers, the initials in keys, ini: and FIRST, every name in strings', sub.includes("'" + F[1].team + "':{mgr:'" + F[1].mgr + "',ini:'" + F[1].ini + "'}") && sub.includes("'" + F[1].ini + '|' + F[0].ini + "':'The " + w(0)[1] + " Derby'") && sub.includes("'" + F[2].ini + '|' + F[1].ini + "':[1,2,0]") && sub.includes(F[1].ini + ":'" + w(1)[0] + "'") && sub.includes(F[2].ini + ":'" + w(2)[0] + "'"), sub);
  check('substituteCode: a first name equal to its initials (PJ) stays a name in the value and initials in the keys', sub.includes("'" + F[0].team + "':{mgr:'" + w(0)[0] + ' ' + w(0)[1] + "',ini:'" + F[0].ini + "'}") && sub.includes(F[0].ini + ":'" + w(0)[0] + "'") && sub.includes("'" + F[0].ini + '|' + F[2].ini + "':'El Clasico'"), sub);
  check('substituteCode: a variable that happens to be two capitals is left alone, the derby name and copy follow the names', sub.includes('const X=BS=>BS+1') && sub.includes("'The " + w(0)[1] + " Derby'") && sub.includes('Will ' + w(1)[0] + ' finish 8th? ' + F[2].team + ' to finish last'), sub);
  check('substituteCode: the SHORTOF table becomes the fictional pairs', sub.includes("const SHORTOF={'" + F[1].team + "':'" + F[1].short + "','" + F[2].team + "':'" + F[2].short + "'}"), sub);
  check('substituteCode leaves no test name behind', names.leaks(sub, m).length === 0, names.leaks(sub, m).join());

  /* ---------- the leak check ---------- */
  check('leaks: every real name found as a whole word, the short names too, none in clean text', names.leaks('Team Bob beat Zeta Zebras, said Alice; Stone agreed; Zebras 4 Goats 0', m).join() === 'Alice,Goats,Stone,Team Bob,Zebras,Zeta Zebras' && names.leaks('Bobby Quillon and ' + F[1].team, m).length === 0);
  check('leaks: skipFirst leaves first and short names out (a player file), surnames and teams still count', names.leaks('Alice and Quill and Team Bob and Goats', m, true).join() === 'Quill,Team Bob');
  check('leaks: a first name a footballer shares is exempt, the rest still counts', names.leaks('Bob Ramsey and Alice and Stone', m, false, new Set(['Bob'])).join() === 'Alice,Stone');
  check('playerFirstNames reads the first word of each Full name', [...names.playerFirstNames(tabs.Players)].sort().join() === 'Alice,Bob');
  check('PLAYER_TABS name the data files the first-name rule skips', build.playerFile('demo/data/' + names.slug('GW Stats')) && build.playerFile('demo/data/players.json') && !build.playerFile('demo/data/standings.json') && !build.playerFile('demo/app.js'));
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'mw-demo-test-'));
  fs.mkdirSync(path.join(tmp, 'demo', 'data'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'demo', 'data', 'players.json'), JSON.stringify({ cols: ['Full name'], rows: [{ 'Full name': 'Alice Ramsey' }] }));   /* a footballer with a manager's first name: not a leak in a player file */
  fs.writeFileSync(path.join(tmp, 'demo', 'app.js'), 'var x="' + F[1].team + '";');
  fs.writeFileSync(path.join(tmp, 'page.html'), '<p>' + F[2].team + ' play Team Bob</p>');
  fs.writeFileSync(path.join(tmp, 'pic.png'), 'Team Bob');
  const found = build.leakScan(tmp, m, new Set(['Alice']));
  check('leakScan: text files under the site, binary files skipped, player data files without the first-name rule', JSON.stringify(found) === JSON.stringify({ 'page.html': ['Team Bob'] }) && !('demo/data/players.json' in found), JSON.stringify(found));
  fs.rmSync(tmp, { recursive: true, force: true });

  /* ---------- the build's index page and the engine's initials ---------- */
  const tpl = read('fplgg/tools/matchweek/index.template.html');
  const idx = build.demoIndex(tpl, '20261009000000');
  check('the demo index: its own title, no manifest, no preconnect to the Sheet, the build stamp in, the scripts as the app loads them', /<title>Matchweek · Demo league<\/title>/.test(idx) && !/rel="manifest"/.test(idx) && !/docs\.google\.com/.test(idx) && !/__BUILD__/.test(idx) && /core\.js\?v=20261009000000/.test(idx) && /app\.js\?v=20261009000000/.test(idx) && /app\.css\?v=20261009000000/.test(idx));
  const core = read('fplgg/tools/matchweek/core.gen.js');
  const league = require('../fplgg/tools/matchweek/tools/league.js'), cfg = league.load();
  const engIni = build.leagueInitials(cfg);
  const engShort = build.leagueShorts(cfg);
  check('leagueShorts reads one short name per team of league.json, one word each', Object.keys(engShort).length === Object.keys(cfg.teams).length && Object.keys(engShort).every(t => t in engIni) && Object.values(engShort).every(v => /^\S+$/.test(v)));
  check('leagueInitials reads one initials code per team of league.json, and the engine has no TEAMS literal left', Object.keys(engIni).length >= 8 && Object.values(engIni).every(v => /^[A-Z0-9]{2,3}$/.test(v)) && !/ini:'[A-Z]{2}'/.test(core) && /const TEAMS=\{\};Object\.keys\(LEAGUE\.teams\)/.test(core));
  /* the mapping knows a former name (aliases) and the demo's own LEAGUE header is fictional throughout (BUGS.md #33, ROADMAP C1) */
  const m2 = names.mapping(standings, { 'Team Bob': 'BS', 'Mountain Goats': 'PJ', 'Zeta Zebras': 'AQ' }, { 'Team Bob': 'Bobs', 'Zeta Zebras': 'Zebras' }, { 'Old Bob': 'Team Bob', 'Nobody': 'No Team' });
  check('mapping: a former name (aliases) maps to the current team\'s fictional name, an alias of an unknown team is ignored', m2.teams['Old Bob'] === names.FICTIONAL[1].team && !('Nobody' in m2.teams) && names.leaks('Old Bob won', m2).join() === 'Old Bob');
  const testCfg = { name: 'Test', teams: { 'Team Bob': { mgr: 'Bob Stone', first: 'Bob', ini: 'BS', short: 'Bobs', col: '#111111', xi: 1000, lo: 800, hi: 1200 }, 'Mountain Goats': { mgr: 'PJ Stone', first: 'PJ', ini: 'PJ', short: 'Goats', col: '#222222', xi: 1000, lo: 800, hi: 1200 }, 'Zeta Zebras': { mgr: 'Alice Quill', first: 'Alice', ini: 'AQ', short: 'Zebras', col: '#333333', xi: 1000, lo: 800, hi: 1200 } },
    aliases: { 'Old Bob': 'Team Bob' }, derbies: { 'BS|PJ': 'The Stone Derby', 'PJ|AQ': 'The Quill Cup' }, seeded: { 'BS|PJ': [5, 2, 1], 'AQ|PJ': [1, 4, 0] }, periods: [['Aug', 1, 38]], pot: { buyin: 10, first: 20, second: 5, third: 2, half: 2, motm: 1 } };
  const anon = names.anonymiseLeague(testCfg, m2), aT = Object.keys(anon.teams), F1 = names.FICTIONAL[1], F0 = names.FICTIONAL[0], F2 = names.FICTIONAL[2];
  check('anonymiseLeague: fictional team keys, managers, first names, initials and short names; colours and priors kept', aT.join() === [F1.team, F0.team, F2.team].join() && anon.teams[F1.team].mgr === F1.mgr && anon.teams[F1.team].first === names.words(F1.mgr)[0] && anon.teams[F1.team].ini === F1.ini && anon.teams[F1.team].short === F1.short && anon.teams[F1.team].col === '#111111' && anon.teams[F1.team].xi === 1000, JSON.stringify(anon.teams));
  check('anonymiseLeague: derby keys follow the initials, derby names lose the real names, the aliases are dropped', anon.derbies[F1.ini + '|' + F0.ini] === 'The ' + names.words(F0.mgr)[1] + ' Derby' && anon.derbies[F0.ini + '|' + F2.ini] === 'The ' + names.words(F2.mgr)[1] + ' Cup' && JSON.stringify(anon.aliases) === '{}', JSON.stringify(anon.derbies));
  const sk = [F1.ini, F0.ini].sort().join('|'), sk2 = [F2.ini, F0.ini].sort().join('|');
  check('anonymiseLeague: a seeded pair is re-sorted by the new initials and its wins swapped when the order flips', JSON.stringify(anon.seeded[sk]) === JSON.stringify(sk.split('|')[0] === F1.ini ? [5, 2, 1] : [2, 5, 1]) && JSON.stringify(anon.seeded[sk2]) === JSON.stringify(sk2.split('|')[0] === F2.ini ? [1, 4, 0] : [4, 1, 0]), JSON.stringify(anon.seeded));
  check('anonymiseLeague: the result passes the config check and leaks nothing', league.problems(anon).length === 0 && names.leaks(JSON.stringify(anon), m2).length === 0, league.problems(anon).join('; ') + ' ' + names.leaks(JSON.stringify(anon), m2).join());
  check('the demo build writes the fictional LEAGUE header in front of the engine, and takes the aliases into the mapping', /league\.header\(names\.anonymiseLeague\(cfg, m\)\) \+ names\.substituteCode\(demoCore\(core\), m\)/.test(read('fplgg/tools/demo/build-demo.js')) && /names\.mapping\(shot\.tabs\.Standings\.rows, leagueInitials\(cfg\), leagueShorts\(cfg\), cfg\.aliases\)/.test(read('fplgg/tools/demo/build-demo.js')));
  check('build-demo writes into site/public/demo and copies the icons, voices and press folders, never faces/ (9 Oct 2026)', build.OUT.replace(/\\/g, '/').endsWith('site/public/demo') && build.ASSET_DIRS.join() === 'icons,voices,press' && !build.ASSET_DIRS.includes('faces'));

  /* ---------- no EA assets in the demo (Parker, 9 Oct 2026) ---------- */
  check('the EA tabs are named and left out of the snapshot the build takes', build.EA_TABS.join() === 'EA Map,FC27' && /snap\.snapshot\(undefined, checkOnly \? null : log, EA_TABS\)/.test(read('fplgg/tools/demo/build-demo.js')));
  const skipped = []; const fakeFetch = async url => { skipped.push(decodeURIComponent((url.match(/sheet=([^&]+)/) || [])[1])); return { ok: true, text: async () => 'google.visualization.Query.setResponse({"table":{"cols":[{"id":"A","label":"X","type":"string"}],"rows":[]}})' }; };
  let snapErr = ''; await snap.snapshot(fakeFetch, null, build.EA_TABS).catch(e => { snapErr = e.message; });
  check('snapshot(fetch, log, skip) never asks the Sheet for a skipped tab', !skipped.includes('EA Map') && !skipped.includes('FC27') && skipped.includes('Rosters'), snapErr || skipped.join());
  const demoCore = build.demoCore(core);
  check('demoCore empties FC_FACES (still a Set, so faceUrls only ever names FPL\'s photo), the rest of the engine untouched', /const FC_FACES=new Set\(\);/.test(demoCore) && !/const FC_FACES=new Set\('\d/.test(demoCore) && demoCore.length < core.length && demoCore.includes('const faceUrls=c=>') && (() => { try { build.demoCore('const FC_FACES=new Set(x);'); return false; } catch (e) { return /FC_FACES set is not where/.test(e.message); } })());
  const dropped = build.dropRatings({ Rosters: { cols: ['Team', 'Player', 'OVR', 'Proj pts'], rows: [{ Team: 'A', Player: 'Raya', OVR: '87', 'Proj pts': '150' }] }, 'EA Map': { cols: ['fpl_code'], rows: [] }, FC27: { cols: ['fpl_code'], rows: [] }, Standings: { cols: ['Team'], rows: [] } });
  check('dropRatings blanks the Rosters OVR column (an EA-based rating) and drops the EA tabs; the other columns and tabs stay', dropped.Rosters.rows[0].OVR === '' && dropped.Rosters.rows[0]['Proj pts'] === '150' && dropped.Rosters.cols.join() === 'Team,Player,OVR,Proj pts' && !('EA Map' in dropped) && !('FC27' in dropped) && 'Standings' in dropped);
  check('the engine rates a player without OVR from his projected points (62 to 96), so a blank column breaks nothing', /function ovrOf\(p\)\{\n\s*if\(p\.OVR!==''&&p\.OVR!==undefined&&p\.OVR!==null&&p\.OVR!=0\)return Math\.round\(num\(p\.OVR\)\);\n\s*return Math\.max\(62,Math\.min\(96,Math\.round\(62\+22\*num\(p\['Proj pts'\]\)\/170\)\)\);/.test(core));
  const eaTmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'mw-ea-test-'));
  const facesDir = path.join(eaTmp, 'repo-faces'); fs.mkdirSync(facesDir); fs.writeFileSync(path.join(facesDir, '17761.png'), 'EA-RENDER-BYTES');
  const site = path.join(eaTmp, 'site'); fs.mkdirSync(path.join(site, 'demo', 'data'), { recursive: true }); fs.mkdirSync(path.join(site, 'demo', 'img')); fs.mkdirSync(path.join(site, 'demo', 'faces'));
  fs.writeFileSync(path.join(site, 'demo', 'img', 'copy.png'), 'EA-RENDER-BYTES');            /* byte-identical to a face, renamed */
  fs.writeFileSync(path.join(site, 'demo', 'img', '487838.png'), 'other bytes');              /* an FC face by code */
  fs.writeFileSync(path.join(site, 'demo', 'faces', 'x.png'), 'anything');                   /* a faces folder */
  fs.writeFileSync(path.join(site, 'demo', 'data', 'fc27.json'), '{}');
  fs.writeFileSync(path.join(site, 'demo', 'data', 'ea-map.json'), '{}');
  fs.writeFileSync(path.join(site, 'demo', 'data', 'EA_Map.csv'), '');
  fs.writeFileSync(path.join(site, 'icon.png'), 'an icon');                                   /* clean */
  fs.writeFileSync(path.join(site, 'demo', 'data', 'standings.json'), '{}');                 /* clean */
  const eaFound = build.eaScan(site, facesDir, new Set(['487838']));
  check('eaScan finds a byte-identical face under any name, a faces folder, an FC face by code and the EA data files by name; a clean icon and tab pass',
    eaFound['demo/img/copy.png'] === 'byte-identical to faces/17761.png' && eaFound['demo/faces/x.png'] === 'in a faces folder' && eaFound['demo/img/487838.png'] === 'an FC face by code' &&
    eaFound['demo/data/fc27.json'] === 'an EA data file by name' && eaFound['demo/data/ea-map.json'] === 'an EA data file by name' && eaFound['demo/data/EA_Map.csv'] === 'an EA data file by name' &&
    !('icon.png' in eaFound) && !('demo/data/standings.json' in eaFound) && Object.keys(eaFound).length === 6, JSON.stringify(eaFound));
  check('faceCodes reads the FC_FACES codes of core.gen.js (149 today) and faceHashes one md5 per face in faces/', build.faceCodes(core).size >= 100 && build.faceCodes(core).has('17761') && build.faceHashes(path.join(ROOT, 'faces')).size === fs.readdirSync(path.join(ROOT, 'faces')).filter(f => /\.png$/.test(f)).length);
  check('the real site is clean of EA assets right now (the committed demo carries none)', Object.keys(build.eaScan(path.join(ROOT, 'site', 'public'))).length === 0, JSON.stringify(Object.keys(build.eaScan(path.join(ROOT, 'site', 'public'))).slice(0, 5)));
  check('the build runs the EA check after the leak check and fails on a hit, in --check mode too', /const ea = eaScan\(SITE\);/.test(read('fplgg/tools/demo/build-demo.js')) && /an EA asset is in site\/public/.test(read('fplgg/tools/demo/build-demo.js')) && read('fplgg/tools/demo/build-demo.js').indexOf('leak check: clean') < read('fplgg/tools/demo/build-demo.js').indexOf('const ea = eaScan(SITE)'));
  fs.rmSync(eaTmp, { recursive: true, force: true });
  const playerJs = read('fplgg/tools/matchweek/src/sheets/player.js');
  check('player.js: the Ratings tab in the demo shows no FC 27 attributes and says the rating comes from projected points; the league app is unchanged', /import \{ DEMO \} from '\.\.\/data\/tabs\.js'/.test(playerJs) && /const has = !DEMO && fc && keys\.some/.test(playerJs) && /DEMO \? '<div class="ps-none">The demo league shows no attribute ratings: every player is rated from his projected points\.<\/div>'/.test(playerJs) && /aside: DEMO \? 'Demo league' : 'FC 27'/.test(playerJs) && /FC 27 has no attribute ratings for him yet/.test(playerJs));
  const headless = read('fplgg/tools/demo/check-headless.js');
  check('check-headless fails on a request for an EA face or data file and checks the Ratings tab', /\/faces\\\/\|fc27\|ea\[-_\]\?map/i.test(headless) && /no request for an EA face or an EA data file/.test(headless) && /data-tab="ratings"/.test(headless));
  check('the snapshot reads every tab the engine reads, with the same GW Stats trim as the app', snap.TABS.length === 18 && ['Rosters', 'Standings', 'H2H Fixtures', 'Matchweeks', 'Club Fixtures', 'Clubs', 'Specials', 'EA Map', 'FC27', 'Transactions', 'Predictions', 'GW Stats', 'Players', 'GW Log', 'Fixture BPS', 'Managers', 'Social', 'Posts'].every(t => snap.TABS.includes(t)) && snap.QUERIES['GW Stats'].tq === L.x.QUERIES['GW Stats'].tq);
  const gv = snap.parseGviz('/*O_o*/\ngoogle.visualization.Query.setResponse({"table":{"cols":[{"id":"A","label":"Team","type":"string"},{"id":"B","label":"W","type":"number"}],"rows":[{"c":[{"v":"Team Bob"},{"v":3.0,"f":"3"}]},{"c":[{"v":"Zeta Zebras"},null]}]}});', 'Standings');
  check('parseGviz shapes the rows as the app\'s readRaw does (f over v, null blank, strings)', gv.cols.join() === 'Team,W' && gv.rows[0].W === '3' && gv.rows[0].Team === 'Team Bob' && gv.rows[1].W === '');
  check('headerProblem: an unknown tab (gviz answers the draft grades) is refused', snap.headerProblem('Standings', ['Rank', 'Team', 'Manager', 'Grade']) !== '' && snap.headerProblem('Standings', ['Team', 'Manager', 'W', 'D', 'L', 'Pts For', 'Pts Against', 'League Pts']) === '');

  /* ---------- the app, the workflow and the site ---------- */
  const main = read('fplgg/tools/matchweek/src/main.js');
  check('main.js: no service worker, no error reporting, no facts sent and no sign-in in the demo', /if \(!DEMO && 'serviceWorker' in navigator/.test(main) && /if \(!DEMO\) installErrorReporting\(\)/.test(main) && /if \(!DEMO\) setTimeout\(\(\) => idle\(\(\) => \{ maybeSendRecapFacts\(\); maybeSendFacts\(\); articlesWanted\(\); \}\)/.test(main) && /if \(DEMO\) try \{ window\.authRead = \(\) => null; \}/.test(main));
  check('main.js: the Demo league label on every page and in the title', /function demoTag\(\) \{ return DEMO \? '<div class="demo-tag" role="note"><b>Demo league<\/b>/.test(main) && /staleBanner\(\) \+ demoTag\(\) \+ html/.test(main) && /DEMO \? ' · Matchweek demo'/.test(main) && /\.demo-tag\{/.test(read('fplgg/tools/matchweek/src/css/02-components.css')));
  check('social.js: a tap that would write says the demo is off and opens nothing', /if \(DEMO\) \{ UI\.toast\('This is the demo league, so posting is off\.'\); return Promise\.resolve\(false\); \}/.test(read('fplgg/tools/matchweek/src/feed/social.js')));
  check('identity.js and menu.js: the demo copy, no classic app, the legal pages one folder up', /DEMO \? 'This is the demo league, so there is nothing to sign in to\./.test(read('fplgg/tools/matchweek/src/sheets/identity.js')) && /\(DEMO \? '' : '<div class="card mn-classic">/.test(read('fplgg/tools/matchweek/src/sheets/menu.js')) && /\(DEMO \? '\.\.\/' : ''\) \+ 'privacy\.html"/.test(read('fplgg/tools/matchweek/src/sheets/menu.js')));
  const wf = read('.github/workflows/matchweek.yml');
  check('the workflow builds the demo after the app, commits site/public/demo with the six files and refuses anything else', /node fplgg\/tools\/demo\/build-demo\.js/.test(wf) && /FILES="index\.html app\.js app\.css core\.js sw\.js manifest\.webmanifest site\/public\/demo"/.test(wf) && /site\/public\/demo\/\.\+\)\$'/.test(wf) && /git add -A -- \$FILES/.test(wf) && wf.indexOf('ci-build.sh') < wf.indexOf('build-demo.js'));
  check('the workflow runs on demo tool changes and once a day for the snapshot, without rebuilding the app then', /'fplgg\/tools\/demo\/\*\*'/.test(wf) && /schedule:\n\s+- cron: '41 6 \* \* \*'/.test(wf) && /if: github\.event_name != 'schedule'/.test(wf));
  const ciBuild = read('fplgg/tools/matchweek/ci-build.sh');
  check('ci-build.sh is untouched by the demo (it writes the six root files only, no define)', !/MW_DEMO/.test(ciBuild) && !/site\/public/.test(ciBuild));
  ['demo.html', 'app.html'].forEach(f => { const h = read('site/public/' + f); check('site/public/' + f + ' forwards to demo/', /http-equiv="refresh" content="0; url=demo\/"/.test(h) && /location\.replace\('demo\/' \+ location\.hash\)/.test(h) && !/docs\.google|script\.google/.test(h)); });
  const landing = read('site/public/index.html');
  check('the landing page links reach the demo', (landing.match(/href="demo\/"/g) || []).length >= 2 && !/href="demo\.html"/.test(landing));
  check('CLAUDE.md and the tests README name this suite', /tests\/app-demo\.js/.test(read('CLAUDE.md')) && /app-demo\.js/.test(read('tests/README.md')));

  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
