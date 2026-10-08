/* feed/articles.js — the weekly recaps and previews written in the cloud (Code.gs v3.13), read from the league sheet.
   GET ?articles=1      → { live:[{id,gw,kind,title,sub,approved,written}], waiting:[{gw,kind,status,since}], commish, review }
   GET ?article=<id>    → { id, gw, kind, approved, written, auto, a } for live articles only
   POST articles        → { commish, review, drafts:[{id,gw,kind,status,written,model,note,redos,a}], live:[{id,gw,kind,redos,note,rewrite}] }
                          (drafts and live for the commissioner only)
   POST articlemod      → approve | redo (with a note) | drop, commissioner only
   Code.gs v3.14: an article is published as soon as it passes the checks (review false). With EMT_ART_REVIEW = yes (review
   true) every article waits for the commissioner as in v3.13. The commissioner can ask for a rewrite of a live article
   (the live version stays up until the new one passes the checks; rewrite 'writing') or take it down. A live article's
   written time changes when a rewrite replaces it: this phone then fetches the new text and shows the old one meanwhile.
   A server without review (v3.13) counts as review mode.
   The list is cached on this phone (shown at once next time) and refreshed whenever the Feed opens and on each data
   refresh (main.js), at most once a minute; the server caches it for 5 minutes and clears that on every change. The built-in
   RECAPS/PREVIEWS (hand-built pages from GW1 to GW4) merge in and keep linking to their own HTML pages. */
import { lsGet, lsSet, bump } from './util.js';

const LKEY = 'emt-articles', BKEY = 'emt-artbodies', FRESH = 60e3, MAX_REDOS = 3;
const S = {
  list: norm(lsGet(LKEY, null)), at: 0, q: false, gen: 0,
  drafts: null, liveMeta: null, dFor: null, dAt: 0, dq: false, dErr: false, commishOK: false,
  bodies: lsGet(BKEY, {}) || {}, miss: {}, bq: {}, stale: {},
};
function norm(r) { return r && typeof r === 'object' ? { live: Array.isArray(r.live) ? r.live : [], waiting: Array.isArray(r.waiting) ? r.waiting : [], commish: r.commish || null, review: r.review === undefined ? true : !!r.review } : null; }
const url = q => D.api + (D.api.indexOf('?') > -1 ? '&' : '?') + q;
const getJSON = q => fetch(url(q), { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
const auth = () => (typeof authRead === 'function' ? authRead() : null);
export const KIND = k => (/recap/i.test(String(k)) ? 'Recap' : 'Preview');
export const artHref = id => '#/feed/articles/' + encodeURIComponent(id);

/* something on screen changed: rebuild the posts, redraw the Feed or Matchday (its article card) when one is showing,
   never under someone typing (a rewrite note, a press-room quote) */
function changed() {
  bump();
  const f = document.activeElement, typing = !!(f && /^(INPUT|TEXTAREA|SELECT)$/.test(f.tagName));
  const pg = document.body.dataset.page;
  if (!typing && (pg === 'feed' || pg === 'matchday') && window.MW) window.MW.render({ keepScroll: true });
}
function saveBodies() {
  const ids = Object.keys(S.bodies);
  if (ids.length > 8) ids.sort((a, b) => String(S.bodies[a].approved || '').localeCompare(String(S.bodies[b].approved || ''))).slice(0, ids.length - 8).forEach(k => delete S.bodies[k]);
  lsSet(BKEY, S.bodies);
}

/* ---------- reading ---------- */
export function articlesWanted(force) {
  if (!D || !D.api) return;
  if (!S.q && (force || Date.now() - S.at > FRESH)) {
    S.q = true;
    const gen = S.gen;
    getJSON('articles=1').then(r => {
      S.q = false; S.at = Date.now();
      if (gen !== S.gen) { articlesWanted(true); return; }   /* asked before an approve or a drop landed: ask again */
      if (r && r.ok) {
        const n = norm(r), ids = new Set(n.live.map(a => a.id));
        ids.forEach(id => { delete S.miss[id]; });
        /* rewritten since this phone kept it: fetch the new text, keep showing the old one until it arrives */
        n.live.forEach(a => { const b = S.bodies[a.id]; if (b && a.written && b.written && a.written !== b.written) S.stale[a.id] = 1; });
        const gone = Object.keys(S.bodies).filter(id => !ids.has(id));
        if (gone.length) { gone.forEach(id => { delete S.bodies[id]; }); saveBodies(); }   /* unpublished since: not served from this phone either */
        if (JSON.stringify(n) !== JSON.stringify(S.list) || gone.length) { S.list = n; lsSet(LKEY, n); changed(); }
      }
      draftsWanted(force);
    });
  } else draftsWanted(force);
}
/* the commissioner's drafts: only asked for when the signed-in team is the commissioner */
function draftsWanted(force) {
  const a = auth();
  if (!a || !D.api || !S.list || !S.list.commish || a.team !== S.list.commish) {
    if (S.drafts && (!a || a.team !== S.dFor)) { S.drafts = null; S.dFor = null; S.commishOK = false; changed(); }
    return;
  }
  if (S.dq || (!force && S.dFor === a.team && Date.now() - S.dAt < FRESH)) return;
  S.dq = true;
  const gen = S.gen;
  authPost(authBuildReq('articles', { team: a.team, token: a.token })).then(r => {
    S.dq = false; S.dAt = Date.now();
    if (gen !== S.gen) { draftsWanted(true); return; }   /* asked before an approve, a rewrite or a drop landed */
    if (!r || !r.ok) { if (!S.dErr) { S.dErr = true; changed(); } return; }
    S.dErr = false;
    const d = r.commish ? (Array.isArray(r.drafts) ? r.drafts : []) : [];
    const lm = r.commish && Array.isArray(r.live) ? r.live : null;   /* v3.14: his live articles (rewrites used, a rewrite under way) */
    const was = JSON.stringify([S.drafts, S.liveMeta, S.commishOK, S.dFor]);
    S.drafts = d; S.liveMeta = lm; S.commishOK = !!r.commish; S.dFor = a.team;
    if (JSON.stringify([S.drafts, S.liveMeta, S.commishOK, S.dFor]) !== was) changed();
  }).catch(() => { S.dq = false; S.dAt = Date.now(); if (!S.dErr) { S.dErr = true; changed(); } });
}
export const live = () => (S.list ? S.list.live : []);
export const waiting = () => (S.list ? S.list.waiting : []);
export const commish = () => (S.list && S.list.commish) || null;
export const commishFirst = () => { const c = commish(); return c ? (typeof FIRSTOF === 'function' ? FIRSTOF(c) : c) : 'the commissioner'; };
/* the signed-in phone is the commissioner's, and the server said so */
export function isCommish() { const a = auth(); return !!(a && S.commishOK && S.dFor === a.team); }
export const drafts = () => (isCommish() && S.drafts ? S.drafts : []);
export const maxRedos = MAX_REDOS;
/* review mode: every article waits for the commissioner (Code.gs EMT_ART_REVIEW = yes, or a v3.13 server) */
export const review = () => !S.list || S.list.review !== false;
/* the commissioner's view of one live article: { redos, note, rewrite: '' | 'writing' | 'failed' }, or null (not him,
   not loaded yet, or a server without live rewrites) */
export const liveInfo = id => (isCommish() && S.liveMeta ? S.liveMeta.find(x => x.id === id) || null : null);

/* every article, newest first: live sheet articles (read in the app) and the built-in pages (their own HTML) */
export function allArticles() {
  const out = [], have = new Set();
  live().forEach(a => {
    const kind = KIND(a.kind), gw = +a.gw; have.add(gw + kind);
    out.push({ id: a.id, gw, kind, ord: gw * 2 + (kind === 'Recap' ? 1 : 0), href: artHref(a.id), title: a.title || '', sub: a.sub || '', approved: a.approved || '', sheet: true });
  });
  const add = (list, kind) => (list || []).forEach(a => { if (!have.has(a.gw + kind)) out.push({ ...a, kind, ord: a.gw * 2 + (kind === 'Recap' ? 1 : 0) }); });
  add(typeof PREVIEWS !== 'undefined' ? PREVIEWS : [], 'Preview');
  add(typeof RECAPS !== 'undefined' ? RECAPS : [], 'Recap');
  return out.sort((a, b) => b.ord - a.ord || String(b.approved || '').localeCompare(String(a.approved || '')));
}

/* one article: a cached live one, the commissioner's draft, or fetched now ({loading}) */
function fetchBody(id, quiet) {
  if (S.bq[id] || !D || !D.api) return;
  S.bq[id] = 1;
  getJSON('article=' + encodeURIComponent(id)).then(r => {
    delete S.bq[id];
    if (r && r.ok && r.a) { S.bodies[id] = { id: r.id || id, gw: r.gw, kind: r.kind, approved: r.approved || '', written: r.written || '', auto: r.auto, a: r.a }; delete S.stale[id]; saveBodies(); changed(); return; }
    /* a newer version could not be fetched: keep the one on screen (the next list refresh tries again), never loop */
    if (quiet) { delete S.stale[id]; return; }
    S.miss[id] = r ? (r.error || 'notfound') : 'net';
    changed();
  });
}
export function body(id) {
  if (S.bodies[id]) { if (S.stale[id]) fetchBody(id, true); return { ok: true, ...S.bodies[id] }; }
  const d = drafts().find(x => x.id === id);
  if (d) return { ok: true, draft: true, id, gw: d.gw, kind: d.kind, status: d.status, written: d.written, model: d.model, note: d.note, redos: +d.redos || 0, error: d.error || '', a: d.a || null };
  const a = auth(), mayBeDraft = a && S.list && S.list.commish === a.team && (S.dq || (S.drafts == null && !S.dErr));
  if (S.miss[id]) return mayBeDraft ? { ok: false, loading: true } : { ok: false, missing: S.miss[id] };
  fetchBody(id, false);
  if (!D || !D.api) return { ok: false, missing: 'off' };
  return { ok: false, loading: true };
}
export function retry(id) { delete S.miss[id]; changed(); }

/* ---------- the commissioner's read: approve, rewrite with a note, drop (a draft); rewrite or take down (a live one) ---------- */
export function mod(id, op, note) {
  const a = auth(); if (!a) return Promise.resolve({ ok: false, error: 'Sign in as ' + (commish() || 'the commissioner') + ' first.' });
  const req = { team: a.team, token: a.token, id, op };
  if (op === 'redo') req.note = String(note || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  return authPost(authBuildReq('articlemod', req)).then(r => {
    r = r || { ok: false };
    if (r.ok) {
      S.gen++;
      const d = (S.drafts || []).find(x => x.id === id), lm = (S.liveMeta || []).find(x => x.id === id);
      if (op === 'approve' && d) {
        const now = new Date().toISOString();
        if (d.a) { S.bodies[id] = { id, gw: d.gw, kind: d.kind, approved: now, written: d.written || '', auto: false, a: d.a }; saveBodies(); }
        if (S.list) S.list.live = [{ id, gw: d.gw, kind: d.kind, title: (d.a || {}).title || '', sub: (d.a || {}).sub || '', approved: now, written: d.written || '' }].concat(S.list.live.filter(x => x.id !== id));
        S.drafts = S.drafts.filter(x => x.id !== id);
      } else if (op === 'redo' && d) { d.status = 'writing'; d.redos = (+d.redos || 0) + 1; d.note = req.note; }
      else if (op === 'redo' && lm) { lm.rewrite = 'writing'; lm.redos = (+lm.redos || 0) + 1; lm.note = req.note; }   /* the live version stays up */
      else if (op === 'drop') {
        S.drafts = (S.drafts || []).filter(x => x.id !== id);
        if (!d) {                                  /* a live one, taken down: off this phone at once too */
          if (S.list) S.list.live = S.list.live.filter(x => x.id !== id);
          if (S.liveMeta) S.liveMeta = S.liveMeta.filter(x => x.id !== id);
          if (S.bodies[id]) { delete S.bodies[id]; saveBodies(); }
          S.miss[id] = 'notfound';
        }
      }
      if (S.list && d) S.list.waiting = S.list.waiting.filter(w => !(+w.gw === +d.gw && KIND(w.kind) === KIND(d.kind))).concat(op === 'redo' ? [{ gw: d.gw, kind: d.kind, status: 'writing', since: new Date().toISOString() }] : []);
      bump();
    }
    S.at = 0; S.dAt = 0;
    setTimeout(() => articlesWanted(true), 400);
    return r;
  }).catch(e => ({ ok: false, error: typeof authErrText === 'function' ? authErrText(e) : 'Couldn’t reach the server. Try again.' }));
}
