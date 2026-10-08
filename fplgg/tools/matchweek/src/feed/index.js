/* feed/index.js — the Feed contract (BRIEF §3). Other pages import from here:
   buildPosts() · renderPost(post,{compact}) · postsFor(team) · jiveTodo(team) · jiveCall(team) · unread()
   plus rail(posts) for a ready-made horizontal rail of compact posts. */
import * as UI from '../ui.js';
import { build, jivePosts, callPost, callKey, theShort } from './build.js';
import { presser } from './claims.js';
import { toggleReact, vote, sayQuote, quoteOf, me as signedIn, rumours, startRumour, passRumour } from './social.js';
import { renderPost as R, cut } from './render.js';
import { selectionCall, flagged, freeAgents, simWanted, showsWanted, shows, mmss } from './facts.js';
import { lsGet, lsSet, ver, bump, hash, esc, list, chanceOf, statusWord, newsLabel, newsWhen, buildUpTime, gwDoneTime, words, ord } from './util.js';
import { VOICES } from './voices.js';
import * as GS from './showplay.js';

/* ---------- posts, memoised per data load, team and local state ---------- */
let MEMO = { k: null, posts: [] };
export function buildPosts() {
  if (!D || !D.ro || !D.ro.length) return [];
  const you = UI.you(), k = LOADED_AT + '|' + you + '|' + ver();
  if (MEMO.k !== k) { let posts = []; try { posts = build(you); } catch (e) { console.error(e); } MEMO = { k, posts, by: Object.fromEntries(posts.map(p => [p.id, p])) }; }
  return MEMO.posts;
}
export const postById = id => { buildPosts(); return (MEMO.by || {})[id] || null; };
/* render.js draws quote-posts (qt) from here without importing this module back */
if (typeof window !== 'undefined') window.__postById = postById;
export const renderPost = R;
/* posts that involve a team; Jive and your own press-conference line only when the team is yours */
export function postsFor(team) { const you = UI.you(); return buildPosts().filter(p => !p.wide && (p.teams || []).includes(team) && (p.audience !== 'you' || team === you)); }
export function rail(posts, max = 6) { const ps = (posts || []).slice(0, max); return ps.length ? '<div class="frail">' + ps.map(p => R(p, { compact: true })).join('') + '</div>' : ''; }
/* start the deferred work (title odds simulation, Gameweek Show lookup); safe to call from any page's mount */
export function warm() { try { simWanted(); showsWanted(); } catch (e) { } }

/* ---------- Jive ---------- */
export function jiveCall(team) {
  team = team || UI.you();
  const c = selectionCall(team); if (!c) return null;
  if ((lsGet('emt-feed-kept', {}) || {})[callKey(c)]) return null;
  return callPost(c);
}
/* "with a back injury, no return date", "with a knock, back 17 Oct", "until 17 Oct" */
function outWhy(p) {
  const news = String(p.News || ''), n = news.split(/\s+-\s+/)[0].trim(), when = newsWhen(p);
  if (p.Status === 's') return when ? ' until ' + when : '';
  let why = '';
  if (/^ill(ness)?$/i.test(n)) why = ' through illness';
  else if (/injury|knock|strain|problem|surgery/i.test(n)) why = ' with a ' + n.toLowerCase();
  else if (n && !/suspen|unknown|loan|left|transfer/i.test(n)) why = ' with a ' + n.toLowerCase() + ' injury';
  return why + (/unknown return/i.test(news) ? ', no return date' : when ? ', back ' + when : '');
}
export function jiveTodo(team) {
  team = team || UI.you();
  if (!team || !TEAMS[team] || !D || !D.ro || D.dlPassed) return [];
  const out = [], F = flagged(team), W = UI.waivers(), onWaivers = !!(W && W.phase === 'waivers');
  /* the waiver deadline: time-bound, so it leads. Absolute times only (the Jive thread's unread mark hashes this text) */
  if (onWaivers) out.push({ html: '<b>Waivers close ' + esc(UI.soonWhen(W.wv)) + '.</b> Claims go in on FPL Draft' + (W.pick ? ', and you’re ' + ord(W.pick) + ' in the order' : '') + '. After the run, free agents are instant pickups until the deadline.', faces: [], action: { label: 'Transfers', href: '#/team/transfers' }, kind: 'waivers' });
  if (F.xi.length) {
    const d = F.xi.filter(p => p.Status === 'd'), same = d.length === F.xi.length && d.every(p => chanceOf(p) === chanceOf(d[0]));
    const nm = F.xi.slice(0, 3).map(p => esc(p.Player));
    const html = same
      ? '<b>' + list(nm) + (F.xi.length > 3 ? ' and ' + (F.xi.length - 3) + ' more' : '') + '</b> ' + (F.xi.length === 1 ? 'is ' : 'are ') + chanceOf(d[0]) + '%, and ' + (F.xi.length === 1 ? 'starts.' : F.xi.length === 2 ? 'both start.' : 'all ' + words(F.xi.length) + ' start.')
      : '<b>' + words(F.xi.length).replace(/^./, c => c.toUpperCase()) + ' ' + (F.xi.length === 1 ? 'starter carries' : 'starters carry') + ' a flag:</b> ' + F.xi.slice(0, 3).map(p => esc(p.Player) + ' ' + esc(statusWord(p))).join(', ') + '.';
    out.push({ html, faces: F.xi.slice(0, 3).map(p => String(p.Code)), action: { label: 'Lineup', href: '#/team/lineup' }, kind: 'xi' });
  }
  const hurt = F.bench.filter(p => 'isu'.includes(p.Status));
  if (hurt.length) {
    const p = hurt[0];
    out.push({ html: '<b>' + esc(p.Player) + ' is ' + (p.Status === 's' ? 'suspended' : p.Status === 'u' ? 'unavailable' : 'out') + '</b>' + esc(outWhy(p)) + '.' + (hurt.length > 1 ? ' So ' + (hurt.length > 2 ? 'are ' : 'is ') + esc(list(hurt.slice(1).map(x => x.Player))) + '.' : '') + (hurt.length > 1 ? ' They’re on your bench.' : ' He’s on your bench.'), faces: hurt.slice(0, 2).map(x => String(x.Code)), action: { label: 'Transfers', href: '#/team/transfers' }, kind: 'bench' });
  }
  const c = jiveCall(team);
  if (c) { const m = c.media; out.push({ html: '<b>Selection call:</b> ' + esc(m.out.name) + ' (' + Math.round(m.out.ps * 100) + '% to start) or ' + esc(m.alt.name) + ' (' + Math.round(m.alt.ps * 100) + '%, ' + (m.kind === 'free' ? (onWaivers ? 'on waivers' : 'free agent') : 'your bench') + ').', faces: [m.out.code, m.alt.code], action: m.kind === 'free' ? { label: 'Transfers', href: '#/team/transfers' } : { label: 'Lineup', href: '#/team/lineup' }, kind: 'call' }); }
  const P = presser(team);
  if (P && !P.mine && out.length < 3) out.push({ html: '<b>Archizio wants a quote</b> before ' + esc(P.nm || 'GW' + P.g) + '. Everyone in the league will see it.', faces: [], action: { label: 'Press', href: '#/feed/messages/archizio' }, kind: 'press' });
  const fa = freeAgents(1)[0];
  if (fa && out.length < 3) out.push({ html: '<b>' + esc(fa.p.Player) + '</b> ' + (onWaivers ? 'is on waivers' : 'is a free agent') + ': ' + fa.l3 + ' points in the last ' + words(fa.n) + ' gameweeks.' + (onWaivers ? ' A claim gets him.' : W && W.phase === 'free' ? ' He’s an instant pickup.' : ''), faces: [String(fa.p.Code)], action: { label: fa.p.Player, open: 'player:' + fa.p.Code }, kind: 'fa' });
  return out.slice(0, 3);
}

/* ---------- message threads ---------- */
const firstOfT = t => (typeof FIRSTOF === 'function' ? FIRSTOF(t) : t);
/* the press conference composer: which line is picked ('p0'.., 'own'), the typed words, the claim for typed words */
export const PRESS = { sel: null, text: '', claim: 'none', err: '', busy: false, to: null };
/* the rumour mill composer: a new rumour, and the twist being typed for one already going round */
export const RUM = { text: '', about: '', anon: true, err: '', busy: false, tw: null, twText: '' };
function rumSay() {
  const t = String(RUM.text || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (t.length < 8) { RUM.err = 'Give Archizio a bit more to go on.'; rerender(); return; }
  RUM.busy = true; rerender();
  startRumour(t, RUM.about, RUM.anon).then(ok => { RUM.busy = false; if (ok) { RUM.text = ''; RUM.about = ''; RUM.err = ''; UI.toast(RUM.anon ? 'Whispered. Archizio never names a source.' : 'Whispered, with your name on it.'); } rerender(); });
}
function rumPass(id, kind) {
  let text = '';
  if (kind === 'twist') { text = String(RUM.twText || '').replace(/\s+/g, ' ').trim().slice(0, 140); if (text.length < 4) { RUM.err = 'Add your twist first.'; rerender(); return; } }
  RUM.busy = true; rerender();
  passRumour(id, kind, text).then(ok => { RUM.busy = false; if (ok) { RUM.tw = null; RUM.twText = ''; RUM.err = ''; UI.toast(kind === 'confirm' ? 'You confirmed it.' : kind === 'deny' ? 'You denied it.' : 'Passed on. It’s changed again.'); } rerender(); });
}
function pressSay(target) {
  const P = presser(signedIn() || UI.you()); if (!P) return;
  const isReply = target !== P.target, R = isReply ? P.replies.find(r => r.target === target) : null;
  const picks = isReply ? (R ? R.picks : []) : P.picks;
  let line = '', claim = null, p = null, src = 'pick';
  if (PRESS.to !== target) { PRESS.err = 'Pick a line, or write your own.'; PRESS.to = target; rerender(); return; }
  if (PRESS.sel === 'own') {
    line = String(PRESS.text || '').replace(/\s+/g, ' ').trim().slice(0, 140); src = 'own';
    if (!line) { PRESS.err = 'Say something first.'; rerender(); return; }
    const c = (P.claims || []).find(x => x.c.type === PRESS.claim);
    if (c && (!isReply || c.c.type === 'win')) { claim = c.c; p = c.p; }
  } else {
    const k = PRESS.sel && /^p(\d+)$/.exec(PRESS.sel), o = k ? picks[+k[1]] : null;
    if (!o) { PRESS.err = 'Pick a line, or write your own.'; rerender(); return; }
    line = o.line; claim = o.c; p = o.p;
  }
  if (!signedIn()) { UI.toast('Sign in as your club to go on the record'); window.MW && window.MW.openSheet('identity'); return; }
  if (signedIn() !== P.team) { UI.toast('You’re signed in as ' + signedIn() + '. Switch to that club to answer for it.'); return; }
  PRESS.busy = true;
  sayQuote(target, line, claim, p, src).then(ok => { PRESS.busy = false; if (ok) { PRESS.sel = null; PRESS.text = ''; PRESS.claim = 'none'; UI.toast('On the record. Everyone can see it.'); } rerender(); });
}
export function threads() {
  const you = UI.you(); if (!you || !TEAMS[you]) return [];
  const out = [];
  const J = jivePosts(you).concat(jiveTodo(you).length ? [{ id: 'todo:' + D.gw + ':' + hash(jiveTodo(you).map(t => t.html).join()) }] : []);
  if (J.length) {
    const first = J.find(p => p.kind === 'call') || J.find(p => p.kind === 'fitness') || J[0];
    out.push({ id: 'jive', voice: 'jive', sig: hash(J.map(p => p.id).join('|')), preview: first.kind === 'call' ? 'A selection call before the deadline' : first.kind === 'fitness' ? 'The fitness board for GW' + D.gw : first.kind === 'subs' ? 'The auto-subs so far' : first.kind === 'scout' ? 'Scouting the opponent' : 'Your to-do list', time: '' });
  }
  const P = presser(you);
  if (P) {
    const owed = P.replies.filter(r => !r.mine);
    out.push({ id: 'archizio', voice: 'archizio', sig: hash(P.target + (P.mine ? P.mine.line : '') + owed.map(r => r.target).join()), preview: owed.length ? firstOfT(owed[0].to.team) + ' said something. Want to answer?' : P.mine ? 'You said: “' + P.mine.line + '”' : 'Wants a quote before ' + (P.nm || 'GW' + P.g), time: '', needs: !P.mine || owed.length > 0 });
  }
  {
    const me = signedIn() || you;
    let R = []; try { R = rumours(); } catch (e) { }
    const owed = R.filter(g => g.by !== me && !g.seen[me] && g.status === 'spreading');
    out.push({ id: 'rumours', voice: 'archizio', sig: hash(R.map(g => g.id + g.hops + g.confirms + g.denies).join('|')), preview: owed.length ? 'Heard this? “' + owed[0].latest + '”' : R.length ? R.length + (R.length === 1 ? ' rumour' : ' rumours') + ' going round · start one' : 'Start a rumour. Archizio never names a source.', time: '', needs: owed.length > 0 });
  }
  const seen = lsGet('emt-feed-threads', {}) || {};
  out.forEach(t => { t.unread = seen[t.id] !== t.sig && (t.id !== 'archizio' || t.needs || seen[t.id] === undefined); });
  return out;
}
export function markThread(id) { const t = threads().find(x => x.id === id); if (!t) return; const s = lsGet('emt-feed-threads', {}) || {}; if (s[id] !== t.sig) { s[id] = t.sig; lsSet('emt-feed-threads', s); } }
export const unreadThreads = () => threads().filter(t => t.unread).length;

/* ---------- unread ---------- */
function seenSet() { const s = lsGet('emt-feed-seen', null); return s && Array.isArray(s.ids) ? { t: s.t || 0, ids: new Set(s.ids) } : null; }
export function unreadIds() {
  const posts = buildPosts(), s = seenSet();
  if (s) return posts.filter(p => !s.ids.has(p.id)).map(p => p.id);
  /* never opened on this phone: this gameweek's posts count as new */
  const from = D.gwsDone ? gwDoneTime(D.gwsDone).getTime() : 0;
  return posts.filter(p => p.ts && p.ts.getTime() >= from).map(p => p.id);
}
export function unread() { try { return unreadIds().length; } catch (e) { return 0; } }
export function markSeen() {
  const ids = buildPosts().map(p => p.id), s = seenSet();
  /* keep ids of posts that may come back (a poll before and after a pick), capped */
  const keep = s ? [...s.ids].filter(i => !ids.includes(i)).slice(-120) : [];
  lsSet('emt-feed-seen', { t: Date.now(), ids: ids.concat(keep) });
}

/* ---------- taps that act locally: share, poll picks, keep, press conference, voice note, the show ---------- */
function rerender() { bump(); if (window.MW) { window.MW.render({ keepScroll: true }); window.MW.refreshSheet && window.MW.refreshSheet(); } }
async function share(p) {
  const text = p.share || String(p.text || '').replace(/<[^>]+>/g, '');
  const url = location.href.split('#')[0] + '#/feed/league';
  try { if (navigator.share) { await navigator.share({ title: VOICES[p.voice].name + ' · El Matador Tire', text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text + ' ' + url); UI.toast('Copied to share'); } catch (e) { UI.toast('Sharing isn’t available here'); }
}
let SPK = null;
export function speak(id, btn) {
  const p = postById(id); if (!p || !p.media || !p.media.script) return;
  const S = window.speechSynthesis;
  if (!S || typeof SpeechSynthesisUtterance === 'undefined') { window.MW && window.MW.openSheet('post', id); return; }
  if (SPK === id && (S.speaking || S.pending)) { S.cancel(); SPK = null; setSpeakUI(id, false); return; }
  S.cancel();
  const u = new SpeechSynthesisUtterance(p.media.script.join(' '));
  u.rate = 1.02; u.lang = 'en-GB';
  u.onend = () => { if (SPK === id) SPK = null; setSpeakUI(id, false); };
  u.onerror = ev => { if (SPK === id) SPK = null; setSpeakUI(id, false); if (ev && (ev.error === 'interrupted' || ev.error === 'canceled')) return; UI.toast('This phone can’t read it aloud. Here’s the script.'); window.MW && window.MW.openSheet('post', id); };
  SPK = id; setSpeakUI(id, true); S.speak(u);
}
function setSpeakUI(id, on) {
  document.querySelectorAll('[data-fx="speak:' + CSS.escape(id) + '"]').forEach(b => { b.classList.toggle('on', on); b.innerHTML = on ? '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>' : '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 4 L20 12 L7 20 Z" fill="currentColor"/></svg>'; b.setAttribute('aria-label', on ? 'Stop' : 'Play the preview'); });
}
export const stopSpeaking = () => { try { if (SPK && window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { } SPK = null; };

function onTap(e) {
  const el = e.target.closest('[data-fx]'); if (!el) return;
  const v = el.getAttribute('data-fx'), i = v.indexOf(':'), kind = v.slice(0, i), arg = v.slice(i + 1);
  e.preventDefault(); e.stopPropagation();
  if (kind === 'share') { const p = postById(arg); if (p) share(p); return; }
  if (kind === 'poll') {
    const j = arg.lastIndexOf(':'), pid = arg.slice(0, j), pick = arg.slice(j + 1), p = postById(pid); if (!p) return;
    vote(pid, pick); return;
  }
  if (kind === 'rx') { const j = arg.lastIndexOf(':'); toggleReact(arg.slice(0, j), arg.slice(j + 1)); return; }
  if (kind === 'qp') { const j = arg.lastIndexOf('|'), t = arg.slice(0, j); if (PRESS.to !== t) { PRESS.text = ''; PRESS.claim = 'none'; } PRESS.to = t; PRESS.sel = arg.slice(j + 1); PRESS.err = ''; rerender(); return; }
  if (kind === 'qc') { const j = arg.lastIndexOf('|'); PRESS.to = arg.slice(0, j); PRESS.sel = 'own'; PRESS.claim = arg.slice(j + 1); rerender(); return; }
  if (kind === 'qsay') { pressSay(arg); return; }
  if (kind === 'rmab') { RUM.about = RUM.about === arg ? '' : arg; rerender(); return; }
  if (kind === 'rmanon') { RUM.anon = arg !== '0'; rerender(); return; }
  if (kind === 'rmsay') { rumSay(); return; }
  if (kind === 'rmp') { const j = arg.lastIndexOf('|'); rumPass(arg.slice(0, j), arg.slice(j + 1)); return; }
  if (kind === 'rmtw') { RUM.tw = RUM.tw === arg ? null : arg; RUM.twText = ''; RUM.err = ''; rerender(); return; }
  if (kind === 'keep') {
    const s = lsGet('emt-feed-kept', {}) || {}; s[arg] = Date.now(); lsSet('emt-feed-kept', s);
    const p = buildPosts().find(x => x.kind === 'call'); UI.toast(p ? 'Noted. Keeping ' + p.media.out.name + '.' : 'Noted.'); rerender(); return;
  }
  if (kind === 'unkeep') { const s = lsGet('emt-feed-kept', {}) || {}; delete s[arg]; lsSet('emt-feed-kept', s); rerender(); return; }
  if (kind === 'presshare') { const p = postById(arg); if (p) share(p); return; }
  if (kind === 'speak') { speak(arg, el); return; }
  if (kind === 'show') { GS.open(+arg); return; }
  if (kind === 'showch') { const [g, c] = String(arg).split('|'); GS.open(+g, +c); return; }
}
/* carousels: keep the dots in step with the slide in view */
function onScroll(e) {
  const c = e.target; if (!c || !c.classList || !c.classList.contains('fcar')) return;
  const i = Math.round(c.scrollLeft / Math.max(1, c.clientWidth));
  const dots = c.parentElement && c.parentElement.querySelector('.fcd'); if (dots) [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
  CAR[c.getAttribute('data-car')] = i;
}
export const CAR = {};
export function restoreCarousels(root) { (root || document).querySelectorAll('.fcar[data-car]').forEach(c => { const i = CAR[c.getAttribute('data-car')]; if (i) { c.scrollLeft = i * c.clientWidth; onScroll({ target: c }); } }); }
if (typeof document !== 'undefined' && !window.__feedTaps) {
  window.__feedTaps = 1;
  /* typing a quote: keep the words without redrawing under the thumb */
  document.addEventListener('input', e => {
    const r = e.target;
    if (r && r.matches && r.matches('textarea[data-rm]')) { RUM.text = r.value.slice(0, 160); RUM.err = ''; const n = r.parentElement.querySelector('.pq-n'); if (n) n.textContent = (160 - r.value.length) + ''; return; }
    if (r && r.matches && r.matches('textarea[data-rmt]')) { RUM.twText = r.value.slice(0, 140); RUM.err = ''; const n = r.parentElement.querySelector('.pq-n'); if (n) n.textContent = (140 - r.value.length) + ''; return; }
    const t = e.target; if (!t || !t.matches || !t.matches('textarea[data-qt]')) return;
    const tgt = t.getAttribute('data-qt'); if (PRESS.to !== tgt) { PRESS.claim = 'none'; }
    PRESS.to = tgt; PRESS.sel = 'own'; PRESS.text = t.value.slice(0, 140); PRESS.err = '';
    const box = t.closest('.pq'); if (box) { box.querySelectorAll('.pq-o').forEach(b => b.classList.remove('on')); const own = t.closest('.pq-own'); if (own) own.classList.add('on'); }
    const n = t.parentElement && t.parentElement.querySelector('.pq-n'); if (n) n.textContent = (140 - t.value.length) + '';
  });
  document.addEventListener('click', onTap, true);
  document.addEventListener('scroll', onScroll, true);
}
export { theShort, VOICES, shows, mmss, cut };
