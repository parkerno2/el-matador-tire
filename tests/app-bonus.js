// Provisional bonus tests (the engine's computeProvBonus in fplgg/tools/matchweek/core.gen.js, from src-prod/base.js):
// a club's only match ranks GW Stats BPS as before; a club's second match of a double gameweek ranks its own BPS from
// the Fixture BPS tab (Code.gs v3.21, BUGS #8). Plain Node.   node tests/app-bonus.js
const fs = require('fs'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const CORE = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/core.gen.js', 'utf8'), BASE = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src-prod/base.js', 'utf8');
/* a top-level function or const by name, braces matched (none of these hold a brace in a string) */
function lift(src, name) {
  const i = src.search(new RegExp('^(function ' + name + '\\(|const ' + name + '=)', 'm')); if (i < 0) throw new Error('no ' + name);
  if (src.slice(i).startsWith('const')) return src.slice(i, src.indexOf('\n', i) + 1);
  let depth = 0, j = src.indexOf('{', i);
  for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (!depth) break; } }
  return src.slice(i, j + 1) + '\n';
}
const NAMES = ['fin', 'num', 'provTiers', 'computeProvBonus'];
const fbpsLine = src => { const m = /^ {4}D\.fbps=\{\};\(fb\|\|\[\]\)\.forEach\(.*\n/m.exec(src); if (!m) throw new Error('no D.fbps line'); return m[0]; };
check('core.gen.js carries the same provisional bonus code as src-prod/base.js', NAMES.every(n => lift(CORE, n) === lift(BASE, n)) && fbpsLine(CORE) === fbpsLine(BASE));
check('__loadBase reads the Fixture BPS tab as optional, after GW Log', /readTab\('GW Log'\)\.catch\(\(\)=>\[\]\),readTab\('Fixture BPS'\)\.catch\(\(\)=>\[\]\)\n  \]\)\.then\(\(\[ro,st,fx,mw,cf,clubs,sp,ea,f27,tx,pred,gws,plr,gl,fb\]\)=>\{/.test(CORE));

const ctx = { D: {}, Set, Object, String, Number, Array, Math, parseFloat, isNaN, console };
vm.createContext(ctx);
vm.runInContext(NAMES.map(n => lift(CORE, n)).join('') + '\nfunction buildFbps(fb){' + fbpsLine(CORE) + '}', ctx);
const D = ctx.D;
const fx = (Home, Away, Started, Finished) => ({ GW: 6, Home, Away, Started: Started ? 'TRUE' : 'FALSE', Finished: Finished ? 'TRUE' : 'FALSE' });
const gws = rows => { D.gwsCur = {}; rows.forEach(([Code, Club, Mins, BPS, Bonus]) => { D.gwsCur[Code] = { Code, Club, Mins, BPS, Bonus: Bonus || 0 }; }); };
const tab = rows => { D.gw = 6; ctx.buildFbps(rows.map(([GW, Home, Away, Code, Club, BPS, Bonus]) => ({ GW, Home, Away, Code, Club, BPS, Bonus: Bonus || 0 }))); };
const pb = curFx => JSON.stringify(ctx.computeProvBonus(curFx));

console.log('--- S a club\'s only match: unchanged');
D.fbps = {};
gws([['1', 'MCI', 90, 40], ['2', 'MCI', 90, 30], ['3', 'ARS', 90, 30], ['4', 'ARS', 85, 25], ['5', 'ARS', 0, 0], ['6', 'LIV', 90, 50], ['7', 'CHE', 90, 20]]);
check('S1 a finished match ranks GW Stats BPS 3/2/1; a tie for second shares 2 and eats third; an unfinished one gives nothing', pb([fx('MCI', 'ARS', true, true), fx('LIV', 'CHE', true, false)]) === '{"1":3,"2":2,"3":2}');
gws([['1', 'MCI', 90, 40], ['2', 'MCI', 90, 40], ['3', 'ARS', 90, 30], ['4', 'ARS', 85, 25]]);
check('S2 a tie for first: both 3, the next gets 1', pb([fx('MCI', 'ARS', true, true)]) === '{"1":3,"2":3,"3":1}');
gws([['1', 'MCI', 90, 40, 3], ['2', 'MCI', 90, 30], ['3', 'ARS', 90, 30]]);
check('S3 official bonus in GW Stats: nothing provisional', pb([fx('MCI', 'ARS', true, true)]) === '{}');
gws([['1', 'MCI', 90, 40], ['2', 'MCI', 90, 30], ['3', 'ARS', 90, 30], ['6', 'LIV', 90, 50], ['7', 'CHE', 90, 20]]);
tab([[6, 'MCI', 'ARS', '1', 'MCI', 99]]);
check('S4 the Fixture BPS tab is not consulted for a club\'s only match (GW Stats wins: 40, not 99)', pb([fx('MCI', 'ARS', true, true), fx('LIV', 'CHE', true, true)]) === '{"1":3,"2":2,"3":2,"6":3,"7":2}');

console.log('--- W a double gameweek');
/* MCI play ARS (leg 1) and LIV (leg 2); GW Stats sums MCI\'s two matches */
gws([['1', 'MCI', 180, 70, 3], ['2', 'MCI', 180, 45, 2], ['3', 'ARS', 90, 30, 1], ['4', 'ARS', 85, 25], ['6', 'LIV', 90, 50], ['7', 'LIV', 90, 20], ['8', 'CHE', 90, 20]]);
const legs = [fx('MCI', 'ARS', true, true), fx('MCI', 'LIV', true, true)];
D.fbps = {};
check('W1 without the tab (an old sheet) a double gives nothing, as before', pb(legs) === '{}');
tab([[6, 'MCI', 'ARS', '1', 'MCI', 48, 3], [6, 'MCI', 'ARS', '2', 'MCI', 30, 2], [6, 'MCI', 'ARS', '3', 'ARS', 30, 1], [6, 'MCI', 'ARS', '4', 'ARS', 25],
  [6, 'MCI', 'LIV', '6', 'LIV', 50], [6, 'MCI', 'LIV', '1', 'MCI', 22], [6, 'MCI', 'LIV', '2', 'MCI', 15], [6, 'MCI', 'LIV', '7', 'LIV', 20]]);
check('W2 leg 1 confirmed (bonus in the tab), leg 2 finished and pending: leg 2 ranked on its own BPS (Salah 3, Haaland 2, Robertson 1)', pb(legs) === '{"1":2,"6":3,"7":1}', pb(legs));
check('W3 leg 2 not over yet: nothing for it', pb([fx('MCI', 'ARS', true, true), fx('MCI', 'LIV', true, false)]) === '{}');
tab([[6, 'MCI', 'ARS', '1', 'MCI', 48], [6, 'MCI', 'ARS', '2', 'MCI', 30], [6, 'MCI', 'ARS', '3', 'ARS', 30], [6, 'MCI', 'ARS', '4', 'ARS', 25], [6, 'MCI', 'LIV', '6', 'LIV', 14], [6, 'MCI', 'LIV', '1', 'MCI', 9]]);
gws([['1', 'MCI', 120, 52], ['2', 'MCI', 120, 33], ['3', 'ARS', 90, 30], ['4', 'ARS', 85, 25], ['6', 'LIV', 30, 14]]);
check('W4 leg 1 finished with its bonus pending while leg 2 is on (nothing before): leg 1 from its own BPS, a tie for second', pb([fx('MCI', 'ARS', true, true), fx('MCI', 'LIV', true, false)]) === '{"1":3,"2":2,"3":2}', pb([fx('MCI', 'ARS', true, true), fx('MCI', 'LIV', true, false)]));
check('W5 both legs finished and pending: a player can earn in both (Haaland 3 in leg 1, 2 behind Salah in leg 2)', pb(legs) === '{"1":5,"2":2,"3":2,"6":3}', pb(legs));
gws([['1', 'MCI', 120, 52], ['2', 'MCI', 120, 33], ['3', 'ARS', 90, 30], ['4', 'ARS', 85, 25], ['6', 'LIV', 90, 14, 3]]);
check('W6 the feed-lag guard: GW Stats shows bonus for a LIV player (a club with one match) while the tab shows none: leg 2 is skipped, leg 1 is not', pb(legs) === '{"1":3,"2":2,"3":2}', pb(legs));
gws([['1', 'MCI', 120, 52, 3], ['2', 'MCI', 120, 33], ['3', 'ARS', 90, 30], ['4', 'ARS', 85, 25], ['6', 'LIV', 90, 14]]);
tab([[6, 'MCI', 'ARS', '1', 'MCI', 48, 3], [6, 'MCI', 'ARS', '3', 'ARS', 30, 1], [6, 'MCI', 'LIV', '6', 'LIV', 14], [6, 'MCI', 'LIV', '1', 'MCI', 9]]);
check('W7 an MCI player\'s GW Stats bonus (leg 1\'s) does not block leg 2', pb(legs) === '{"1":2,"6":3}', pb(legs));
check('W8 the opponent of the doubled club is on the double path too: ARS v MCI read from the tab under its own key', (tab([[6, 'ARS', 'MCI', '3', 'ARS', 30], [6, 'ARS', 'MCI', '1', 'MCI', 20]]), gws([['1', 'MCI', 120, 52], ['3', 'ARS', 90, 30]]), pb([fx('ARS', 'MCI', true, true), fx('MCI', 'LIV', true, false)])) === '{"1":2,"3":3}');

console.log('--- B the tab into D.fbps');
tab([[6, 'MCI', 'ARS', 1001, 'MCI', '48', '3'], [5, 'MCI', 'ARS', 1001, 'MCI', 40, 0], [6, '', '', 1002, 'MCI', 10, 0], [6, 'LIV', 'CHE', 3001, 'LIV', 33, '']]);
check('B1 keyed home|away, this gameweek only, codes as strings, numbers as numbers, blanks as 0', JSON.stringify(D.fbps) === '{"MCI|ARS":[{"Code":"1001","Club":"MCI","BPS":48,"Bonus":3}],"LIV|CHE":[{"Code":"3001","Club":"LIV","BPS":33,"Bonus":0}]}', JSON.stringify(D.fbps));
ctx.buildFbps(null); check('B2 no tab (an old Code.gs): an empty map', JSON.stringify(D.fbps) === '{}');

console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
