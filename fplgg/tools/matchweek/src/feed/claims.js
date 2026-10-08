/* feed/claims.js — Archizio's press conference (every manager, every gameweek, before the deadline) and the claims
   inside the quotes. A claim is something the data can settle later: a win, a margin, a score, a month, a haul.
   Settling is a pure function of the data, so every phone agrees on the receipts. */
import * as UI from '../ui.js';
import { esc, short, firstOf, mgrOf, fxFor, oppOf, pick, hash, ptsOver, gwDoneTime } from './util.js';
import { results, motmTotals, periodDone } from './facts.js';
import { quotes, quoteOf } from './social.js';
import { motm } from '../pages/league/data.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tail = z => 1 - hpNorm(z);                       /* P(X ≥ ...) from a z-score */
export const pct = p => p == null ? '' : p < .01 ? '<1%' : p > .99 ? '>99%' : Math.round(p * 100) + '%';
const perOf = name => (PERIODS || []).find(p => p[0] === name) || null;
const perFor = g => (PERIODS || []).find(p => g >= p[1] && g <= p[2]) || null;
const pname = name => String(name).replace(' & ', '–');

/* ---------- what a claim is called ---------- */
export function claimLabel(c) {
  if (!c) return '';
  if (c.type === 'win') return 'beat ' + short(c.opp);
  if (c.type === 'margin') return 'beat ' + short(c.opp) + ' by ' + c.n + '+';
  if (c.type === 'score') return c.n + '+ points';
  if (c.type === 'motm') return 'win ' + pname(c.per) + '’s Manager of the Month';
  if (c.type === 'star') return (c.name || 'him') + ' to score ' + c.n + '+';
  return '';
}
const theS = t => { const s = short(t); return s !== t && /s$/.test(s) ? 'the ' + s : t; };
export function claimClause(c) {
  if (!c) return '';
  if (c.type === 'win') return theS(c.team) + ' beat ' + theS(c.opp);
  if (c.type === 'margin') return theS(c.team) + ' beat ' + theS(c.opp) + ' by ' + c.n + ' or more';
  if (c.type === 'score') return theS(c.team) + ' put up ' + c.n + ' or more';
  if (c.type === 'motm') return theS(c.team) + ' win ' + pname(c.per) + '’s Manager of the Month';
  if (c.type === 'star') return (c.name || 'he') + ' scores ' + c.n + ' or more';
  return '';
}
export function claimChip(c) {
  if (!c) return '';
  if (c.type === 'win') return 'WIN v ' + short(c.opp).toUpperCase();
  if (c.type === 'margin') return 'WIN BY ' + c.n + '+';
  if (c.type === 'score') return c.n + '+ POINTS';
  if (c.type === 'motm') return pname(c.per).toUpperCase() + ' MOTM';
  if (c.type === 'star') return String(c.name || '').toUpperCase() + ' ' + c.n + '+';
  return '';
}

/* ---------- the claims open to a team this gameweek, with the model's chance for each ---------- */
function claimsFor(team, g) {
  const f = fxFor(team, g); if (!f) return [];
  const opp = oppOf(f, team), home = f.Home === team, out = [];
  let w = null; try { w = hpWin(f); } catch (e) { }
  if (w && !w.done) {
    const pw = home ? w.h : w.a, mu = home ? w.muH - w.muA : w.muA - w.muH, sd = w.sd || 1;
    out.push({ c: { type: 'win', gw: g, team, opp }, p: pw });
    out.push({ c: { type: 'margin', gw: g, team, opp, n: 10 }, p: tail((9.5 - mu) / sd) });
    try {
      const m = hpTeam(team, g), s = hpTeamSd(team, g) || 8;
      const n = Math.max(30, Math.ceil((m + .9 * s) / 5) * 5);
      out.push({ c: { type: 'score', gw: g, team, n }, p: tail((n - .5 - m) / s) });
    } catch (e) { }
  }
  const per = perFor(g);
  if (per && g - per[1] <= 1 && !periodDone(per)) {
    let p = null;
    try { const R = motm(); if (R && R.per && R.per[0] === per[0]) { const row = R.rows.find(r => r.t === team); if (row) p = row.win; } } catch (e) { }
    out.push({ c: { type: 'motm', per: per[0], team }, p });
  }
  try {
    const xi = (typeof effXiOf === 'function' ? effXiOf(team, true) : xiOf(team)) || [];
    const top = xi.map(p => ({ p, ep: epOf(p.Code) || 0 })).sort((a, b) => b.ep - a.ep)[0];
    if (top && top.ep > 0) out.push({ c: { type: 'star', gw: g, team, code: String(top.p.Code), name: top.p.Player, n: 10 }, p: null });
  } catch (e) { }
  return out;
}

/* ---------- the press conference ---------- */
const WIN_FAV = ['We’re favourites for a reason.', 'The model has us. So do I.', 'Three points. Expected, and delivered.', 'Nothing to discuss. We win.'];
const WIN_EVEN = ['We win this one.', 'Coin flip? Not from where I’m sitting.', 'Tight on paper. It won’t be on Monday.', 'Bring it. We take this.'];
const WIN_DOG = ['Write us off. We like it that way.', 'The model can keep its numbers. We win.', 'Underdogs? Watch this.', 'Upset loading.'];
const DERBY = ['{o} knows what’s coming.', 'Ask {o} about the derby on Monday.', 'Derby day. Only one result.'];
const MARGIN = ['Double figures. Minimum.', 'We win by ten. At least.', 'It won’t be close.'];
const SCORE = ['{n} on the board. Write it down.', 'We put up {n} this week.', '{n}. Bank it.'];
const MOTM = ['{per} is ours.', 'Manager of the Month for {per}. Book it.', 'That $30 for {per} has our name on it.'];
const STAR = ['{p} gets double figures.', '{p} hauls this week. Ten-plus.', 'Watch {p}. Ten points, minimum.'];
const DEFLECT = ['No comment.', 'Respect to {o}. Doesn’t change a thing.', 'We focus on ourselves.'];
const REPLY = ['Talk is cheap. See you Monday.', 'Frame that quote. I’ll sign it after.', 'Funny. Ask me again after full time.', 'Heard it before.', 'Noted.'];
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => v[k] != null ? v[k] : m);

export function presser(team) {
  if (!team || !TEAMS[team] || !D || !D.ro || D.dlPassed) return null;
  const g = D.gw, f = fxFor(team, g); if (!f) return null;
  const opp = oppOf(f, team), nm = derbyName(f.Home, f.Away), slot = Object.keys(TEAMS).indexOf(team);
  const C = claimsFor(team, g), by = t => C.find(x => x.c.type === t) || null;
  const v = { o: firstOf(opp) };
  const picks = [];
  const W = by('win');
  if (W) {
    const set = nm && slot % 2 ? DERBY : W.p >= .58 ? WIN_FAV : W.p < .42 ? WIN_DOG : WIN_EVEN;
    picks.push({ line: fill(pick('pw:' + team, g, set), v), c: W.c, p: W.p });
  }
  const bold = (g + slot) % 2 ? by('margin') : by('score');
  if (bold) picks.push({ line: fill(pick('pb:' + team, g, bold.c.type === 'margin' ? MARGIN : SCORE), { n: bold.c.n }), c: bold.c, p: bold.p });
  const M = by('motm'), S = by('star');
  if (M) picks.push({ line: fill(pick('pm:' + team, g, MOTM), { per: pname(M.c.per) }), c: M.c, p: M.p });
  else if (S) picks.push({ line: fill(pick('ps:' + team, g, STAR), { p: S.c.name }), c: S.c, p: null });
  picks.push({ line: fill(pick('pd:' + team, g, DEFLECT), v), c: null, p: null });
  const W0 = W ? W.p : null;
  const q = nm ? pick('pq:' + team, g, ['Any comment before ' + nm + '?', nm + ' this week. Anything for the record?', 'A word before ' + nm + '?'])
    : pick('pq:' + team, g, ['Gameweek ' + g + ', ' + short(team) + ' v ' + short(opp) + '. Anything for the record?', 'A word before you face ' + short(opp) + '?', short(opp) + ' this week. Any comment?']);
  /* answers owed: quotes this week from the team you play */
  const replies = quotes().filter(x => x.gw === g && !x.re && x.team === opp).map(x => {
    const tgt = 'qr:' + g + ':' + x.team;
    const rp = REPLY.map((l, i) => ({ line: l, c: i < 3 && W ? W.c : null, p: i < 3 && W ? W.p : null }));
    const two = [rp[(hash(team + g) % 3)], rp[3 + (hash(team + g + 'x') % 2)]];
    return { to: x, target: tgt, mine: quoteOf(team, tgt), picks: two };
  });
  return { team, g, f, opp, nm, q, w: W0, target: 'q:' + g, mine: quoteOf(team, 'q:' + g), picks, claims: C, replies };
}

/* ---------- settling a claim ---------- */
const fxFinal = r => r && r.f && fin(r.f.Finished);
function gwFinished(g) { const w = (D.mw || []).find(x => num(x.GW) === g); return !!(w && fin(w.Finished)); }
export function settle(q) {
  const c = q && q.claim; if (!c) return { state: 'none' };
  if (c.type === 'win' || c.type === 'margin' || c.type === 'score') {
    const r = results(c.gw).find(x => x.home === c.team || x.away === c.team); if (!r) return { state: 'open' };
    const ts = r.home === c.team ? r.hs : r.as, os = r.home === c.team ? r.as : r.hs;
    const line = esc(r.home) + ' ' + r.hs + '–' + r.as + ' ' + esc(r.away), plain = r.home + ' ' + r.hs + '–' + r.as + ' ' + r.away;
    if (!fxFinal(r)) return (r.live || r.done) ? { state: 'live', line, plain, ts, os } : { state: 'open' };
    let won, sev;
    if (c.type === 'win') { won = ts > os; sev = ts === os ? .3 : clamp((os - ts) / 25, .15, 1); }
    else if (c.type === 'margin') { won = ts - os >= c.n; sev = clamp((c.n - (ts - os)) / (c.n + 25), .1, 1); }
    else { won = ts >= c.n; sev = clamp((c.n - ts) / c.n * 2, .1, 1); }
    return { state: won ? 'won' : 'lost', sev, line, plain, ts, os, when: gwDoneTime(c.gw) };
  }
  if (c.type === 'star') {
    if (!gwFinished(c.gw)) return { state: c.gw === D.gw && D.dlPassed ? 'live' : 'open' };
    const pts = ptsOver(c.code, [c.gw]);
    const line = esc(c.name) + ': ' + pts + ' ' + (pts === 1 ? 'point' : 'points') + ' in GW' + c.gw, plain = c.name + ': ' + pts + ' in GW' + c.gw;
    return { state: pts >= c.n ? 'won' : 'lost', sev: clamp((c.n - pts) / c.n, .1, 1), line, plain, when: gwDoneTime(c.gw) };
  }
  if (c.type === 'motm') {
    const per = perOf(c.per); if (!per) return { state: 'open' };
    const T = motmTotals(per); if (!T || !T.any) return { state: 'open' };
    const rows = T.rows, mine = rows.find(r => r[0] === c.team); if (!mine) return { state: 'open' };
    const rank = 1 + rows.filter(r => r[1] > mine[1]).length, lead = rows[0], gap = lead[1] - mine[1];
    const name = pname(per[0]);
    if (periodDone(per)) {
      const line = name + ': ' + (rank === 1 ? esc(c.team) + ' top it on ' + mine[1] : ordinal(rank) + ' of eight, ' + gap + ' behind ' + esc(lead[0]));
      return { state: rank === 1 ? 'won' : 'lost', sev: clamp((rank - 1) / 7, .15, 1), rank, gap, line, plain: line.replace(/<[^>]+>/g, ''), when: gwDoneTime(per[2]) };
    }
    let upTo = 0; for (let g = per[1]; g <= per[2]; g++) if (gwFinished(g)) upTo = g;
    if (!upTo) return { state: 'open' };
    return { state: 'running', rank, gap, upTo, line: name + ' after GW' + upTo + ': ' + ordinal(rank) + ' of eight, ' + gap + ' behind ' + esc(lead[0]), plain: '' };
  }
  return { state: 'open' };
}
export const ordinal = n => ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][n] || String(n);
/* earned, not random: a big miss, or a bold call that missed, or one that landed against the odds */
export function viral(q, s) {
  if (!q || !q.claim || !s) return false;
  if (s.state === 'lost') return s.sev >= .6 || (q.p != null && q.p <= .4 && s.sev >= .3) || (q.claim.type === 'motm' && s.rank >= 7);
  if (s.state === 'won') return q.p != null && q.p <= .3;
  return false;
}
