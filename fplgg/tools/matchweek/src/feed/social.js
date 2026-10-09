/* feed/social.js — the shared social log (Apps Script v3.8, Social tab): press-conference quotes, reactions, poll votes.
   Every phone reads the same rows (D.social), so everyone sees the same quotes, counts and votes.
   Writes need a signed-in manager (emt-auth); they show at once on this phone and land for everyone on the next read. */
import * as UI from '../ui.js';
import { lsGet, lsSet, bump } from './util.js';
import { DEMO } from '../data/tabs.js';   /* the demo league (Q2): every write is off, and a tap says so */

/* reactions: words in the log, line icons on screen (no emoji in the UI) */
export const REACTS = [
  { k: 'fire', label: 'Fire' },
  { k: 'laugh', label: 'Funny' },
  { k: 'clown', label: 'Clown' },
  { k: 'eyes', label: 'Watching' },
  { k: 'bin', label: 'Bin it' },
];
const PK = 'emt-social-pending', TTL = 20 * 60e3;
const tsOf = r => { const d = typeof dt === 'function' ? dt(r['When (UTC)']) : null; return d ? d.getTime() : 0; };
function pendingAll() { const now = Date.now(); return (lsGet(PK, []) || []).filter(r => r && now - r.t < TTL); }
function savePending(a) { lsSet(PK, a.slice(-80)); }
const same = (a, b) => a.team === b.team && a.kind === b.kind && a.target === b.target && a.value === b.value && String(a.extra || '') === String(b.extra || '');

let MEMO = { k: null, rows: [] };
/* all rows, oldest first: the server's, then this phone's writes that haven't come back yet */
export function rows() {
  const srv = D && D.social || [];
  const pend = pendingAll();
  const k = srv.length + '|' + (srv.length ? srv[srv.length - 1]['When (UTC)'] : '') + '|' + pend.length + '|' + (pend.length ? pend[pend.length - 1].t : '');
  if (MEMO.k === k) return MEMO.rows;
  const out = srv.map(r => ({ team: String(r.Team), kind: String(r.Kind), target: String(r.Target), value: String(r.Value || ''), extra: String(r.Extra || ''), at: tsOf(r) }));
  /* a pending write that the server now has is done; drop it */
  const left = pend.filter(p => !out.some(r => same(r, p) && r.at >= p.t - 5 * 60e3));
  if (left.length !== pend.length) savePending(left);
  left.forEach(p => out.push({ team: p.team, kind: p.kind, target: p.target, value: p.value, extra: p.extra, at: p.t, local: true }));
  out.sort((a, b) => a.at - b.at);
  MEMO = { k, rows: out };
  return out;
}
/* the signed-in manager on this phone, or null */
export function me() { const a = typeof authRead === 'function' ? authRead() : null; return a && TEAMS[a.team] ? a.team : null; }
export const live = () => !!(D && D.api);

/* ---------- reactions ---------- */
export function reactions(target) {
  const st = {};
  rows().forEach(r => { if (r.kind === 'react' && r.target === target && REACTS.some(x => x.k === r.value)) st[r.team + '|' + r.value] = r.extra !== 'off' && r.extra !== '0'; });
  const who = {}; REACTS.forEach(x => { who[x.k] = []; });
  Object.keys(st).forEach(k => { if (!st[k]) return; const i = k.lastIndexOf('|'); who[k.slice(i + 1)].push(k.slice(0, i)); });
  const m = me(), mine = new Set(REACTS.filter(x => m && who[x.k].includes(m)).map(x => x.k));
  const total = REACTS.reduce((s, x) => s + who[x.k].length, 0);
  return { who, mine, total };
}
export function toggleReact(target, k) {
  const m = me(); if (!m) return needSignIn('react');
  const on = !reactions(target).mine.has(k);
  return write('react', target, k, on ? 'on' : 'off');
}

/* ---------- poll votes (latest per manager, before the deadline) ---------- */
export function votes(target, gw) {
  const dl = gwDeadline(gw), cut = dl ? dl.getTime() : Infinity, last = {};
  rows().forEach(r => { if (r.kind === 'vote' && r.target === target && 'hda'.includes(r.value) && r.value && (r.local || r.at <= cut)) last[r.team] = r.value; });
  const by = { h: [], d: [], a: [] }; Object.keys(last).forEach(t => by[last[t]].push(t));
  const m = me();
  return { by, mine: m ? last[m] || null : null, n: Object.keys(last).length };
}
export function vote(target, v) { const m = me(); if (!m) return needSignIn('vote'); return write('vote', target, v, ''); }

/* ---------- quotes: one per manager per target, the first one stands, only before that gameweek's deadline ---------- */
export function quotes() {
  const seen = {}, out = [];
  rows().forEach(r => {
    if (r.kind !== 'quote' || !TEAMS[r.team]) return;
    const m = /^(q|qr):(\d+)(?::(.+))?$/.exec(r.target); if (!m) return;
    const gw = +m[2], dl = gwDeadline(gw);
    if (!r.local && dl && r.at > dl.getTime() + 60e3) return;
    const key = r.team + '|' + r.target; if (seen[key]) return; seen[key] = 1;
    let x = {}; try { x = JSON.parse(r.extra || '{}') || {}; } catch (e) { return; }
    const line = String(x.line || '').trim(); if (!line) return;
    out.push({ team: r.team, target: r.target, gw, re: m[1] === 'qr' ? m[3] || null : null, line, claim: x.claim && typeof x.claim === 'object' ? x.claim : null, p: typeof x.p === 'number' ? x.p : null, src: x.src || 'pick', at: r.at, local: !!r.local });
  });
  return out;
}
export const quoteOf = (team, target) => quotes().find(q => q.team === team && q.target === target) || null;
export function sayQuote(target, line, claim, p, src) {
  const m = me(); if (!m) return needSignIn('quote');
  return write('quote', target, '', JSON.stringify({ line, claim: claim || null, p: p == null ? null : Math.round(p * 1000) / 1000, src: src || 'pick' }));
}

/* ---------- writing ---------- */
function rerender() { bump(); MEMO.k = null; if (window.MW) { window.MW.render({ keepScroll: true }); window.MW.refreshSheet && window.MW.refreshSheet(); } }
export function needSignIn(what) {
  if (DEMO) { UI.toast('This is the demo league, so posting is off.'); return Promise.resolve(false); }
  UI.toast(what === 'quote' ? 'Sign in as your club to go on the record' : what === 'vote' ? 'Sign in as your club to vote' : what === 'rumour' ? 'Sign in as your club to whisper to Archizio' : 'Sign in as your club to react');
  if (window.MW) window.MW.openSheet('identity');
  return Promise.resolve(false);
}
const ERR = {
  auth: 'Your sign-in expired. Sign in again.',
  closed: 'That closed at the deadline.',
  already: 'You’re already on the record. No take-backs.',
  slow: 'Easy. Try again in a minute.',
  empty: 'Say something first.',
  'unknown action': 'The league sheet needs its update (Code.gs v3.10) before this works.',
  badkind: 'The league sheet needs its update (Code.gs v3.10) before this works.',
  toomany: 'Three rumours a day is plenty.',
  yours: 'You can’t pass on your own rumour.',
  norumour: 'That rumour has gone quiet.',
};
function write(kind, target, value, extra) {
  const a = typeof authRead === 'function' ? authRead() : null; if (!a) return needSignIn(kind);
  const row = { team: a.team, kind, target, value, extra, t: Date.now() };
  savePending(pendingAll().concat([row])); rerender();
  const undo = msg => { savePending(pendingAll().filter(p => !(same(p, row) && p.t === row.t))); rerender(); if (msg) UI.toast(msg); };
  if (!live()) { undo('Logins aren’t switched on yet.'); return Promise.resolve(false); }
  return authPost(authBuildReq('social', { team: a.team, token: a.token, kind, target, value, extra })).then(r => {
    if (r && r.ok) { setTimeout(pull, 2500); return true; }
    const code = (r && r.error) || '';
    if (code === 'auth' && typeof AUTH !== 'undefined') AUTH.logout();
    undo(ERR[code] || 'The league sheet said no (' + (code || 'unknown') + ').');
    return false;
  }).catch(e => { undo(typeof authErrText === 'function' ? authErrText(e) : 'Couldn’t reach the league sheet.'); return false; });
}

/* ---------- reading again between data loads, so the feed feels alive ---------- */
let PULLING = false, LAST_PULL = 0;
export function pull() {
  if (PULLING || typeof readTab !== 'function') return Promise.resolve(false);
  PULLING = true; LAST_PULL = Date.now();
  return readTab('Social').then(so => {
    const next = (so || []).filter(r => r && r.Kind && r.Target && r.Team);
    const cur = D.social || [];
    const changed = next.length !== cur.length || (next.length && cur.length && next[next.length - 1]['When (UTC)'] !== cur[cur.length - 1]['When (UTC)']);
    if (changed) {
      D.social = next; MEMO.k = null; bump();
      /* never re-render under someone typing a quote */
      const typing = document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
      if (!typing && window.MW) { window.MW.render({ keepScroll: true }); window.MW.refreshSheet && window.MW.refreshSheet(); }
    }
    return changed;
  }).catch(() => false).finally(() => { PULLING = false; });
}
/* every 40 s while the Feed or a post is on screen */
if (typeof window !== 'undefined' && !window.__socialPoll) {
  window.__socialPoll = 1;
  setInterval(() => {
    if (document.visibilityState !== 'visible' || !D || !D.ro || !D.ro.length) return;
    const onFeed = document.body.dataset.page === 'feed' || document.querySelector('.sheet .post-sheet, .sheet .ps');
    if (onFeed && Date.now() - LAST_PULL > 38e3) pull();
  }, 10e3);
}

/* ---------- the rumour mill: anyone starts one, everyone else confirms, denies or passes it on with a twist ---------- */
export function rumours() {
  const R = {}, order = [];
  rows().forEach(r => {
    if (r.kind === 'rumour' && /^r:[a-z0-9]{4,20}$/.test(r.target) && !R[r.target] && TEAMS[r.team]) {
      let x = {}; try { x = JSON.parse(r.extra || '{}') || {}; } catch (e) { return; }
      if (!x.text) return;
      R[r.target] = { id: r.target, by: r.team, text: String(x.text), about: TEAMS[x.about] ? x.about : null, anon: x.anon !== false, at: r.at, local: !!r.local, passes: [], seen: {} };
      order.push(r.target);
    }
  });
  rows().forEach(r => {
    const g = R[r.target];
    if (r.kind !== 'pass' || !g || r.team === g.by || g.seen[r.team] || !'confirm deny twist'.includes(r.value) || !r.value) return;
    let x = {}; try { x = JSON.parse(r.extra || '{}') || {}; } catch (e) { }
    if (r.value === 'twist' && !x.text) return;
    g.seen[r.team] = 1;
    g.passes.push({ team: r.team, kind: r.value, text: String(x.text || ''), at: r.at, local: !!r.local });
  });
  return order.map(id => {
    const g = R[id], tw = g.passes.filter(p => p.kind === 'twist');
    g.confirms = g.passes.filter(p => p.kind === 'confirm').length;
    g.denies = g.passes.filter(p => p.kind === 'deny').length;
    g.hops = 1 + tw.length;
    g.latest = tw.length ? tw[tw.length - 1].text : g.text;
    g.status = g.confirms >= 2 && g.confirms > g.denies ? 'confirmed' : g.denies >= 2 && g.denies > g.confirms ? 'denied' : 'spreading';
    g.last = Math.max(g.at, ...g.passes.map(p => p.at));
    return g;
  }).sort((a, b) => b.last - a.last);
}
export function startRumour(text, about, anon) {
  const m = me(); if (!m) return needSignIn('rumour');
  const id = 'r:' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36).padStart(2, '0');
  return write('rumour', id, '', JSON.stringify({ text, about: about || '', anon: anon !== false }));
}
export function passRumour(id, kind, text) {
  const m = me(); if (!m) return needSignIn('rumour');
  return write('pass', id, kind, JSON.stringify({ text: text || '' }));
}
