/* errors.js — phones report script errors to the backend (ROADMAP A4), so a broken build is seen in the cloud before
   a manager complains. window.onerror and unhandledrejection POST `clienterror` to the web app (Code.gs v3.18+): the
   build stamp, the route (the hash), the message and a truncated stack. Nothing personal: no team, no token, no user
   agent, no query string. Rate-limited on the phone: at most 5 reports a page load, 30 seconds apart, the same error
   once per 10 minutes; "Script error." (a cross-origin script with no detail) is skipped. Reports that happen before
   the backend's address is known (the Specials tab loads it) wait in a short queue and go when it is. */
const MAX_PER_LOAD = 5, GAP_MS = 30e3, SAME_MS = 10 * 60e3, QUEUE_MAX = 5, WAIT_MS = 5000, WAIT_FOR_MS = 120e3;
const MSG_MAX = 300, STACK_MAX = 1500, ROUTE_MAX = 80;

export function buildStamp() {
  try { const s = document.querySelector('script[src*="app.js?v="]'); return s ? ((/v=(\d{8,16})/.exec(s.getAttribute('src') || '') || [])[1] || '') : ''; } catch (e) { return ''; }
}
/* 'network' for the failures a flaky connection causes (not a bug in the app), else 'error' or 'rejection' */
export function classify(kind, msg) {
  return /failed to fetch|load failed|networkerror|network request failed|the network connection was lost|timed out|internet connection|aborted|cancelled/i.test(String(msg)) ? 'network' : kind;
}
/* { msg, stack } from whatever the browser hands over: an ErrorEvent, a PromiseRejectionEvent's reason, an Error, a string */
export function describe(x) {
  if (x == null) return { msg: '', stack: '' };
  if (typeof x === 'string') return { msg: x, stack: '' };
  const err = x.error || x.reason || x;
  if (typeof err === 'string') return { msg: err, stack: '' };
  if (err && typeof err === 'object' && (err.message !== undefined || err.stack !== undefined)) {
    const msg = String(err.name && err.message ? err.name + ': ' + err.message : err.message || err.name || x.message || '');
    return { msg, stack: String(err.stack || '') };
  }
  if (x.message !== undefined) return { msg: String(x.message), stack: '' };
  try { return { msg: JSON.stringify(err).slice(0, MSG_MAX), stack: '' }; } catch (e) { return { msg: String(err), stack: '' }; }
}
/* the limits, as a small state machine: consider() returns the report to send, or null with why not */
export function makeReporter(build) {
  const S = { sent: 0, lastAt: 0, seen: {} };
  return {
    consider(kind, msg, stack, route, now) {
      msg = String(msg || '').replace(/\s+/g, ' ').trim().slice(0, MSG_MAX);
      if (!msg || msg === 'Script error.' || /^Script error\.?$/.test(msg)) return null;
      if (S.sent >= MAX_PER_LOAD) return null;
      if (S.lastAt && now - S.lastAt < GAP_MS) return null;
      route = String(route || '').slice(0, ROUTE_MAX);
      const k = kind + '|' + route + '|' + msg;
      if (S.seen[k] && now - S.seen[k] < SAME_MS) return null;
      S.seen[k] = now; S.sent++; S.lastAt = now;
      return { action: 'clienterror', build: build || '', route, kind: classify(kind, msg), msg, stack: String(stack || '').slice(0, STACK_MAX), online: typeof navigator === 'undefined' ? null : navigator.onLine !== false };
    },
    state: S,
  };
}
const apiUrl = () => { try { return typeof D !== 'undefined' && D && D.api ? String(D.api) : ''; } catch (e) { return ''; } };
let REP = null, QUEUE = [], TIMER = 0, WAITED = 0;
function post(p) {
  const api = apiUrl();
  if (!api) { if (QUEUE.length < QUEUE_MAX) QUEUE.push(p); arm(); return false; }
  try { fetch(api, { method: 'POST', body: JSON.stringify(p), keepalive: true }).catch(() => {}); } catch (e) { }
  return true;
}
function arm() {
  if (TIMER) return;
  TIMER = setTimeout(() => { TIMER = 0; WAITED += WAIT_MS; flushErrors(); if (QUEUE.length && WAITED < WAIT_FOR_MS) arm(); else if (WAITED >= WAIT_FOR_MS) QUEUE = []; }, WAIT_MS);
}
/* once the backend's address is known, the queued reports go */
export function flushErrors() { if (!apiUrl() || !QUEUE.length) return 0; const q = QUEUE; QUEUE = []; q.forEach(post); return q.length; }
export function report(kind, x) {
  try {
    if (!REP) REP = makeReporter(buildStamp());
    const d = describe(x), p = REP.consider(kind, d.msg, d.stack, typeof location !== 'undefined' ? location.hash : '', Date.now());
    if (p) post(p);
    return !!p;
  } catch (e) { return false; }
}
export function installErrorReporting() {
  try {
    addEventListener('error', e => { if (e && (e.error || e.message)) report('error', e); }, true);
    addEventListener('unhandledrejection', e => report('rejection', e));
  } catch (e) { }
}
