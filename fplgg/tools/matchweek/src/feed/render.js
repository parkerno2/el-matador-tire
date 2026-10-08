/* feed/render.js — a post to HTML. Each voice's look lives only inside its own posts. */
import * as UI from '../ui.js';
import { VOICES, avatar, tagChip } from './voices.js';
import { esc, f1, oddsTxt, short, firstOf, mgrOf, hash, newsLabel, statusWord, chanceOf, list } from './util.js';
import { shows, mmss } from './facts.js';
import { REACTS, reactions, votes, me as signedIn } from './social.js';

/* ---------- small pieces ---------- */
const AR = 0.42;                                     /* average glyph width of the condensed display faces, in em */
const fit = (txt, room, max, k = AR) => Math.max(5, Math.min(max, room / (Math.max(3, String(txt).length) * k))).toFixed(2);
/* a cut-out player image: the FC cutout or FPL photo (UI.faceSrcs), then nothing */
export function cut(code, cls = '', alt = '') {
  const urls = code ? UI.faceSrcs(code) : [];
  if (!urls.length) return '';
  return UI.chainImg(urls, 'class="' + cls + '" alt="' + esc(alt) + '" loading="lazy" decoding="async"', 'this.style.visibility=\'hidden\'');
}
const nameOf = code => { const p = UI.player(code); return p ? p.Player : ''; };
const clubOf = code => { const p = UI.player(code); return p ? p.Club : ''; };
const posOf = code => { const p = UI.player(code); return p ? p.Pos : ''; };
const crest = (t, px) => UI.crest(t, px);
const sq = '<i class="fsq" aria-hidden="true"></i>';
const apMark = '<span class="ap-mark">' + sq + 'archizio</span>';
const ARROW = '<svg class="farw" viewBox="0 0 48 40" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 30 C 16 30, 28 22, 38 10"/><path d="M26 10 L39 8 L38 22"/></svg>';
const PLAY = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 4 L20 12 L7 20 Z" fill="currentColor"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>';
const chalkArrow = '<svg class="ch-arw" width="42" height="30" viewBox="0 0 42 30" fill="none" stroke="#EAD27A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 24 C 14 26, 28 20, 36 8"/><path d="M28 9 L37 7 L37 16"/></svg>';
const PITCH = '<svg class="fjb-pitch" viewBox="0 0 358 420" preserveAspectRatio="none" aria-hidden="true"><rect x="10" y="10" width="338" height="400" rx="6"/><path d="M10 210 H348"/><circle cx="179" cy="210" r="46"/><rect x="104" y="10" width="150" height="62"/><rect x="104" y="348" width="150" height="62"/></svg>';
function wave(seed, n = 44, h = 34) {
  let x = hash(seed) || 7; const r = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 1000) / 1000; };
  let s = '';
  for (let i = 0; i < n; i++) { const v = .25 + .75 * Math.abs(Math.sin(i * .55 + r() * 1.4)) * (.55 + .45 * r()); const bh = Math.max(4, v * h); s += '<rect x="' + (i * 5) + '" y="' + ((h - bh) / 2).toFixed(1) + '" width="3" height="' + bh.toFixed(1) + '" rx="1.5"/>'; }
  return '<svg class="fwave" viewBox="0 0 ' + (n * 5) + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' + s + '</svg>';
}
const youOf = () => UI.you();
/* win-chance bar colours: you blue, the other side grey; a neutral matchup light v dim */
function sideCols(h, a) { return UI.pairCols(h, a); }

/* ============================== ARCHIZIO ============================== */
function deal(m, post) {
  const n = m.slides.length;
  const slide = (s, i) => {
    const nm = String(s.name).toUpperCase();
    return '<div class="dd" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' of ' + n + '">'
      + '<i class="dd-slab"></i>' + cut(s.code, 'dd-face', s.name)
      + '<span class="dd-tag f-cond">Deal done</span>' + (n > 1 ? '<span class="dd-ct f-mono">' + (i + 1) + ' / ' + n + '</span>' : '')
      + '<div class="dd-txt"><span class="dd-nm f-cond" style="font-size:' + fit(nm, 88, 20, .5) + 'cqw">' + esc(nm) + '</span>'
      + '<span class="dd-sf f-cond">Signs for</span><span class="dd-to">' + crest(s.team, 32) + '<b class="f-cond" style="font-size:' + fit(s.team, 74, 9, .48) + 'cqw">' + esc(s.team) + '</b></span></div>'
      + '<div class="dd-bar"><span class="f-mono">OUT</span><b class="f-cond">' + esc(s.out) + '</b><span class="f-mono">VIA</span><b class="f-cond">' + esc(s.via) + '</b>' + apMark + '</div>'
      + '</div>';
  };
  return '<div class="fm-deal"><div class="fcar" data-car="' + esc(post.id) + '">' + m.slides.map(slide).join('') + '</div>'
    + (n > 1 ? '<div class="fcd" aria-hidden="true">' + m.slides.map((_, i) => '<i' + (i ? '' : ' class="on"') + '></i>').join('') + '</div>' : '') + '</div>';
}
function race(m) {
  return '<div class="ap-panel"><div class="ap-hd"><span class="f-cond ap-ttl">Contested</span><span class="f-mono ap-meta">GW' + m.gw + ' WAIVERS</span></div>'
    + m.rows.map(r => '<div class="ap-row race"><span class="fc-w">' + UI.face(r.p ? r.p.Code : null, 48, { bg: '#1C1C1C' }) + '</span>'
      + '<span class="ap-mid"><b>' + esc(r.name) + '</b><span class="f-mono">' + r.teams.length + ' CLUBS CLAIMED</span>'
      + (r.losers.length ? '<span class="race-lost"><em>Denied: ' + esc(r.losers.map(firstOf).join(', ')) + '</em></span>' : '') + '</span>'
      + '<span class="race-won">' + (r.winner ? crest(r.winner, 32) + '<span class="f-mono">' + esc(firstOf(r.winner).toUpperCase()) + '</span>' : '<span class="f-mono">NOBODY</span>') + '</span></div>').join('')
    + '<div class="ap-ft"><span class="f-mono">TRANSACTIONS LOG</span>' + apMark + '</div></div>';
}
function treat(m) {
  return '<div class="ap-panel"><div class="ap-hd"><span class="f-cond ap-ttl">Injury watch</span><span class="f-mono ap-meta">GW' + (D.gw) + ' · STARTERS</span></div>'
    + m.groups.map(g => '<div class="ftr-g"><span class="ftr-team">' + crest(g.team, 22) + '<b>' + esc(g.team) + '</b></span>'
      + '<div class="ftr-ps">' + g.codes.map(c => { const p = UI.player(c); return '<span class="ftr-p" data-open="player:' + esc(c) + '">' + UI.face(p, 34, { bg: '#1C1C1C' }) + '<span><b>' + esc(p.Player) + '</b><em class="f-mono">' + esc(newsLabel(p).toUpperCase()) + '</em></span>' + chipFor(p) + '</span>'; }).join('') + '</div></div>').join('')
    + '<div class="ap-ft"><span class="f-mono">FPL INJURY NEWS</span>' + apMark + '</div></div>';
}
function chipFor(p, label) {
  if (label) return '<span class="chip mute">' + esc(label) + '</span>';
  if (!p) return '';
  if (p.Status === 'd') return '<span class="chip doubt">' + chanceOf(p) + '%</span>';
  return '<span class="chip out">' + esc(statusWord(p).toUpperCase()) + '</span>';
}
function injcards(m) {
  return '<div class="finj' + (m.codes.length === 1 ? ' one' : '') + '">' + m.codes.map(c => {
    const p = UI.player(c); if (!p) return '';
    const sub = m.chip ? esc(short(p.Team)) : esc(newsLabel(p)) + (p.Status === 'i' && /unknown/i.test(p.News) ? ' · no return date' : '');
    return '<button class="finj-c" data-open="player:' + esc(c) + '">' + UI.face(p, 40) + '<span class="finj-t"><b>' + esc(p.Player) + '</b><em>' + chipFor(p, m.chip) + '<span>' + sub + '</span></em></span></button>';
  }).join('') + '</div>';
}
function derbies(m) {
  return '<div class="ap-panel slim">' + m.fx.map(f => {
    const s = series(f.h, f.a) || '';
    return '<div class="dby"><span class="dby-c">' + crest(f.h, 34) + '<i class="f-cond">v</i>' + crest(f.a, 34) + '</span><span class="dby-t"><b class="f-cond">' + esc(derbyName(f.h, f.a)) + '</b><span class="f-mono">' + esc(short(f.h).toUpperCase()) + ' V ' + esc(short(f.a).toUpperCase()) + (s ? ' · ' + esc(s.toUpperCase()) : '') + '</span></span></div>';
  }).join('') + '</div>';
}
function fa(m) {
  return '<div class="ap-panel"><div class="ap-hd"><span class="f-cond ap-ttl big">Free agent watch</span><span class="f-mono ap-meta">BEFORE GW' + m.before + '</span></div>'
    + m.rows.map((r, i) => '<div class="ap-row fa" data-open="player:' + esc(r.code) + '"><span class="f-cond fa-rk">' + (i + 1) + '</span>' + UI.face(r.code, 52, { bg: '#1C1C1C' })
      + '<span class="ap-mid"><b>' + esc(r.name) + '</b><span class="f-mono">' + esc(r.club) + ' · ' + esc(r.pos) + '</span><span class="fa-note">' + r.season + ' this season</span></span>'
      + '<span class="fa-pts"><b class="f-cond">' + r.l3 + '</b><span class="f-mono">LAST ' + r.n + '</span></span></div>').join('')
    + '<div class="ap-ft"><span class="f-mono">POINTS, LAST ' + (m.rows[0] ? m.rows[0].n : 3) + ' GWS · UNOWNED</span>' + apMark + '</div></div>';
}
function r1(m) {
  return '<div class="ap-panel"><div class="ap-hd"><span class="f-cond ap-ttl big">Round one</span><span class="f-mono ap-meta">' + m.done + ' GAMEWEEKS IN</span></div>'
    + '<div class="r1g">' + m.rows.map((r, i) => '<button class="r1c' + (i === 0 ? ' top' : '') + '" data-open="player:' + esc(r.code) + '">' + UI.face(r.code, 48, { bg: '#1C1C1C' }) + '<b class="f-cond">' + r.pts + '</b><span class="r1n">' + esc(r.name) + '</span><span class="f-mono">' + esc(r.pick) + ' · ' + esc(short(r.team).toUpperCase()) + '</span></button>').join('') + '</div>'
    + '<div class="ap-ft"><span class="f-mono">SEASON POINTS · FIRST-ROUND PICKS</span>' + apMark + '</div></div>';
}
function stat(m) {
  return '<div class="ap-panel stat">' + (m.team ? '<span class="fst-crest">' + crest(m.team, 64) + '</span>' : '')
    + '<span class="f-mono ap-meta">' + esc(m.label.toUpperCase()) + '</span><b class="f-cond fst-big">' + esc(m.big) + '</b><span class="fst-sub">' + esc(m.sub) + '</span>'
    + (m.rows ? '<div class="fst-rows">' + m.rows.map((r, i) => '<span' + (i === 0 ? ' class="on"' : '') + '>' + crest(r[0], 16) + '<em>' + esc(short(r[0])) + '</em><b class="f-cond">' + r[1] + '</b></span>').join('') + '</div>' : '')
    + '<div class="ap-ft">' + apMark + '</div></div>';
}
function odds(m) {
  const mx = Math.max(...m.rows.map(r => r.v), 1);
  return '<div class="ap-panel"><div class="ap-hd"><span class="f-cond ap-ttl big">Title odds</span><span class="f-mono ap-meta">AFTER GW' + D.gwsDone + '</span></div>'
    + m.rows.map((r, i) => '<div class="od-r' + (i === 0 ? ' top' : '') + '">' + crest(r.team, 20) + '<span class="od-n">' + esc(r.team) + '</span><span class="od-b"><i style="width:' + Math.max(1.5, r.v / mx * 100).toFixed(1) + '%"></i></span><b class="f-cond">' + oddsTxt(r.v) + '</b>'
      + (r.d !== null && m.prev ? '<span class="f-mono od-d ' + (r.d >= .5 ? 'up' : r.d <= -.5 ? 'dn' : '') + '">' + (Math.abs(r.d) < .5 ? '–' : (r.d > 0 ? '+' : '−') + Math.round(Math.abs(r.d))) + '</span>' : '') + '</div>').join('')
    + '<div class="ap-ft"><span class="f-mono">5,000 SIMULATED SEASONS' + (m.prev ? ' · CHANGE SINCE GW' + m.prev : '') + '</span>' + apMark + '</div></div>';
}
function market(m) {
  return '<div class="ap-panel mkt"><div class="mk-l"><span class="f-mono ap-meta">THE BAHA MARKET</span><b class="f-cond mk-q">' + esc(m.team) + ' to finish last</b><span class="f-mono mk-r">RESOLVES GW38 · TABLE NOW ' + m.pos + (['', 'ST', 'ND', 'RD'][m.pos] || 'TH') + '</span></div>'
    + '<div class="mk-v"><b class="f-cond">' + oddsTxt(m.v) + '</b><span class="f-mono">CHANCE</span>' + (m.prev !== null && m.prev !== undefined ? '<span class="f-mono mk-p">GW' + m.prevGw + ' ' + oddsTxt(m.prev) + '</span>' : '') + '</div>'
    + '<div class="ap-ft fwide"><span class="f-mono">5,000 SIMULATED SEASONS</span>' + apMark + '</div></div>';
}
function quote(m) {
  const L = String(m.line).toUpperCase();
  const size = L.length <= 14 ? 14 : L.length <= 26 ? 11.5 : L.length <= 42 ? 9.6 : L.length <= 80 ? 7.8 : 6.4;
  const stamp = m.verdict === 'won' ? '<span class="aq-st won f-cond">CALLED IT</span>' : m.verdict === 'lost' ? '<span class="aq-st lost f-cond">RECEIPT</span>' : '';
  return '<div class="aq' + (m.re ? ' re' : '') + '"><span class="aq-q f-cond" aria-hidden="true">“</span><span class="dd-tag f-cond aq-tag">' + (m.re ? 'Response' : 'Press conference') + '</span>'
    + (m.re ? '<div class="aq-re"><span class="f-mono">' + esc(String(m.re.who).toUpperCase()) + ' SAID</span><b class="f-cond">“' + esc(m.re.line) + '”</b></div>' : '')
    + '<b class="aq-t f-cond" style="font-size:' + size + 'cqw">' + esc(L) + '</b>'
    + (m.chip ? '<div class="aq-call f-mono"><span>CALLING</span><b>' + esc(m.chip) + '</b>' + (m.p != null ? '<em>MODEL ' + (m.p < .01 ? '<1' : m.p > .99 ? '>99' : Math.round(m.p * 100)) + '%</em>' : '') + '</div>' : '')
    + '<div class="aq-by">' + crest(m.team, 32) + '<span><b class="f-cond">' + esc(String(m.who).toUpperCase()) + '</b><em class="f-mono">' + esc(m.team.toUpperCase()) + '</em></span>' + apMark + '</div>' + stamp + '</div>';
}
/* a rumour: what's being said now, where it came from, how far it has travelled */
function whisper(m) {
  const st = m.status === 'confirmed' ? '<span class="aq-st won f-cond">CONFIRMED</span>' : m.status === 'denied' ? '<span class="aq-st lost f-cond">DENIED</span>' : '';
  const L = String(m.text);
  return '<div class="fwh">' + (m.about ? '<span class="fwh-crest">' + crest(m.about, 120) + '</span>' : '')
    + '<span class="dd-tag f-cond fwh-tag">Rumour' + (m.about ? ' · about ' + esc(firstOf(m.about)) : '') + '</span>'
    + '<b class="fwh-t f-cond" style="font-size:' + (L.length <= 40 ? 9.4 : L.length <= 80 ? 7.6 : 6.2) + 'cqw">“' + esc(L) + '”</b>'
    + (m.hops > 1 ? '<span class="fwh-first f-mono">FIRST HEARD: “' + esc(m.first) + '”</span>' : '')
    + '<div class="fwh-by f-mono"><span>SOURCE: ' + esc(m.src) + '</span><span>HEARD ' + m.hops + (m.hops === 1 ? ' TIME' : ' TIMES') + ' · ' + m.confirms + ' CONFIRM · ' + m.denies + ' DENY</span></div>'
    + '<div class="fwh-mk">' + apMark + '</div>' + st + '</div>';
}
/* breaking news: a club under investigation (Archizio's black and lime) */
function probe(m) {
  return '<div class="fpr"><div class="fpr-bar f-cond"><span>BREAKING</span><i></i><span>BREAKING</span><i></i><span>BREAKING</span></div>'
    + '<span class="fpr-crest">' + crest(m.team, 120) + '</span>'
    + '<div class="fpr-t f-cond"><b>UNDER</b><b>INVESTIGATION</b></div>'
    + '<div class="fpr-s f-mono">' + esc(String(m.team).toUpperCase()) + ' · ' + esc(m.rec) + ' · ' + (m.pos === 1 ? '1ST' : m.pos === 2 ? '2ND' : m.pos === 3 ? '3RD' : m.pos + 'TH') + '</div>'
    + '<div class="fpr-by">' + apMark + '</div></div>';
}
/* the receipt: the quote, the call, what happened, stamped */
function receipt(m) {
  const v = m.verdict, st = v === 'won' ? 'CALLED IT' : v === 'lost' ? 'RECEIPT' : 'PENDING';
  return '<div class="frc frc-' + v + '"><div class="frc-paper">'
    + '<div class="frc-h f-mono"><span>RECEIPT · GW' + m.gw + '</span><span>' + esc(String(m.team).toUpperCase()) + '</span></div>'
    + '<div class="frc-q f-cond">“' + esc(m.line) + '”</div>'
    + '<div class="frc-by f-mono">' + esc(String(m.who).toUpperCase()) + '</div>'
    + '<div class="frc-rows f-mono"><span>CALLED</span><b>' + esc(m.chip || '') + '</b>' + (m.p != null ? '<span>MODEL SAID</span><b>' + (m.p < .01 ? '<1' : Math.round(m.p * 100)) + '%</b>' : '') + '<span>' + (v === 'running' ? 'SO FAR' : 'RESULT') + '</span><b>' + esc(m.result || '') + '</b></div>'
    + '</div><span class="frc-st f-anton">' + st + '</span>' + crest(m.team, 40) + '</div>';
}
/* a post quoting another: the original, small and tappable */
function qt(m) {
  const P = typeof window !== 'undefined' && window.__postById ? window.__postById(m.ref) : null;
  if (!P) return '';
  return '<div class="fqt">' + renderPost(P, { compact: true }) + '</div>';
}

/* ============================== CLARK ============================== */
/* Clark's thumbnails: nine looks, picked per post from a stable hash so the feed never runs two the same in a row
   and every phone shows the same one. A builder can pin a look with lock: true. */
const TH_GENERAL = ['split', 'yellow', 'stripes', 'flame', 'breaking', 'zoom', 'chart', 'static'];
const TH_NUMBER = ['number', 'split', 'flame', 'zoom', 'chart', 'static', 'stripes'];
const CRASH = (up) => '<svg class="fct-ch" viewBox="0 0 160 90" preserveAspectRatio="none" aria-hidden="true"><path d="' + (up ? 'M0 80 L28 70 L46 74 L70 50 L92 56 L118 24 L136 30 L160 6' : 'M0 14 L24 20 L44 12 L66 34 L86 28 L108 58 L128 52 L160 86') + '" fill="none" stroke="' + (up ? '#19D27A' : '#FF3B3B') + '" stroke-width="3.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
export function thumbStyle(m, post) {
  if (m.lock && m.style) return m.style;
  if (m.team2 && m.team) return 'vs';
  const t1 = String(m.t1 || ''), numeric = /^[+\-−]?\d/.test(t1) && t1.length <= 12;
  const pool = numeric ? TH_NUMBER : TH_GENERAL;
  return pool[hash((post && post.id) || t1) % pool.length];
}
function thumb(m, post, compact) {
  const t1 = String(m.t1), t2 = String(m.t2 || '');
  const style = thumbStyle(m, post), up = /^\+/.test(t1) || /UP|HOT|ABOVE|RECORD|CALLED/i.test(t1 + ' ' + t2);
  const deco = { split: '<i class="fct-y"></i>', yellow: '<i class="fct-r"></i>', stripes: '<i class="fct-st"></i>', flame: '<i class="fct-fl"></i>',
    breaking: '<i class="fct-bk f-anton">BREAKING</i><i class="fct-tk"></i>', zoom: '<i class="fct-dots"></i>', chart: '<i class="fct-grid"></i>' + CRASH(up),
    static: '<i class="fct-noise"></i>', number: '<i class="fct-nb"></i>', vs: '<i class="fct-vsl"></i><i class="fct-vsr"></i>' }[style] || '';
  const subject = style === 'vs'
    ? '<span class="fct-crest l">' + crest(m.team, 120) + '</span><span class="fct-crest r">' + crest(m.team2, 120) + '</span><b class="fct-vst f-anton">VS</b>'
    : (m.img ? '<span class="fct-stk"><img src="' + esc(m.img) + '" alt="" decoding="async"></span>' : m.code ? '<span class="fct-stk">' + cut(m.code, '', nameOf(m.code)) + '</span>' : m.team ? '<span class="fct-crest">' + crest(m.team, 120) + '</span>' : '');
  const big = style === 'number' ? fit(t1, 52, 30, .42) : style === 'vs' ? fit(t1, 88, 11, .4) : fit(t1, 56, 16.5, .4);
  return '<div class="fct fct-' + style + '">' + deco + subject
    + (style === 'zoom' && (m.code || m.img) ? '<i class="fct-ring"></i>' : '')
    + (compact || style === 'breaking' ? '' : '<span class="fct-lbl">THE TERRACE</span>')
    + '<span class="fct-ttl"><b class="f-anton fct-t1" style="font-size:' + big + 'cqw">' + esc(t1) + '</b>' + (t2 ? '<b class="f-anton fct-t2" style="font-size:' + fit(t2, style === 'vs' ? 80 : 58, style === 'vs' ? 6.4 : 8.4, .43) + 'cqw">' + esc(t2) + '</b>' : '') + '</span>'
    + ((m.code || m.img) && !compact && (style === 'split' || style === 'yellow' || style === 'stripes') ? ARROW : '')
    + (m.lo && !compact ? '<span class="fct-lo f-anton">' + esc(m.lo) + '</span>' : '')
    + (compact ? '<span class="fct-lbl lo">THE TERRACE</span>' : '')
    + '<span class="fct-chip' + (m.live ? ' live' : '') + '">' + esc(m.chip || '') + '</span>'
    + '<span class="fct-play" aria-hidden="true">' + PLAY + '</span></div>';
}
function poll(m, post) {
  const opts = [['h', m.h], ['a', m.a], ['d', null]];
  const res = m.live, done = res && res.done;
  const won = done ? (res.hs > res.as ? 'h' : res.as > res.hs ? 'a' : 'd') : null;
  const V = votes(post.id, post.gw), pickd = V.mine, show = !m.open || !!pickd || V.n >= 3;
  const bar = k => { const n = V.by[k].length, w = V.n ? Math.round(n / V.n * 100) : 0; return show ? '<i style="width:' + w + '%"></i><span class="fcp-v"><span class="fcp-who">' + esc(V.by[k].slice(0, 3).map(firstOf).join(', ') + (V.by[k].length > 3 ? ' +' + (V.by[k].length - 3) : '')) + '</span><b class="n">' + n + '</b></span>' : '<i></i>'; };
  return '<div class="fcp' + (show ? ' shown' : '') + '">' + opts.map(([k, t]) => '<button class="fcp-o' + (pickd === k ? ' on' : '') + (won === k ? ' won' : '') + '"' + (m.open ? ' data-fx="poll:' + esc(post.id) + ':' + k + '"' : ' disabled') + '>'
    + (t ? crest(t, 24) : '<span class="fcp-eq">=</span>') + '<b>' + (t ? esc(t) : 'A draw') + '</b>'
    + (won === k ? '<span class="fcp-r">RESULT</span>' : '') + bar(k) + '</button>').join('') + '</div>'
    + '<div class="fcp-ft"><span>' + (m.open ? (pickd ? 'Your vote is in · ' : signedIn() ? '' : 'Sign in to vote · ') + V.n + ' of eight voted · closes at the deadline' : 'Poll closed · ' + V.n + ' of eight voted' + (pickd ? ' · you said ' + esc(pickd === 'd' ? 'a draw' : short(pickd === 'h' ? m.h : m.a)) : '')) + '</span>'
    + (done ? '<span class="fcp-m">' + (D.provOver ? 'Provisional: ' : 'Result: ') + '<b>' + res.hs + '–' + res.as + '</b></span>'
      : '<span class="fcp-m">The model' + (res ? ' now' : '') + ': ' + esc(short(m.fav)) + ' <b' + (m.fav === youOf() ? ' class="you-c"' : '') + '>' + Math.max(m.w.h, m.w.a) + '%</b></span>') + '</div>';
}
function stamp(m) {
  return '<div class="fstamp"><span class="fstamp-b"><b class="f-anton">' + esc(m.big) + '</b><span>' + esc(m.sub) + '</span></span><span class="fstamp-c">' + crest(m.a, 40) + '<i>v</i>' + crest(m.b, 40) + '</span></div>';
}
function robbed(m) {
  const mx = Math.max(m.ap, m.pts, 1);
  return '<div class="cr-meter"><div class="crm-r"><span>League points</span><i style="width:' + Math.max(2, m.pts / mx * 100) + '%"></i><b class="f-anton">' + m.pts + '</b></div>'
    + '<div class="crm-r all"><span>All-play</span><i style="width:' + Math.max(2, m.ap / mx * 100) + '%"></i><b class="f-anton">' + f1(m.ap) + '</b></div></div>';
}

/* ============================== MALCOLM ============================== */
function scoreLine(m) {
  if (m.state === 'pred') return '<span class="fsb-sc pred"><b class="n">' + f1(m.ph) + '</b><i></i><b class="n">' + f1(m.pa) + '</b></span>';
  return '<span class="fsb-sc"><b class="n">' + m.hs + '</b><i></i><b class="n">' + m.as + '</b></span>';
}
function winRow(w, h, a, was) {
  const [ch, ca] = sideCols(h, a);
  return '<div class="fsb-w"><div class="fsb-wl"><b class="n" style="color:' + ch + '">' + w.h + '%</b><span>' + (was ? 'was ' + was.h + '%' : 'win chance') + '</span><span class="fsb-d">draw ' + w.d + '%</span><span>' + (was ? 'was ' + was.a + '%' : '') + '</span><b class="n" style="color:' + ca + '">' + w.a + '%</b></div>' + UI.wbar(w.h / 100, w.d / 100, w.a / 100, ch, ca, true) + '</div>';
}
function scorebug(m) {
  const lab = { pred: 'GW' + m.gw + ' · PREDICTED', live: '<span class="live-dot"><i></i>LIVE</span>', ft: 'FULL TIME', prov: 'FULL TIME · PROVISIONAL' }[m.state];
  const right = m.state === 'ft' || m.state === 'prov' ? 'GAMEWEEK ' + m.gw : m.nm ? esc(m.nm.toUpperCase()) : 'GAMEWEEK ' + m.gw;
  const st = m.star;
  return '<div class="fmb' + (m.state === 'ft' || m.state === 'prov' ? ' ft' : '') + '"><i class="fmb-edge"></i>'
    + '<div class="fmb-hd"><b class="n">' + lab + '</b><span class="n">' + right + '</span></div>'
    + '<div class="fsb-row"><span class="fsb-t">' + crest(m.h, 52) + '<b>' + esc(m.h) + '</b></span>' + scoreLine(m) + '<span class="fsb-t">' + crest(m.a, 52) + '<b>' + esc(m.a) + '</b></span></div>'
    + ((m.state === 'ft' || m.state === 'prov') && m.nm ? '<div class="fsb-nm">' + esc(m.nm.toUpperCase()) + '</div>' : '')
    + (m.state === 'live' ? '<div class="fsb-proj n">PROJ FINAL ' + f1(m.ph) + ' – ' + f1(m.pa) + '</div>' : '')
    + (m.w ? winRow(m.w, m.h, m.a, m.was) : '')
    + (st ? '<div class="fsb-star" data-open="player:' + esc(st.code) + '">' + UI.face(st.code, 48) + '<span class="fsb-st"><em>STAR MAN</em><b>' + esc(st.name) + ' · ' + esc(short(st.team)) + '</b>' + (st.line ? '<i>' + esc(st.line.toUpperCase()) + '</i>' : '') + '</span><span class="fsb-sp"><b class="n">' + st.pts + '</b><em>PTS</em></span></div>' : '')
    + '</div>';
}
function voicenote(m, post) {
  return '<div class="fmb vn"><i class="fmb-edge"></i><div class="vn-top">'
    + '<button class="vn-play" data-fx="speak:' + esc(post.id) + '" aria-label="Play the preview">' + PLAY + '</button>'
    + '<span class="vn-mid"><b>' + esc(m.nm || (short(m.h) + ' v ' + short(m.a))) + '</b>' + wave(post.id) + '<span class="vn-cap">GW' + m.gw + ' PREVIEW · READ ALOUD BY YOUR PHONE</span></span></div>'
    + '<div class="vn-bug"><span class="vb-t">' + crest(m.h, 24) + '<b class="n">' + esc(short(m.h).toUpperCase()) + '</b></span><span class="n vb-v">v</span><span class="vb-t">' + crest(m.a, 24) + '<b class="n">' + esc(short(m.a).toUpperCase()) + '</b></span>'
    + '<span class="vb-w n">WIN CHANCE <b style="color:' + sideCols(m.h, m.a)[0] + '">' + m.w.h + '</b>–<b style="color:' + sideCols(m.h, m.a)[1] + '">' + m.w.a + '</b></span></div></div>';
}
function board(m) {
  return '<div class="fmb"><i class="fmb-edge"></i><div class="fmb-hd"><b class="n">' + (m.live ? '<span class="live-dot"><i></i>LIVE</span>' : 'PREDICTED') + '</b><span class="n">GAMEWEEK ' + m.gw + '</span></div>'
    + m.rows.map(r => {
      const [ch, ca] = sideCols(r.h, r.a);
      const sc = m.live ? '<b class="n">' + r.hs + '</b><i>–</i><b class="n">' + r.as + '</b>' : '<b class="n">' + f1(r.ph) + '</b><i>–</i><b class="n">' + f1(r.pa) + '</b>';
      return '<div class="fbd-r">' + (r.nm ? '<span class="fbd-nm">' + esc(r.nm.toUpperCase()) + '</span>' : '')
        + '<div class="fbd-m"><span class="fbd-t">' + crest(r.h, 22) + '<b>' + esc(short(r.h)) + '</b></span><span class="fbd-s">' + sc + '</span><span class="fbd-t r"><b>' + esc(short(r.a)) + '</b>' + crest(r.a, 22) + '</span></div>'
        + '<div class="fbd-w"><span class="n">' + r.w.h + '%</span>' + UI.wbar(r.w.h / 100, r.w.d / 100, r.w.a / 100, ch, ca, true) + '<span class="n">' + r.w.a + '%</span></div>'
        + (m.live ? '<div class="fbd-pf n">PROJ FINAL ' + f1(r.ph) + ' – ' + f1(r.pa) + '</div>' : '') + '</div>';
    }).join('') + '<div class="fmb-ft">' + (m.live ? 'Bars show each side’s win chance now.' : 'Bars show each side’s win chance. Scores are the model’s projection.') + '</div></div>';
}
function results(m) {
  return '<div class="fmb res"><i class="fmb-edge"></i><div class="fmb-hd ftg"><b class="n">FULL TIME</b><span class="n">GAMEWEEK ' + m.gw + '</span></div>'
    + m.rows.map(r => '<div class="fbd-r"><div class="fbd-m"><span class="fbd-t">' + crest(r.home, 22) + '<b>' + esc(short(r.home)) + '</b></span><span class="fbd-s"><b class="n' + (r.hs > r.as ? ' w' : '') + '">' + r.hs + '</b><i>–</i><b class="n' + (r.as > r.hs ? ' w' : '') + '">' + r.as + '</b></span><span class="fbd-t r"><b>' + esc(short(r.away)) + '</b>' + crest(r.away, 22) + '</span></div></div>').join('')
    + (m.star ? '<div class="fsb-star" data-open="player:' + esc(m.star.code) + '">' + UI.face(m.star.code, 44) + '<span class="fsb-st"><em>STAR OF THE WEEK</em><b>' + esc(m.star.name) + ' · ' + esc(short(m.star.team)) + '</b></span><span class="fsb-sp"><b class="n">' + m.star.pts + '</b><em>PTS</em></span></div>' : '')
    + '</div>';
}
function table(m) {
  return '<div class="fmb"><i class="fmb-edge"></i><div class="fmb-hd ftg"><b class="n">THE TABLE</b><span class="n">AFTER GW' + m.gw + '</span></div><div class="ftb">'
    + m.ord.map(t => { const d = m.before[t] - m.now[t], s = D.st.find(x => x.Team === t) || {};
      return '<div class="ftb-r' + (t === youOf() ? ' me' : '') + '"><b class="n ftb-p">' + m.now[t] + '</b><span class="ftb-m ' + (d > 0 ? 'up' : d < 0 ? 'dn' : '') + '">' + (d > 0 ? '▲' + d : d < 0 ? '▼' + (-d) : '–') + '</span>' + crest(t, 18) + '<span class="ftb-n">' + esc(t) + '</span><b class="n ftb-pts">' + (num(s['League Pts']) || 0) + '</b></div>'; }).join('')
    + '</div></div>';
}
function article(m) {
  return '<a class="far" href="' + esc(m.href) + '"><span class="far-k"><b class="n">GW' + m.gw + '</b><em>' + esc(m.kind.toUpperCase()) + '</em></span><span class="far-t"><b>' + esc(m.title) + '</b><span>' + esc(m.sub) + '</span></span><span class="far-go">' + UI.icon('chev', 16, 'var(--p300)') + '</span></a>';
}
function show(m, post) {
  const s = shows().find(x => x.gw === m.gw); if (!s) return '';
  return '<button class="fgs" data-fx="show:' + m.gw + '" aria-label="Watch the Gameweek ' + m.gw + ' show">'
    + '<span class="fgs-top"><span class="fgs-av f-cond">MT</span><span class="fgs-k">The Gameweek Show</span><span class="fgs-t n">' + mmss(s.dur) + '</span></span>'
    + '<span class="fgs-ttl f-cond">Gameweek ' + m.gw + '</span>'
    + '<span class="fgs-ch">' + s.j.chapters.map(c => '<span class="fgs-c">' + crest(c.home, 24) + '<b>' + esc(firstOf(c.home)) + '</b><i>v</i><b>' + esc(firstOf(c.away)) + '</b>' + crest(c.away, 24) + '</span>').join('') + '</span>'
    + '<span class="fgs-ft"><span class="fgs-play">' + PLAY + '</span><span class="fgs-by">Malcolm Tyre in the booth</span></span></button>';
}

/* ============================== JIVE ============================== */
function call(m, post, compact) {
  const o = m.out, a = m.alt;
  const row = (l, k, r) => '<div class="jr"><span class="l">' + l + '</span><span class="m">' + k + '</span><span class="r">' + r + '</span></div>';
  const W = m.kind === 'free' ? UI.waivers() : null, onWaivers = !!(W && W.phase === 'waivers');
  const note = m.kind === 'free' ? (onWaivers ? firstName(a.name) + '’s on waivers, gaffer. Claim by ' + UI.soonWhen(W.wv) + '. Your call.' : firstName(a.name) + '’s a free agent, gaffer. Your call.') : firstName(a.name) + '’s on your bench, gaffer. Your call.';
  return '<div class="fjb">' + PITCH
    + '<div class="fjb-hd"><span class="f-mono fjb-t">SELECTION CALL</span><span class="f-mono fjb-m">GW' + m.gw + ' · ' + esc(m.pos) + '</span></div>'
    + '<div class="jc"><button class="jc-p" data-open="player:' + esc(o.code) + '"><span class="jc-f dash">' + cut(o.code, '', o.name) + '</span><b class="f-mono">' + esc(o.name.toUpperCase()) + '</b><span class="f-mono">' + esc(o.club) + ' · in your XI</span></button>'
    + '<span class="f-chalk jc-v">v</span>'
    + '<button class="jc-p" data-open="player:' + esc(a.code) + '"><span class="jc-f gold">' + cut(a.code, '', a.name) + '</span><b class="f-mono">' + esc(a.name.toUpperCase()) + '</b><span class="f-mono">' + esc(a.club) + ' · ' + (m.kind === 'free' ? (onWaivers ? 'on waivers' : 'free agent') : 'your bench') + '</span></button></div>'
    + '<div class="jrs">' + row(o.mins, 'MINUTES, LAST ' + o.n, a.mins) + row(o.starts, 'STARTS', a.starts) + row(Math.round(o.ps * 100) + '%', 'START CHANCE', Math.round(a.ps * 100) + '%') + row(f1(o.pts), 'PROJECTED', f1(a.pts)) + '</div>'
    + '<div class="fjb-note"><span class="f-chalk">' + esc(note) + '</span>' + chalkArrow + '</div>'
    + (compact ? '' : '<div class="fjb-btns">' + (m.kind === 'free' ? '<a class="jbtn on f-mono" href="#/team/transfers">See free-agent ' + posWord(m.pos) + '</a>' : '<a class="jbtn on f-mono" href="#/team/lineup">Open the lineup</a>')
      + '<button class="jbtn f-mono" data-fx="keep:' + esc(m.key) + '">Keep ' + esc(o.name) + '</button></div>')
    + '</div>';
}
const firstName = n => String(n).replace(/^[A-Z]\.\s?/, '');
const posWord = p => ({ GKP: 'keepers', DEF: 'defenders', MID: 'midfielders', FWD: 'forwards' }[p] || 'players');
function fitness(m, post, compact) {
  const xi = m.xi.slice(0, 3), more = m.xi.length - xi.length;
  const benchTxt = m.bench.map(c => { const p = UI.player(c); return p ? esc(p.Player.toUpperCase()) + ' ' + (p.Status === 'd' ? chanceOf(p) + '%' : statusWord(p).toUpperCase()) : ''; }).filter(Boolean);
  return '<div class="fjb fit">' + PITCH + '<div class="fjb-hd"><span class="f-mono fjb-t">FITNESS BOARD</span><span class="f-mono fjb-m">GW' + D.gw + '</span></div>'
    + (xi.length ? '<div class="jf">' + xi.map(c => { const p = UI.player(c); return '<button class="jf-p" data-open="player:' + esc(c) + '"><span class="jc-f dash sm">' + cut(c, '', p.Player) + '</span><b class="f-mono">' + esc(p.Player.toUpperCase()) + '</b><span class="f-chalk">' + (p.Status === 'd' ? chanceOf(p) + '%' : esc(statusWord(p))) + '</span></button>'; }).join('') + '</div>' : '<div class="jf-clear f-chalk">Your XI is clear.</div>')
    + (more > 0 ? '<div class="f-mono jf-more">+' + more + ' MORE IN THE XI: ' + m.xi.slice(3).map(c => esc((UI.player(c) || {}).Player || '').toUpperCase()).join(', ') + '</div>' : '')
    + (benchTxt.length ? '<div class="f-mono jf-b">BENCH: ' + benchTxt.join(' · ') + '</div>' : '')
    + '</div>';
}
function scout(m) {
  const p = UI.player(m.code);
  return '<div class="fjb sc">' + PITCH + '<div class="fjb-hd"><span class="f-mono fjb-t">SCOUTING</span><span class="f-mono fjb-m">' + esc(short(m.opp).toUpperCase()) + ' · GW' + D.gw + '</span></div>'
    + '<div class="jsc">' + m.xi.map((x, i) => { const q = UI.player(x.code); return '<button class="jsc-p' + (i === 0 ? ' top' : '') + '" data-open="player:' + esc(x.code) + '"><span class="jc-f ' + (i === 0 ? 'gold' : 'dash') + ' sm">' + cut(x.code, '', q && q.Player) + '</span><b class="f-mono">' + esc((q && q.Player || '').toUpperCase()) + '</b><span class="f-mono jsc-v">' + f1(x.ep) + '</span></button>'; }).join('') + '</div>'
    + '<div class="fjb-note"><span class="f-chalk">Watch ' + esc(p ? p.Player : '') + ', gaffer.</span></div></div>';
}
function subs(m) {
  return '<div class="fjb sc">' + PITCH + '<div class="fjb-hd"><span class="f-mono fjb-t">AUTO-SUBS</span><span class="f-mono fjb-m">GW' + D.gw + ' · LIVE</span></div>'
    + m.subs.map(s => { const o = UI.player(s.out), i = UI.player(s.inn); return '<div class="jsub"><span class="f-mono jsub-o">' + esc((o && o.Player || '').toUpperCase()) + '</span><span class="f-chalk">→</span><button class="f-mono jsub-i" data-open="player:' + esc(s.inn) + '">' + esc((i && i.Player || '').toUpperCase()) + '</button><b class="f-mono">' + s.pts + ' PTS</b></div>'; }).join('')
    + '</div>';
}

/* ============================== the post ============================== */
const MEDIA = { stamp, deal, race, treat, injcards, derbies, fa, r1, stat, odds, market, quote, receipt, qt, probe, whisper, thumb, poll, robbed, scorebug, voicenote, board, results, table, article, show, call, fitness, scout, subs };
/* media that holds its own buttons or links can't sit inside the tap-to-open area */
const LIVE_MEDIA = { qt: 1, deal: 1, poll: 1, voicenote: 1, show: 1, call: 1, fitness: 1, scout: 1, subs: 1, article: 1, injcards: 1, treat: 1, fa: 1, r1: 1, scorebug: 1, results: 1 };

export function mediaHTML(post, compact) {
  const m = post.media; if (!m || !MEDIA[m.type]) return '';
  try { return MEDIA[m.type](m, post, compact); } catch (e) { console.error(e); return ''; }
}
function head(post, opt) {
  const V = VOICES[post.voice];
  const handle = post.voice === 'jive' ? 'Assistant manager' : V.handle;
  return '<div class="fp-h"' + (opt.open ? ' data-open="post:' + esc(post.id) + '"' : '') + '>' + avatar(post.voice, opt.compact ? 32 : 40)
    + '<div class="fp-who"><b><span class="fp-nm">' + esc(V.name) + '</span>' + tagChip(post.voice) + (post.viral ? '<span class="fp-viral">GOING VIRAL</span>' : '') + '</b><span>' + esc(handle) + (post.time ? ' · ' + esc(post.time) : '') + '</span></div>'
    + (opt.unread ? '<i class="fp-new" aria-label="New"></i>' : '') + '</div>';
}
const nb = t => String(t).replace(/(\d+(?:\.\d+)?%?)–(\d+(?:\.\d+)?%?)/g, '<span class="nw">$1–$2</span>');
export function renderPost(post, opt = {}) {
  if (!post) return '';
  const id = esc(post.id);
  if (opt.compact) {
    const m = post.media, type = m && m.type;
    let media = '';
    try { media = type === 'thumb' ? thumb(m, post, true) : miniMedia(post); } catch (e) { console.error(e); }
    const thumbFirst = type === 'thumb';
    return '<article class="fpc v-' + post.voice + (thumbFirst ? ' th' : '') + '" data-open="post:' + id + '">'
      + (post.voice === 'malcolm' ? '<i class="fmb-edge"></i>' : '')
      + (thumbFirst ? media + '<div class="fpc-b">' + head(post, { compact: true }) + '<div class="fpc-tx">' + nb(post.text) + '</div></div>'
        : '<div class="fpc-b">' + head(post, { compact: true }) + '<div class="fpc-tx">' + nb(post.text) + '</div>' + media + '</div>')
      + '</article>';
  }
  const m = post.media, live = m && LIVE_MEDIA[m.type];
  const media = opt.noMedia ? '' : mediaHTML(post, false);
  const link = (post.links || [])[0];
  const linkHTML = link ? (link.open ? '<button class="fp-lk" data-open="' + esc(link.open) + '">' + esc(link.label) + ' ›</button>' : '<a class="fp-lk" href="' + esc(link.href) + '">' + esc(link.label) + ' ›</a>') : '';
  return '<article class="fp v-' + post.voice + (opt.unread ? ' unread' : '') + (opt.big ? ' big' : '') + (post.hot ? ' hot' : '') + '" id="p-' + id.replace(/[^\w-]/g, '_') + '">'
    + head(post, { open: !opt.big, unread: opt.unread })
    + '<div class="fp-tx"' + (opt.big ? '' : ' data-open="post:' + id + '"') + '>' + nb(post.text) + '</div>'
    + (media ? (live || opt.big ? '<div class="fp-media">' + media + '</div>' : '<div class="fp-media" data-open="post:' + id + '">' + media + '</div>') : '')
    + (post.audience === 'you' && post.voice !== 'jive' ? '<div class="fp-only">Only you can see this. It stays on this phone.</div>' : '')
    + (post.facts ? '<div class="fp-ft"><span class="fp-facts"' + (opt.big ? '' : ' data-open="post:' + id + '"') + '>' + esc(post.facts) + '</span></div>' : '')
    + (opt.noActs || post.audience === 'you' ? '' : reactBar(post))
    + (opt.noActs ? '' : '<div class="fp-acts">' + (post.share ? '<button class="fp-sh" data-fx="share:' + id + '">' + UI.icon('share', 15, 'currentColor', 1.9) + 'Share</button>' : '') + linkHTML + '</div>')
    + '</article>';
}
/* reactions: line icons, counts, yours lit. Words in the log, never emoji on screen */
const RX_ICON = {
  fire: '<path d="M12 3.2c.6 3-1.6 4.4-2.9 6.2-1.2 1.7-1.6 3.9-.6 5.8A5.3 5.3 0 0 0 12 20.8a5.4 5.4 0 0 0 5.4-5.6c-.1-2.6-1.8-4-2.6-6-.4 1.5-1.2 2.4-2.1 2.9.5-3.2-.1-6.3-.7-8.9z"/><path d="M12 20.8c-1.6 0-2.7-1.2-2.7-2.7 0-1.6 1.3-2.4 1.9-3.6.3 1 .9 1.5 1.5 1.8.1-.8.5-1.5 1-2 .6 1.2 1.1 2.2 1.1 3.6 0 1.6-1.2 2.9-2.8 2.9z"/>',
  laugh: '<circle cx="12" cy="12" r="8.6"/><path d="M8.2 10.2q1.1-1.4 2.2 0M13.6 10.2q1.1-1.4 2.2 0"/><path d="M7.8 13.4h8.4a4.2 4.2 0 0 1-8.4 0z"/>',
  clown: '<circle cx="12" cy="14.6" r="6.9"/><path d="M8.4 8.6 12 2.6l3.6 6"/><circle cx="12" cy="2.4" r=".9" fill="currentColor"/><circle cx="12" cy="15.2" r="1.9" class="rx-nose"/><path d="M9.3 12.6h.01M14.7 12.6h.01" stroke-width="2.4"/><path d="M9 17.6q3 2.2 6 0"/>',
  eyes: '<path d="M2.6 12s3.4-5.6 9.4-5.6 9.4 5.6 9.4 5.6-3.4 5.6-9.4 5.6S2.6 12 2.6 12z"/><circle cx="12" cy="12" r="2.6"/>',
  bin: '<path d="M4 6.8h16"/><path d="M9.4 6.8V4.6h5.2v2.2"/><path d="M6.2 6.8l1 13.2h9.6l1-13.2"/><path d="M10 10.4v6.2M14 10.4v6.2"/>',
};
const rxIcon = k => '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + RX_ICON[k] + '</svg>';
export function reactBar(post) {
  const R = reactions(post.id), id = esc(post.id);
  return '<div class="frx" data-rx="' + id + '">' + REACTS.map(x => {
    const n = R.who[x.k].length, on = R.mine.has(x.k);
    return '<button class="frx-b rx-' + x.k + (on ? ' on' : '') + (n ? ' has' : '') + '" data-fx="rx:' + id + ':' + x.k + '" aria-pressed="' + on + '" aria-label="' + x.label + (n ? ', ' + n : '') + '">' + rxIcon(x.k) + (n ? '<b class="n">' + n + '</b>' : '') + '</button>';
  }).join('') + '</div>';
}
/* compact media for rails: one strip per format, in the voice's own look */
const faceRow = (codes, px = 34) => '<span class="mini-faces">' + codes.slice(0, 4).map(c => UI.face(c, px, { bg: '#1C1C1C' })).join('') + '</span>';
const apStrip = (big, label, extra) => '<div class="mini-ap"><b class="f-cond">' + big + '</b><span class="f-mono">' + label + '</span>' + (extra || '') + '</div>';
function miniMedia(post) {
  const m = post.media; if (!m) return '';
  switch (m.type) {
    case 'scorebug': case 'voicenote': return miniBug(m);
    case 'deal': return miniDeal(m);
    case 'call': return miniCall(m);
    case 'fa': return apStrip(String(m.rows[0].l3), 'LAST ' + m.rows[0].n + ' · ' + esc(String(m.rows[0].name).toUpperCase()), faceRow([m.rows[0].code], 36));
    case 'r1': return apStrip(String(m.rows[0].pts), 'ROUND ONE · ' + esc(m.rows[0].name.toUpperCase()), faceRow(m.rows.map(r => r.code), 30));
    case 'odds': return apStrip(oddsTxt(m.rows[0].v), 'TITLE · ' + esc(short(m.rows[0].team).toUpperCase()), crest(m.rows[0].team, 30));
    case 'market': return apStrip(oddsTxt(m.v), 'TO FINISH LAST · ' + esc(short(m.team).toUpperCase()), crest(m.team, 30));
    case 'stat': return apStrip(esc(m.big), esc(m.label.toUpperCase()), m.team ? crest(m.team, 30) : '');
    case 'treat': return apStrip(String(m.groups.reduce((s2, g) => s2 + g.codes.length, 0)), 'FLAGGED STARTERS', faceRow(m.groups.flatMap(g => g.codes), 30));
    case 'injcards': return apStrip(m.chip ? 'BENCH' : statusWord(UI.player(m.codes[0])) || '', m.chip ? 'TEAM SHEETS' : 'FITNESS', faceRow(m.codes, 32));
    case 'race': return apStrip(String(m.rows.length), 'CONTESTED · GW' + m.gw, faceRow(m.rows.map(r => r.p && r.p.Code).filter(Boolean), 32));
    case 'derbies': return '<div class="mini-ap">' + m.fx.slice(0, 2).map(f => '<span class="mini-vs">' + crest(f.h, 22) + '<b>' + esc(firstOf(f.h)) + '</b><i>v</i><b>' + esc(firstOf(f.a)) + '</b>' + crest(f.a, 22) + '</span>').join('<i class="sep"></i>') + '<span class="f-mono">' + m.fx.length + (m.fx.length === 1 ? ' DERBY' : ' DERBIES') + '</span></div>';
    case 'quote': return '<div class="mini-ap q"><b class="f-cond">“' + esc(m.line) + '”</b>' + (m.chip ? '<span class="f-mono">' + esc(m.chip) + '</span>' : '') + '</div>';
    case 'receipt': return '<div class="mini-cl rc"><b class="f-anton">' + (m.verdict === 'won' ? 'CALLED IT' : m.verdict === 'lost' ? 'RECEIPT' : 'PENDING') + '</b><span>“' + esc(m.line) + '”</span></div>';
    case 'qt': return '';
    case 'whisper': return '<div class="mini-ap q"><b class="f-cond">“' + esc(m.text) + '”</b><span class="f-mono">RUMOUR · HEARD ' + m.hops + 'X</span></div>';
    case 'probe': return apStrip('UNDER INVESTIGATION', esc(String(m.team).toUpperCase()) + ' · ' + esc(m.rec), crest(m.team, 30));
    case 'stamp': return '<div class="mini-cl"><b class="f-anton">' + esc(m.big) + '</b><span>' + esc(firstOf(m.a)) + ' v ' + esc(firstOf(m.b)) + '</span></div>';
    case 'robbed': return '<div class="mini-cl"><b class="f-anton">' + m.pts + '</b><span>v ' + f1(m.ap) + ' all-play</span></div>';
    case 'poll': return '<div class="mini-cl">' + crest(m.h, 22) + '<span>' + esc(firstOf(m.h)) + ' v ' + esc(firstOf(m.a)) + '</span>' + crest(m.a, 22) + '<em>' + (m.open ? 'PICK' : 'CLOSED') + '</em></div>';
    case 'board': { const r = m.rows.find(x => x.h === youOf() || x.a === youOf()) || m.rows[0]; return miniBug({ h: r.h, a: r.a, ph: r.ph, pa: r.pa, hs: r.hs, as: r.as, state: m.live ? 'live' : 'pred' }); }
    case 'results': return m.star ? '<div class="mini-bug">' + UI.face(m.star.code, 30) + '<b class="n">' + esc(String(m.star.name).toUpperCase()) + '</b><span class="n">' + m.star.pts + ' PTS</span></div>' : '';
    case 'table': return '<div class="mini-bug">' + m.ord.slice(0, 3).map((t, i) => '<span class="mini-tb"><em class="n">' + (i + 1) + '</em>' + crest(t, 18) + '<b>' + esc(firstOf(t)) + '</b></span>').join('') + '<span class="n">AFTER GW' + m.gw + '</span></div>';
    case 'article': return '<div class="mini-bug"><b class="n">GW' + m.gw + ' ' + esc(m.kind.toUpperCase()) + '</b><span class="n">READ ›</span></div>';
    case 'show': { const sh = shows().find(x => x.gw === m.gw); return '<div class="mini-bug"><span class="mini-play">' + PLAY + '</span><b class="n">GW' + m.gw + ' SHOW</b><span class="n">' + (sh ? mmss(sh.dur) : '') + '</span></div>'; }
    case 'fitness': return '<div class="mini-call">' + m.xi.slice(0, 3).map(c => '<span>' + UI.face(c, 34) + '<b class="f-mono">' + chanceOf(UI.player(c)) + '%</b></span>').join('') + '</div>';
    case 'scout': return '<div class="mini-call"><span>' + UI.face(m.code, 38) + '<b class="f-mono">' + f1(m.ep) + '</b></span></div>';
    case 'subs': return '<div class="mini-call">' + m.subs.slice(0, 3).map(x => '<span>' + UI.face(x.inn, 32) + '<b class="f-mono">' + x.pts + (x.pts === 1 ? ' PT' : ' PTS') + '</b></span>').join('') + '</div>';
  }
  return '';
}
/* compact media for rails */
function miniBug(m) {
  const sc = m.state === 'pred' ? f1(m.ph) + '<i>–</i>' + f1(m.pa) : m.hs !== undefined ? m.hs + '<i>–</i>' + m.as : '<i>v</i>';
  return '<div class="mini-bug">' + crest(m.h, 22) + '<b class="n">' + esc(short(m.h).toUpperCase()) + '</b><span class="n">' + sc + '</span><b class="n">' + esc(short(m.a).toUpperCase()) + '</b>' + crest(m.a, 22) + '</div>';
}
function miniDeal(m) {
  const s = m.slides[0];
  return '<div class="mini-deal">' + UI.face(s.code, 44, { bg: '#1C1C1C' }) + '<span><em class="f-cond">Deal done' + (m.slides.length > 1 ? ' · ' + m.slides.length : '') + '</em><b class="f-cond">' + esc(m.slides.map(x => x.name).join(', ').toUpperCase()) + '</b></span></div>';
}
function miniCall(m) {
  return '<div class="mini-call"><span>' + UI.face(m.out.code, 38) + '<b class="f-mono">' + Math.round(m.out.ps * 100) + '%</b></span><span class="f-chalk">v</span><span>' + UI.face(m.alt.code, 38) + '<b class="f-mono">' + Math.round(m.alt.ps * 100) + '%</b></span></div>';
}
