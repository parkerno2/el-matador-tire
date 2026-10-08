// v3.19 tests: the Matchweeks tab carries FPL's waivers_time (Waivers (UTC)) and Standings carries FPL's waiver order
// (Waiver pick), both as new last columns so every reader of the old columns is unchanged.
//   cd /home/claude/emt && node tests/codegs/v319.js
// The two put() calls are lifted out of writeSheets and run against a stub put() with real GW6 shapes from the draft
// API (8 Oct 2026), then the whole file is loaded once to prove it still parses and the version reads v3.19 or later.
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../../Code.gs', 'utf8');
let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL ' + m); } else console.log('ok   ' + m); };

function lift(tab) {
  const i = src.indexOf("  put('" + tab + "',");
  if (i < 0) throw new Error('no put for ' + tab);
  let depth = 0, j = src.indexOf('(', i);
  for (; j < src.length; j++) { const c = src[j]; if (c === '(') depth++; else if (c === ')') { depth--; if (!depth) break; } }
  return src.slice(i, j + 2);
}
const out = {};
const ctx = {
  put: (name, header, rows) => { out[name] = { header, rows }; },
  MIDSEASON_GW: 19, PRIZES: { mid: 50 },
  periodOf: gw => (gw <= 5 ? 'Aug & Sep' : 'October'),
  boot: { events: { data: [
    { id: 5, deadline_time: '2026-09-26T10:00:00Z', waivers_time: '2026-09-25T10:00:00Z', finished: true },
    { id: 6, deadline_time: '2026-10-10T10:00:00Z', waivers_time: '2026-10-09T10:00:00Z', finished: false },
    { id: 7, deadline_time: '2026-10-17T10:00:00Z', finished: false },
  ] } },
  // league 45380, 8 Oct 2026: waiver_pick runs in reverse table order (Devils U21s bottom, pick 1)
  teams: { 1: { name: 'Kobbie Mainoo Fan', manager: 'A B', waiver: 8 }, 2: { name: 'Devils U21s', manager: 'C D', waiver: 1 }, 3: { name: 'Team Nowaiver', manager: 'E F' } },
  leToEntry: { 11: 1, 12: 2, 13: 3 },
  details: { standings: [
    { league_entry: 11, matches_won: 3, matches_drawn: 1, matches_lost: 1, points_for: 228, points_against: 200, total: 10 },
    { league_entry: 12, matches_won: 0, matches_drawn: 0, matches_lost: 5, points_for: 186, points_against: 250, total: 0 },
    { league_entry: 13, matches_won: 2, matches_drawn: 1, matches_lost: 2, points_for: 210, points_against: 210, total: 7 },
  ] },
};
vm.createContext(ctx);
vm.runInContext(lift('Matchweeks') + '\n' + lift('Standings'), ctx);

const M = out.Matchweeks, S = out.Standings;
ok(M && M.header.join('|') === 'GW|Deadline (UTC)|MOTM period|Finished|Notes|Waivers (UTC)', 'Matchweeks: old five columns unchanged, Waivers (UTC) last');
ok(M.rows.every(r => r.length === M.header.length), 'Matchweeks: every row as wide as the header');
ok(M.rows[1][1] === "'2026-10-10T10:00:00Z" && M.rows[1][5] === "'2026-10-09T10:00:00Z", 'Matchweeks: GW6 deadline and waivers, both kept as text');
ok(M.rows[2][5] === '', 'Matchweeks: a gameweek without waivers_time gets an empty cell, not "undefined"');
ok(S && S.header.join('|') === 'Team|Manager|W|D|L|Pts For|Pts Against|League Pts|Waiver pick', 'Standings: old eight columns unchanged, Waiver pick last');
ok(S.rows.every(r => r.length === S.header.length), 'Standings: every row as wide as the header');
ok(S.rows[0][8] === 8 && S.rows[1][8] === 1, 'Standings: waiver_pick reaches the right club (top 8th, bottom 1st)');
ok(S.rows[2][8] === '', 'Standings: a club without waiver_pick gets an empty cell');
ok(S.rows[0][0] === 'Kobbie Mainoo Fan' && S.rows[0][7] === 10, 'Standings: team and league points still in place');

// the readers that use column positions only read the first two Matchweeks columns
ok(/getRange\(1, 1, sh\.getLastRow\(\), 2\)/.test(src.slice(src.indexOf('function emtDeadlineMs'), src.indexOf('function emtDeadlineMs') + 400)), 'emtDeadlineMs still reads only GW and Deadline');

// the whole file still parses and the self-update reads v3.15
try { new vm.Script(src, { filename: 'Code.gs' }); ok(true, 'Code.gs parses'); } catch (e) { ok(false, 'Code.gs parses: ' + e.message); }
const ver = (/CHANGELOG[\s\S]*?\n[ \t]*\*[ \t]*(v\d+(?:\.\d+)+)/.exec(src) || [])[1] || '';
const vn = ver.slice(1).split('.').map(Number);
ok(vn[0] > 3 || (vn[0] === 3 && vn[1] >= 19), 'the first version after CHANGELOG is v3.19 or later (got ' + ver + ')');
ok(/\* v3\.19 · 8 Oct 2026\n \*   The app knows the waiver window/.test(src), 'the v3.19 entry is in the CHANGELOG');
ok(new RegExp("var EMT_VERSION = '" + ver.replace(/\./g, '\\.') + "'").test(src), 'EMT_VERSION follows the first CHANGELOG entry');

console.log(fails ? fails + ' of ' + n + ' FAILED' : n + ' checks\nALL PASS');
process.exit(fails ? 1 : 0);
