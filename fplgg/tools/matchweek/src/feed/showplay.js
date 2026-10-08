/* feed/showplay.js — The Gameweek Show, full screen and vertical.
   Script: show/gwN.json (open, four chapters of five beats, close). Audio, one clip per line:
     · show/gwN/<clip>.mp3 in the repo (GW4, rendered by hand), or
     · rendered by Code.gs v3.11 with ElevenLabs into the Sheet and served by the web app (GET ?show=N).
   No audio yet = the same show with timed captions, so it plays from the moment the script is published.
   The picture is built live from the app's own data: the real XIs, the model's numbers, the press room. */
import * as UI from '../ui.js';
import { allArticles } from './articles.js';
import * as M from '../pages/matchday/model.js';
import { shows } from './facts.js';
import { quotes } from './social.js';
import { esc, firstOf } from './util.js';

const HOLD = { open: 7200, intro: 3400, xi: 5800, face: 5400, close: 5200 };
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
let Q = null;

/* ---------- audio: where the clips live ---------- */
const AUDIO = {};
function wavSilence() {
  const n = 2205, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 22050, true); v.setUint32(28, 44100, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
}
let SILENT = null;
export function audioFor(s) {
  if (AUDIO[s.gw]) return AUDIO[s.gw];
  if (s.j.audio !== 'sheet' && s.j.dur) {
    const urls = {}; s.clips.forEach(k => { urls[k] = s.base + k + '.mp3'; });
    return (AUDIO[s.gw] = Promise.resolve({ urls, durs: s.j.dur, from: 'repo' }));
  }
  if (!D.api) return Promise.resolve(null);
  const p = fetch(D.api + (D.api.indexOf('?') > -1 ? '&' : '?') + 'show=' + s.gw, { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null).then(r => {
      if (!r || !r.ok || !r.clips || !Object.keys(r.clips).length) { delete AUDIO[s.gw]; return null; }
      const urls = {}, durs = {};
      Object.keys(r.clips).forEach(k => {
        const c = r.clips[k]; if (!c || !c.b64) return;
        const bin = atob(c.b64), u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        urls[k] = URL.createObjectURL(new Blob([u8], { type: 'audio/mpeg' })); durs[k] = +c.secs || 0;
      });
      return { urls, durs, from: 'sheet', complete: !!r.complete };
    }).catch(() => { delete AUDIO[s.gw]; return null; });
  return (AUDIO[s.gw] = p);
}

/* ---------- the data behind a chapter ---------- */
const tableOf = () => (D.st || []).slice().sort((a, b) => num(b['League Pts']) - num(a['League Pts']) || num(b['Pts For']) - num(a['Pts For'])).map(r => r.Team);
function results(t, upTo) {
  return (D.fx || []).filter(f => fin(f.Finished) && num(f.GW) <= upTo && (f.Home === t || f.Away === t)).sort((a, b) => num(a.GW) - num(b.GW))
    .map(f => { const me = num(f.Home === t ? f['Home pts'] : f['Away pts']), op = num(f.Home === t ? f['Away pts'] : f['Home pts']); return me > op ? 'W' : me < op ? 'L' : 'D'; });
}
function chapterFx(c, gw) {
  const all = (D.fx || []).filter(f => num(f.GW) === gw);
  const f = all.find(x => (x.Home === c.home && x.Away === c.away) || (x.Home === c.away && x.Away === c.home)) || null;
  const live = gw === D.gw ? M.gwFx().findIndex(x => x === f || (x.Home === (f && f.Home) && x.Away === (f && f.Away))) : -1;
  return { f, i: live };
}

/* ---------- scenes ---------- */
const crestBig = (t, px) => '<span class="gs-cr">' + UI.crest(t, px) + '</span>';
function chips(list) { return '<span class="gs-form">' + list.slice(-5).map(r => '<i class="' + r.toLowerCase() + '">' + r + '</i>').join('') + '</span>'; }
function sceneOpen(s) {
  const rows = s.j.chapters.map(c => {
    const { f, i } = chapterFx(c, s.gw); if (!f) return '';
    const m = i > -1 ? M.mx(i) : null, w = m && m.win ? (m.flip ? { h: m.win.r, a: m.win.l } : { h: m.win.l, a: m.win.r }) : null;
    const dn = derbyName(f.Home, f.Away);
    return '<div class="gs-fx">' + UI.crest(f.Home, 30) + '<span class="gs-fxn"><b>' + esc(firstOf(f.Home)) + ' <i>v</i> ' + esc(firstOf(f.Away)) + '</b>' + (dn ? '<em>' + esc(dn) + '</em>' : '') + '</span>'
      + (w ? '<span class="gs-fxw n">' + w.h + '<i>–</i>' + w.a + '</span>' : '') + UI.crest(f.Away, 30) + '</div>';
  }).join('');
  const dl = gwDeadline(s.gw);
  return '<div class="gs-open">' + UI.mwMark(30) + '<span class="gs-k">Gameweek ' + s.gw + '</span><h2 class="gs-ttl f-cond">The Gameweek Show</h2><span class="gs-by">Malcolm Tyre in the booth</span>'
    + '<div class="gs-fxs">' + rows + '</div>' + (dl && s.gw === D.gw ? '<span class="gs-dl">Deadline ' + esc(UI.dayFull(dl)) + '</span>' : '') + '<span class="gs-wl">Win chance, the model</span></div>';
}
function sceneIntro(c, side, s) {
  const t = side === 'h' ? c.home : c.away, live = s.gw === D.gw;
  const r = typeof mpxRecord === 'function' ? mpxRecord(t) : null;
  const pos = tableOf().indexOf(t) + 1;
  let proj = null; try { if (live && M.hasProj()) proj = M.team(t).proj; } catch (e) { }
  return '<div class="gs-intro ' + side + '">' + crestBig(t, 168)
    + '<h2 class="gs-tn f-cond">' + esc(t) + '</h2><span class="gs-mg">' + esc(firstOf(t)) + '’s week</span>'
    + '<div class="gs-stats">' + (live && pos ? '<span><b class="n">' + ORD[pos] + '</b><em>in the table</em></span>' : '') + (live && r ? '<span><b class="n">' + UI.rec(r.w, r.d, r.l) + '</b><em>W–D–L</em></span>' : '')
    + (proj ? '<span><b class="n">' + M.f1(proj) + '</b><em>projected</em></span>' : '') + '</div>'
    + chips(results(t, s.gw - 1)) + '</div>';
}
function sceneXI(c, side, s) {
  const t = side === 'h' ? c.home : c.away;
  if (s.gw !== D.gw) return sceneIntro(c, side, s);
  let T = null; try { T = M.team(t); } catch (e) { }
  if (!T || !T.players.length) return sceneIntro(c, side, s);
  const star = String((c.star || {})[side] || '');
  const top = T.players.slice().sort((a, b) => (b.proj || 0) - (a.proj || 0))[0];
  const starCode = T.players.some(x => x.code === star) ? star : top ? top.code : '';
  const order = ['FWD', 'MID', 'DEF', 'GKP'];
  let k = 0;
  const rows = order.map((pos, ri) => {
    const g = T.players.filter(x => x.pos === pos); if (!g.length) return '';
    const delay = (3 - ri) * .32;
    return '<div class="gs-row n' + g.length + '">' + g.map(x => {
      const isStar = x.code === starCode;
      return '<span class="gs-tk' + (isStar ? ' star' : '') + (x.doubt || x.out ? ' flag' : '') + '" style="--d:' + (delay + (k++ % 5) * .05).toFixed(2) + 's">'
        + '<span class="gs-ph">' + UI.face(x.p, isStar ? 64 : 50) + (x.proj != null ? '<b class="gs-pj n">' + M.f1(x.proj) + '</b>' : '') + (x.doubt || x.out ? '<i class="gs-fl">' + (x.chance || 0) + '%</i>' : '') + '</span>'
        + '<span class="gs-nm">' + esc(x.p.Player) + '</span>' + (isStar ? '<span class="gs-st">Star man</span>' : '') + '</span>';
    }).join('') + '</div>';
  }).join('');
  return '<div class="gs-xi ' + side + '"><div class="gs-xih">' + UI.crest(t, 34) + '<span><b>' + esc(t) + '</b><em>' + esc(T.form) + (M.hasProj() ? ' · projected ' + M.f1(T.proj) : '') + '</em></span></div>'
    + '<div class="gs-pitch"><i class="gs-lines" aria-hidden="true"></i>' + rows + '</div></div>';
}
function quoteFor(c, gw) {
  let Qs = []; try { Qs = quotes(); } catch (e) { }
  const q = Qs.filter(x => x.gw === gw && (x.team === c.home || x.team === c.away)).sort((a, b) => b.at - a.at)[0];
  return q || null;
}
function sceneFace(c, s) {
  const { f, i } = chapterFx(c, s.gw); if (!f) return '';
  const H = f.Home, A = f.Away, [ch, ca] = UI.pairCols(H, A), dn = derbyName(H, A);
  const m = i > -1 ? M.mx(i) : null;
  let nums = '', bar = '';
  if (m && !m.final) {
    const ph = m.flip ? m.tr.proj : m.tl.proj, pa = m.flip ? m.tl.proj : m.tr.proj;
    if (M.hasProj()) nums = '<div class="gs-pred"><span class="gs-pk">Predicted</span><b class="n">' + M.f1(ph) + '<i>–</i>' + M.f1(pa) + '</b></div>';
    if (m.win) { const w = m.flip ? { h: m.win.r, d: m.win.d, a: m.win.l } : { h: m.win.l, d: m.win.d, a: m.win.r }; bar = '<div class="gs-win"><b class="n" style="color:' + ch + '">' + w.h + '%</b>' + UI.wbar(w.h / 100, w.d / 100, w.a / 100, ch, ca) + '<b class="n" style="color:' + ca + '">' + w.a + '%</b></div>'; }
  } else if (fin(f.Finished)) nums = '<div class="gs-pred"><span class="gs-pk">Full time</span><b class="n">' + num(f['Home pts']) + '<i>–</i>' + num(f['Away pts']) + '</b></div>';
  const rc = M.record(H, A), lead = rc && rc.n ? (rc.a === rc.b ? 'Level at ' + rc.a + '–' + rc.b : esc(firstOf(rc.a > rc.b ? H : A)) + ' leads ' + Math.max(rc.a, rc.b) + '–' + Math.min(rc.a, rc.b)) + (rc.d ? ', ' + rc.d + ' drawn' : '') : 'First ever meeting';
  const q = quoteFor(c, s.gw);
  return '<div class="gs-face"><span class="gs-dn">' + esc(dn || 'Gameweek ' + s.gw) + '</span>'
    + '<div class="gs-vs"><span class="gs-fs l">' + crestBig(H, 120) + '<b>' + esc(firstOf(H)) + '</b></span><b class="gs-x f-cond">VS</b><span class="gs-fs r">' + crestBig(A, 120) + '<b>' + esc(firstOf(A)) + '</b></span></div>'
    + nums + bar + '<span class="gs-ser">' + lead + '</span>'
    + (q ? '<div class="gs-q">' + UI.crest(q.team, 22) + '<span><em>On the record · ' + esc(firstOf(q.team)) + '</em><b>“' + esc(q.line) + '”</b></span></div>' : '') + '</div>';
}
function sceneClose(s) {
  const rows = s.j.chapters.map(c => {
    const { f, i } = chapterFx(c, s.gw); if (!f) return '';
    const m = i > -1 ? M.mx(i) : null;
    let mid = '';
    if (fin(f.Finished)) mid = num(f['Home pts']) + '<i>–</i>' + num(f['Away pts']);
    else if (m && M.hasProj()) mid = M.f1(m.flip ? m.tr.proj : m.tl.proj) + '<i>–</i>' + M.f1(m.flip ? m.tl.proj : m.tr.proj);
    return '<div class="gs-fx">' + UI.crest(f.Home, 30) + '<span class="gs-fxn"><b>' + esc(firstOf(f.Home)) + ' <i>v</i> ' + esc(firstOf(f.Away)) + '</b></span><span class="gs-fxw n">' + mid + '</span>' + UI.crest(f.Away, 30) + '</div>';
  }).join('');
  const live = s.gw === D.gw && !D.dlPassed;
  const prev = allArticles().find(p => p.kind === 'Preview' && p.gw === s.gw);
  return '<div class="gs-open gs-close"><span class="gs-k">Gameweek ' + s.gw + '</span><h2 class="gs-ttl f-cond">That’s the gameweek</h2>'
    + '<div class="gs-fxs">' + rows + '</div><span class="gs-wl">' + (live ? 'Predicted' : '') + '</span>'
    + '<div class="gs-cta">' + (live ? '<a class="btn" href="#/feed/messages/archizio" data-gs-go>Go on the record</a>' : '') + (prev ? '<a class="btn ghost" href="' + esc(prev.href) + '" data-gs-go>Read the preview</a>' : '')
    + '<button class="btn ghost" data-gs-replay>Watch again</button></div></div>';
}

/* ---------- the show ---------- */
function build(s, only) {
  const me = UI.you(), items = [];
  let order = s.j.chapters.map((c, i) => i);
  if (only != null && only > -1) order = [only];
  else order.sort((a, b) => { const A = s.j.chapters[a], B = s.j.chapters[b]; const ma = A.home === me || A.away === me ? 0 : 1, mb = B.home === me || B.away === me ? 0 : 1; return ma - mb || a - b; });
  if (only == null || only < 0) items.push({ kind: 'open', clip: 'open', cap: s.j.open });
  order.forEach((ci, n) => {
    const c = s.j.chapters[ci];
    c.beats.forEach((t, j) => items.push({ kind: ['intro', 'xi', 'intro', 'xi', 'face'][j] || 'face', side: j < 2 ? 'h' : 'a', c, ci, n, j, clip: 'c' + (ci + 1) + 'b' + j, cap: t }));
  });
  if (only == null || only < 0) items.push({ kind: 'close', clip: 'close', cap: s.j.close });
  return { items, chapters: order.length };
}
function capHTML(t) { return String(t || '').split(/\s+/).filter(Boolean).map((w, i) => '<span style="--w:' + i + '">' + esc(w) + '</span>').join(' '); }
function sceneFor(it, s) {
  if (it.kind === 'open') return sceneOpen(s);
  if (it.kind === 'close') return sceneClose(s);
  if (it.kind === 'intro') return sceneIntro(it.c, it.side, s);
  if (it.kind === 'xi') return sceneXI(it.c, it.side, s);
  return sceneFace(it.c, s);
}
const est = it => (String(it.cap || '').split(/\s+/).length / 2.7 + .9) * 1000;
function holdOf(it) { return HOLD[it.kind] || 3500; }

function shell(s, B) {
  return '<div class="gs" id="gs" role="dialog" aria-modal="true" aria-label="The Gameweek ' + s.gw + ' show">'
    + '<div class="gs-bg"><i class="a"></i><i class="b"></i></div>'
    + '<div class="gs-top"><div class="gs-seg">' + B.items.map(() => '<i><b></b></i>').join('') + '</div>'
    + '<div class="gs-hd"><span class="gs-av f-cond">MT</span><span class="gs-hdt"><b>The Gameweek ' + s.gw + ' Show</b><em id="gs-ch">Malcolm Tyre in the booth</em></span>'
    + '<button class="gs-ib" id="gs-mute" aria-label="Mute">' + UI.icon('volume', 20) + '</button><button class="gs-ib" id="gs-x" aria-label="Close">' + UI.icon('close', 22) + '</button></div></div>'
    + '<div class="gs-stage" id="gs-stage"></div>'
    + '<div class="gs-cap" id="gs-cap" aria-live="polite"></div>'
    + '<div class="gs-foot"><span id="gs-n" class="n"></span><span id="gs-src"></span><button class="gs-skip" id="gs-skip">Next matchup ›</button></div>'
    + '<div class="gs-tap l" data-gs="prev"></div><div class="gs-tap r" data-gs="next"></div>'
    + '<div class="gs-paused" id="gs-paused">' + UI.icon('pause', 34) + '</div>'
    + '</div>';
}

export function open(gw, only) {
  const s = shows().find(x => x.gw === gw); if (!s) return;
  close(true);
  const B = build(s, only);
  document.body.insertAdjacentHTML('beforeend', shell(s, B));
  const el = document.getElementById('gs');
  document.documentElement.classList.add('gs-on');
  /* unlock audio inside this tap: iOS only lets a gesture start playback; the same element then plays every clip */
  const A = new Audio(); A.preload = 'auto';
  if (!SILENT) SILENT = wavSilence();
  A.src = SILENT; const p0 = A.play(); if (p0 && p0.catch) p0.catch(() => { });
  Q = { s, B, el, A, i: -1, au: null, paused: false, muted: false, t0: 0, ends: 0, timer: 0, raf: 0, only, ready: false, waitStart: Date.now() };
  try { history.pushState({ gs: 1 }, ''); } catch (e) { }
  wire(el);
  try {
    if (navigator.mediaSession && window.MediaMetadata) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: 'The Gameweek ' + gw + ' Show', artist: 'Malcolm Tyre · El Matador Tire', album: 'Matchweek', artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
      navigator.mediaSession.setActionHandler('pause', () => setPaused(true)); navigator.mediaSession.setActionHandler('play', () => setPaused(false));
    }
  } catch (e) { }
  const src = document.getElementById('gs-src'); if (src) src.textContent = 'Warming up the booth…';
  /* show the cold open straight away; the clock starts when the audio has answered (or after 5 s without it) */
  go(0, true);
  let settled = false;
  const start = au => { if (settled || !Q || Q.el !== el) return; settled = true; Q.au = au; Q.ready = true; if (src) src.textContent = au ? '' : 'Captions only for now'; go(Q.i < 0 ? 0 : Q.i); };
  audioFor(s).then(start);
  setTimeout(() => start(null), 5000);
}
export function close(silent) {
  if (!Q) return;
  const q = Q; Q = null;
  clearTimeout(q.timer); cancelAnimationFrame(q.raf);
  try { q.A.onended = q.A.onerror = null; q.A.pause(); q.A.removeAttribute('src'); q.A.load(); } catch (e) { }
  try { if (navigator.mediaSession) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; } } catch (e) { }
  q.el.classList.add('out'); setTimeout(() => q.el.remove(), 260);
  document.documentElement.classList.remove('gs-on');
  if (!silent && history.state && history.state.gs) { try { history.back(); } catch (e) { } }
}
function wire(el) {
  let down = 0, held = false, ht = 0;
  el.addEventListener('pointerdown', e => {
    if (!e.target.closest('.gs-tap')) return;
    down = Date.now(); held = false; clearTimeout(ht);
    ht = setTimeout(() => { held = true; setPaused(true); }, 320);
  });
  el.addEventListener('pointerup', e => {
    clearTimeout(ht);
    const t = e.target.closest('.gs-tap'); if (!t) return;
    if (held) { setPaused(false); return; }
    if (Date.now() - down > 600) return;
    if (Q && Q.paused) { setPaused(false); return; }
    if (t.dataset.gs === 'prev') go(Math.max(0, Q.i - 1)); else go(Q.i + 1);
  });
  el.addEventListener('pointercancel', () => { clearTimeout(ht); if (held) setPaused(false); });
  el.addEventListener('click', e => {
    if (e.target.closest('#gs-x')) { close(); return; }
    if (e.target.closest('#gs-mute')) { Q.muted = !Q.muted; Q.A.muted = Q.muted; const b = e.target.closest('#gs-mute'); b.innerHTML = UI.icon(Q.muted ? 'mute' : 'volume', 20); b.setAttribute('aria-label', Q.muted ? 'Unmute' : 'Mute'); return; }
    if (e.target.closest('#gs-skip')) { skipChapter(); return; }
    if (e.target.closest('[data-gs-replay]')) { const g = Q.s.gw, o = Q.only; open(g, o); return; }
    if (e.target.closest('[data-gs-go]')) { close(true); try { if (history.state && history.state.gs) history.replaceState(null, ''); } catch (er) { } }
  });
}
addEventListener('popstate', () => { if (Q) close(true); });
addEventListener('keydown', e => { if (!Q) return; if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') go(Q.i + 1); else if (e.key === 'ArrowLeft') go(Math.max(0, Q.i - 1)); else if (e.key === ' ') { e.preventDefault(); setPaused(!Q.paused); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && Q && !Q.paused) setPaused(true); });

function setPaused(v) {
  if (!Q) return; Q.paused = v; Q.el.classList.toggle('paused', v);
  const it = Q.B.items[Q.i];
  if (v) {
    clearTimeout(Q.timer); cancelAnimationFrame(Q.raf);
    if (Q.useAudio) { try { Q.A.pause(); } catch (e) { } }
    Q.left = Math.max(0, Q.ends - Date.now());
    try { navigator.mediaSession.playbackState = 'paused'; } catch (e) { }
  } else {
    if (Q.useAudio && !Q.A.ended) { const p = Q.A.play(); if (p && p.catch) p.catch(() => { }); }
    Q.ends = Date.now() + (Q.left || 0); Q.t0 = Q.ends - (Q.span || 0);
    arm(it); tick();
    try { navigator.mediaSession.playbackState = 'playing'; } catch (e) { }
  }
}
function skipChapter() {
  if (!Q) return; const cur = Q.B.items[Q.i];
  let j = Q.i + 1;
  if (cur && cur.c) while (j < Q.B.items.length && Q.B.items[j].c === cur.c) j++;
  go(j);
}
function go(i, preview) {
  if (!Q) return;
  const items = Q.B.items;
  if (i >= items.length) { finish(); return; }
  clearTimeout(Q.timer); cancelAnimationFrame(Q.raf);
  Q.i = i; Q.paused = false; Q.el.classList.remove('paused', 'done');
  Q.el.dataset.kind = items[i].kind;
  const it = items[i], s = Q.s;
  /* segments: done, current, to come */
  [...Q.el.querySelectorAll('.gs-seg i')].forEach((x, k) => { x.className = k < i ? 'on' : ''; x.firstChild.style.width = k < i ? '100%' : '0%'; });
  /* colours follow the chapter */
  if (it.c) { const [a, b] = UI.pairCols(it.c.home, it.c.away); Q.el.style.setProperty('--ga', a); Q.el.style.setProperty('--gb', b); }
  else { Q.el.style.removeProperty('--ga'); Q.el.style.removeProperty('--gb'); }
  const stage = document.getElementById('gs-stage');
  [...stage.children].forEach(x => { x.classList.add('out'); setTimeout(() => x.remove(), 420); });
  let html = ''; try { html = sceneFor(it, s); } catch (e) { console.error(e); }
  stage.insertAdjacentHTML('beforeend', '<div class="gs-sc s-' + it.kind + '">' + html + '</div>');
  const cap = document.getElementById('gs-cap'); cap.innerHTML = '<p>' + capHTML(it.cap) + '</p>'; cap.dataset.n = String(it.cap || '').split(/\s+/).length;
  const ch = document.getElementById('gs-ch'), nEl = document.getElementById('gs-n'), sk = document.getElementById('gs-skip');
  if (it.c) { const dn = derbyName(it.c.home, it.c.away); ch.textContent = dn || (firstOf(it.c.home) + ' v ' + firstOf(it.c.away)); nEl.textContent = (it.n + 1) + ' / ' + Q.B.chapters; sk.style.visibility = ''; }
  else { ch.textContent = 'Malcolm Tyre in the booth'; nEl.textContent = ''; sk.style.visibility = it.kind === 'open' ? '' : 'hidden'; sk.textContent = it.kind === 'open' ? 'Skip intro ›' : 'Next matchup ›'; }
  if (it.c) sk.textContent = 'Next matchup ›';
  if (preview || !Q.ready) { Q.span = holdOf(it); Q.t0 = Date.now(); Q.ends = Infinity; return; }
  /* the clip, or the caption clock */
  const url = Q.au && Q.au.urls[it.clip];
  Q.useAudio = !!url;
  const d = (Q.au && Q.au.durs && Q.au.durs[it.clip]) ? Q.au.durs[it.clip] * 1000 : est(it);
  Q.span = Math.max(d + 350, holdOf(it)); Q.t0 = Date.now(); Q.ends = Q.t0 + Q.span; Q.clipMs = d;
  if (url) {
    const A = Q.A; A.onended = null; A.onerror = null;
    A.src = url; A.muted = Q.muted;
    const p = A.play(); if (p && p.catch) p.catch(() => { Q && (Q.useAudio = false); });
    A.onerror = () => { if (Q) Q.useAudio = false; };
  } else { try { Q.A.pause(); } catch (e) { } }
  arm(it); tick();
}
function arm(it) {
  clearTimeout(Q.timer);
  const left = Math.max(0, Q.ends - Date.now());
  Q.timer = setTimeout(() => { if (Q && !Q.paused) go(Q.i + 1); }, left + 30);
}
function tick() {
  if (!Q || Q.paused) return;
  const it = Q.B.items[Q.i]; if (!it) return;
  const el = Q.el, now = Date.now();
  let f;
  if (Q.useAudio && Q.A.duration && isFinite(Q.A.duration) && !Q.A.paused) {
    f = Math.min(1, (Q.A.currentTime * 1000) / Q.span);
    /* the picture never cuts a clip short: hold until the audio has finished */
    const remA = (Q.A.duration - Q.A.currentTime) * 1000;
    if (remA > (Q.ends - now)) { Q.ends = now + remA + 250; arm(it); }
  } else f = Math.min(1, (now - Q.t0) / Q.span);
  const seg = el.querySelectorAll('.gs-seg i')[Q.i]; if (seg) seg.firstChild.style.width = (f * 100).toFixed(1) + '%';
  /* captions arrive word by word with the voice */
  const words = el.querySelectorAll('#gs-cap span'), n = words.length;
  const spoken = Q.useAudio && Q.A.duration ? Math.min(1, Q.A.currentTime / Q.A.duration) : Math.min(1, (now - Q.t0) / (Q.clipMs || Q.span));
  const k = Math.ceil(spoken * n * 1.08);
  words.forEach((w, i) => w.classList.toggle('on', i < k));
  Q.raf = requestAnimationFrame(tick);
}
function finish() {
  if (!Q) return;
  clearTimeout(Q.timer); cancelAnimationFrame(Q.raf);
  try { Q.A.pause(); } catch (e) { }
  Q.el.classList.add('done');
  [...Q.el.querySelectorAll('.gs-seg i')].forEach(x => { x.className = 'on'; x.firstChild.style.width = '100%'; });
  if (Q.only != null && Q.only > -1) {
    const cap = document.getElementById('gs-cap'); if (cap) cap.innerHTML = '<p class="gs-end"><button class="btn ghost" data-gs-replay>Watch again</button></p>';
  }
}
export const isOpen = () => !!Q;
