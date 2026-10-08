/* feed/player.js — plays the Gameweek Show: the real narrated clips in show/gwN/, in order, with their captions. */
import { shows, mmss } from './facts.js';
import { esc } from './util.js';

let A = null, Q = null;
export const state = () => Q;
export function caption(s, k) {
  if (k === 'open') return { ch: -1, text: s.j.open };
  if (k === 'close') return { ch: s.j.chapters.length, text: s.j.close };
  const m = /^c(\d+)b(\d+)$/.exec(k); if (!m) return { ch: -1, text: '' };
  const c = s.j.chapters[+m[1] - 1]; return { ch: +m[1] - 1, text: c ? c.beats[+m[2]] || '' : '' };
}
export function toggle(gw) {
  if (Q && Q.gw === gw) { if (Q.playing) pause(); else resume(); return; }
  start(gw);
}
function start(gw) {
  const s = shows().find(x => x.gw === gw); if (!s) return;
  stop();
  Q = { gw, s, i: 0, playing: true };
  A = new Audio(); A.preload = 'auto';
  A.onended = next; A.onerror = next; A.ontimeupdate = paint;
  try {
    if (navigator.mediaSession && window.MediaMetadata) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: 'Gameweek ' + gw + ' show', artist: 'Malcolm Tyre · El Matador Tire', album: 'Matchweek', artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
      navigator.mediaSession.setActionHandler('pause', pause); navigator.mediaSession.setActionHandler('play', resume);
    }
  } catch (e) { }
  play();
}
function play() {
  const k = Q.s.clips[Q.i]; if (!k) { stop(); return; }
  A.src = Q.s.base + k + '.mp3';
  const p = A.play(); if (p && p.catch) p.catch(() => { if (Q) { Q.playing = false; paint(); } });
  paint();
}
function next() { if (!Q) return; Q.i++; if (Q.i >= Q.s.clips.length) { stop(); return; } play(); }
export function pause() { if (A) A.pause(); if (Q) Q.playing = false; paint(); }
function resume() { if (!Q) return; if (A) { const p = A.play(); if (p && p.catch) p.catch(() => { }); } Q.playing = true; paint(); }
export function skip() { if (!Q) return; const cur = caption(Q.s, Q.s.clips[Q.i]).ch; let j = Q.i + 1; while (j < Q.s.clips.length && caption(Q.s, Q.s.clips[j]).ch === cur && cur >= 0) j++; Q.i = j - 1; next(); }
export function stop() {
  if (A) { A.onended = A.onerror = A.ontimeupdate = null; try { A.pause(); A.removeAttribute('src'); A.load(); } catch (e) { } }
  A = null; Q = null;
  try { if (navigator.mediaSession) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; } } catch (e) { }
  paint();
}
function elapsed() { if (!Q) return 0; let t = 0; for (let i = 0; i < Q.i; i++) t += Q.s.j.dur[Q.s.clips[i]] || 0; return t + (A ? A.currentTime || 0 : 0); }
const PLAY = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 4 L20 12 L7 20 Z" fill="currentColor"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>';
function paint() {
  document.querySelectorAll('[data-fx^="show:"]').forEach(b => { const g = +b.getAttribute('data-fx').slice(5); const on = !!(Q && Q.gw === g && Q.playing); b.innerHTML = on ? PAUSE : PLAY; b.classList.toggle('on', on); b.setAttribute('aria-label', on ? 'Pause the show' : 'Play the show'); });
  document.querySelectorAll('.show-player').forEach(el => {
    const g = +el.getAttribute('data-gw'), mine = Q && Q.gw === g, s = mine ? Q.s : shows().find(x => x.gw === g); if (!s) return;
    const t = mine ? elapsed() : 0, cap = mine ? caption(s, s.clips[Q.i]) : { ch: -2, text: '' };
    const bar = el.querySelector('.spl-bar i'); if (bar) bar.style.width = Math.min(100, t / s.dur * 100).toFixed(2) + '%';
    const tm = el.querySelector('.spl-t'); if (tm) tm.textContent = mmss(t) + ' / ' + mmss(s.dur);
    const cp = el.querySelector('.spl-cap'); if (cp) { const txt = mine ? cap.text : 'Tap play. ' + s.j.chapters.length + ' matchups, ' + mmss(s.dur) + '.'; if (cp.textContent !== txt) cp.textContent = txt; }
    el.querySelectorAll('.spl-ch [data-ch]').forEach(c => c.classList.toggle('on', mine && +c.getAttribute('data-ch') === cap.ch));
    const sk = el.querySelector('.spl-skip'); if (sk) sk.disabled = !mine;
  });
}
export const repaint = paint;
export { esc };
