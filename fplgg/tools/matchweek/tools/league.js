/* tools/league.js — the league's config (ROADMAP C1, 9 Oct 2026): reads and checks league.json and writes the LEAGUE
   header that ci-build.sh and the demo build put in front of core.gen.js. The engine (core.gen.js, from src-prod/base.js
   and v10.js) builds its TEAMS, TEAM_ALIAS, MATCH (derbies), SEED (seeded series), FIRST, SHORTOF and PERIODS tables
   from the LEAGUE global, and the UI reads the pot (src/pages/league/data.js) from it; nothing league-specific stays in
   the engine's code. Plain Node, no dependencies, so a test and a build can share it.

   league.json: { name, teams: { <team>: { mgr, first, ini, short, col, xi, lo, hi } }, aliases: { <old name>: <team> },
     derbies: { "<ini>|<ini>": name }, seeded: { "<ini>|<ini>": [w1, w2, d] } (the pair sorted, w1 for the first of the
     two), periods: [[name, fromGw, toGw]...] (Manager of the Month), pot: { buyin, first, second, third, half, motm },
     ratings: "ea" | "house" (ROADMAP C3: "house" rates every player from the FPL projection and reads no EA tab; "ea", the
     default when missing, keeps the FC27 overall where there is one) } */
'use strict';
const fs = require('fs'), path = require('path');
const FILE = path.join(__dirname, '..', 'league.json');
const POT_KEYS = ['buyin', 'first', 'second', 'third', 'half', 'motm'];
const isHex = v => typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v);
const isInt = v => Number.isInteger(v);
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

/* every problem with a config, [] when it is sound */
function problems(cfg) {
  const out = [];
  if (!isObj(cfg)) return ['the config is not an object'];
  if (typeof cfg.name !== 'string' || !cfg.name.trim()) out.push('name: a non-empty string');
  const teams = isObj(cfg.teams) ? cfg.teams : {};
  const names = Object.keys(teams);
  if (names.length < 2) out.push('teams: at least two');
  const inis = new Set(), shorts = new Set();
  names.forEach(t => {
    const x = teams[t] || {};
    if (!t.trim()) out.push('teams: an empty team name');
    ['mgr', 'first', 'ini', 'short'].forEach(k => { if (typeof x[k] !== 'string' || !x[k].trim()) out.push(t + ': ' + k + ' is not a non-empty string'); });
    if (typeof x.ini === 'string') { if (!/^[A-Z0-9]{2,3}$/.test(x.ini)) out.push(t + ': ini must be 2 or 3 capitals or digits'); if (inis.has(x.ini)) out.push(t + ': ini ' + x.ini + ' is used twice'); inis.add(x.ini); }
    if (typeof x.short === 'string') { if (/\s/.test(x.short)) out.push(t + ': short must be one word'); if (shorts.has(x.short)) out.push(t + ': short ' + x.short + ' is used twice'); shorts.add(x.short); }
    if (!isHex(x.col)) out.push(t + ': col must be #rrggbb');
    ['xi', 'lo', 'hi'].forEach(k => { if (!isInt(x[k]) || x[k] <= 0) out.push(t + ': ' + k + ' must be a positive whole number'); });
    if (isInt(x.lo) && isInt(x.hi) && isInt(x.xi) && !(x.lo < x.xi && x.xi < x.hi)) out.push(t + ': lo < xi < hi');
  });
  const pairOk = k => { const p = k.split('|'); return p.length === 2 && p[0] !== p[1] && inis.has(p[0]) && inis.has(p[1]); };
  if (cfg.aliases != null && !isObj(cfg.aliases)) out.push('aliases: an object of old name to current name');
  Object.keys(isObj(cfg.aliases) ? cfg.aliases : {}).forEach(k => { if (!(cfg.aliases[k] in teams)) out.push('aliases: ' + k + ' points to an unknown team'); if (k in teams) out.push('aliases: ' + k + ' is a current team name'); });
  if (cfg.derbies != null && !isObj(cfg.derbies)) out.push('derbies: an object');
  Object.keys(isObj(cfg.derbies) ? cfg.derbies : {}).forEach(k => {
    if (!pairOk(k)) out.push('derbies: ' + k + ' is not a pair of two known initials');
    if (typeof cfg.derbies[k] !== 'string' || !cfg.derbies[k].trim()) out.push('derbies: ' + k + ' has no name');
  });
  const seenPair = new Set();
  Object.keys(isObj(cfg.derbies) ? cfg.derbies : {}).forEach(k => { const s = k.split('|').sort().join('|'); if (seenPair.has(s)) out.push('derbies: ' + k + ' names the same pair twice'); seenPair.add(s); });
  if (cfg.seeded != null && !isObj(cfg.seeded)) out.push('seeded: an object');
  Object.keys(isObj(cfg.seeded) ? cfg.seeded : {}).forEach(k => {
    if (!pairOk(k)) out.push('seeded: ' + k + ' is not a pair of two known initials');
    else if (k.split('|').sort().join('|') !== k) out.push('seeded: ' + k + ' must be sorted (' + k.split('|').sort().join('|') + ')');
    const v = cfg.seeded[k];
    if (!Array.isArray(v) || v.length !== 3 || !v.every(n => isInt(n) && n >= 0)) out.push('seeded: ' + k + ' must be [wins, wins, draws]');
  });
  const per = Array.isArray(cfg.periods) ? cfg.periods : null;
  if (!per || !per.length) out.push('periods: a non-empty list of [name, from, to]');
  else {
    let next = 1;
    per.forEach((p, i) => {
      if (!Array.isArray(p) || p.length !== 3 || typeof p[0] !== 'string' || !p[0].trim() || !isInt(p[1]) || !isInt(p[2])) { out.push('periods[' + i + ']: [name, from, to]'); return; }
      if (p[1] !== next) out.push('periods[' + i + '] (' + p[0] + '): starts at GW' + p[1] + ', expected GW' + next);
      if (p[2] < p[1]) out.push('periods[' + i + '] (' + p[0] + '): ends before it starts');
      next = p[2] + 1;
    });
    if (per.every(p => Array.isArray(p) && isInt(p[2])) && next - 1 !== 38) out.push('periods: must end at GW38, not GW' + (next - 1));
  }
  if (cfg.ratings != null && !['ea', 'house'].includes(cfg.ratings)) out.push('ratings: "ea" (the FC27 overall where there is one) or "house" (Matchweek\'s own, from the FPL projection)');
  const pot = isObj(cfg.pot) ? cfg.pot : null;
  if (!pot) out.push('pot: an object');
  else {
    POT_KEYS.forEach(k => { if (!isInt(pot[k]) || pot[k] < 0) out.push('pot.' + k + ': a whole number of dollars'); });
    Object.keys(pot).forEach(k => { if (!POT_KEYS.includes(k)) out.push('pot.' + k + ': unknown (' + POT_KEYS.join(', ') + ')'); });
    if (POT_KEYS.every(k => isInt(pot[k])) && per && names.length >= 2) {
      const paid = pot.first + pot.second + pot.third + pot.half + pot.motm * per.length, total = pot.buyin * names.length;
      if (paid !== total) out.push('pot: the prizes add up to ' + paid + ' and the buy-ins to ' + total);
    }
  }
  return out;
}
/* the config from a file (league.json by default), checked; throws with every problem listed */
function load(file) {
  const f = file || FILE;
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error(f + ': ' + (e && e.message)); }
  const bad = problems(cfg);
  if (bad.length) throw new Error(path.basename(f) + ': ' + bad.join('; '));
  return cfg;
}
/* the line that goes in front of core.gen.js: the config as one JSON literal on a const the engine reads */
function header(cfg) {
  const bad = problems(cfg);
  if (bad.length) throw new Error('league config: ' + bad.join('; '));
  return 'const LEAGUE=' + JSON.stringify(cfg).replace(/<\/script/gi, '<\\/script').replace(/[\u2028\u2029]/g, c => '\\u' + c.charCodeAt(0).toString(16)) + ';\n';
}
module.exports = { FILE, POT_KEYS, problems, load, header };
if (require.main === module) { const cfg = load(process.argv[2]); console.log(cfg.name + ': ' + Object.keys(cfg.teams).length + ' teams, ' + Object.keys(cfg.derbies || {}).length + ' derbies, ' + Object.keys(cfg.seeded || {}).length + ' seeded series, ' + cfg.periods.length + ' periods, pot ' + cfg.pot.buyin * Object.keys(cfg.teams).length); }
