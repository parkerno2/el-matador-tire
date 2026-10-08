/* kit.js — small helpers shared by the sheets (player, manager, identity, search, menu).
   Engine globals (D, TEAMS, num, fin, …) come from core.js as bare names. */
import * as UI from '../ui.js';

const esc = UI.esc;

/* The locked Plate card fills its plate with url(#gGold) … url(#gPotm); production defines those gradients once in its markup.
   index.template.html doesn't yet, so every card lost its tier art. Guarded: a no-op once the shell carries the defs. */
(function cardDefs() {
  if (typeof document === 'undefined' || document.getElementById('gGold')) return;
  const g = (id, x2, stops) => '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + x2 + '" y2="1">' + stops.map(([o, c]) => '<stop offset="' + o + '" stop-color="' + c + '"/>').join('') + '</linearGradient>';
  const svg = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
    + g('gGold', .32, [[0, '#FBE9A6'], [.3, '#EFCB68'], [.72, '#D2A73F'], [1, '#B8892B']])
    + g('gSilver', .32, [[0, '#FAFBFD'], [.35, '#DCDFE6'], [.8, '#ACB2C0'], [1, '#979DAD']])
    + g('gSpec', .28, [[0, '#7E3190'], [.42, '#37003C'], [1, '#2E5BFF']])
    + g('gElite', .28, [[0, '#2A5AC2'], [.45, '#0B3E9E'], [1, '#0E63D6']])
    + g('gTotw', .28, [[0, '#3E3E4A'], [.5, '#141419'], [1, '#2B2416']])
    + g('gPotm', .28, [[0, '#8E2C55'], [.5, '#6E1239'], [1, '#B03A6A']])
    + '</defs></svg>';
  const put = () => document.body && !document.getElementById('gGold') && document.body.insertAdjacentHTML('beforeend', svg);
  if (document.body) put(); else document.addEventListener('DOMContentLoaded', put);
})();

/* ---------- memo per data load: aggregates are pure functions of D, so compute them once per load ---------- */
const MEMO = new Map();
let MEMO_AT = -1;
export function memo(key, fn) {
  if (MEMO_AT !== LOADED_AT) { MEMO.clear(); MEMO_AT = LOADED_AT; }
  if (!MEMO.has(key)) MEMO.set(key, fn());
  return MEMO.get(key);
}
export const luck = () => memo('luck', () => luckAgg());
export const sched = () => memo('sched', () => schedLuck());
export const titleOdds = () => UI.titleOdds();
export const titleReady = () => UI.oddsReady();
/* XI points per player code (started weeks only, any owner), the same lens as xiPtsMap, without the full league pass */
export function xiStarted(code) {
  const idx = memo('glxi', () => {
    const m = {};
    (D.gl || []).forEach(r => {
      if (num(r.GW) >= D.gw && !D.demo) return;
      const k = String(r.Code), o = m[k] = m[k] || { xi: 0, bench: 0 };
      const p = num(r['GW pts']);
      if (r.Started === 'XI') o.xi += p; else o.bench += p;
    });
    return m;
  });
  return idx[String(code)] || { xi: 0, bench: 0 };
}
export const effXi = team => memo('exi|' + team, () => effXiOf(team));

/* ---------- formatting ---------- */
export const ord = n => (typeof ORD === 'function' ? ORD(n) : n + 'th');
export const sgn = (v, d = 1) => { const r = Math.round(v * Math.pow(10, d)) / Math.pow(10, d); return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(d); };
export const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
export const plural = (n, w, ws) => n + ' ' + (n === 1 ? w : (ws || w + 's'));
export const POSNAME = { GKP: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' };
export const POSPL = { GKP: 'Goalkeepers', DEF: 'Defenders', MID: 'Midfielders', FWD: 'Forwards' };
export const clubName = c => (typeof CLUBNAME !== 'undefined' && CLUBNAME[c]) || c;
export function kickoff(f) { return f ? dt(f['Kickoff (UTC)']) : null; }
/* "9:00" and "am" apart, so the time can be big and the meridiem small */
export function timeParts(d) {
  if (!d) return { t: 'TBC', m: '' };
  const s = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const m = s.match(/^(.*?)\s*([AaPp]\.?\s?[Mm]\.?)$/);
  return m ? { t: m[1], m: m[2].replace(/\./g, '').replace(/\s/g, '').toLowerCase() } : { t: s, m: '' };
}
export const nameOf = t => { const p = (PROFILE && PROFILE[t]) || {}; return (p.manager || '').trim() || (TEAMS[t] || {}).mgr || ''; };

/* ---------- table position, record, points ---------- */
export function standings() {
  return (D.st || []).slice().sort((a, b) => num(b['League Pts']) - num(a['League Pts']) || num(b['Pts For']) - num(a['Pts For'])).filter(s => TEAMS[s.Team]);
}
export function standOf(team) {
  const st = standings(), i = st.findIndex(s => s.Team === team), r = st[i] || {};
  return { pos: i + 1, w: num(r.W), d: num(r.D), l: num(r.L), pts: num(r['League Pts']), pf: num(r['Pts For']), pa: num(r['Pts Against']), has: i >= 0 && r.W !== undefined && r.W !== '' };
}
export const rec = s => UI.rec(s);
export const recL = s => UI.recL(s);

/* ---------- visual atoms ---------- */
/* a PL club badge in a light circle, the code underneath in case the image is missing */
export function cb(club, px = 28) {
  return '<span class="sk-cb" style="width:' + px + 'px;height:' + px + 'px;font-size:' + Math.max(6, Math.round(px * .3)) + 'px" title="' + esc(clubName(club)) + '"><em>' + esc(club || '') + '</em>' + UI.badge(club, Math.round(px * .72)) + '</span>';
}
/* points chip: the purple scale, brighter = bigger week */
export function ptsCls(v, dnp) { return dnp ? 'z' : v >= 10 ? 'p4' : v >= 6 ? 'p3' : v >= 3 ? 'p2' : 'p1'; }
export function pc(v, opt = {}) {
  return '<span class="sk-pc ' + (opt.live ? 'lv' : ptsCls(v, opt.dnp)) + '"' + (opt.w ? ' style="width:' + opt.w + 'px;height:' + (opt.h || 30) + 'px"' : '') + '>' + v + '</span>';
}
/* W/D/L chip with the score */
export function res(r, score, live) {
  return '<span class="sk-res ' + (live ? 'lv' : r.toLowerCase()) + '">' + (live ? 'LIVE' : r) + (score ? ' ' + score : '') + '</span>';
}
export function fdrColor(n) { return n <= 2 ? 'var(--win)' : n === 3 ? 'var(--tx4)' : n === 4 ? 'var(--loss)' : 'var(--sk-fdr5)'; }
export const FDRWORD = { 1: 'easy', 2: 'easy', 3: 'medium', 4: 'hard', 5: 'very hard' };
/* the pill switcher inside a sheet (local, not routes) */
export function tabs(items, on) {
  return '<nav class="pills sk-tabs" role="tablist" aria-label="Sections">' + items.map(([id, label]) =>
    '<button type="button" role="tab" data-tab="' + id + '" aria-selected="' + (id === on) + '"' + (id === on ? ' class="on"' : '') + '>' + esc(label) + '</button>').join('') + '</nav>';
}
/* wire the switcher; the choice survives a data refresh (the sheet element persists, main.js only swaps its innerHTML) */
export function wireTabs(el, lazy) {
  const show = id => {
    el.dataset.tab = id;
    el.querySelectorAll('.sk-tabs [data-tab]').forEach(b => { const on = b.dataset.tab === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    el.querySelectorAll('[data-panel]').forEach(p => {
      const on = p.dataset.panel === id;
      if (on && !p.dataset.done && lazy && lazy[id]) { try { p.innerHTML = lazy[id](); } catch (e) { console.error(e); p.innerHTML = '<div class="err">Couldn’t draw this. ' + esc(e.message) + '</div>'; } p.dataset.done = '1'; }
      p.hidden = !on;
    });
    UI.showOn(el, '.sk-tabs');
  };
  const nav = el.querySelector('.sk-tabs');
  if (nav) nav.addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    const was = el.dataset.tab; show(b.dataset.tab);
    if (was !== b.dataset.tab) { const top = nav.offsetTop - 4; if (el.scrollTop > top) el.scrollTop = top; }
  });
  const first = el.dataset.tab && el.querySelector('[data-panel="' + el.dataset.tab + '"]') ? el.dataset.tab : (el.querySelector('.sk-tabs [data-tab]') || {}).dataset?.tab;
  if (first) show(first);
}
export function panel(id, html, on) { return '<section data-panel="' + id + '"' + (on ? '' : ' hidden') + (html === null ? '' : ' data-done="1"') + '>' + (html || '') + '</section>'; }
export function note(t) { return '<p class="sk-note">' + t + '</p>'; }
export function rgbaOf(hex, a) { const v = parseInt(String(hex).slice(1), 16); return 'rgba(' + (v >> 16) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + a + ')'; }
/* club pattern as a CSS background layer (stripes, hoops, halves, sash) in the team's accent */
export function patternBg(kind, col, a = .16) {
  const c = rgbaOf(col, a);
  if (kind === 'stripes') return 'repeating-linear-gradient(90deg,' + c + ' 0 18px,transparent 18px 36px)';
  if (kind === 'hoops') return 'repeating-linear-gradient(180deg,' + c + ' 0 16px,transparent 16px 32px)';
  if (kind === 'halves') return 'linear-gradient(90deg,transparent 50%,' + c + ' 50%)';
  if (kind === 'sash') return 'linear-gradient(135deg,transparent 38%,' + c + ' 38%,' + c + ' 56%,transparent 56%)';
  return '';
}
export const PATTERNS = [['plain', 'Plain'], ['stripes', 'Stripes'], ['hoops', 'Hoops'], ['halves', 'Halves'], ['sash', 'Sash']];
/* a manager's photo, or the crest when there is none */
export function avatar(team, px) {
  const ph = ((PROFILE && PROFILE[team]) || {}).photo;
  return ph ? '<span class="sk-av" style="width:' + px + 'px;height:' + px + 'px"><img src="' + esc(ph) + '" alt="' + esc(nameOf(team)) + '"></span>' : UI.crest(team, px);
}
export const statusWord = s => ({ d: 'Doubtful', i: 'Injured', s: 'Suspended', u: 'Unavailable', n: 'Not available' }[s] || '');
