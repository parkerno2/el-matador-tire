// Auto-sub tests (the engine's autoSubs in fplgg/tools/matchweek/core.gen.js, from src-prod/base.js; the Matchup, Lineup
// and manager views read it): a player appears exactly once per team view (BUGS #37, Parker, 10 Oct 2026: Tzolis in
// Trophy Hunters' XI and on their bench at once). The subs the engine reports always describe the XI it returns, so a
// view that draws the XI and then the bench as "the bench players not brought on, plus the starters going off" shows
// every one of the fifteen once. Runs the whole engine in a vm (the LEAGUE header as ci-build.sh writes it) on the live
// GW6 snapshot of 10 Oct 2026 (tests/fixtures/subs-gw6.json) and on crafted squads. Plain Node.   node tests/app-subs.js
const fs = require('fs'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const MW = __dirname + '/../fplgg/tools/matchweek/';
const CORE = fs.readFileSync(MW + 'core.gen.js', 'utf8'), BASE = fs.readFileSync(MW + 'src-prod/base.js', 'utf8');
const MODEL = fs.readFileSync(MW + 'src/pages/matchday/model.js', 'utf8'), MATCHUP = fs.readFileSync(MW + 'src/pages/matchday/matchup.js', 'utf8'), LINEUP = fs.readFileSync(MW + 'src/pages/team/lineup.js', 'utf8');
/* a top-level function by name, braces matched */
function lift(src, name) {
  const i = src.search(new RegExp('^function ' + name + '\\(', 'm')); if (i < 0) throw new Error('no ' + name);
  let depth = 0, j = src.indexOf('{', i);
  for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (!depth) break; } }
  return src.slice(i, j + 1) + '\n';
}

console.log('--- C the code');
check('C1 core.gen.js carries the same autoSubs as src-prod/base.js', lift(CORE, 'autoSubs') === lift(BASE, 'autoSubs'));
check('C2 autoSubs keeps the kinds to the swaps it made (no "net" list from the confirmed-facts pass)', /const pair=x=>String\(x\.out\.Code\)\+'>'\+String\(x\.inn\.Code\),sure=new Set\(autoSubs\(team,false\)\.subs\.map\(pair\)\)/.test(lift(CORE, 'autoSubs')) && !/const net=/.test(lift(CORE, 'autoSubs')));
check('C3 the Matchup model draws the bench as the bench players not brought on plus the starters going off, from the same autoSubs call as the XI',
  /const as = autoSubs\(t, true\), lk = autoSubs\(t, false\);\n\s+const xi = as\.xi/.test(MODEL) && /const inn = new Set\(as\.subs\.map\(s => String\(s\.inn\.Code\)\)\);\n\s+const bench = benchOf\(t\)\.filter\(b => !inn\.has\(String\(b\.Code\)\)\)\.concat\(as\.subs\.map\(s => s\.out\)\);/.test(MODEL));
check('C4 the Matchup bench card marks a starter going off from T.subs (SUBBED OFF or LIKELY OFF)', /T\.subs\.filter\(s => s\.kind === 'locked'\)\.map\(s => String\(s\.out\.Code\)\)/.test(MATCHUP) && /T\.subs\.filter\(s => s\.kind === 'likely'\)\.map\(s => String\(s\.out\.Code\)\)/.test(MATCHUP));
check('C5 the Lineup bench shows the starter going off in the slot of the bench player who comes on, from the same subs as the pitch', /L\.as\.subs\.forEach\(s => \{ swap\[s\.inn\.Code\] = s\.out; \}\)/.test(LINEUP) && /const xi = as\.xi\.slice\(\)/.test(LINEUP));
check('C6 the sub reason says "did not play" for a starter whose match finished without him, whatever the sub\'s kind', /if \(s\.kind === 'locked' \|\| \(x && x\.finished && x\.mins <= 0\)\) return 'did not play'/.test(MODEL));

/* ---------- the engine in a vm ---------- */
const L = require(MW + 'tools/league.js');
const ctx = { console, Date, Math, JSON, Set, Map, Object, Array, String, Number, parseFloat, parseInt, isNaN, Promise, setTimeout, clearTimeout, Intl, RegExp, Error, Infinity, NaN,
  window: {}, document: { createElement: () => ({ remove() { } }), head: { appendChild() { } }, body: { getAttribute: () => 'gw' } }, localStorage: { getItem: () => null, setItem() { } }, navigator: {}, location: { search: '' } };
vm.createContext(ctx);
vm.runInContext(L.header(L.load()) + CORE + '\nthis.E={get D(){return D},get autoSubs(){return autoSubs},TEAMS,benchOf,xiOf,flaggedOut,fxFinished};', ctx, { filename: 'core.js' });
const E = ctx.E, D = E.D;
const TEAM = Object.keys(E.TEAMS)[0];
/* what the Matchup model shows: the XI the engine returns and the bench as model.js builds it */
function view(t) {
  const as = E.autoSubs(t, true);
  const inn = new Set(as.subs.map(s => String(s.inn.Code)));
  const bench = E.benchOf(t).filter(b => !inn.has(String(b.Code))).concat(as.subs.map(s => s.out));
  return { as, xi: as.xi, bench, subs: as.subs, codes: as.xi.concat(bench).map(p => String(p.Code)) };
}
const names = l => l.map(p => p.Player).join(', ');
const dups = codes => codes.filter((c, i) => codes.indexOf(c) !== i);
/* the rule, for one team: fifteen players, each once; every sub's replacement on the pitch and its starter off it */
function once(label, t) {
  const v = view(t), squad = E.D.ro.filter(r => r.Team === t);
  const d = dups(v.codes);
  check(label + ': every player once across the pitch and the bench', !d.length && v.codes.length === squad.length && squad.every(r => v.codes.includes(String(r.Code))),
    (d.length ? 'twice: ' + names(squad.filter(r => d.includes(String(r.Code)))) + '; ' : '') + v.codes.length + ' of ' + squad.length + ' | pitch ' + names(v.xi) + ' | bench ' + names(v.bench));
  const xiC = new Set(v.xi.map(p => String(p.Code)));
  check(label + ': every sub describes the XI (the replacement on the pitch, the starter off it)', v.subs.every(s => xiC.has(String(s.inn.Code)) && !xiC.has(String(s.out.Code))), v.subs.map(s => s.inn.Player + ' for ' + s.out.Player + ' (' + s.kind + ')').join('; ') || 'no subs');
  check(label + ': eleven on the pitch in a legal formation', v.xi.length === 11 && v.xi.filter(p => p.Pos === 'GKP').length === 1 && v.xi.filter(p => p.Pos === 'DEF').length >= 3 && v.xi.filter(p => p.Pos === 'MID').length >= 2 && v.xi.filter(p => p.Pos === 'FWD').length >= 1);
  return v;
}
function load(fx) { D.ro = fx.ro; D.cf = fx.cf; D.gw = fx.gw; D.dlPassed = !!fx.dlPassed; D.gwsCur = fx.gws; D.gwsByGw = { [fx.gw]: fx.gws }; D.fx = []; D.predCur = {}; D.pbonus = {}; D.gl = []; D.provOver = false; }

console.log('--- L the live GW6 snapshot (10 Oct 2026, 16:37 UTC)');
const LIVE = JSON.parse(fs.readFileSync(__dirname + '/fixtures/subs-gw6.json', 'utf8'));
load(LIVE);
Object.keys(E.TEAMS).forEach(t => once('L ' + t, t));
const TH = view('Trophy Hunters'), by = n => LIVE.ro.find(r => r.Team === 'Trophy Hunters' && r.Player === n);
check('L Trophy Hunters: Araujo on for Robinson is the one sub, locked (IPS-FUL finished with Robinson on 0 minutes)', TH.subs.length === 1 && TH.subs[0].inn.Player === 'Araujo' && TH.subs[0].out.Player === 'Robinson' && TH.subs[0].kind === 'locked', JSON.stringify(TH.subs.map(s => [s.inn.Player, s.out.Player, s.kind])));
check('L Trophy Hunters: Tzolis (0 minutes, ARS-LEE finished) stays on the pitch, since the only cover left is Mateta, flagged out, and is not on the bench', TH.xi.some(p => p.Player === 'Tzolis') && !TH.bench.some(p => p.Player === 'Tzolis'));
check('L Trophy Hunters: Brobbey (0 minutes, SUN-BHA finished) stays on the pitch too, and Mateta and Kroupi.Jr sit on the bench with Robinson', TH.xi.some(p => p.Player === 'Brobbey') && ['Suzuki', 'Mateta', 'Kroupi.Jr', 'Robinson'].every(n => TH.bench.some(p => p.Player === n)) && TH.bench.length === 4, names(TH.bench));
check('L Trophy Hunters: the confirmed-facts pass alone would bring Mateta on for Tzolis (the score counts him until CRY-NFO says otherwise), which the view no longer reports as applied', E.autoSubs('Trophy Hunters', false).subs.some(s => s.inn.Player === 'Mateta' && s.out.Player === 'Tzolis'));
check('L the snapshot holds the state Parker saw: Tzolis flagged, ARS-LEE finished, Mateta flagged', E.flaggedOut(by('Tzolis')) && E.fxFinished('ARS') && E.flaggedOut(by('Mateta')) && !E.fxFinished('CRY'));

console.log('--- K crafted squads');
let n = 1000;
const row = (name, pos, club, slot, opt = {}) => ({ Team: TEAM, Player: name, Pos: pos, Club: club, Code: String(++n), 'GW XI': slot <= 11 ? 'XI' : 'BEN', Slot: String(slot), 'Best XI': slot <= 11 ? 'XI' : '', Status: opt.status || 'a', News: opt.news || '', 'GW pts': '0', 'GW mins': String(opt.mins || 0), 'Proj pts': '50' });
const fx = (Home, Away, started, finished) => ({ GW: '6', Home, Away, 'Kickoff (UTC)': '2026-10-10T14:00:00Z', Started: started ? 'TRUE' : 'FALSE', Finished: finished ? 'TRUE' : 'FALSE', Mins: finished ? '90' : '0' });
/* clubs: DONE played (finished), LATER has not kicked off */
const CF = [fx('DON', 'DNE', true, true), fx('LAT', 'LTR', false, false), fx('DN2', 'DN3', true, true)];
function squad(spec) { /* spec: [name, pos, club, slot, opt] in slot order */
  const ro = spec.map(s => row(...s)); const gws = {};
  ro.forEach(r => { if (CF.some(f => (f.Home === r.Club || f.Away === r.Club) && f.Finished === 'TRUE')) gws[r.Code] = { Code: r.Code, Club: r.Club, Mins: +r['GW mins'], Pts: 0 }; });
  return { ro, cf: CF, gw: 6, dlPassed: true, gws };
}
const INJ = { status: 'i', news: 'Hamstring injury - Expected back 24 Oct' };
const played = { mins: 90 };
/* K1: the Trophy Hunters shape. Three starters finished on 0 minutes (a DEF, a MID, a FWD); the bench has a keeper, one
   fit defender who has not played, a flagged forward who has not played and a flagged midfielder who finished on 0 */
load(squad([
  ['GK1', 'GKP', 'DON', 1, played], ['D1', 'DEF', 'DON', 2, played], ['D2', 'DEF', 'DON', 3, played], ['D3 out', 'DEF', 'DON', 4], ['D4', 'DEF', 'DON', 5, played],
  ['M1', 'MID', 'DON', 6, played], ['M2', 'MID', 'DON', 7, played], ['M3 out', 'MID', 'DON', 8, INJ], ['M4', 'MID', 'DON', 9, played], ['F1', 'FWD', 'DON', 10, played], ['F2 out', 'FWD', 'DN2', 11, INJ],
  ['GK2', 'GKP', 'LAT', 12], ['Dsub', 'DEF', 'LAT', 13], ['Fsub flagged', 'FWD', 'LAT', 14, INJ], ['Msub flagged', 'MID', 'DN2', 15, INJ]]));
const K1 = once('K1 three starters on 0 minutes, one fit cover', TEAM);
check('K1 the fit defender comes on for the first starter who did not play, locked', K1.subs.length === 1 && K1.subs[0].inn.Player === 'Dsub' && K1.subs[0].out.Player === 'D3 out' && K1.subs[0].kind === 'locked', JSON.stringify(K1.subs.map(s => [s.inn.Player, s.out.Player, s.kind])));
check('K1 the midfielder and the forward who did not play stay on the pitch (no fit cover), and the flagged bench players stay on the bench', ['M3 out', 'F2 out'].every(nm => K1.xi.some(p => p.Player === nm)) && ['GK2', 'Fsub flagged', 'Msub flagged', 'D3 out'].every(nm => K1.bench.some(p => p.Player === nm)) && K1.bench.length === 4, names(K1.bench));
check('K1 the confirmed-facts pass would use the flagged forward (not yet ruled out by his match) for the midfielder: that swap is not in the view', E.autoSubs(TEAM, false).subs.length === 2 && !K1.subs.some(s => s.inn.Player === 'Fsub flagged'));
/* K2: an injured starter whose match has not begun, with a valid cover on the bench */
load(squad([
  ['GK1', 'GKP', 'LAT', 1], ['D1', 'DEF', 'LAT', 2], ['D2', 'DEF', 'LAT', 3], ['D3', 'DEF', 'LAT', 4], ['D4', 'DEF', 'LAT', 5],
  ['M1', 'MID', 'LAT', 6], ['M2 injured', 'MID', 'LAT', 7, INJ], ['M3', 'MID', 'LAT', 8], ['M4', 'MID', 'LAT', 9], ['F1', 'FWD', 'LAT', 10], ['F2', 'FWD', 'LAT', 11],
  ['GK2', 'GKP', 'LAT', 12], ['Dsub', 'DEF', 'LAT', 13], ['Msub', 'MID', 'LAT', 14], ['Fsub', 'FWD', 'LAT', 15]]));
const K2 = once('K2 an injured starter before kick-off, cover on the bench', TEAM);
check('K2 the first bench player who keeps the formation legal comes on, likely; the injured starter is on the bench once and not on the pitch', K2.subs.length === 1 && K2.subs[0].inn.Player === 'Dsub' && K2.subs[0].out.Player === 'M2 injured' && K2.subs[0].kind === 'likely' && !K2.xi.some(p => p.Player === 'M2 injured') && K2.bench.filter(p => p.Player === 'M2 injured').length === 1 && !K2.bench.some(p => p.Player === 'Dsub'), JSON.stringify(K2.subs.map(s => [s.inn.Player, s.out.Player, s.kind])));
/* K3: the same starter with no valid cover: a keeper and three flagged outfielders on the bench */
load(squad([
  ['GK1', 'GKP', 'LAT', 1], ['D1', 'DEF', 'LAT', 2], ['D2', 'DEF', 'LAT', 3], ['D3', 'DEF', 'LAT', 4], ['D4', 'DEF', 'LAT', 5],
  ['M1', 'MID', 'LAT', 6], ['M2 injured', 'MID', 'LAT', 7, INJ], ['M3', 'MID', 'LAT', 8], ['M4', 'MID', 'LAT', 9], ['F1', 'FWD', 'LAT', 10], ['F2', 'FWD', 'LAT', 11],
  ['GK2', 'GKP', 'LAT', 12], ['Dsub flagged', 'DEF', 'LAT', 13, INJ], ['Msub flagged', 'MID', 'LAT', 14, { status: 's', news: 'Suspended until 24 Oct' }], ['Fsub flagged', 'FWD', 'LAT', 15, { status: 'd', news: 'Knock - 25% chance of playing' }]]));
const K3 = once('K3 an injured starter with no valid cover', TEAM);
check('K3 nobody moves: no sub, the starter on the pitch, the bench as set', !K3.subs.length && K3.xi.some(p => p.Player === 'M2 injured') && K3.bench.length === 4 && !K3.bench.some(p => p.Player === 'M2 injured'), names(K3.bench));
/* K4: the only cover would break the formation (an injured defender in a 3-5-2, midfielders and forwards on the bench) */
load(squad([
  ['GK1', 'GKP', 'LAT', 1], ['D1', 'DEF', 'LAT', 2], ['D2', 'DEF', 'LAT', 3], ['D3 injured', 'DEF', 'LAT', 4, INJ],
  ['M1', 'MID', 'LAT', 5], ['M2', 'MID', 'LAT', 6], ['M3', 'MID', 'LAT', 7], ['M4', 'MID', 'LAT', 8], ['M5', 'MID', 'LAT', 9], ['F1', 'FWD', 'LAT', 10], ['F2', 'FWD', 'LAT', 11],
  ['GK2', 'GKP', 'LAT', 12], ['Msub', 'MID', 'LAT', 13], ['Fsub', 'FWD', 'LAT', 14], ['Msub2', 'MID', 'LAT', 15]]));
const K4 = once('K4 the only cover would leave two defenders', TEAM);
check('K4 nobody moves (three defenders is the floor)', !K4.subs.length && K4.xi.some(p => p.Player === 'D3 injured') && K4.bench.length === 4, names(K4.bench));
/* K5: a flagged starter early in the XI takes the one cover that the confirmed-facts pass would give a starter who finished on 0 */
load(squad([
  ['GK1', 'GKP', 'DON', 1, played], ['D1', 'DEF', 'DON', 2, played], ['D2', 'DEF', 'DON', 3, played], ['D3', 'DEF', 'DON', 4, played], ['D4', 'DEF', 'DON', 5, played],
  ['M1 injured', 'MID', 'LAT', 6, INJ], ['M2', 'MID', 'DON', 7, played], ['M3 out', 'MID', 'DON', 8], ['M4', 'MID', 'DON', 9, played], ['F1', 'FWD', 'DON', 10, played], ['F2', 'FWD', 'DON', 11, played],
  ['GK2', 'GKP', 'LAT', 12], ['Dsub', 'DEF', 'LAT', 13], ['Fsub flagged', 'FWD', 'LAT', 14, INJ], ['Msub flagged', 'MID', 'LAT', 15, INJ]]));
const K5 = once('K5 a flagged starter ahead of one who finished on 0, one cover', TEAM);
check('K5 the cover goes to the flagged starter as a likely sub (the confirmed-facts pass gives him to the other), and the starter who finished on 0 stays on the pitch, not on the bench', K5.subs.length === 1 && K5.subs[0].inn.Player === 'Dsub' && K5.subs[0].out.Player === 'M1 injured' && K5.subs[0].kind === 'likely' && K5.xi.some(p => p.Player === 'M3 out') && !K5.bench.some(p => p.Player === 'M3 out') && E.autoSubs(TEAM, false).subs[0].out.Player === 'M3 out', JSON.stringify(K5.subs.map(s => [s.inn.Player, s.out.Player, s.kind])));
/* K6: a swap both passes make is locked; one only the flagged assumption makes is likely */
load(squad([
  ['GK1', 'GKP', 'DON', 1, played], ['D1', 'DEF', 'DON', 2, played], ['D2', 'DEF', 'DON', 3, played], ['D3 out', 'DEF', 'DON', 4], ['D4', 'DEF', 'DON', 5, played],
  ['M1', 'MID', 'DON', 6, played], ['M2', 'MID', 'DON', 7, played], ['M3', 'MID', 'DON', 8, played], ['M4', 'MID', 'DON', 9, played], ['F1', 'FWD', 'DON', 10, played], ['F2 injured', 'FWD', 'LAT', 11, INJ],
  ['GK2', 'GKP', 'LAT', 12], ['Dsub', 'DEF', 'LAT', 13], ['Fsub', 'FWD', 'LAT', 14], ['Msub', 'MID', 'LAT', 15]]));
const K6 = once('K6 one starter on 0 minutes and one flagged, two covers', TEAM);
check('K6 Dsub for D3 is locked (both passes), Fsub for F2 is likely (the flagged assumption alone)', K6.subs.length === 2 && K6.subs.some(s => s.inn.Player === 'Dsub' && s.out.Player === 'D3 out' && s.kind === 'locked') && K6.subs.some(s => s.inn.Player === 'Fsub' && s.out.Player === 'F2 injured' && s.kind === 'likely'), JSON.stringify(K6.subs.map(s => [s.inn.Player, s.out.Player, s.kind])));
check('K6 the confirmed-facts pass (likely false) is unchanged: the one locked swap, kind locked', JSON.stringify(E.autoSubs(TEAM, false).subs.map(s => [s.inn.Player, s.out.Player, s.kind])) === '[["Dsub","D3 out","locked"]]');

console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
