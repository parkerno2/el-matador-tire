/* matchday/model.js — the numbers behind every Matchday screen, read from the engine (core.js) and memoised per data load.
   Nothing here invents a figure: scores are mscore(), win chance is hpWin() rounded once by mpxWinPct(), projections are
   teamProj()/projOf()/hpLive(), xP is teamXP()/teamXPBlend() for teams and xpOf() per player (0 for a player with 0 minutes),
   auto-subs are autoSubs(), the series is series() after buildH2H(). */
import * as UI from '../../ui.js';

/* ---------- speed: autoSubs is a pure function of the loaded data, but the engine recomputes it on every call
   (hpWin alone asks for it ~8 times). Production (v12-look) memoised it per data load; core.gen.js lost that wrapper
   with the old UI, so it is restored here, transparently: same results, copies handed out, cache keyed on the data. ---------- */
(function memoAutoSubs() {
  if (typeof autoSubs !== 'function' || autoSubs.__mdMemo) return;
  const base = autoSubs;
  let key = null, cache = new Map();
  const wrapped = function (team, likely) {
    const k = [D.ro, D.gwsByGw, D.cf, D.fx, D.gw, D.dlPassed, D.provOver, D.pbonus, D.predCur, D.gl];
    if (!key || k.some((v, i) => v !== key[i])) { key = k; cache = new Map(); }
    const ck = team + '|' + (likely ? 1 : 0);
    let c = cache.get(ck);
    if (!c) { c = base(team, likely); cache.set(ck, c); }
    return { xi: c.xi.slice(), subs: c.subs.slice() };
  };
  wrapped.__mdMemo = 1;
  autoSubs = wrapped; // eslint-disable-line no-global-assign
})();

/* ---------- per-load memo for this area ---------- */
let KEY = null, MEMO = new Map();
function fresh() {
  const k = [D.ro, D.fx, D.cf, D.gwsByGw, D.pbonus, D.provOver, D.dlPassed, D.gw, D.predCur, D.st, LOADED_AT];
  if (!KEY || k.some((v, i) => v !== KEY[i])) {
    KEY = k; MEMO = new Map();
    /* series() reads LIVEH2H, which only buildH2H() fills (the old renderGW called it on every render) */
    try { buildH2H(); } catch (e) { }
  }
}
export function memo(key, fn) { fresh(); if (!MEMO.has(key)) MEMO.set(key, fn()); return MEMO.get(key); }

/* ---------- small formatting ---------- */
export const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
export const int = v => String(Math.round(v));
export const signed = (v, d = 1) => { const r = Math.round(v * Math.pow(10, d)) / Math.pow(10, d); return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(d); };
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const tTime = d => UI.hm(d);
export const tWd = d => UI.wd(d);
/* kick-off label: time only if today, weekday + time otherwise ("3:30pm", "Sun 1pm") */
export function tKo(d) { if (!d) return ''; return sameDay(d, new Date()) ? tTime(d) : UI.dayHm(d); }
export const tShort = tKo;
export const tDayLong = d => d ? d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }) : '';
export const tFull = d => UI.dayFull(d);
export const dayKey = d => d ? d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() : '';
/* countdown in words for sentences ("in 11 hours"); the app bar pill keeps its own shorthand */
export function until(d) {
  if (!d) return '';
  const ms = d.getTime() - Date.now(); if (ms <= 0) return 'now';
  const m = Math.floor(ms / 60e3), h = Math.floor(m / 60), dd = Math.floor(h / 24);
  if (h >= 48) return dd + ' days';
  if (h >= 10) return h + ' hours';
  if (h >= 1) return h + 'h ' + (m % 60) + 'm';
  return Math.max(1, m) + ' min';
}

/* projections exist whenever the engine produces them: FPL's forecast, or the house model (v12 epOf), which works
   from history and, before any, from draft-rank priors. Hidden only if every team projects to nothing. */
export const hasProj = () => memo('hasproj', () => !!(D.hasEP || gwFx().some(f => teamProj(f.Home) > 0 || teamProj(f.Away) > 0)));

/* ---------- the gameweek ---------- */
export const gwFx = () => memo('gwfx', () => (D.fx || []).filter(f => num(f.GW) === D.gw));
export const gwCf = (g = D.gw) => memo('cf|' + g, () => (D.cf || []).filter(x => num(x.GW) === g)
  .slice().sort((a, b) => String(a['Kickoff (UTC)']).localeCompare(String(b['Kickoff (UTC)']))));
export const koOf = x => dt(x && x['Kickoff (UTC)']);
export const clubFx = club => gwCf().filter(x => x.Home === club || x.Away === club);
export const hasScore = x => x && x['Home goals'] !== '' && x['Home goals'] !== undefined && x['Home goals'] !== null;
export const liveFx = x => fin(x.Started) && !fin(x.Finished);

/* the week's phase: pre (deadline ahead), locked (deadline passed, nothing kicked off), live, prov (all PL games over,
   FPL not closed), ft (every matchup marked finished), none (no fixtures for this gameweek) */
export function phase() {
  return memo('phase', () => {
    const fx = gwFx(); if (!fx.length) return 'none';
    if (D.provOver) return 'prov';
    if (fx.every(f => fin(f.Finished))) return 'ft';
    if (!D.dlPassed) return 'pre';
    const kicked = gwCf().some(x => fin(x.Started)) || fx.some(f => num(f['Home pts']) + num(f['Away pts']) > 0);
    return kicked ? 'live' : 'locked';
  });
}
export const deadline = () => gwDeadline(D.gw);
export const nextDeadline = () => gwDeadline(D.gw + 1);
export const firstKo = () => { const k = gwCf().map(koOf).filter(Boolean); return k.length ? k[0] : null; };
export const lastKo = () => { const k = gwCf().map(koOf).filter(Boolean); return k.length ? k[k.length - 1] : null; };

/* ---------- a player this gameweek ---------- */
export function pl(p) {
  if (!p) return null;
  if (typeof p !== 'object') p = UI.player(p);
  if (!p) return null;
  return memo('pl|' + p.Code + '|' + (p.Team || ''), () => {
    const code = String(p.Code), fxs = clubFx(p.Club);
    const started = fxs.some(x => fin(x.Started)), finished = fxs.length > 0 && fxs.every(x => fin(x.Finished));
    const live = started && !finished;
    const row = (D.gwsCur || {})[code] || null;
    const mins = row ? num(row.Mins) : num(p['GW mins']);
    const pb = (D.pbonus || {})[code] || 0;
    const pts = num(p['GW pts']) + pb;
    const e = epOf(code);
    const hl = started ? hpLive(p) : null;
    const now = fxs.find(liveFx) || null;
    const nextUp = fxs.find(x => !fin(x.Started)) || null;
    const status = String(p.Status || 'a');
    return {
      p, code, team: p.Team, pos: p.Pos, club: p.Club, fxs, dgw: fxs.length > 1, blank: !fxs.length,
      started, finished, live, mins, pts, pb, row,
      proj: e === null ? null : e,                 /* PROJ: frozen pre-match projection */
      final: started ? hl.pts : (e === null ? 0 : e), /* contribution to PROJ FINAL (= projOf) */
      rem: started ? hl.rem : (e === null ? 0 : e),
      st: hl ? hl.state : (fxs.length ? 'pre' : 'blank'),
      xp: started && row ? (num(row.Mins) > 0 ? xpOf(row) : 0) : null, /* 0 minutes deserves 0 (xpOf alone would add expected DefCon) */
      minute: now ? Math.round(num(now.Mins)) : null,
      ko: nextUp ? koOf(nextUp) : (fxs[0] ? koOf(fxs[0]) : null),
      fx: now || nextUp || fxs[fxs.length - 1] || null,
      status, doubt: status === 'd', out: 'isun'.includes(status) && status !== '', chance: UI.chance(p),
      news: String(p.News || ''),
    };
  });
}
/* the bubble a player wears: banked (white), live (green), projected (dashed) */
export function bubble(x, mode) {
  if (!x) return { cls: 'pj', txt: '–' };
  if (mode === 'xp' && x.started && x.xp !== null) return { cls: 'xp', txt: f1(x.xp) };
  if (x.blank) return { cls: 'pj', txt: '–' };
  if (!x.started) return { cls: 'pj', txt: x.proj === null ? '–' : f1(x.proj) };
  return { cls: x.finished ? 'bk' : 'lv', txt: int(x.pts) };
}
/* the short line under a player: kick-off, minute, FT, not on yet */
export function statusLine(x, compact) {
  if (!x) return { t: '', live: false };
  if (x.blank) return { t: 'No match', live: false };
  if (!x.started) return { t: compact ? tShort(x.ko) : tKo(x.ko), live: false };
  if (x.finished) return { t: x.mins > 0 ? 'FT' : 'Did not play', live: false };
  if (x.st === 'bench' || (x.mins <= 0 && x.minute !== null)) return { t: 'not on yet', live: true };
  if (x.st === 'off') return { t: 'off · ' + x.mins + '’', live: false };
  if (x.st === 'pre') return { t: compact ? tShort(x.ko) : tKo(x.ko), live: false }; /* second leg of a double still to come */
  return { t: (x.minute !== null ? x.minute : x.mins) + '’', live: true };
}
export const fxLabel = x => x ? x.Home + ' v ' + x.Away : '';
/* the fixture from the player's side: "v LEE" at home, "at BOU" away */
export const fxOpp = (x, club) => !x ? '' : x.Home === club ? 'v ' + x.Away : 'at ' + x.Home;

/* ---------- a team this gameweek ---------- */
export function team(t) {
  return memo('team|' + t, () => {
    const as = autoSubs(t, true), lk = autoSubs(t, false);
    const xi = as.xi, xiL = lk.xi;
    const players = xi.map(pl);
    const split = hpLiveSplit(t);
    const left = mpxLeft(t);
    const toPlay = players.filter(x => x.st === 'pre');
    const playing = players.filter(x => x.live && x.st === 'live');
    const done = players.filter(x => x.started && x.st !== 'pre');
    const inn = new Set(as.subs.map(s => String(s.inn.Code)));
    const bench = benchOf(t).filter(b => !inn.has(String(b.Code))).concat(as.subs.map(s => s.out));
    return {
      t, xi, xiL, players, bench, subs: as.subs, lockedSubs: lk.subs,
      proj: teamProj(t), split, left, toPlay, playing, done,
      /* the engine's own team xP (the full-time line, as the old app showed it) and its xP-or-projection blend */
      xp: D.hasXP ? teamXP(t) : null, xpBlend: D.hasXP ? teamXPBlend(t) : null,
      /* xP of the effective XI players who have actually played (the live "so far" figure) */
      xpPlayed: D.hasXP ? xiL.map(pl).reduce((s2, x) => s2 + (x.started && x.mins > 0 ? x.xp || 0 : 0), 0) : null,
      form: formation(xi).replace(/–/g, '-'),
      rec: mpxRecord(t),
    };
  });
}

/* ---------- a matchup ---------- */
export function mx(i) {
  const fx = gwFx(); const f = fx[i]; if (!f) return null;
  const me = UI.you();
  return memo('mx|' + i + '|' + me, () => {
    const mine = me === f.Home || me === f.Away;
    const L = me === f.Away ? f.Away : f.Home, R = L === f.Home ? f.Away : f.Home, flip = L !== f.Home;
    const s = mscore(f);
    const ph = s.done ? 'ft' : D.provOver ? 'prov' : phase() === 'none' ? 'pre' : (phase() === 'ft' ? 'live' : phase());
    let win = null;
    if (ph !== 'ft' && ph !== 'prov') {
      const w = hpWin(f); if (!w.done) { const pc = mpxWinPct(w); win = flip ? { l: pc.a, d: pc.d, r: pc.h, raw: w } : { l: pc.h, d: pc.d, r: pc.a, raw: w }; }
    }
    const tl = team(L), tr = team(R);
    return {
      i, f, mine, me, L, R, flip, s, ph, win, tl, tr,
      sl: flip ? s.as2 : s.hs, sr: flip ? s.hs : s.as2,
      derby: derbyName(f.Home, f.Away), series: series(f.Home, f.Away),
      final: ph === 'ft' || ph === 'prov',
    };
  });
}
export const youIndex = () => { const me = UI.you(); return me ? gwFx().findIndex(f => f.Home === me || f.Away === me) : -1; };
/* with no team chosen: a derby, the closest one first; else the closest game */
export function featuredIndex() {
  return memo('feat', () => {
    const fx = gwFx(); if (!fx.length) return -1;
    const close = i => { const m = mx(i); if (m.win) return Math.abs(m.win.l - m.win.r); return Math.abs(m.sl - m.sr); };
    const idx = fx.map((f, i) => i);
    const der = idx.filter(i => derbyName(fx[i].Home, fx[i].Away));
    const pool = der.length ? der : idx;
    return pool.slice().sort((a, b) => close(a) - close(b))[0];
  });
}
/* the matchup sub-line: PREDICTED → PROJ FINAL → xP */
export function projLine(m) {
  if (m.final) return D.hasXP ? { k: 'xP', l: m.tl.xp, r: m.tr.xp } : null;
  if (!hasProj()) return null;
  return { k: m.ph === 'pre' ? 'Predicted' : 'Proj final', l: m.tl.proj, r: m.tr.proj };
}
/* the side labels: "You" for you, the manager's first name otherwise */
export const who = (m, t) => (m.me === t ? 'You' : FIRSTOF(t));
export const mgr = t => (PROFILE[t] || {}).manager || (TEAMS[t] || {}).mgr || '';

/* ---------- auto-sub reasons ---------- */
export function subReason(s) {
  const p = s.out, x = pl(p);
  if (s.kind === 'likely') {
    if (x && x.blank) return 'no match this week';
    const n = String(p.News || '').split(' - ')[0].trim();
    return n || (p.Status === 'd' ? 'doubtful' : 'flagged out');
  }
  if (x && x.blank) return 'no match this week';
  return 'did not play' + (x && x.fxs.length ? ', ' + fxLabel(x.fxs[0]) + ' finished' : '');
}

/* ---------- this season's meetings between two teams ---------- */
export function meetings(a, b) {
  return (D.fx || []).filter(f => fin(f.Finished) && ((f.Home === a && f.Away === b) || (f.Home === b && f.Away === a)))
    .sort((x, y) => num(x.GW) - num(y.GW));
}
/* all-time record from the seeded history plus this season, oriented to (a, b) */
export function record(a, b) {
  const x = (TEAMS[a] || {}).ini, y = (TEAMS[b] || {}).ini; if (!x || !y) return null;
  const k = pairKey(x, y), first = k.split('|')[0];
  const sd = SEED[k] || [0, 0, 0], lv = LIVEH2H[k] || [0, 0, 0];
  const w1 = sd[0] + lv[0], w2 = sd[1] + lv[1], dr = sd[2] + lv[2];
  const [wa, wb] = x === first ? [w1, w2] : [w2, w1];
  const [sa, sb] = x === first ? [sd[0], sd[1]] : [sd[1], sd[0]];
  return { a: wa, b: wb, d: dr, n: wa + wb + dr, seedA: sa, seedB: sb, seedD: sd[2], seeded: sd[0] + sd[1] + sd[2] };
}
