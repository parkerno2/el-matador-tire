/* alltime.js — the all-time manager model (Parker's Q5, 10 Oct 2026: "We should also have all time stats for managers
   somewhere too"). Keyed by manager code (league.json "ini"), never by team name: the earlier seasons come from the
   HISTORY global (history/*.json through tools/history.js, in front of the engine after LEAGUE), this season from the
   finished H2H Fixtures rows (D.fx) with the standings worked out from them. Pure functions of those globals, memoised
   per data load; nothing here touches the DOM. The League's All-time sub-tab and the manager sheet's All-time tab read
   it. The head-to-head records equal the Derbies page's series (SEED plus this season's finished meetings), which
   tests/app-alltime.js holds to. */

const M = { at: -1, v: null };
const hist = () => (typeof HISTORY !== 'undefined' && Array.isArray(HISTORY) ? HISTORY : []);
const codeOf = team => (TEAMS[team] || {}).ini || '';

/* this season's label, as the League page reads it (the year of the GW1 deadline) */
export function thisSeason() {
  let d = null;
  try { d = (typeof gwDeadline === 'function' && gwDeadline(1)) || (typeof dt === 'function' && dt(((D.mw || [])[0] || {})['Deadline (UTC)'])) || null; } catch (e) { d = null; }
  if (!d) d = new Date();
  const y = d.getUTCFullYear();
  return y + '/' + String((y + 1) % 100).padStart(2, '0');
}

/* this season as a history-shaped record: finished fixtures only, the standings from them (3 a win, 1 a draw, points
   for breaks ties), complete once every fixture of the season is finished */
export function currentSeason() {
  const fx = (D.fx || []).filter(f => fin(f.Finished) && codeOf(f.Home) && codeOf(f.Away));
  const codes = Object.keys(TEAMS).map(codeOf).filter(Boolean);
  const teams = {}; Object.keys(TEAMS).forEach(t => { teams[codeOf(t)] = t; });
  const T = {}; codes.forEach(c => { T[c] = { W: 0, D: 0, L: 0, PF: 0, PA: 0, P: 0 }; });
  const fixtures = fx.map(f => [num(f.GW), codeOf(f.Home), num(f['Home pts']), num(f['Away pts']), codeOf(f.Away)]).sort((p, q) => p[0] - q[0]);
  fixtures.forEach(([g, a, as, bs, b]) => {
    T[a].PF += as; T[a].PA += bs; T[b].PF += bs; T[b].PA += as; T[a].P++; T[b].P++;
    if (as > bs) { T[a].W++; T[b].L++; } else if (bs > as) { T[b].W++; T[a].L++; } else { T[a].D++; T[b].D++; }
  });
  const order = codes.slice().sort((p, q) => (3 * T[q].W + T[q].D) - (3 * T[p].W + T[p].D) || T[q].PF - T[p].PF);
  const standings = order.map((c, i) => ({ rank: i + 1, team: teams[c], mgr: c, P: T[c].P, W: T[c].W, D: T[c].D, L: T[c].L, PF: T[c].PF, PA: T[c].PA, Pts: 3 * T[c].W + T[c].D }));
  const all = (D.fx || []).filter(f => codeOf(f.Home) && codeOf(f.Away));
  return { season: thisSeason(), teams, standings, fixtures, current: true, complete: all.length > 0 && all.every(f => fin(f.Finished)) && fixtures.length === all.length };
}

/* a manager's matches across the seasons, oldest first: { season, gw, opp, my, their, res } */
function matchesOf(seasons, code) {
  const out = [];
  seasons.forEach(s => (s.fixtures || []).forEach(([g, a, as, bs, b]) => {
    if (a === code) out.push({ season: s.season, gw: g, opp: b, my: as, their: bs });
    else if (b === code) out.push({ season: s.season, gw: g, opp: a, my: bs, their: as });
  }));
  out.forEach(m => { m.res = m.my > m.their ? 'W' : m.my < m.their ? 'L' : 'D'; });
  return out;
}
/* the longest run of a result, kept as { n, from: { season, gw }, to: { season, gw } }; runs cross seasons */
function longestRun(ms, res) {
  let best = null, cur = 0, from = null;
  ms.forEach(m => {
    if (m.res === res) { if (!cur) from = { season: m.season, gw: m.gw }; cur++; if (!best || cur > best.n) best = { n: cur, from, to: { season: m.season, gw: m.gw } }; }
    else cur = 0;
  });
  return best;
}
/* this season's all-play record: a manager's score against every other finished score of the same gameweek */
function allPlayNow(cur, code) {
  const byGw = {};
  cur.fixtures.forEach(([g, a, as, bs, b]) => { (byGw[g] = byGw[g] || {})[a] = as; byGw[g][b] = bs; });
  let w = 0, l = 0, t = 0;
  Object.keys(byGw).forEach(g => {
    const row = byGw[g]; if (!(code in row)) return;
    Object.keys(row).forEach(o => { if (o === code) return; if (row[code] > row[o]) w++; else if (row[code] < row[o]) l++; else t++; });
  });
  return { w, l, t };
}

/* the model: { seasons, managers: { <code>: {...} }, rows: [managers ranked by league points], records } */
export function allTime() {
  if (M.at === LOADED_AT && M.v) return M.v;
  const cur = currentSeason();
  const seasons = hist().slice().sort((p, q) => String(p.season).localeCompare(String(q.season))).map(h => Object.assign({ complete: true, current: false }, h)).concat([cur]);
  const codes = new Set(); seasons.forEach(s => Object.keys(s.teams || {}).forEach(c => codes.add(c)));
  const nowTeam = {}; Object.keys(TEAMS).forEach(t => { nowTeam[codeOf(t)] = t; });
  const managers = {};
  codes.forEach(code => {
    const ms = matchesOf(seasons, code);
    const bySeason = seasons.map(s => {
      const st = (s.standings || []).find(x => x.mgr === code); if (!st) return null;
      return { season: s.season, team: s.teams[code], rank: st.rank, P: st.P, W: st.W, D: st.D, L: st.L, PF: st.PF, PA: st.PA, Pts: st.Pts, complete: !!s.complete, current: !!s.current, n: (s.standings || []).length, title: !!s.complete && st.rank === 1 };
    }).filter(Boolean);
    const sum = k => bySeason.reduce((a, s) => a + s[k], 0);
    const P = sum('P'), W = sum('W'), D = sum('D'), L = sum('L'), PF = sum('PF'), PA = sum('PA'), Pts = 3 * W + D;
    let hi = null, lo = null, bigWin = null, bigLoss = null;
    ms.forEach(m => {
      if (!hi || m.my > hi.v) hi = { v: m.my, season: m.season, gw: m.gw, opp: m.opp, their: m.their };
      if (!lo || m.my < lo.v) lo = { v: m.my, season: m.season, gw: m.gw, opp: m.opp, their: m.their };
      const d = m.my - m.their;
      if (d > 0 && (!bigWin || d > bigWin.m)) bigWin = { m: d, season: m.season, gw: m.gw, opp: m.opp, my: m.my, their: m.their };
      if (d < 0 && (!bigLoss || -d > bigLoss.m)) bigLoss = { m: -d, season: m.season, gw: m.gw, opp: m.opp, my: m.my, their: m.their };
    });
    const ap = { w: 0, l: 0, t: 0 };
    seasons.forEach(s => {
      if (s.current) { const a = allPlayNow(s, code); ap.w += a.w; ap.l += a.l; ap.t += a.t; }
      else if (s.allplay && s.allplay[code]) { ap.w += s.allplay[code].apW; ap.l += s.allplay[code].apL; ap.t += s.allplay[code].apT; }
    });
    const h2h = {};
    ms.forEach(m => { const r = h2h[m.opp] || (h2h[m.opp] = { w: 0, d: 0, l: 0, pf: 0, pa: 0 }); r[m.res.toLowerCase()]++; r.pf += m.my; r.pa += m.their; });
    const first = seasons.filter(s => !s.current && s.draft && s.draft[code] && s.draft[code].length).map(s => ({ season: s.season, pick: s.draft[code][0], star: s.allstar && s.allstar[code] ? s.allstar[code] : null }));
    managers[code] = {
      code, team: nowTeam[code] || null, current: !!nowTeam[code], lastTeam: bySeason.length ? bySeason[bySeason.length - 1].team : (nowTeam[code] || code),
      seasons: bySeason, played: bySeason.length, titles: bySeason.filter(s => s.title).length,
      P, W, D, L, Pts, PF, PA, ppm: P ? Pts / P : 0, winPct: P ? W / P : 0, avg: P ? PF / P : 0, avgAgainst: P ? PA / P : 0,
      hi, lo, bigWin, bigLoss, winRun: longestRun(ms, 'W'), lossRun: longestRun(ms, 'L'), allplay: ap, h2h, drafts: first, matches: ms,
    };
  });
  const rows = Object.values(managers).sort((p, q) => q.Pts - p.Pts || q.ppm - p.ppm || q.PF - p.PF || p.code.localeCompare(q.code));
  rows.forEach((r, i) => { r.rank = i + 1; });
  const top = (k, f) => { let b = null; rows.forEach(r => { const v = r[k]; if (!v) return; const x = f(v); if (b == null || x > b.x) b = { x, code: r.code, v }; }); return b; };
  const records = { hi: top('hi', v => v.v), bigWin: top('bigWin', v => v.m), winRun: top('winRun', v => v.n), lossRun: top('lossRun', v => v.n) };
  M.at = LOADED_AT; M.v = { seasons, managers, rows, records };
  return M.v;
}
export const managerOf = team => allTime().managers[codeOf(team)] || null;
/* the name a code goes by: the current team's first name, else the code */
export const nameOf = code => { const m = allTime().managers[code]; return m && m.team && typeof FIRSTOF === 'function' ? FIRSTOF(m.team) : code; };
export const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
export const f2 = v => (Math.round(v * 100) / 100).toFixed(2);
export const pct = v => Math.round(v * 100) + '%';
