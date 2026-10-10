/* lock.js — the page behind a bottom sheet (Parker, 10 Oct 2026, on his iPhone: "the Home Screen was up high and I
   clicked on a player and it half rendered"). While a sheet is open the page must not move at all, and it must come back
   at exactly the position it had. iOS Safari ignores overflow:hidden on the root for touch scrolling: a finger that
   reaches the end of the sheet keeps scrolling the page behind it, and the rubber band moves it too; so the lock makes the
   body itself a fixed, non-scrolling box the size of the viewport and parks the page inside it at the same offset
   (body.scrollTop, which a finger cannot move), and the unlock puts the styles back and scrolls the window to the saved
   position. Sticky bars inside the page keep sticking (the body is their scroll container while it is locked), and nothing
   drawn at a fixed position (the nav bar, the scrim, the sheet) moves, because the body carries no transform.
   pageY() and setPageY() are what main.js reads and writes instead of scrollY and scrollTo while a sheet is open. */
let LOCK = null;
export const locked = () => !!LOCK;
/* the page's position: the saved one while it is locked (window.scrollY reads 0 then) */
export function pageY() { return LOCK ? LOCK.y : (window.scrollY || 0); }
export function setPageY(y) {
  y = Math.max(0, Math.round(y || 0));
  if (LOCK) { LOCK.y = y; document.body.scrollTop = y; } else scrollTo(0, y);
}
export function lockPage() {
  if (LOCK) return LOCK.y;
  const y = Math.round(window.scrollY || 0), b = document.body, h = document.documentElement;
  LOCK = { y, body: b.getAttribute('style') || '', html: h.style.overflow || '' };
  h.style.overflow = 'hidden';
  b.style.position = 'fixed'; b.style.top = '0'; b.style.left = '0'; b.style.right = '0'; b.style.bottom = '0';
  b.style.width = '100%'; b.style.overflow = 'hidden';
  b.scrollTop = y;
  return y;
}
export function unlockPage() {
  if (!LOCK) return;
  const { y, body, html } = LOCK; LOCK = null;
  const b = document.body;
  if (body) b.setAttribute('style', body); else b.removeAttribute('style');
  document.documentElement.style.overflow = html;
  scrollTo(0, y);
}
