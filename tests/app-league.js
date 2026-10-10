// The league's config (ROADMAP C1, 9 Oct 2026): fplgg/tools/matchweek/league.json holds the teams (manager, first name,
// initials, short name, colour, projection prior), the aliases (a former team name), the derbies, the seeded series, the
// Manager of the Month periods and the pot; tools/league.js checks it and writes the `const LEAGUE={...}` header that
// ci-build.sh and the demo build put in front of core.gen.js; the engine (core.gen.js, src-prod/base.js and v10.js)
// builds TEAMS, TEAM_ALIAS, MATCH, SEED, FIRST, SHORTOF and PERIODS from it and the UI reads the pot from it. Plain Node,
// no network.   node tests/app-league.js
const fs = require('fs'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const ROOT = __dirname + '/../', MW = ROOT + 'fplgg/tools/matchweek/';
const rd = f => fs.readFileSync(MW + f, 'utf8');
const L = require(MW + 'tools/league.js');
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- league.json is sound ---------- */
const cfg = L.load();
const teams = Object.keys(cfg.teams);
check('league.json loads and passes every check', L.problems(cfg).length === 0, L.problems(cfg).join('; '));
check('the league: a name, 8 teams, each with mgr, first, ini, short, col, xi, lo, hi', cfg.name.length > 0 && teams.length === 8 && teams.every(t => ['mgr', 'first', 'ini', 'short', 'col', 'xi', 'lo', 'hi'].every(k => k in cfg.teams[t])));
check('initials and short names are unique, the first name is the first word of the manager', new Set(teams.map(t => cfg.teams[t].ini)).size === 8 && new Set(teams.map(t => cfg.teams[t].short)).size === 8 && teams.every(t => cfg.teams[t].mgr.split(' ')[0] === cfg.teams[t].first));
check('one alias (a former name) pointing to a current team', Object.keys(cfg.aliases).length === 1 && Object.values(cfg.aliases).every(v => v in cfg.teams));
check('15 derbies and 15 seeded series keyed by pairs of initials, the periods cover GW1 to GW38, the pot adds up to the buy-ins', Object.keys(cfg.derbies).length === 15 && Object.keys(cfg.seeded).length === 15 && cfg.periods.length === 9 && cfg.periods[0][1] === 1 && cfg.periods[8][2] === 38
  && cfg.pot.first + cfg.pot.second + cfg.pot.third + cfg.pot.half + cfg.pot.motm * cfg.periods.length === cfg.pot.buyin * 8);

/* ---------- the checks catch a bad config ---------- */
const bad = (fn, re) => { const c = clone(cfg); fn(c); const p = L.problems(c); return p.length > 0 && p.some(x => re.test(x)) ? '' : (p.join('; ') || 'no problem found'); };
check('problems: a duplicate initials code', bad(c => { c.teams[teams[1]].ini = c.teams[teams[0]].ini; }, /used twice/) === '', bad(c => { c.teams[teams[1]].ini = c.teams[teams[0]].ini; }, /used twice/));
check('problems: a derby keyed by unknown initials, a seeded pair out of order, a seeded record that is not three counts', bad(c => { c.derbies['XX|' + c.teams[teams[0]].ini] = 'X'; }, /not a pair/) === '' && bad(c => { const k = Object.keys(c.seeded)[0], v = c.seeded[k]; delete c.seeded[k]; c.seeded[k.split('|').reverse().join('|')] = v; }, /sorted/) === '' && bad(c => { c.seeded[Object.keys(c.seeded)[0]] = [1, 2]; }, /wins, wins, draws/) === '');
check('problems: a gap in the periods, periods that stop short of GW38, a period that ends before it starts', bad(c => { c.periods[1][1] = 7; }, /expected GW6/) === '' && bad(c => { c.periods[8][2] = 37; }, /GW38/) === '' && bad(c => { c.periods[2][2] = 9; }, /ends before it starts/) === '');
check('problems: a pot that does not add up, an unknown pot key, a bad colour, lo < xi < hi, a two-word short name', bad(c => { c.pot.first += 1; }, /prizes add up/) === '' && bad(c => { c.pot.extra = 1; }, /unknown/) === '' && bad(c => { c.teams[teams[0]].col = 'blue'; }, /#rrggbb/) === '' && bad(c => { c.teams[teams[0]].lo = c.teams[teams[0]].hi; }, /lo < xi < hi/) === '' && bad(c => { c.teams[teams[0]].short = 'Two Words'; }, /one word/) === '');
check('problems: an alias to an unknown team, an alias that is a current name, fewer than two teams', bad(c => { c.aliases.Old = 'Nobody'; }, /unknown team/) === '' && bad(c => { c.aliases[teams[0]] = teams[1]; }, /current team name/) === '' && bad(c => { c.teams = { A: c.teams[teams[0]] }; }, /at least two/) === '');
let thrown = ''; try { L.load(MW + 'package.json'); } catch (e) { thrown = e.message; }
check('load throws with the problems listed for a file that is not a league (package.json has a name and nothing else)', /teams: at least two/.test(thrown) && /periods: a non-empty list/.test(thrown) && /pot: an object/.test(thrown), thrown.slice(0, 120));

/* ---------- the header ---------- */
const hdr = L.header(cfg);
check('header: one line, `const LEAGUE={...};`, that parses back to the config', /^const LEAGUE=\{.*\};\n$/s.test(hdr) && JSON.stringify(new Function(hdr + 'return LEAGUE;')()) === JSON.stringify(cfg));
const tricky = clone(cfg); tricky.name = 'x</script>y\u2028z';
check('header: a closing script tag and a line separator in a value are escaped', !/<\/script/.test(L.header(tricky)) && !/\u2028/.test(L.header(tricky)) && new Function(L.header(tricky) + 'return LEAGUE.name;')() === tricky.name);
let hdrErr = ''; try { L.header({}); } catch (e) { hdrErr = e.message; }
check('header refuses a config that fails the checks', /league config:/.test(hdrErr));

/* ---------- the engine builds its tables from LEAGUE ---------- */
function engine(config) {
  const ctx = { window: {}, document: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, location: { search: '', hash: '' }, navigator: {}, console: { log() {}, warn() {}, error() {} }, setTimeout: () => 0, clearTimeout() {}, fetch: () => new Promise(() => {}), Intl, URLSearchParams, performance: { now: () => 0 } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext((config ? L.header(config) : '') + rd('core.gen.js') + '\n;this.__t = { TEAMS, TEAM_ALIAS, MATCH, SEED, FIRST, PERIODS, SHORTOF, FIRSTOF, derbyName, series, canonTeam, D, buildH2H };', ctx);
  return ctx.__t;
}
const E = engine(cfg);
check('TEAMS: every team of league.json with mgr, ini, col, xi, lo, hi (first and short live in FIRST and SHORTOF)', Object.keys(E.TEAMS).join('|') === teams.join('|') && teams.every(t => { const a = E.TEAMS[t], b = cfg.teams[t]; return a.mgr === b.mgr && a.ini === b.ini && a.col === b.col && a.xi === b.xi && a.lo === b.lo && a.hi === b.hi && !('first' in a) && !('short' in a); }));
check('FIRST by initials, SHORTOF by team, FIRSTOF through them', teams.every(t => E.FIRST[cfg.teams[t].ini] === cfg.teams[t].first && E.SHORTOF[t] === cfg.teams[t].short && E.FIRSTOF(t) === cfg.teams[t].first));
check('TEAM_ALIAS and canonTeam from the aliases', JSON.stringify(E.TEAM_ALIAS) === JSON.stringify(cfg.aliases) && Object.keys(cfg.aliases).every(o => E.canonTeam(o) === cfg.aliases[o]) && E.canonTeam(teams[0]) === teams[0]);
check('MATCH, SEED and PERIODS are copies of the derbies, the seeded series and the periods', JSON.stringify(E.MATCH) === JSON.stringify(cfg.derbies) && JSON.stringify(E.SEED) === JSON.stringify(cfg.seeded) && JSON.stringify(E.PERIODS) === JSON.stringify(cfg.periods) && E.PERIODS !== cfg.periods);
const dk = Object.keys(cfg.derbies)[0], [i1, i2] = dk.split('|'), tOf = i => teams.find(t => cfg.teams[t].ini === i);
check('derbyName finds a derby by either order of the pair', E.derbyName(tOf(i1), tOf(i2)) === cfg.derbies[dk] && E.derbyName(tOf(i2), tOf(i1)) === cfg.derbies[dk] && E.derbyName(tOf(i1), 'Nobody') === null);
const sk = Object.keys(cfg.seeded)[0], [s1, s2] = sk.split('|'), sv = cfg.seeded[sk];
E.D.fx = []; E.buildH2H();
check('series reads the seeded record for a pair, the first initials of the sorted key owning the first count', (sv[0] > sv[1] ? E.series(tOf(s1), tOf(s2)).startsWith(cfg.teams[tOf(s1)].first + ' leads ' + sv[0] + '–' + sv[1]) : sv[1] > sv[0] ? E.series(tOf(s1), tOf(s2)).startsWith(cfg.teams[tOf(s2)].first + ' leads ' + sv[1] + '–' + sv[0]) : E.series(tOf(s1), tOf(s2)).startsWith('Series level')), E.series(tOf(s1), tOf(s2)));
const small = { name: 'Three', teams: { Alpha: { mgr: 'Ann Able', first: 'Ann', ini: 'AA', short: 'Alpha', col: '#101010', xi: 1000, lo: 800, hi: 1200 }, Beta: { mgr: 'Ben Bold', first: 'Ben', ini: 'BB', short: 'Beta', col: '#202020', xi: 1000, lo: 800, hi: 1200 }, Gamma: { mgr: 'Cat Cole', first: 'Cat', ini: 'CC', short: 'Gamma', col: '#303030', xi: 1000, lo: 800, hi: 1200 } },
  aliases: {}, derbies: { 'AA|BB': 'The Alphabet Derby' }, seeded: { 'AA|BB': [2, 1, 0] }, periods: [['Autumn', 1, 19], ['Spring', 20, 38]], pot: { buyin: 30, first: 50, second: 20, third: 10, half: 6, motm: 2 } };
const S = engine(small); S.D.fx = []; S.buildH2H();
check('another league: three teams, one derby, two periods, a first-ever meeting where nothing is seeded', Object.keys(S.TEAMS).join() === 'Alpha,Beta,Gamma' && S.derbyName('Beta', 'Alpha') === 'The Alphabet Derby' && S.series('Alpha', 'Beta') === 'Ann leads 2–1' && S.series('Alpha', 'Gamma') === 'First ever meeting' && S.PERIODS.length === 2 && S.SHORTOF.Gamma === 'Gamma');
let noHdr = ''; try { engine(null); } catch (e) { noHdr = e.message; }
check('core.gen.js refuses to load without LEAGUE, naming the build', /core\.js needs LEAGUE \(league\.json\)/.test(noHdr), noHdr);

/* ---------- nothing league-specific is left in the engine's code, and src-prod carries the same lines ---------- */
const CORE = rd('core.gen.js'), BASE = rd('src-prod/base.js'), V10 = rd('src-prod/v10.js');
const literal = /const (TEAMS|MATCH|SEED|FIRST|TEAM_ALIAS|SHORTOF)=\{'|const PERIODS=\[\[|ini:'[A-Z]{2}'|mgr:'[A-Z]/;
check('no TEAMS, MATCH, SEED, FIRST, TEAM_ALIAS, SHORTOF or PERIODS literal in core.gen.js or src-prod', !literal.test(CORE) && !literal.test(BASE) && !literal.test(V10));
const lines = ['const TEAM_ALIAS=Object.assign({},LEAGUE.aliases||{});', 'const TEAMS={};Object.keys(LEAGUE.teams).forEach(t=>{const x=LEAGUE.teams[t];TEAMS[t]={mgr:x.mgr,ini:x.ini,col:x.col,xi:x.xi,lo:x.lo,hi:x.hi}});', 'const MATCH=Object.assign({},LEAGUE.derbies||{});', 'const SEED=Object.assign({},LEAGUE.seeded||{});', 'const FIRST={};Object.keys(LEAGUE.teams).forEach(t=>{FIRST[LEAGUE.teams[t].ini]=LEAGUE.teams[t].first});', 'const PERIODS=LEAGUE.periods.map(p=>p.slice());', "if(typeof LEAGUE==='undefined')throw new Error('core.js needs LEAGUE (league.json): build with ci-build.sh');"];
check('core.gen.js and src-prod/base.js carry the same LEAGUE lines', lines.every(l => CORE.includes(l) && BASE.includes(l)), lines.filter(l => !(CORE.includes(l) && BASE.includes(l))).join(' | '));
const shortLine = 'const SHORTOF={};Object.keys(LEAGUE.teams).forEach(t=>{SHORTOF[t]=LEAGUE.teams[t].short});';
check('core.gen.js and src-prod/v10.js carry the same SHORTOF line', CORE.includes(shortLine) && V10.includes(shortLine));
teams.forEach(t => { if (CORE.includes("'" + t + "':{")) fails++; });
check('no team of league.json is a key of a table literal in core.gen.js', teams.every(t => !CORE.includes("'" + t + "':{")));

/* ---------- the builds put the header in front of the engine ---------- */
const CI = rd('ci-build.sh');
check('ci-build.sh writes core.js as the LEAGUE header (checked by tools/league.js) followed by core.gen.js, and no longer copies core.gen.js alone', /\{ node -e 'const L=require\("\.\/tools\/league\.js"\),H=require\("\.\/tools\/history\.js"\),c=L\.load\(\),h=H\.load\(\),p=H\.problems\(h,c\.seeded\);[^']*process\.stdout\.write\(L\.header\(c\)\+H\.header\(h\)\)'; cat core\.gen\.js; \} > "\$ROOT\/core\.js"/.test(CI) && !/cp core\.gen\.js/.test(CI));
check('ci-build.sh still checks core.js with node --check after writing it', /node --check "\$ROOT\/app\.js" && node --check "\$ROOT\/core\.js"/.test(CI));

/* ---------- the UI's pot and the Manager of the Month periods ---------- */
const DATA = rd('src/pages/league/data.js'), MENU = rd('src/sheets/menu.js');
check('src/pages/league/data.js takes PAY from LEAGUE.pot and POT from the buy-in times the teams', /export const PAY = Object\.assign\(\{ first: 0, second: 0, third: 0, half: 0, motm: 0, buyin: 0 \}, \(typeof LEAGUE !== 'undefined' && LEAGUE\.pot\) \|\| \{\}\);/.test(DATA) && /export const POT = PAY\.buyin \* Object\.keys\(TEAMS\)\.length;/.test(DATA) && !/buyin: 150/.test(DATA));
check('the menu\'s money rows come from PAY, POT and PERIODS, no dollar amount typed in', /import \{ PAY, POT, money \} from '\.\.\/pages\/league\/data\.js'/.test(MENU) && !/\$600|\$180|\$1,200|8 × \$150/.test(MENU) && /money\(PAY\.motm \* n\)/.test(MENU) && /teams \+ ' × ' \+ money\(PAY\.buyin\)/.test(MENU));
const pctx = { Object, Array, Boolean, LEAGUE: cfg, TEAMS: E.TEAMS, LOADED_AT: 1 }; vm.createContext(pctx);
vm.runInContext(DATA.slice(DATA.indexOf('export const PAY'), DATA.indexOf('export const FINAL')).replace(/^export (function|const|let)/gm, '$1') + '\n;this.__p = { PAY, POT };', pctx);
check('PAY and POT evaluate to the config\'s pot: 1,200 for 8 managers at 150', pctx.__p.POT === cfg.pot.buyin * 8 && pctx.__p.PAY.first === cfg.pot.first && pctx.__p.PAY.motm === cfg.pot.motm, JSON.stringify(pctx.__p));
const gs = fs.readFileSync(ROOT + 'Code.gs', 'utf8'), gsPer = /var MOTM_PERIODS = \[([\s\S]*?)\];/.exec(gs);
const gsList = gsPer ? new Function('return [' + gsPer[1] + '];')().map(p => [p.name, p.from, p.to]) : null;
check('Code.gs\'s own MOTM_PERIODS equal league.json\'s periods (two copies, kept in step here)', gsList && JSON.stringify(gsList) === JSON.stringify(cfg.periods), JSON.stringify(gsList));

/* ---------- the CI gate picks this suite up by pattern (tests/*.js) ---------- */
check('this file is named tests/app-league.js, which the gate\'s pattern runs', /app-league\.js$/.test(__filename));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
