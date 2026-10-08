// Fixture difficulty tests (the engine's fdrOf and hpStrengthPrior in fplgg/tools/matchweek/core.gen.js, from
// src-prod/v10.js, v12.js and base.js): FPL's 1 to 5 ratings come from the Clubs tab's Str H and Str A (Code.gs v3.22,
// ROADMAP A7, BUGS #25), with the built-in table as the fallback. Plain Node.   node tests/app-fdr.js
const fs = require('fs'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const MW = __dirname + '/../fplgg/tools/matchweek/';
const CORE = fs.readFileSync(MW + 'core.gen.js', 'utf8'), BASE = fs.readFileSync(MW + 'src-prod/base.js', 'utf8'),
  V10 = fs.readFileSync(MW + 'src-prod/v10.js', 'utf8'), V12 = fs.readFileSync(MW + 'src-prod/v12.js', 'utf8');
/* a top-level function or const by name, braces matched (none of these hold a brace in a string) */
function lift(src, name) {
  const i = src.search(new RegExp('^(function ' + name + '\\(|const ' + name + '=)', 'm')); if (i < 0) throw new Error('no ' + name);
  if (src.slice(i).startsWith('const')) return src.slice(i, src.indexOf('\n', i) + 1);
  let depth = 0, j = src.indexOf('{', i);
  for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (!depth) break; } }
  return src.slice(i, j + 1) + '\n';
}
const strLine = src => { const m = /^ {4}D\.str=\{\};clubs\.forEach\(.*\n/m.exec(src); if (!m) throw new Error('no D.str line'); return m[0]; };
check('core.gen.js carries the same difficulty code as src-prod (STRENGTH, strengthOf, fdrOf from v10, hpStrengthPrior from v12, the loader line from base)',
  ['STRENGTH', 'strengthOf', 'fdrOf'].every(n => lift(CORE, n) === lift(V10, n)) && lift(CORE, 'hpStrengthPrior') === lift(V12, 'hpStrengthPrior') && lift(CORE, 'num') === lift(BASE, 'num') && strLine(CORE) === strLine(BASE));
check('the loader fills D.str right after D.clubs, in core.gen.js and base.js alike', [CORE, BASE].every(s => /\n    clubs\.forEach\(c=>\{if\(c\.Short&&c\['Badge code'\]\)D\.clubs\[c\.Short\]=c\['Badge code'\]\}\);\n    \/\*[^\n]*\*\/\n    D\.str=\{\};clubs\.forEach/.test(s)));

const ctx = { D: {}, Object, String, Number, Array, Math, parseFloat, isNaN, console };
vm.createContext(ctx);
vm.runInContext(['num', 'STRENGTH', 'strengthOf', 'fdrOf', 'hpStrengthPrior'].map(n => lift(CORE, n)).join('') + '\nfunction buildStr(clubs){' + strLine(CORE) + '}\nthis.__x = { STRENGTH, strengthOf, fdrOf, hpStrengthPrior, buildStr };', ctx);
const D = ctx.D, E = ctx.__x;
const fx = (Home, Away) => ({ GW: 6, Home, Away });
/* FPL's classic bootstrap-static on 8 Oct 2026: [strength_overall_home, strength_overall_away] per club; the fixture
   feed's team_h_difficulty is the visitor's first figure and team_a_difficulty the host's second, on all 30 fixtures
   of GW6 to GW8 */
const FPL_8_OCT = { ARS: [4, 5], AVL: [3, 3], BOU: [3, 3], BRE: [3, 3], BHA: [3, 4], CHE: [4, 4], COV: [2, 2], CRY: [2, 3], EVE: [3, 3], FUL: [2, 3], HUL: [2, 2], IPS: [2, 2], LEE: [3, 3], LIV: [4, 4], MCI: [4, 5], MUN: [4, 4], NEW: [3, 3], NFO: [3, 3], TOT: [2, 3], SUN: [3, 3] };

console.log('--- T the built-in table');
check('T1 the fallback table is FPL\'s snapshot of 8 Oct 2026, all 20 clubs', JSON.stringify(E.STRENGTH) === JSON.stringify(FPL_8_OCT), JSON.stringify(E.STRENGTH));

console.log('--- F without the tab (an old sheet)');
E.buildStr([]);
check('F1 no Str columns: D.str is empty and the table answers', JSON.stringify(D.str) === '{}' && E.strengthOf('ARS') === E.STRENGTH.ARS);
check('F2 hosting MCI is their first figure (4), visiting them their second (5)', E.fdrOf('ARS', fx('ARS', 'MCI')) === 4 && E.fdrOf('ARS', fx('MCI', 'ARS')) === 5);
check('F3 GW6 from the feed: ARS host LEE at 3, LEE visit ARS at 5; MUN host TOT at 2, TOT visit MUN at 4', E.fdrOf('ARS', fx('ARS', 'LEE')) === 3 && E.fdrOf('LEE', fx('ARS', 'LEE')) === 5 && E.fdrOf('MUN', fx('MUN', 'TOT')) === 2 && E.fdrOf('TOT', fx('MUN', 'TOT')) === 4);
check('F4 an opponent the table does not know is a 3', E.fdrOf('ARS', fx('ARS', 'XYZ')) === 3 && E.fdrOf('XYZ', fx('ARS', 'XYZ')) === 5);
check('F5 the projection\'s strength prior is the average of the two, 3 for a club it does not know', E.hpStrengthPrior('MCI') === 4.5 && E.hpStrengthPrior('COV') === 2 && E.hpStrengthPrior('XYZ') === 3);

console.log('--- W with the Clubs tab');
E.buildStr([
  { Short: 'ARS', 'Badge code': 3, 'Str H': 2, 'Str A': 2 },            /* FPL moved ARS down: the tab wins over the table */
  { Short: 'MCI', 'Badge code': 43, 'Str H': '5', 'Str A': '4' },       /* strings from gviz are fine */
  { Short: 'AVL', 'Badge code': 7, 'Str H': '', 'Str A': '' },           /* blank: FPL gave nothing, the table answers */
  { Short: 'BOU', 'Badge code': 91, 'Str H': 0, 'Str A': 0 },            /* 0: a rating FPL no longer publishes */
  { Short: 'CHE', 'Badge code': 8, 'Str H': 1250, 'Str A': 1300 },       /* the old 1000 to 1400 scale is not a difficulty */
  { Short: 'LIV', 'Badge code': 14, 'Str H': 'x', 'Str A': 4 },          /* junk in one: neither is taken */
  { Short: 'WOL', 'Badge code': 39, 'Str H': 3, 'Str A': 4 },            /* a club the table does not know */
  { Short: '', 'Badge code': '', 'Str H': 4, 'Str A': 4 },               /* no club */
]);
check('W1 only rows with both figures in 1 to 5 land in D.str, as numbers', JSON.stringify(D.str) === '{"ARS":[2,2],"MCI":[5,4],"WOL":[3,4]}', JSON.stringify(D.str));
check('W2 the tab wins over the table: hosting ARS is now a 2, visiting MCI a 4', E.fdrOf('LEE', fx('LEE', 'ARS')) === 2 && E.fdrOf('ARS', fx('ARS', 'MCI')) === 5 && E.fdrOf('ARS', fx('MCI', 'ARS')) === 4);
check('W3 a club the tab leaves blank, at 0, on the old scale or with junk keeps the table', E.strengthOf('AVL') === E.STRENGTH.AVL && E.strengthOf('BOU') === E.STRENGTH.BOU && E.strengthOf('CHE') === E.STRENGTH.CHE && E.strengthOf('LIV') === E.STRENGTH.LIV);
check('W4 a club new to the tab is known without a table entry', E.fdrOf('ARS', fx('ARS', 'WOL')) === 3 && E.fdrOf('ARS', fx('WOL', 'ARS')) === 4 && E.hpStrengthPrior('WOL') === 3.5);
check('W5 the strength prior follows the tab too', E.hpStrengthPrior('ARS') === 2 && E.hpStrengthPrior('MCI') === 4.5);
E.buildStr([]); check('W6 the Clubs tab read empty (the reader guard fell back): an empty map, the table answers', JSON.stringify(D.str) === '{}' && E.fdrOf('ARS', fx('ARS', 'MCI')) === 4);

console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
