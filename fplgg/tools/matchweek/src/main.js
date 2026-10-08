/* main.js — boot, routing, sheets, refresh. Pages and sheets register here. */
import * as UI from './ui.js';
import matchday from './pages/matchday.js';
import team from './pages/team.js';
import league from './pages/league.js';
import feed from './pages/feed.js';
import { SHEETS } from './sheets/index.js';
import { maybeSendFacts, maybeSendRecapFacts, computeFacts, computeRecapFacts } from './feed/showfacts.js';
import { articlesWanted } from './feed/articles.js';   /* new articles reach Matchday's card and the Feed's posts without a Feed visit */

const PAGES = { matchday, team, league, feed };
const app = document.getElementById('app');
const LAST = {};
try { Object.assign(LAST, JSON.parse(localStorage.getItem('emt-subs') || '{}')); } catch (e) { }
/* 7 Oct: the Feed now opens on Everyone; forget a remembered For you once so every phone sees the change */
try { if (!localStorage.getItem('emt-mig-feed1')) { delete LAST.feed; localStorage.setItem('emt-subs', JSON.stringify(LAST)); localStorage.setItem('emt-mig-feed1', '1'); } } catch (e) { }

export function parse(h = location.hash) {
  const parts = (h || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  let page = parts[0] && PAGES[parts[0]] ? parts[0] : 'matchday';
  let sub = parts[1] || '';
  const mod = PAGES[page];
  const subs = (mod.subs || []).map(s => s.id);
  if (!sub || !subs.includes(sub)) sub = (!parts[1] && LAST[page] && subs.includes(LAST[page])) ? LAST[page] : subs[0];
  return { page, sub, args: parts.slice(2) };
}

let CUR = null, RENDERING = false, VIA_POP = false;
const SCROLLS = {};
/* tappable divs and spans get a keyboard role, so every [data-open] / [data-go] can be reached and pressed */
function a11y(root) {
  root.querySelectorAll('[data-open],[data-go]').forEach(el => {
    if (/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.hasAttribute('tabindex')) return;
    el.setAttribute('tabindex', '0'); if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
  });
}
addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('[role=button][data-open],[role=button][data-go]')) { e.preventDefault(); e.target.click(); }
});
let ST;
addEventListener('scroll', () => { clearTimeout(ST); ST = setTimeout(() => { if (!document.documentElement.style.overflow) SCROLLS[location.hash] = scrollY; }, 120); }, { passive: true });
export function render(opt = {}) {
  if (!D || !D.ro || !D.ro.length) return;
  const r = parse();
  const mod = PAGES[r.page];
  /* a bad or partial address settles on the page it shows, without adding history */
  { const canon = '#/' + r.page + '/' + r.sub + (r.args.length ? '/' + r.args.map(encodeURIComponent).join('/') : '');
    const raw = (location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
    if (location.hash !== canon && (!raw.length || !PAGES[raw[0]] || (raw[1] && !(mod.subs || []).some(s => s.id === raw[1])))) history.replaceState(history.state, '', canon); }
  LAST[r.page] = r.sub; try { localStorage.setItem('emt-subs', JSON.stringify(LAST)); } catch (e) { }
  const same = CUR && CUR.page === r.page && CUR.sub === r.sub && CUR.args.join('/') === r.args.join('/');
  const y = same ? scrollY : 0;
  RENDERING = true;
  let html;
  try { html = mod.render(r.sub, r.args); }
  catch (e) { console.error(e); html = UI.pageHead(mod.title || '') + '<div class="err">Something went wrong drawing this page. ' + UI.esc(e.message) + '</div>'; }
  const unread = PAGES.feed.unread ? PAGES.feed.unread() : 0;
  app.innerHTML = html + UI.navBar(r.page, unread);
  document.body.dataset.page = r.page; document.body.dataset.sub = r.sub;
  document.title = (mod.title || 'Matchweek') + ' · El Matador Tire';
  try { mod.mount && mod.mount(app, r.sub, r.args); } catch (e) { console.error(e); }
  RENDERING = false;
  a11y(app);
  const back = VIA_POP && !same && SCROLLS[location.hash] != null; VIA_POP = false;
  if (back) scrollTo(0, SCROLLS[location.hash]); else if (!opt.keepScroll) scrollTo(0, same ? y : 0); else scrollTo(0, y);
  CUR = r;
}

/* ---------- sheets ---------- */
const STACK = [];
const CHROME = () => '<div class="grab"><i></i></div><button class="sheet-x" data-close aria-label="Close">' + UI.icon('close', 15, '#fff', 2.6) + '</button>';
export function openSheet(kind, arg, opt = {}) {
  const S = SHEETS[kind]; if (!S) return;
  let body;
  try { body = S.render(arg); } catch (e) { console.error(e); body = '<div class="err">Couldn’t open this. ' + UI.esc(e.message) + '</div>'; }
  if (body == null) return;
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  const sh = document.createElement('div'); sh.className = 'sheet' + (S.cls ? ' ' + S.cls : ''); sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
  sh.innerHTML = CHROME() + body;
  document.body.append(scrim, sh);
  document.documentElement.style.overflow = 'hidden';
  requestAnimationFrame(() => { scrim.classList.add('in'); sh.classList.add('in'); });
  const entry = { kind, arg, scrim, sh, opener: document.activeElement };
  sh.tabIndex = -1; app.inert = true; STACK.forEach(x => { x.sh.inert = true; });
  STACK.push(entry);
  scrim.onclick = () => history.back();
  try { S.mount && S.mount(sh, arg); } catch (e) { console.error(e); }
  a11y(sh);
  if (!opt.noHistory) history.pushState({ sheet: STACK.length }, '');
  swipeToClose(sh);
  requestAnimationFrame(() => { if (sh.contains(document.activeElement)) return; const x = sh.querySelector('.sheet-x'); x && x.focus({ preventScroll: true }); });
  return sh;
}
function dropTop() {
  const e = STACK.pop(); if (!e) return;
  e.scrim.classList.remove('in'); e.sh.classList.remove('in');
  setTimeout(() => { e.scrim.remove(); e.sh.remove(); }, 300);
  if (!STACK.length) { document.documentElement.style.overflow = ''; app.inert = false; } else STACK[STACK.length - 1].sh.inert = false;
  try { e.opener && e.opener.isConnected && e.opener.focus({ preventScroll: true }); } catch (er) { }
  const S = SHEETS[e.kind]; S && S.unmount && S.unmount(e.sh);
}
export function closeSheet() { if (STACK.length) history.back(); }
/* a refresh redraws the top sheet; whatever field the manager is typing in keeps its value, focus and caret */
function typingIn(sh) {
  const f = document.activeElement;
  if (!f || !sh.contains(f) || !/^(INPUT|TEXTAREA)$/.test(f.tagName) || /^(range|checkbox|radio|file|button)$/.test(f.type)) return null;
  const sel = f.id ? '#' + CSS.escape(f.id) : f.dataset.in ? '[data-in="' + f.dataset.in + '"]' : f.tagName.toLowerCase() + '[type="' + f.type + '"]';
  return { sel, v: f.value, a: f.selectionStart, b: f.selectionEnd };
}
export function refreshSheet() {
  const e = STACK[STACK.length - 1]; if (!e) return; const S = SHEETS[e.kind];
  const t = typingIn(e.sh);
  try { const b = S.render(e.arg); e.sh.innerHTML = CHROME() + b; S.mount && S.mount(e.sh, e.arg); a11y(e.sh); } catch (er) { console.error(er); }
  const n = t && e.sh.querySelector(t.sel);
  if (n) { if (n.value !== t.v) { n.value = t.v; n.dispatchEvent(new Event('input', { bubbles: true })); } n.focus({ preventScroll: true }); try { n.setSelectionRange(t.a, t.b); } catch (er) { } }
}
let NAV_AFTER = null;
function closeAllThen(h) {
  const n = STACK.length;
  if (!n) { location.hash = h; return; }
  for (let k = 0; k < n; k++) dropTop();
  NAV_AFTER = h; history.go(-n);   /* rewind the sheets' own entries, then navigate (one popstate arrives for the whole traversal) */
}
addEventListener('popstate', () => {
  VIA_POP = true; setTimeout(() => { VIA_POP = false; }, 400);
  if (NAV_AFTER !== null) { const h = NAV_AFTER; NAV_AFTER = null; if (location.hash !== h) location.hash = h; else render(); return; }
  if (STACK.length) dropTop();   /* a route change also fires hashchange, which renders once */
});
addEventListener('keydown', e => { if (e.key === 'Escape' && STACK.length) history.back(); });
function swipeToClose(sh) {
  let y0 = null, dy = 0;
  sh.addEventListener('touchstart', e => { if (sh.scrollTop <= 0) { y0 = e.touches[0].clientY; dy = 0; } else y0 = null; }, { passive: true });
  sh.addEventListener('touchmove', e => { if (y0 === null) return; dy = e.touches[0].clientY - y0; if (dy > 0) { sh.style.transition = 'none'; sh.style.transform = 'translateY(' + dy + 'px)'; } }, { passive: true });
  sh.addEventListener('touchend', () => { if (y0 === null) return; sh.style.transition = ''; if (dy > 110) history.back(); else sh.style.transform = ''; y0 = null; });
}

/* ---------- global taps ---------- */
document.addEventListener('click', e => {
  const c = e.target.closest('[data-close]'); if (c) { e.preventDefault(); closeSheet(); return; }
  const o = e.target.closest('[data-open]');
  if (o) {
    e.preventDefault();
    const v = o.getAttribute('data-open'), i = v.indexOf(':');
    const kind = i < 0 ? v : v.slice(0, i), arg = i < 0 ? '' : v.slice(i + 1);
    if (o.closest('.sheet') && SHEETS[kind] && SHEETS[kind].replace) { history.back(); setTimeout(() => openSheet(kind, arg), 320); return; }
    openSheet(kind, arg); return;
  }
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); closeAllThen(g.getAttribute('data-go')); return; }
  const a = e.target.closest('a[href^="#/"]');
  if (a && STACK.length) { e.preventDefault(); closeAllThen(a.getAttribute('href')); }
});
addEventListener('hashchange', () => render());

/* ---------- data ---------- */
let BUSY = false;
export function reload(quiet) {
  if (BUSY) return Promise.resolve(true);
  BUSY = true;
  return loadData(quiet).then(() => { BUSY = false; render({ keepScroll: true }); if (STACK.length) refreshSheet(); scheduleEdge(); setTimeout(() => idle(warmImages), 2500); setTimeout(() => idle(() => { maybeSendRecapFacts(); maybeSendFacts(); articlesWanted(); }), 9000); return true; })
    .catch(e => {
      BUSY = false;
      if (D.ro && D.ro.length) return false;   /* keep what's on screen; the caller says so */
      console.error(e);
      app.innerHTML = '<div class="boot">' + UI.leagueCrest(44) + '<div class="err" style="text-align:center">Couldn’t reach the league data. Check your connection and try again.</div><button class="btn" id="retry">Try again</button></div>';
      const b = document.getElementById('retry'); b && (b.onclick = () => { boot(); });
      return false;
    });
}
let EDGE_T;
function scheduleEdge() {
  clearTimeout(EDGE_T);
  if (!D || !D.ro || !D.ro.length) return;
  const now = Date.now(), t = [];
  const dl = gwDeadline(D.gw); if (dl && dl.getTime() > now) t.push(dl.getTime());
  (D.cf || []).forEach(f => { if (num(f.GW) !== D.gw || fin(f.Started)) return; const k = dt(f['Kickoff (UTC)']); if (k && k.getTime() > now) t.push(k.getTime()); });
  if (!t.length) return;
  const ms = Math.min(...t) - now + 20e3;
  if (ms < 2 ** 31 - 1) EDGE_T = setTimeout(() => reload(true), ms);
}
function cadence() { return D && D.liveNow ? 90e3 : 300e3; }
setInterval(() => { if (document.visibilityState === 'visible' && Date.now() - (LOADED_AT || 0) > cadence()) reload(true); }, 30e3);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - (LOADED_AT || 0) > 60e3) reload(true); });
setInterval(() => { const p = document.querySelector('.abar .sp'); if (p && D && D.ro && D.ro.length) p.innerHTML = UI.statePill(); }, 30e3);

function boot() {
  app.innerHTML = '<div class="boot">' + UI.leagueCrest(44) + UI.mwMark(30) + '<div class="bar"><i></i></div><span>Loading El Matador Tire</span></div>';
  reload(false);
}
window.MW = { render, openSheet, closeSheet, reload, refreshSheet, UI, facts: { preview: computeFacts, recap: computeRecapFacts } };
/* no zoom at all. iOS ignores user-scalable=no, so its pinch gestures are stopped here; the CSS keeps panning only */
['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));
/* warm the image cache once the first page is up: every club badge, every rostered player's flag and face (yours first).
   The service worker keeps them across deploys, so sheets and pitches draw at once */
function warmImages() {
  if (warmImages.done || !D || !D.ro || !D.ro.length) return; warmImages.done = 1;
  const me = UI.you(), ro = D.ro.slice().sort((a, b) => (b.Team === me) - (a.Team === me));
  const urls = [];
  Object.values(D.clubs || {}).forEach(c => { if (c) urls.push('https://resources.premierleague.com/premierleague/badges/50/t' + c + '.png'); });
  [...new Set(ro.map(p => String(p.Nation || '').toLowerCase()).filter(Boolean))].forEach(n => urls.push('https://flagcdn.com/w80/' + n + '.png'));
  ro.forEach(p => urls.push('faces/' + p.Code + '.png'));
  let i = 0, live = 0;
  const next = () => {
    while (live < 3 && i < urls.length) {
      const img = new Image(); live++;
      try { img.fetchPriority = 'low'; } catch (e) { }
      img.onload = img.onerror = () => { live--; setTimeout(next, 30); };
      img.src = urls[i++];
    }
  };
  next();
}
const idle = f => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 4000 }) : setTimeout(f, 300));
if (history.state && history.state.sheet) history.replaceState(null, '');   /* a reload with a sheet open leaves no dead Back */
boot();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
