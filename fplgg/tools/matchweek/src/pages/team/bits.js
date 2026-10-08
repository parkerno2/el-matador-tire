/* My team: small shared pieces (memo, team colour maths, chips, per-player series). Engine globals come from core.js. */
import * as UI from '../../ui.js';

export const esc = UI.esc;
export const BASE = '#0E0A13'; /* the --base token as a hex, for mixing team colours into the dark ground */

/* ---------- memo: one cache per data load (and per week state, so test toggles and state flips never serve stale numbers) ---------- */
let MEMO = {}, MKEY = null;
export function memo(k, fn) {
  const key = LOADED_AT + '|' + D.gw + '|' + D.dlPassed + '|' + D.provOver + '|' + D.liveNow + '|' + D.gwsDone;
  if (key !== MKEY) { MKEY = key; MEMO = {}; }
  return k in MEMO ? MEMO[k] : (MEMO[k] = fn());
}
export function safe(fn, dflt) { try { const v = fn(); return v === undefined ? dflt : v; } catch (e) { console.error(e); return dflt; } }

/* ---------- title odds: simulate() is ~0.5 s, so it runs once per set of results (it moves at full time, not mid-game) ---------- */
let SIM = null, SIMK = null;
function simKey() {
  return D.gw + '|' + (D.provOver ? 1 : 0) + '|' + (D.fx || []).filter(f => fin(f.Finished)).map(f => num(f.GW) + f.Home + num(f['Home pts']) + '-' + num(f['Away pts'])).join(';');
}
export function simCached() { return UI.oddsReady() ? UI.titleOdds() : null; }
export function simRun() { return UI.titleOdds(); }

/* ---------- colour maths for the club frame ---------- */
const hx = h => { const v = parseInt(String(h).slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
export const mix = (a, b, t) => { const A = hx(a), B = hx(b); return '#' + A.map((x, i) => Math.round(x * t + B[i] * (1 - t)).toString(16).padStart(2, '0')).join(''); };
export const rgba = (h, a) => { const [r, g, b] = hx(h); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; };
export function frame(team) {
  const c = UI.teamColors(team);
  return {
    c,
    vars: '--tc-deep:' + c.deep + ';--tc-acc:' + c.accent + ';--tc-light:' + c.light + ';--tc-soft:' + mix(c.light, '#ffffff', .55)
      + ';--tc-line:' + rgba(c.light, .18) + ';--tc-line2:' + rgba(c.light, .13),
    head: 'linear-gradient(180deg,' + c.deep + ' 0%,' + mix(c.deep, BASE, .52) + ' 48%,var(--base) 100%)',
    headS: 'linear-gradient(180deg,' + c.deep + ' 0%,' + mix(c.deep, BASE, .4) + ' 60%,var(--base) 100%)',
    s1: mix(c.deep, BASE, .27), s2: mix(c.deep, BASE, .34), mark: rgba(c.light, .17), edge: rgba(c.light, .2),
  };
}

/* ---------- words and numbers ---------- */
export const ord = n => ORD(n);
export const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
export const sgn = (v, d = 1) => { const r = Math.round(v * Math.pow(10, d)) / Math.pow(10, d); return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(d); };
const NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
export const words = n => NUMW[n] || String(n);
export const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
export const mgrName = t => ((PROFILE && PROFILE[t] && PROFILE[t].manager) || (TEAMS[t] || {}).mgr || '');
export const POSN = { GKP: 'GK', DEF: 'DEF', MID: 'MID', FWD: 'FWD' };
export const POSW = { GKP: 'goalkeeper', DEF: 'defender', MID: 'midfielder', FWD: 'forward' };
export const chev = '<span class="tm-ch" aria-hidden="true">›</span>';
export function dlText(d) { /* "in 11h", "in 2d", "in 3h 20m" */
  const u = UI.untilText(d); return u === 'now' ? 'now' : 'in ' + u.toLowerCase();
}
export const dayTime = d => UI.dayHm(d);
export const dayDate = d => UI.day(d);

/* ---------- players ---------- */
export const plrRow = code => memo('plrmap', () => { const m = {}; (D.plr || []).forEach(r => { m[String(r.Code)] = r; }); return m; })[String(code)] || null;
export function apps(code) { /* gameweeks with minutes: the "per game" denominator (production's plrAvg since v12) */
  return memo('apps', () => { const m = {}; Object.values(D.gwsByGw || {}).forEach(g => Object.entries(g || {}).forEach(([c, r]) => { if (r && num(r.Mins) > 0) m[c] = (m[c] || 0) + 1; })); return m; })[String(code)] || 0;
}
export const seasonPts = p => TEAMS[p.Team] ? seasonTot(p) : num(p['Season pts']);
export const ppg = p => { const a = apps(p.Code); return a ? seasonPts(p) / a : 0; };
export const seasonMins = p => { const r = plrRow(p.Code); return r ? num(r.Mins) : Object.values(D.gwsByGw || {}).reduce((s, g) => s + num(((g || {})[String(p.Code)] || {}).Mins), 0); };
export function flaggedOutP(p) { return flaggedOut(p); }
/* FPL's stated chance of playing for a doubt, or null when the news gives no percentage */
export function chanceOf(p) { const m = String((p && p.News) || '').match(/(\d+)% chance/); return m ? +m[1] : null; }
export const chanceTxt = p => { const c = chanceOf(p); return c === null ? 'doubtful' : c + '%'; };
/* the last n gameweeks a player could have scored in (the live one once his club has kicked off) */
export function lastN(p, n = 5) {
  const code = String(p.Code), out = [];
  const top = fxStarted(p.Club) ? D.gw : D.gw - 1;
  for (let g = top; g >= 1 && out.length < n; g--) {
    const r = (D.gwsByGw[g] || {})[code];
    out.unshift({ g, pts: r ? num(r.Pts) : null, mins: r ? num(r.Mins) : 0, live: g === D.gw && !fxFinished(p.Club) });
  }
  return out;
}
export const lastSum = p => lastN(p, 5).reduce((s, x) => s + (x.mins > 0 ? x.pts : 0), 0);
/* points chip in the purple scale (player sheet look): 10+ light, 6+ purple, 4+ deep purple, less = flat */
export function pc(x, sm) {
  if (x.pts === null || !(x.mins > 0)) return '<span class="tm-pc dnp' + (sm ? ' sm' : '') + '" title="GW' + x.g + ': did not play">–</span>';
  const v = x.pts, k = v >= 10 ? 'c4' : v >= 6 ? 'c3' : v >= 3 ? 'c2' : 'c1'; /* the player sheet's scale */
  return '<span class="tm-pc ' + k + (x.live ? ' live' : '') + (sm ? ' sm' : '') + '" title="GW' + x.g + ': ' + v + ' pts' + (x.live ? ', live' : '') + '">' + v + '</span>';
}
export function chips(p, n = 5, sm) { const l = lastN(p, n); return l.length ? '<span class="tm-pcs">' + l.map(x => pc(x, sm)).join('') + '</span>' : ''; }

/* ---------- fixtures ---------- */
export const fdK = n => n <= 2 ? 'e' : n === 3 ? 'n' : n === 4 ? 'h' : 'x';
export function oppChip(club, f, opt = {}) {
  const home = f.Home === club, opp = home ? f.Away : f.Home, n = fdrOf(club, f);
  return '<span class="tm-fd fd-' + fdK(n) + (opt.cls ? ' ' + opt.cls : '') + '" title="' + esc(clubName(opp)) + ' (' + (home ? 'H' : 'A') + '), ' + FDRLAB[n].toLowerCase() + '"><b>' + esc(opp) + '</b><i>' + (home ? 'H' : 'A') + '</i></span>';
}
/* a player's fixture this gameweek as a short state: upcoming (difficulty chip), live score, or full-time score */
export function gwFix(p) {
  const fs = (D.cf || []).filter(x => num(x.GW) === D.gw && (x.Home === p.Club || x.Away === p.Club));
  if (!fs.length) return { blank: true };
  const f = fs[0], home = f.Home === p.Club, opp = home ? f.Away : f.Home;
  const started = fin(f.Started) || fin(f.Finished), done = fin(f.Finished);
  const hg = num(f['Home goals']), ag = num(f['Away goals']);
  return { f, fs, home, opp, started, done, sc: started ? (home ? hg + '–' + ag : ag + '–' + hg) : '', min: num(f.Mins), dbl: fs.length > 1 };
}

/* ---------- league ---------- */
export function record(team) { return mpxRecord(team) || { w: 0, d: 0, l: 0, pos: 0, played: 0 }; }
export const stRow = team => (D.st || []).find(s => s.Team === team) || {};
export function curFx(team) { return (D.fx || []).find(f => num(f.GW) === D.gw && (f.Home === team || f.Away === team)) || null; }
/* engine reads, once per data load (autoSubs is uncached in the engine and luckAgg/teamResults call it hundreds of times) */
export const asOf = (team, likely = true) => memo('as|' + team + '|' + (likely ? 1 : 0), () => autoSubs(team, likely));
/* luckAgg() line for line, with each owner's effective XI looked up once instead of one autoSubs() per stats row */
export const luck = () => memo('luck', () => {
  const out = {}, logXI = {}, logGws = new Set(), eff = {};
  const inEff = (t, c) => { if (!eff[t]) eff[t] = new Set(asOf(t, false).xi.map(p => String(p.Code))); return eff[t].has(String(c)); };
  (D.gl || []).forEach(r => { const g2 = num(r.GW); logGws.add(g2); if (r.Started === 'XI') logXI[g2 + '|' + String(r.Code) + '|' + r.Team] = 1; });
  Object.keys(D.gwsByGw || {}).forEach(g => {
    const isCur = num(g) === D.gw;
    Object.keys(D.gwsByGw[g]).forEach(code => {
      const r = D.gwsByGw[g][code]; if (!r.Owner) return;
      if (isCur) { if (!inEff(r.Owner, code)) return; }
      else if (logGws.has(num(g)) && !logXI[num(g) + '|' + String(code) + '|' + r.Owner]) return;
      const t = out[r.Owner] = out[r.Owner] || { act: 0, x: 0, gws: {} };
      const a = r.Pts - r.Bonus, x = xpOf(r);
      t.act += a; t.x += x; t.bon = (t.bon || 0) + num(r.Bonus);
      const gg = t.gws[g] = t.gws[g] || { act: 0, x: 0 }; gg.act += a; gg.x += x;
    });
  });
  return out;
});
export const sched = () => memo('sched', () => schedLuck());
export const projOfTeam = team => memo('tp|' + team, () => teamProj(team));
export const posAt = g => memo('pos|' + g, () => posAfter(g));
/* teamResults() line for line, minus its xP column (the Season chart reads luck() itself) and with posAfter memoised */
export function results(team) {
  return memo('res|' + team, () => {
    return resFixtures(team).map(f => {
      const g = num(f.GW), home = f.Home === team, opp = home ? f.Away : f.Home;
      const my = effPtsOf(f, team), their = effPtsOf(f, opp), live = !fin(f.Finished);
      const res = my > their ? 'W' : my < their ? 'L' : 'D';
      return { g, f, home, opp, my, their, live, res, pos: posAt(g)[team], nm: derbyName(f.Home, f.Away) };
    });
  });
}

/* ---------- the Plate card's SVG gradients: the page template lacks them, so My team carries them until it does ---------- */
const DEFS = '<svg class="tm-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>'
  + '<linearGradient id="gGold" x1="0" y1="0" x2="0.32" y2="1"><stop offset="0" stop-color="#FBE9A6"/><stop offset=".3" stop-color="#EFCB68"/><stop offset=".72" stop-color="#D2A73F"/><stop offset="1" stop-color="#B8892B"/></linearGradient>'
  + '<linearGradient id="gSilver" x1="0" y1="0" x2="0.32" y2="1"><stop offset="0" stop-color="#FAFBFD"/><stop offset=".35" stop-color="#DCDFE6"/><stop offset=".8" stop-color="#ACB2C0"/><stop offset="1" stop-color="#979DAD"/></linearGradient>'
  + '<linearGradient id="gSpec" x1="0" y1="0" x2="0.28" y2="1"><stop offset="0" stop-color="#7E3190"/><stop offset=".42" stop-color="#37003C"/><stop offset="1" stop-color="#2E5BFF"/></linearGradient>'
  + '<linearGradient id="gElite" x1="0" y1="0" x2="0.28" y2="1"><stop offset="0" stop-color="#2A5AC2"/><stop offset=".45" stop-color="#0B3E9E"/><stop offset="1" stop-color="#0E63D6"/></linearGradient>'
  + '<linearGradient id="gTotw" x1="0" y1="0" x2="0.28" y2="1"><stop offset="0" stop-color="#3E3E4A"/><stop offset=".5" stop-color="#141419"/><stop offset="1" stop-color="#2B2416"/></linearGradient>'
  + '<linearGradient id="gPotm" x1="0" y1="0" x2="0.28" y2="1"><stop offset="0" stop-color="#8E2C55"/><stop offset=".5" stop-color="#6E1239"/><stop offset="1" stop-color="#B03A6A"/></linearGradient>'
  + '</defs></svg>';
export function plateDefs() {
  const g = typeof document !== 'undefined' && document.getElementById('gGold');
  return g && !g.closest('#app') ? '' : DEFS;
}
/* a Plate card with the predicted auto-sub treatment (SUB / LIKELY / OUT tags come from the engine's SUBMARK) */
/* a Plate with the auto-sub marks set for the render; mini is the small Plate (UI.plateMini: no overall, the number as text) */
export function plateMarked(p, w, marks, mini) {
  const keep = SUBMARK;
  try { SUBMARK = marks || {}; return mini ? UI.plateMini(p, w) : UI.plate(p, w); } finally { SUBMARK = keep; }
}
export function subMarks(as) {
  const m = {};
  (as.subs || []).forEach(s => { const l = s.kind === 'likely' ? 'l' : ''; m[s.inn.Code] = 'in' + l; m[s.out.Code] = 'out' + l; });
  return m;
}
