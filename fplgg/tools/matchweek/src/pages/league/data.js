/* league/data.js: every number the League page shows, computed from the engine (core.js globals) and memoised.
   Render code never computes; it reads these. Nothing here touches the DOM. */
import * as UI from '../../ui.js';

/* ---------- memo: one store per data load (pages re-render from D on every refresh) ---------- */
const M = { at: -1, v: {} };
export function memo(key, fn) {
  if (M.at !== LOADED_AT) { M.at = LOADED_AT; M.v = {}; }
  return key in M.v ? M.v[key] : (M.v[key] = fn());
}
/* heavy results (the month's projections): after a refresh, render the previous load's value at once and let the
   page's mount recompute it straight after paint, so a refresh never stalls the frame. The first ever render computes. */
const STALE = {}, PEND = new Map();
export function heavy(key, fn) {
  if (M.at === LOADED_AT && key in M.v) return M.v[key];
  if (STALE[key]) { PEND.set(key, fn); return STALE[key]; }
  return (STALE[key] = memo(key, fn));
}
export const heavyPending = () => PEND.size > 0;
export function settleHeavy() { PEND.forEach((fn, key) => { STALE[key] = memo(key, fn); }); PEND.clear(); }

/* xiOf / benchOf / effXiOf (projected XI, autoSubs) are recomputed on every call inside the engine's luck, bench,
   golden-boot and projection helpers; within one synchronous pass D cannot change, so memoising them for the pass
   is exact and turns hundreds of milliseconds into a few. */
export function fastXi(fn) {
  if (fastXi.on) return fn();
  const o = { xiOf, benchOf, effXiOf }, m = new Map();
  const wrap = (name, f) => function (team, likely) { const k = name + '|' + team + '|' + (likely ? 1 : 0); if (!m.has(k)) m.set(k, f(team, likely)); return m.get(k); };
  xiOf = wrap('x', o.xiOf); benchOf = wrap('b', o.benchOf); effXiOf = wrap('e', o.effXiOf);
  fastXi.on = true;
  try { return fn(); } finally { xiOf = o.xiOf; benchOf = o.benchOf; effXiOf = o.effXiOf; fastXi.on = false; }
}
/* seeded standard normals, two per Box-Muller draw */
export function normals(seed) {
  const r = hpRng(seed); let spare = null;
  return () => {
    if (spare !== null) { const v = spare; spare = null; return v; }
    let u = 0, v = 0; while (!u) u = r(); v = r();
    const m = Math.sqrt(-2 * Math.log(u)), a = 2 * Math.PI * v;
    spare = m * Math.sin(a); return m * Math.cos(a);
  };
}

/* the pot from the league's config (league.json, ROADMAP C1): the engine's LEAGUE global carries it */
export const PAY = Object.assign({ first: 0, second: 0, third: 0, half: 0, motm: 0, buyin: 0 }, (typeof LEAGUE !== 'undefined' && LEAGUE.pot) || {});
export const POT = PAY.buyin * Object.keys(TEAMS).length;
export const FINAL = PAY.first + PAY.second + PAY.third;
export const ord = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
/* every amount of money, in the league's currency (LEAGUE.currency: GBP, USD or EUR, the commissioner's setting; GBP when it is missing).
   This table is the only place a currency symbol is typed (it agrees with CURRENCIES in data/config.js, tests/m2-currency.js). Whole
   numbers, en-GB digit grouping, a negative amount with the true minus before the symbol. */
export const SYMBOL = { GBP: '\u00a3', USD: '$', EUR: '\u20ac' };
export const money = v => {
  const code = typeof LEAGUE !== 'undefined' && LEAGUE && Object.prototype.hasOwnProperty.call(SYMBOL, LEAGUE.currency) ? LEAGUE.currency : 'GBP';
  const n = Math.round(v);
  return (n < 0 ? '\u2212' : '') + SYMBOL[code] + Math.abs(n).toLocaleString('en-GB');
};
/* true when the league pays a Manager of the Month prize; with none, no screen shows a prize, a multiple or a race for money */
export const hasMotm = () => PAY.motm > 0;
export const sgn = (v, d = 1) => { const r = +(Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); return r > 0 ? '+' + r.toFixed(d) : r < 0 ? '−' + Math.abs(r).toFixed(d) : (0).toFixed(d); };
export const teams = () => Object.keys(TEAMS);
export const perName = p => String(p[0]).replace(' & ', '-');
export const words = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'][n] || String(n);

/* ---------- the week ---------- */
export function wk() {
  return memo('wk', () => {
    const w = UI.week();
    const fxDone = g => { const fs = D.fx.filter(f => num(f.GW) === g); return fs.length > 0 && fs.every(f => fin(f.Finished)); };
    const maxGw = Math.max(38, ...D.fx.map(f => num(f.GW)));
    /* the table we show is "after" this gameweek: finished ones, plus the provisional one at full time */
    const basis = D.provOver ? D.gw : D.gwsDone;
    return { ...w, done: D.gwsDone, basis, maxGw, fxDone, live: w.mode === 'live', prov: w.mode === 'prov', locked: w.mode === 'locked' };
  });
}

/* the season is under way once a gameweek is in (finished, or at full time) */
export const begun = () => D.gwsDone > 0 || !!D.provOver;

/* ---------- standings ---------- */
export function table() {
  return memo('table', () => {
    const rows = (D.st || []).filter(s => TEAMS[s.Team]).map(s => ({
      team: s.Team, mgr: s.Manager || TEAMS[s.Team].mgr, w: num(s.W), d: num(s.D), l: num(s.L),
      pf: num(s['Pts For']), pa: num(s['Pts Against']), pts: num(s['League Pts']),
    }));
    teams().forEach(t => { if (!rows.some(r => r.team === t)) rows.push({ team: t, mgr: TEAMS[t].mgr, w: 0, d: 0, l: 0, pf: 0, pa: 0, pts: 0 }); });
    rows.sort((a, b) => b.pts - a.pts || b.pf - a.pf);
    rows.forEach((r, i) => { r.pos = i + 1; });
    return rows;
  });
}
/* the table after gameweek g, from finished fixtures only (3/1/0, points for breaks ties) */
export function tableAfter(g) {
  return memo('after|' + g, () => {
    const t = {}; teams().forEach(n => { t[n] = { pts: 0, pf: 0, w: 0, d: 0, l: 0 }; });
    D.fx.forEach(f => {
      if (num(f.GW) > g || !fin(f.Finished) || !t[f.Home] || !t[f.Away]) return;
      const h = num(f['Home pts']), a = num(f['Away pts']);
      t[f.Home].pf += h; t[f.Away].pf += a;
      if (h > a) { t[f.Home].pts += 3; t[f.Home].w++; t[f.Away].l++; }
      else if (a > h) { t[f.Away].pts += 3; t[f.Away].w++; t[f.Home].l++; }
      else { t[f.Home].pts++; t[f.Away].pts++; t[f.Home].d++; t[f.Away].d++; }
    });
    const order = teams().sort((p, q) => t[q].pts - t[p].pts || t[q].pf - t[p].pf);
    const pos = {}; order.forEach((n, i) => { pos[n] = i + 1; });
    return { t, order, pos };
  });
}
/* places moved since the previous gameweek's table (null when there is no previous table) */
export function movement() {
  return memo('move', () => {
    const { basis } = wk(), prev = basis - 1, out = {};
    if (prev < 1) return null;
    const p = tableAfter(prev).pos;
    table().forEach(r => { out[r.team] = p[r.team] - r.pos; });
    return { prev, by: out };
  });
}
/* one headline about the shape of the table */
export function tableSummary() {
  return memo('tsum', () => {
    const r = table(), lead = r[0].pts, d = lead - r[1].pts;
    if (!r.some(x => x.pts > 0 || x.pf > 0)) return { big: 'All square', sub: 'every team on 0 points' };
    if (d > 3) return { big: UI.short(r[0].team) + ' clear', sub: words(d) + ' points ahead of ' + UI.short(r[1].team) };
    for (let g = 0; g <= 3; g++) {
      const k = r.filter(x => lead - x.pts <= g).length;
      if (k < 3) continue;
      if (g === 0) return { big: k + ' level on ' + lead, sub: 'points for splits them' };
      return { big: k + ' teams on ' + (lead - g) + '+', sub: (g === 1 ? 'one point covers' : words(g) + ' points cover') + ' 1st to ' + ord(k) };
    }
    if (d === 0) return { big: 'Top two level', sub: 'points for puts ' + UI.short(r[0].team) + ' first' };
    return { big: UI.short(r[0].team) + ' lead by ' + d, sub: UI.short(r[1].team) + ' the only team within a win' };
  });
}

/* ---------- title odds: the engine's simulate(), held still during games ----------
   simulate() takes ~0.5 s and, mid-gameweek, folds live scores into its seed and means. Title chance is a full-time
   number, so: before a ball is kicked and at full time it is simulate() itself; while games are live it is
   simulate() run on this week as not yet played (no live points, no kickoffs). Cached until a result changes. */
export const oddsReady = () => UI.oddsReady();
/* the odds, already settled at the source (UI.warmOdds and simulate()): 0 and 100 only where the table proves them */
export const odds = () => memo('odds', () => UI.titleOdds());
/* the team the wooden spoon market is about: league.json "spoon", else Baha's (the market El Matador has always run), else the last team of the league */
export function spoonTeam() { const ts = Object.keys(TEAMS); return typeof LEAGUE !== 'undefined' && LEAGUE.spoon in TEAMS ? LEAGUE.spoon : ts.find(t => FIRSTOF(t) === 'Baha') || ts[ts.length - 1]; }

/* a Manager of the Month win chance (0 to 1) as text: 0% and 100% only for a decided month, ">99%" and "<1%" for an open one */
export const winTxt = w => w >= 0.995 && w < 1 ? '>99%' : w > 0 && w < 0.005 ? '<1%' : Math.round(w * 100) + '%';

/* ---------- Manager of the Month ---------- */
export const curPeriodIdx = () => { const i = PERIODS.findIndex(p => D.gw >= p[1] && D.gw <= p[2]); return i < 0 ? PERIODS.length - 1 : i; };
function seedOf(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
/* a team's points in a gameweek of a month: its fixture's, or its bye score when the league is odd and it sits the week out
   (the XI it started, which the engine holds as real data: byeScore). A week with no fixtures at all has no scores yet. */
const hasFx = g => D.fx.some(x => num(x.GW) === g);
/* a finished period's totals (finished fixtures and byes only), or a running one's banked points (+ the live week, scored like the scoreboard) */
export function periodTotals(p) {
  const t = {}; teams().forEach(n => { t[n] = 0; });
  D.fx.forEach(f => {
    const g = num(f.GW); if (g < p[1] || g > p[2]) return;
    if (fin(f.Finished)) { t[f.Home] += num(f['Home pts']); t[f.Away] += num(f['Away pts']); return; }
    if (g === D.gw && D.dlPassed) { t[f.Home] += effPtsOf(f, f.Home); t[f.Away] += effPtsOf(f, f.Away); }
  });
  const { fxDone } = wk();
  for (let g = p[1]; g <= p[2]; g++) {
    if (!hasFx(g) || !(fxDone(g) || (g === D.gw && D.dlPassed))) continue;
    teams().forEach(n => { if (!D.fx.some(x => num(x.GW) === g && (x.Home === n || x.Away === n))) t[n] += byeScore(n, g, g === D.gw && D.dlPassed && !fxDone(g)) || 0; });
  }
  return t;
}
export function periodState(p) {
  const { fxDone } = wk();
  let done = 0; for (let g = p[1]; g <= p[2]; g++) if (fxDone(g)) done++;
  const n = p[2] - p[1] + 1;
  return { n, done, complete: done === n, started: done > 0 || (D.gw >= p[1] && D.gw <= p[2] && D.dlPassed), future: D.gw < p[1] };
}
export function motm() {
  return heavy('motm', () => fastXi(() => {
    const idx = curPeriodIdx(), per = PERIODS[idx], [name, a, b] = per, { fxDone } = wk();
    const gws = [];
    for (let g = a; g <= b; g++) {
      let st = 'next';
      if (fxDone(g)) st = 'done';
      else if (g === D.gw && D.provOver) st = 'prov';
      else if (g === D.gw && UI.week().mode === 'live') st = 'live';
      gws.push({ g, st });
    }
    const rows = teams().map(t => {
      let banked = 0, mu = 0, v = 0;
      for (let g = a; g <= b; g++) {
        const f = D.fx.find(x => num(x.GW) === g && (x.Home === t || x.Away === t));
        /* a team with no fixture in a week that has fixtures is on a bye (an odd league): it still scores, so its bye score counts
           as banked in a finished or live week and its Proj stands in for a week still to come */
        if (!f && !hasFx(g)) continue;
        if (f ? fin(f.Finished) : fxDone(g)) { banked += f ? num(f.Home === t ? f['Home pts'] : f['Away pts']) : byeScore(t, g, false) || 0; continue; }
        if (g === D.gw && D.dlPassed) {
          /* the live week is the matchup's own Proj final (hpTeam): what is still to come is that less the score the scoreboard counts */
          const sc = f ? effPtsOf(f, t) : byeScore(t, g, true) || 0, sd = hpTeamSd(t, g);
          banked += sc; mu += Math.max(0, hpTeam(t, g) - sc); v += sd * sd; continue;
        }
        const m = hpTeam(t, g), sd = hpTeamSd(t, g); mu += m; v += sd * sd;
      }
      const sd = Math.sqrt(v), proj = banked + mu;
      return { t, banked, mu, sd, proj, lo: Math.max(banked, proj - 1.2816 * sd), hi: proj + 1.2816 * sd, win: 0 };
    });
    /* WHO WINS THE MONTH (the method; How it works says it again in words). A team's month is the points it has banked plus
       what is still to come: the banked part is fixed, the rest is a normal draw (mean mu, spread sd, never below 0, since a
       gameweek cannot take points away). 20,000 seeded runs; the team with the most points in a run takes it, and its
       share of the runs is its win chance. When nothing is left to play (every spread 0) the month is decided: the top
       banked score wins, and teams level on it share the month evenly (two level teams are 50% each). With 20,000 runs a
       figure of p is good to about 3 x sqrt(p(1-p)/20000), at most 1.1 points. A figure of 0 or 100 shows only for a decided month. */
    const N = 20000, wins = Object.create(null); rows.forEach(r => { wins[r.t] = 0; });
    if (rows.every(r => r.sd < 1e-6)) {
      const top = Math.max(...rows.map(r => r.banked)), w = rows.filter(r => r.banked === top);
      w.forEach(r => { wins[r.t] = N / w.length; });
    } else {
      const z = normals(seedOf(name + '|' + rows.map(r => r.t + r.banked + r.mu.toFixed(2) + r.sd.toFixed(2)).join('|')));
      const k = rows.length, bk = rows.map(r => r.banked), mu = rows.map(r => r.mu), sd = rows.map(r => r.sd), cnt = new Array(k).fill(0);
      for (let i = 0; i < N; i++) {
        let best = 0, bv = -1e9;
        for (let j = 0; j < k; j++) { const s = bk[j] + Math.max(0, mu[j] + sd[j] * z()); if (s > bv) { bv = s; best = j; } }
        cnt[best]++;
      }
      /* 0 and 100 are shown only when the month is decided: a team no run gave the month is half a run, taken from the leader's runs */
      const top = cnt.indexOf(Math.max(...cnt));
      cnt.forEach((c, j) => { if (c < 0.5) { cnt[top] -= 0.5 - c; cnt[j] = 0.5; } });
      rows.forEach((r, j) => { wins[r.t] = cnt[j]; });
    }
    rows.forEach(r => { r.win = wins[r.t] / N; });
    /* the race (Parker, 10 Oct 2026): real points first (the month so far, the live gameweek as it stands), the
       projection breaks ties; before the month has a point, the projection orders it */
    if (rows.some(r => r.banked > 0)) rows.sort((p, q) => q.banked - p.banked || q.proj - p.proj);
    else rows.sort((p, q) => q.proj - p.proj || q.banked - p.banked);
    const st = periodState(per);
    /* last finished period's winner */
    let last = null;
    for (let i = idx - 1; i >= 0; i--) {
      const p = PERIODS[i]; if (!periodState(p).complete) continue;
      const tt = periodTotals(p), top = Math.max(...Object.values(tt));
      last = { per: p, pts: top, who: teams().filter(t => tt[t] === top) }; break;
    }
    const firstKo = koOf(a, 'first'), lastKo = koOf(b, 'last');
    return { idx, per, name, a, b, gws, rows, st, last, firstKo, lastKo, anyBanked: rows.some(r => r.banked > 0) };
  }));
}
/* first or last kickoff of a gameweek (Club Fixtures), falling back to the deadline */
export function koOf(g, which) {
  const ks = (D.cf || []).filter(x => num(x.GW) === g).map(x => dt(x['Kickoff (UTC)'])).filter(Boolean).sort((p, q) => p - q);
  if (ks.length) return which === 'last' ? ks[ks.length - 1] : ks[0];
  return gwDeadline(g);
}
/* "Saturday" within the week, otherwise "Sat 10 Oct" */
export function dayWord(d) {
  if (!d) return '';
  const days = (d.getTime() - Date.now()) / 864e5;
  if (days > -0.5 && days < 6) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
export const dayMonth = d => d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';

/* ---------- the prize pool ---------- */
export function payouts() {
  return memo('pay', () => {
    /* a league with no Manager of the Month prize has no such payout: no stop, no amount of 0 */
    const list = hasMotm() ? PERIODS.map(p => ({ gw: p[2], amt: PAY.motm, kind: 'motm', per: p })) : [];
    list.push({ gw: 19, amt: PAY.half, kind: 'half' });
    list.push({ gw: 38, amt: FINAL, kind: 'final' });
    const done = D.gwsDone;
    const paid = list.filter(x => x.gw <= done && (x.kind !== 'motm' || periodState(x.per).complete)).reduce((s, x) => s + x.amt, 0);
    const byGw = {}; list.forEach(x => { (byGw[x.gw] = byGw[x.gw] || []).push(x); });
    const stops = Object.keys(byGw).map(Number).sort((p, q) => p - q).map(g => ({ gw: g, items: byGw[g], amt: byGw[g].reduce((s, x) => s + x.amt, 0), paid: g <= done }));
    const next = stops.find(s => !s.paid) || null;
    return { list, stops, paid, left: POT - paid, next };
  });
}
/* the halfway prize: the leader after GW19 (decided), or whoever leads now */
export function halfway() {
  return memo('half', () => {
    if (D.gwsDone >= 19) { const a = tableAfter(19); return { decided: true, team: a.order[0], pts: a.t[a.order[0]].pts }; }
    const r = table(); return { decided: false, team: r[0].team, second: r[1] && r[1].team, gap: r[1] ? r[0].pts - r[1].pts : 0, pfgap: r[1] ? r[0].pf - r[1].pf : 0, togo: 19 - D.gwsDone };
  });
}

/* ---------- results ---------- */
/* gameweeks with scores: every finished one, plus the current one once it is under way */
export function resultGws() {
  return memo('rgws', () => {
    const out = [];
    for (let g = 1; g <= D.gw; g++) {
      const fs = D.fx.filter(f => num(f.GW) === g); if (!fs.length) continue;
      if (fs.every(f => fin(f.Finished))) out.push({ g, live: false });
      else if (g === D.gw && (UI.week().mode === 'live' || D.provOver)) out.push({ g, live: true, prov: !!D.provOver });
    }
    return out;
  });
}
export function scoreOf(f) {
  const done = fin(f.Finished);
  const h = done ? num(f['Home pts']) : effPtsOf(f, f.Home), a = done ? num(f['Away pts']) : effPtsOf(f, f.Away);
  return { h, a, done };
}
export function grid() {
  return memo('grid', () => {
    const gws = resultGws(), cell = {}, top = {}, bot = {};
    gws.forEach(({ g, live }) => {
      D.fx.filter(f => num(f.GW) === g).forEach(f => {
        const { h, a } = scoreOf(f);
        cell[f.Home + '|' + g] = { p: h, r: h > a ? 'w' : h < a ? 'l' : 'd', live, opp: f.Away, op: a };
        cell[f.Away + '|' + g] = { p: a, r: a > h ? 'w' : a < h ? 'l' : 'd', live, opp: f.Home, op: h };
      });
      if (!live) { const v = teams().map(t => (cell[t + '|' + g] || {}).p).filter(x => x != null); top[g] = Math.max(...v); bot[g] = Math.min(...v); }
    });
    return { gws, cell, top, bot };
  });
}
/* records across finished fixtures: every holder of a shared record is listed */
export function records() {
  return memo('recs', () => {
    let hi = null, lo = null, big = null, close = null;
    const add = (cur, v, who, better) => { if (!cur || better(v, cur.v)) return { v, who: [who] }; if (v === cur.v) cur.who.push(who); return cur; };
    D.fx.forEach(f => {
      if (!fin(f.Finished)) return;
      const g = num(f.GW), h = num(f['Home pts']), a = num(f['Away pts']);
      hi = add(hi, h, { t: f.Home, g }, (x, y) => x > y); hi = add(hi, a, { t: f.Away, g }, (x, y) => x > y);
      lo = add(lo, h, { t: f.Home, g }, (x, y) => x < y); lo = add(lo, a, { t: f.Away, g }, (x, y) => x < y);
      if (h !== a) {
        const w = h > a ? { t: f.Home, g, o: f.Away, s: h, os: a } : { t: f.Away, g, o: f.Home, s: a, os: h }, m = Math.abs(h - a);
        big = add(big, m, w, (x, y) => x > y); close = add(close, m, w, (x, y) => x < y);
      }
    });
    return { hi, lo, big, close };
  });
}

/* hpWin for a fixture, memoised per data load */
export function winOf(f) { return memo('win|' + num(f.GW) + f.Home + f.Away, () => fastXi(() => hpWin(f))); }

/* ---------- derbies ---------- */
export function derbies() {
  return memo('derbies|' + (myTeam() || ''), () => { buildH2H(); return derbyRows().map(r => {
    const meet = D.fx.filter(f => (f.Home === r.a && f.Away === r.b) || (f.Home === r.b && f.Away === r.a)).sort((p, q) => num(p.GW) - num(q.GW));
    const played = meet.filter(f => fin(f.Finished));
    let big = null;
    played.forEach(f => {
      const h = num(f['Home pts']), a = num(f['Away pts']); if (h === a) return;
      const m = Math.abs(h - a); if (!big || m > big.m) big = { m, g: num(f.GW), w: h > a ? f.Home : f.Away, ws: Math.max(h, a), ls: Math.min(h, a) };
    });
    /* all-time series record, a's wins first: SEED (past seasons) + this season's finished meetings */
    const x = TEAMS[r.a].ini, y = TEAMS[r.b].ini, k = [x, y].sort().join('|'), sd = SEED[k] || [0, 0, 0];
    let aw = (k.split('|')[0] === x ? sd[0] : sd[1]), bw = (k.split('|')[0] === x ? sd[1] : sd[0]), dr = sd[2];
    played.forEach(f => { const h = num(f['Home pts']), a = num(f['Away pts']); if (h === a) dr++; else if ((h > a ? f.Home : f.Away) === r.a) aw++; else bw++; });
    const fxIdx = r.thisGw ? D.fx.filter(f => num(f.GW) === D.gw).indexOf(r.thisGw) : -1;
    return { ...r, meet, playedFx: played, big, aw, bw, dr, fxIdx };
  }); });
}

/* ---------- stats ---------- */
export function lab() {
  return memo('lab', () => fastXi(() => {
    const luck = luckAgg(), sched = schedLuck(), xm = xiPtsMap();
    const ser = {}, bench = {};
    teams().forEach(t => { ser[t] = mgrSeries(t); bench[t] = benchByGw(t); });
    return { luck, sched, xm, ser, bench };
  }));
}
export function metricSeries(t, metric) {
  const L = lab(), ms = L.ser[t] || [];
  switch (metric) {
    case 'pts': return ms.map(m => ({ g: m.gw, v: m.pts, live: m.live }));
    case 'pa': return ms.map(m => ({ g: m.gw, v: m.pa, live: m.live }));
    case 'margin': return ms.map(m => ({ g: m.gw, v: m.margin, live: m.live }));
    case 'race': { let s = 0; return ms.map(m => ({ g: m.gw, v: (s += m.pts > m.pa ? 3 : m.pts === m.pa ? 1 : 0), live: m.live })); }
    case 'luck': { const a = (L.luck[t] || { gws: {} }).gws, lv = {}; ms.forEach(m => { lv[m.gw] = m.live; });
      return Object.keys(a).map(g => ({ g: num(g), v: a[g].act - a[g].x, live: !!lv[num(g)] })).sort((p, q) => p.g - q.g); }
    case 'bench': { const b = L.bench[t] || {}, lv = {}; ms.forEach(m => { lv[m.gw] = m.live; });
      return Object.keys(b).map(g => ({ g: num(g), v: b[g], live: !!lv[num(g)] })).sort((p, q) => p.g - q.g); }
  }
  return [];
}
/* the old Lab tiles: average per game played, best finished gameweek, W-D-L, star man (started points only) */
export function tiles() {
  return memo('tiles', () => {
    const { xm } = lab(), xiP = p => ((xm[String(p.Code)] || {}).xi || 0);
    return table().map(r => {
      const t = r.team;
      const sq = squadOf(t).slice().sort((a, b) => xiP(b) - xiP(a) || ovrOf(b) - ovrOf(a));
      /* the average is points for per game played, counted the way the table counts: finished games only, so the
         denominator is the games counted (g) and a live gameweek is not in it until it is finished */
      let g = 0, pf = 0, best = 0;
      D.fx.forEach(f => {
        if (!fin(f.Finished) || (f.Home !== t && f.Away !== t)) return;
        const pt = num(f.Home === t ? f['Home pts'] : f['Away pts']);
        g++; pf += pt;
        if (pt > best) best = pt;
      });
      return { ...r, games: g, avg: g ? pf / g : null, best: best || null, star: sq[0] || null, starPts: sq[0] ? xiP(sq[0]) : 0 };
    });
  });
}
/* goldenBoot(): started points only, the top eight */
export function boot() {
  return memo('boot', () => {
    const { xm } = lab();
    return Object.keys(xm).map(k => ({ code: k, ...xm[k] })).filter(p => p.owner && TEAMS[p.owner] && p.xi > 0).sort((a, b) => b.xi - a.xi).slice(0, 8);
  });
}
/* season records that belong to the managers rather than the scoreboard */
export function labRecords() {
  return memo('labrecs', () => {
    const { xm, bench } = lab(), done = D.gwsDone;
    let haul = null, ben = null, run = null, loss = null;
    const add = (cur, v, who) => { if (!cur || v > cur.v) return { v, who: [who] }; if (v === cur.v) cur.who.push(who); return cur; };
    Object.keys(xm).forEach(k => { const p = xm[k]; if (!p.owner || !TEAMS[p.owner]) return;
      Object.keys(p.byGw || {}).forEach(g => { g = num(g); if (g > done) return; const v = p.byGw[g]; if (v > 0) haul = add(haul, v, { code: k, name: p.name, t: p.owner, g }); }); });
    teams().forEach(t => {
      Object.keys(bench[t] || {}).forEach(g => { g = num(g); if (g > done) return; const v = bench[t][g]; if (v > 0) ben = add(ben, v, { t, g }); });
      let cur = 0, from = 0;
      D.fx.filter(f => fin(f.Finished) && (f.Home === t || f.Away === t)).sort((p, q) => num(p.GW) - num(q.GW)).forEach(f => {
        const me = num(f.Home === t ? f['Home pts'] : f['Away pts']), op = num(f.Home === t ? f['Away pts'] : f['Home pts']), g = num(f.GW);
        if (me > op) { if (!cur) from = g; cur++; if (cur > 1) run = add(run, cur, { t, from, to: g }); } else cur = 0;
        if (me < op) loss = add(loss, me, { t, g, o: f.Home === t ? f.Away : f.Home, op });
      });
    });
    return { haul, ben, run, loss };
  });
}
