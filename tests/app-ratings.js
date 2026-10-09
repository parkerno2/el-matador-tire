// House ratings (ROADMAP C3, 9 Oct 2026): the engine rates a player from FPL's season projection, position by position
// (houseRank, houseOvr in core.gen.js and src-prod/base.js): the pool at a position is one club XI's worth across the 20
// clubs in a 4-4-2 (GKP 20, DEF 80, MID 80, FWD 40), ranked by projected points from the Players tab; the best projected
// is 94, the top tenth 85 and over (elite), the top half 78 and over (gold), the last of the pool 65, past it 62.
// league.json "ratings": "house" makes it the rating everywhere and leaves the EA tabs unread (the demo); "ea", the
// default, keeps the FC27 overall where there is one and rates the rest this way. Plain Node, no network.
//   node tests/app-ratings.js
const fs = require('fs'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const ROOT = __dirname + '/../', MW = ROOT + 'fplgg/tools/matchweek/';
const rd = f => fs.readFileSync(MW + f, 'utf8');
const L = require(MW + 'tools/league.js');
const names = require(ROOT + 'fplgg/tools/demo/names.js');
const cfg = L.load();

/* ---------- the config ---------- */
check('league.json says "ratings": "ea" (the El Matador app keeps its FC27 ratings)', cfg.ratings === 'ea');
check('league.js accepts "ea", "house" and no ratings key, and refuses anything else', L.problems(Object.assign({}, cfg, { ratings: 'house' })).length === 0 && L.problems((() => { const c = JSON.parse(JSON.stringify(cfg)); delete c.ratings; return c; })()).length === 0 && L.problems(Object.assign({}, cfg, { ratings: 'fifa' })).some(p => /ratings: "ea" .* or "house"/.test(p)));
const demoCfg = names.anonymiseLeague(cfg, names.mapping(Object.keys(cfg.teams).map(t => ({ Team: t, Manager: cfg.teams[t].mgr })), Object.fromEntries(Object.keys(cfg.teams).map(t => [t, cfg.teams[t].ini])), Object.fromEntries(Object.keys(cfg.teams).map(t => [t, cfg.teams[t].short])), cfg.aliases));
check('the demo\'s config (names.anonymiseLeague) says "ratings": "house" and passes the checks', demoCfg.ratings === 'house' && L.problems(demoCfg).length === 0, L.problems(demoCfg).join('; '));

/* ---------- the engine ---------- */
function engine(config) {
  const ctx = { window: {}, document: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, location: { search: '', hash: '' }, navigator: {}, console: { log() {}, warn() {}, error() {} }, setTimeout: () => 0, clearTimeout() {}, fetch: () => new Promise(() => {}), Intl, URLSearchParams, performance: { now: () => 0 }, Date, Math, JSON, Object, Array, String, Number, Set, Map, Promise, RegExp, Error, parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(L.header(config) + rd('core.gen.js') + '\n;this.__t = { HOUSE, HOUSE_POOL, HOUSE_CURVE, houseRank, houseOvr, ovrOf, dynOvr, tierOf, D };', ctx);
  return ctx.__t;
}
/* a Players pool: n players at a position with projections n*10 down to 10 (rank i has 10*(n-i+1) points) */
const pool = (pos, n) => Array.from({ length: n }, (_, i) => ({ Code: pos + i, Player: pos + i, Pos: pos, Proj: 10 * (n - i) }));
const plr = [].concat(pool('GKP', 60), pool('DEF', 200), pool('MID', 300), pool('FWD', 80));
const row = (pos, proj, ovr) => ({ Player: 'x', Pos: pos, 'Proj pts': proj, OVR: ovr === undefined ? '' : ovr });

const EA = engine(cfg); EA.D.plr = plr; EA.D.gwsCur = {}; EA.D.gwsByGw = {}; EA.D.gw = 1;
check('the pools: GKP 20, DEF 80, MID 80, FWD 40 (one club XI in a 4-4-2 across 20 clubs); the curve runs 94, 85, 78, 65, 62', JSON.stringify(EA.HOUSE_POOL) === '{"GKP":20,"DEF":80,"MID":80,"FWD":40}' && JSON.stringify(EA.HOUSE_CURVE) === '[[0,94],[0.1,85],[0.5,78],[1,65],[1.125,62]]' && EA.HOUSE === false);
check('"ea": the FC27 overall wins where there is one (87 stays 87), the house rating stands in where there is none', EA.ovrOf(row('MID', 3000, '87')) === 87 && EA.ovrOf(row('MID', 3000, 87.4)) === 87 && EA.ovrOf(row('MID', 3000)) === 94 && EA.ovrOf(row('MID', 3000, 0)) === 94);
const r1 = EA.houseRank(row('MID', 3000)), r9 = EA.houseRank(row('MID', 2920)), rLast = EA.houseRank(row('MID', 2210)), rPast = EA.houseRank(row('MID', 5));
check('houseRank: the best projected midfielder is 1st of a pool of 80, the 9th is 9th, the 80th is 80th, a projection below everyone is 301st', r1.rank === 1 && r1.pool === 80 && r1.known && r9.rank === 9 && rLast.rank === 80 && rPast.rank === 301);
check('the curve: 1st 94, 9th 85 (the top tenth, elite), 41st 78 (the top half, gold), 80th 65, 91st and beyond 62', EA.houseOvr(row('MID', 3000)) === 94 && EA.houseOvr(row('MID', 2920)) === 85 && EA.houseOvr(row('MID', 2600)) === 78 && EA.houseOvr(row('MID', 2210)) === 65 && EA.houseOvr(row('MID', 2100)) === 62 && EA.houseOvr(row('MID', 5)) === 62);
check('between the anchors a straight line: the 5th of 80 is 90, the 20th 83, the 60th 72', EA.houseOvr(row('MID', 2960)) === 90 && EA.houseOvr(row('MID', 2810)) === 83 && EA.houseOvr(row('MID', 2410)) === 72);
check('a position ranks only among itself: the 3rd keeper (3rd of 20) is 85, the 3rd defender (3rd of 80) is 92', EA.houseOvr(row('GKP', 580)) === 85 && EA.houseOvr(row('DEF', 1980)) === 92 && EA.houseRank(row('GKP', 580)).pool === 20);
check('ties share a rank: a projection equal to the best is 1st; a player row from the Players tab (Proj) rates the same as his Rosters row (Proj pts)', EA.houseRank(row('FWD', 800)).rank === 1 && EA.houseOvr({ Pos: 'FWD', Proj: 800 }) === 94 && EA.houseOvr({ Pos: 'FWD', Proj: 400 }) === EA.houseOvr(row('FWD', 400)));
check('no projection, or none positive, is the floor of 62; an unknown position takes a pool of 80', EA.houseOvr(row('MID', 0)) === 62 && EA.houseOvr(row('MID', '')) === 62 && EA.houseOvr({ Pos: 'MID' }) === 62 && EA.houseRank(row('XYZ', 10)).pool === 80);
const tiers = plr.filter(p => p.Pos === 'MID').map(p => EA.tierOf({ Pos: 'MID', 'Proj pts': p.Proj, Player: p.Player, Drafted: '' }));
check('tierOf on the pool of 300 midfielders: 11 elite (the 10th and 11th round up to 85), 31 gold (down to the 42nd), the rest silver; the form delta is 0 without finished games', tiers.filter(t => t === 'elite').length === 11 && tiers.filter(t => t === 'gold').length === 31 && tiers.filter(t => t === 'silver').length === 258, tiers.filter(t => t === 'elite').length + ' ' + tiers.filter(t => t === 'gold').length);
check('the ranks follow a new Players tab (the cache is per D.plr)', (() => { EA.D.plr = pool('MID', 10); const v = EA.houseOvr(row('MID', 100)); EA.D.plr = plr; return v === 94 && EA.houseOvr(row('MID', 100)) === 62; })());
EA.D.plr = [];
check('before the Players tab is loaded (no pool) the projection sits on a straight line, 62 to 96, as before', EA.houseOvr(row('MID', 170)) === 84 && EA.houseOvr(row('MID', 0)) === 62 && EA.houseOvr(row('MID', 1000)) === 96 && EA.houseRank(row('MID', 170)).known === false);
EA.D.plr = plr;

const HO = engine(Object.assign({}, cfg, { ratings: 'house' })); HO.D.plr = plr; HO.D.gwsCur = {}; HO.D.gwsByGw = {}; HO.D.gw = 1;
check('"house": the FC27 overall is ignored even where there is one; the rating is the house rating', HO.HOUSE === true && HO.ovrOf(row('MID', 3000, '70')) === 94 && HO.ovrOf(row('GKP', 580, '91')) === 85 && HO.dynOvr(row('MID', 3000, '70')) === 94);
const NO = engine((() => { const c = JSON.parse(JSON.stringify(cfg)); delete c.ratings; return c; })()); NO.D.plr = plr;
check('no ratings key is "ea"', NO.HOUSE === false && NO.ovrOf(row('MID', 3000, '70')) === 70);

/* ---------- the two engine files in step ---------- */
const CORE = rd('core.gen.js'), BASE = rd('src-prod/base.js');
const block = s => { const a = s.indexOf('/* house rating (ROADMAP C3'), b = s.indexOf('function tierOf(p){'); return a > 0 && b > a ? s.slice(a, b) : null; };
check('core.gen.js and src-prod/base.js carry the same house rating block (HOUSE, the pools, the curve, houseRank, houseOvr, ovrOf) and no straight-line fallback as the rating', block(CORE) !== null && block(CORE) === block(BASE) && !/return Math\.max\(62,Math\.min\(96,Math\.round\(62\+22\*num\(p\['Proj pts'\]\)\/170\)\)\);/.test(CORE));

/* ---------- the reader leaves the EA tabs out on house ratings ---------- */
const TABS = rd('src/data/tabs.js');
check('tabs.js exports HOUSE from LEAGUE.ratings and answers the EA tabs empty without a request when it is set, from any source', /export const HOUSE = typeof LEAGUE !== 'undefined' && !!LEAGUE && LEAGUE\.ratings === 'house';/.test(TABS) && /if \(HOUSE && DEMO_EMPTY\.includes\(name\)\) \{ REPORT\[name\] = 'left out \(house ratings\), empty'; return Promise\.resolve\(demoEmpty\(name\)\); \}/.test(TABS));

/* ---------- the player sheet ---------- */
const PJ = rd('src/sheets/player.js');
check('player.js: on house ratings the Ratings tab shows no FC 27 attributes, the aside is Matchweek (Demo league in the demo) and the text says where he ranks', /import \{ DEMO, HOUSE \} from '\.\.\/data\/tabs\.js'/.test(PJ) && /const has = !HOUSE && fc && keys\.some/.test(PJ) && /aside: HOUSE \? \(DEMO \? 'Demo league' : 'Matchweek'\) : 'FC 27'/.test(PJ) && /function houseWhy\(p\)/.test(PJ) && /K\.ord\(h\.rank\) \+ ' of the ' \+ pos \+ ' in the Premier League, against a pool of ' \+ h\.pool/.test(PJ) && /HOUSE \? '<div class="ps-none">' \+ \(DEMO \? 'The demo league' : 'This league'\) \+ ' shows no attribute ratings/.test(PJ));
check('player.js: the El Matador app keeps the FC 27 line where there is a rating and explains the house rating where there is none', /\(HOUSE \|\| !\(fc && fc\.ovr\) \? houseWhy\(p\) : ' FC 27 rates him ' \+ Math\.round\(fc\.ovr\) \+ ' overall\.'\)/.test(PJ) && /FC 27 has no attribute ratings for him yet/.test(PJ));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
