/* src/intro.js — the one-time intro (P1, Parker, 11 Oct 2026: "maybe an intro", but nothing elevated for everyone, because
   it gets read once and the app is self-explanatory). Three short screens, one line each, on the very first open of a
   device that has never used the app: shown only when no emt- key was in localStorage before the app wrote its own
   (main.js reads FRESH before its first setItem), skippable on the first screen, never shown again (emt-intro). A
   headless browser (navigator.webdriver) never sees it, so the gates read the pages; ?intro=1 in the URL shows it on
   demand, for a review. It adds nothing anywhere else: How it works stays in the menu. */
import * as UI from './ui.js';

export const KEY = 'emt-intro';
export const SCREENS = [
  { k: 'Matchday', t: 'Matchday shows your matchup, live.' },
  { k: 'Your team', t: 'Pick your team from the menu.' },
  { k: 'The menu', t: 'How it works lives in the menu.' },
];
let shown = false;

export function forced() { try { return /[?&]intro=1(?:&|$)/.test(location.search); } catch (e) { return false; } }
/* fresh: no emt- key existed before the app's first write (main.js) */
export function wanted(fresh) {
  if (forced()) return true;
  if (!fresh) return false;
  try { if (navigator.webdriver) return false; } catch (e) { }
  try { if (localStorage.getItem(KEY)) return false; } catch (e) { }
  return true;
}
export function screenHTML(i) {
  const s = SCREENS[i], last = i === SCREENS.length - 1;
  return '<div class="intro-p" role="dialog" aria-modal="true" aria-labelledby="intro-t">'
    + '<div class="intro-h">' + UI.mwMark(22) + '<span class="k">' + s.k + '</span></div>'
    + '<p class="intro-t" id="intro-t">' + s.t + '</p>'
    + '<div class="intro-f"><span class="intro-dots" aria-hidden="true">' + SCREENS.map((_, j) => '<i' + (j === i ? ' class="on"' : '') + '></i>').join('') + '</span>'
    + '<span class="intro-b">' + (i === 0 ? '<button type="button" class="btn ghost" data-intro="skip">Skip</button>' : '')
    + '<button type="button" class="btn" data-intro="' + (last ? 'done' : 'next') + '">' + (last ? 'Done' : 'Next') + '</button></span></div></div>';
}
function remember() { try { localStorage.setItem(KEY, new Date().toISOString()); } catch (e) { } }
export function showIntro(fresh) {
  if (shown || !wanted(fresh)) return false;
  shown = true;
  let i = 0;
  const el = document.createElement('div'); el.className = 'intro';
  const draw = () => { el.innerHTML = screenHTML(i); const b = el.querySelector('.btn:not(.ghost)'); b && b.focus(); };
  const close = () => { remember(); el.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-intro]'); if (!b) return;
    const a = b.dataset.intro;
    if (a === 'next') { i++; draw(); } else close();
  });
  document.addEventListener('keydown', onKey);
  draw(); document.body.appendChild(el);
  return true;
}
