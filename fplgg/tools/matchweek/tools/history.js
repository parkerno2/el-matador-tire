/* tools/history.js — the league's earlier seasons (Parker's Q5, 10 Oct 2026: "We should also have all time stats for
   managers somewhere too"). Each file in history/ is one season, keyed by manager code (league.json "ini"), never by team
   name (team names change): { season, league_id, source, scoring, teams: { <code>: <team name that season> },
   standings: [{ rank, team, mgr, P, W, D, L, PF, PA, Pts }], weekly: { <code>: [38 scores] }, fixtures: [[gw, codeA,
   ptsA, ptsB, codeB]...], allplay: { <code>: { apW, apL, apT } }, allstar: { <code>: { player, pos_club, pts } },
   draft: { <code>: [15 picks in order] } }. problems() runs the three checks the export was made with (each manager's
   weekly scores sum to his PF, the fixtures reproduce every W, D, L, PF and PA, and the head-to-heads equal league.json
   "seeded"), so a copying slip fails the gate. header() writes the `const HISTORY=[...]` line that ci-build.sh and the
   preview and demo builds put in front of the engine, after the LEAGUE header; the app's all-time model
   (src/alltime.js) reads the HISTORY global. Plain Node, no dependencies. */
'use strict';
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'history');
const isInt = v => Number.isInteger(v);
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

/* every season file, oldest first */
function load(dir) {
  const d = dir || DIR;
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => /^\d{4}-\d{2}\.json$/.test(f)).sort().map(f => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')));
}
/* the head-to-head records across a list of seasons, keyed "A|B" with the pair sorted: [wins of A, wins of B, draws] */
function h2h(list) {
  const out = {};
  list.forEach(h => (h.fixtures || []).forEach(([g, a, as, bs, b]) => {
    const k = [a, b].sort().join('|'), first = k.split('|')[0], r = out[k] || (out[k] = [0, 0, 0]);
    if (as === bs) r[2]++; else r[(as > bs ? a : b) === first ? 0 : 1]++;
  }));
  return out;
}
/* [] when every season is sound; seeded (league.json "seeded") is checked against the head-to-heads of all seasons */
function problems(list, seeded) {
  const out = [];
  if (!Array.isArray(list)) return ['the history is not a list'];
  list.forEach((h, i) => {
    const at = 'history[' + i + ']' + (h && h.season ? ' (' + h.season + ')' : '');
    if (!isObj(h)) { out.push(at + ': not an object'); return; }
    if (!/^\d{4}\/\d{2}$/.test(h.season || '')) out.push(at + ': season must read YYYY/YY');
    if (!isObj(h.teams) || !Object.keys(h.teams).length) { out.push(at + ': teams must map manager codes to team names'); return; }
    const codes = Object.keys(h.teams);
    codes.forEach(c => { if (!/^[A-Z0-9]{2,3}$/.test(c)) out.push(at + ': code ' + c + ' must be 2 or 3 capitals or digits'); if (typeof h.teams[c] !== 'string' || !h.teams[c].trim()) out.push(at + ': ' + c + ' has no team name'); });
    if (!Array.isArray(h.standings) || h.standings.length !== codes.length) out.push(at + ': one standings row per manager');
    const st = {}; (h.standings || []).forEach(s => { if (isObj(s)) st[s.mgr] = s; });
    codes.forEach(c => {
      const s = st[c]; if (!s) { out.push(at + ': no standings row for ' + c); return; }
      ['rank', 'P', 'W', 'D', 'L', 'PF', 'PA', 'Pts'].forEach(k => { if (!isInt(s[k]) || s[k] < 0) out.push(at + ': ' + c + ' ' + k + ' is not a whole number'); });
      if (s.team !== h.teams[c]) out.push(at + ': ' + c + ' stands as "' + s.team + '" but teams says "' + h.teams[c] + '"');
      if (isInt(s.W) && isInt(s.D) && isInt(s.L) && s.W + s.D + s.L !== s.P) out.push(at + ': ' + c + ' W + D + L is not P');
      if (isInt(s.W) && isInt(s.D) && 3 * s.W + s.D !== s.Pts) out.push(at + ': ' + c + ' Pts is not 3 W + D');
      const w = (h.weekly || {})[c];
      if (!Array.isArray(w) || w.length !== 38 || !w.every(v => isInt(v) && v >= 0)) out.push(at + ': ' + c + ' needs 38 whole weekly scores');
      else if (w.reduce((p, q) => p + q, 0) !== s.PF) out.push(at + ': ' + c + ' weekly scores sum to ' + w.reduce((p, q) => p + q, 0) + ', PF is ' + s.PF);
    });
    const ranks = (h.standings || []).map(s => s.rank).sort((p, q) => p - q);
    if (ranks.some((r, j) => r !== j + 1)) out.push(at + ': ranks must run 1 to ' + codes.length);
    if (!Array.isArray(h.fixtures)) { out.push(at + ': fixtures must be a list'); return; }
    const T = {}; codes.forEach(c => { T[c] = { W: 0, D: 0, L: 0, PF: 0, PA: 0 }; });
    h.fixtures.forEach((f, j) => {
      if (!Array.isArray(f) || f.length !== 5 || !isInt(f[0]) || f[0] < 1 || f[0] > 38 || !T[f[1]] || !T[f[4]] || f[1] === f[4] || !isInt(f[2]) || !isInt(f[3])) { out.push(at + ': fixtures[' + j + '] must be [gw, code, pts, pts, code]'); return; }
      const [g, a, as, bs, b] = f;
      T[a].PF += as; T[a].PA += bs; T[b].PF += bs; T[b].PA += as;
      if (as > bs) { T[a].W++; T[b].L++; } else if (bs > as) { T[b].W++; T[a].L++; } else { T[a].D++; T[b].D++; }
      const wa = (h.weekly || {})[a], wb = (h.weekly || {})[b];
      if (Array.isArray(wa) && wa[g - 1] !== as) out.push(at + ': GW' + g + ' ' + a + ' scored ' + as + ' in the fixture, ' + wa[g - 1] + ' in weekly');
      if (Array.isArray(wb) && wb[g - 1] !== bs) out.push(at + ': GW' + g + ' ' + b + ' scored ' + bs + ' in the fixture, ' + wb[g - 1] + ' in weekly');
    });
    codes.forEach(c => { const s = st[c]; if (!s) return; ['W', 'D', 'L', 'PF', 'PA'].forEach(k => { if (T[c][k] !== s[k]) out.push(at + ': the fixtures give ' + c + ' ' + k + ' ' + T[c][k] + ', the standings say ' + s[k]); }); });
    if (h.allplay != null) {
      if (!isObj(h.allplay)) out.push(at + ': allplay must be an object');
      else codes.forEach(c => { const a = h.allplay[c]; if (!isObj(a) || !['apW', 'apL', 'apT'].every(k => isInt(a[k]) && a[k] >= 0)) out.push(at + ': allplay ' + c + ' needs apW, apL, apT');
        else if (Array.isArray((h.weekly || {})[c]) && a.apW + a.apL + a.apT !== 38 * (codes.length - 1)) out.push(at + ': allplay ' + c + ' does not add up to 38 weeks against ' + (codes.length - 1)); });
    }
    if (h.allstar != null && (!isObj(h.allstar) || Object.keys(h.allstar).some(c => !T[c] || !isObj(h.allstar[c]) || typeof h.allstar[c].player !== 'string' || !isInt(h.allstar[c].pts)))) out.push(at + ': allstar must map codes to { player, pos_club, pts }');
    if (h.draft != null && (!isObj(h.draft) || Object.keys(h.draft).some(c => !T[c] || !Array.isArray(h.draft[c]) || !h.draft[c].length || !h.draft[c].every(p => typeof p === 'string' && p.trim())))) out.push(at + ': draft must map codes to the picks in order');
  });
  if (seeded && isObj(seeded) && !out.length) {
    const mine = h2h(list);
    const keys = new Set([...Object.keys(seeded), ...Object.keys(mine)]);
    keys.forEach(k => { const a = JSON.stringify(seeded[k] || [0, 0, 0]), b = JSON.stringify(mine[k] || [0, 0, 0]); if (a !== b) out.push('seeded ' + k + ' is ' + a + ' in league.json, the history gives ' + b); });
  }
  return out;
}
/* the HISTORY global, in front of the engine after the LEAGUE header */
function header(list) { return 'const HISTORY=' + JSON.stringify(list || []) + ';\n'; }
/* the seasons for the demo: every code and team name fictional (the demo's mapping m from names.js, with league.json's
   teams to find a code's current team), the source line and the league id dropped; scores, picks and players stay */
function anonymise(list, m, cfg) {
  const ini = c => (m.ini && m.ini[c]) || c;
  const cur = {}; Object.keys((cfg && cfg.teams) || {}).forEach(t => { cur[cfg.teams[t].ini] = t; });
  const team = (c, name) => (m.teams && (m.teams[name] || (cur[c] && m.teams[cur[c]]))) || 'Team ' + ini(c);
  const remap = o => { const r = {}; Object.keys(o || {}).forEach(c => { r[ini(c)] = o[c]; }); return r; };
  return (list || []).map(h => {
    const teams = {}; Object.keys(h.teams || {}).forEach(c => { teams[ini(c)] = team(c, h.teams[c]); });
    return {
      season: h.season, source: 'the demo league\'s earlier season', scoring: h.scoring,
      teams,
      standings: (h.standings || []).map(s => Object.assign({}, s, { team: team(s.mgr, s.team), mgr: ini(s.mgr) })),
      weekly: remap(h.weekly),
      fixtures: (h.fixtures || []).map(f => [f[0], ini(f[1]), f[2], f[3], ini(f[4])]),
      allplay: remap(h.allplay), allstar: remap(h.allstar), draft: remap(h.draft),
    };
  });
}
module.exports = { DIR, load, problems, h2h, header, anonymise };
