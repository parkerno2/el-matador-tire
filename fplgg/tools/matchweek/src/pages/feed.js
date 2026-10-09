/* pages/feed.js — the Feed: Everyone (id league) · For you · Articles · Messages (+ #/feed/messages/<jive|archizio>, #/feed/league/<voice>). */
import * as UI from '../ui.js';
import { isMotm, oneMotm, demote } from '../feed/curate.js';
import {
  unread, buildPosts, renderPost, unreadIds, markSeen, threads, markThread, unreadThreads, jiveTodo, jiveCall, warm, restoreCarousels, postById, PRESS, RUM,
} from '../feed/index.js';
import { jivePosts, theShort } from '../feed/build.js';
import { presser, claimChip, pct } from '../feed/claims.js';
import { me as signedIn, quotes, live as socialLive, rumours } from '../feed/social.js';
import { quoteId } from '../feed/social-posts.js';
import { VOICES, ORDER, avatar, tagChip, pic } from '../feed/voices.js';
import { shows, showPending, mmss, selectionCall } from '../feed/facts.js';
import { showSlot, showNoteHTML } from '../feed/showsync.js';
import { callKey } from '../feed/build.js';
import { cut, mediaHTML } from '../feed/render.js';
import { esc, short, dayMonth, lsGet, firstOf, dt, relTime } from '../feed/util.js';
import { articlesWanted, allArticles, waiting as artWaiting, drafts as artDrafts, commishFirst, isCommish, isCommishTeam, KIND, artHref, maxRedos, review as artReview } from '../feed/articles.js';
import { reader, readerHead, restoreNote, REV } from '../feed/article.js';

const hasSeen = () => { try { return !!localStorage.getItem('emt-feed-seen'); } catch (e) { return false; } };
/* Everyone comes first: the whole league, about the whole league. For you narrows it to your club */
const SUBS = [{ id: 'league', label: 'Everyone' }, { id: 'foryou', label: 'For you' }, { id: 'articles', label: 'Articles' }, { id: 'messages', label: 'Messages' }];
let VISIT = null, LIMIT = 20;

/* ---------- chrome ---------- */
function head(sub, args) {
  const nt = unreadThreads();
  return UI.pageHead('Feed') + UI.pills(SUBS.map(s => ({ label: s.label, href: '#/feed/' + s.id, on: s.id === sub, ct: s.id === 'messages' && nt ? nt : 0 })));
}
function avatarInner(v) { return pic(v, 56); }
function stories(sub, args) {
  const you = UI.you(), news = VISIT ? VISIT.ids : new Set();
  const posts = buildPosts();
  const fresh = v => posts.some(p => p.voice === v && news.has(p.id));
  const cur = sub === 'league' ? args[0] : sub === 'messages' && args[0] === 'jive' ? 'jive' : null;
  const item = (v, href, label, inner, cls, isNew) => '<a class="fst' + (cur === v ? ' cur' : '') + '" href="' + href + '"><span class="fring ' + cls + (isNew ? '' : ' seen') + '"><span>' + inner + '</span></span><b>' + label + '</b></a>';
  /* the Gameweek Show first, with Malcolm's picture and a play badge: one tap opens the latest show (Parker, 8 Oct 2026) */
  const sv = shows()[0];
  const showItem = sv ? '<button class="fst fst-show" data-fx="show:' + sv.gw + '" aria-label="Watch the Gameweek ' + sv.gw + ' show"><span class="fring r-malcolm' + (showSlot(sv, D) ? '' : ' seen') + '"><span>' + avatarInner('malcolm') + '<i class="fst-play">' + UI.icon('play', 12, '#37003C', 2.6) + '</i></span></span><b>Show</b></button>' : '';
  return '<nav class="fstories" aria-label="Voices">' + showItem
    + ORDER.filter(v => v !== 'jive' || you).map(v => item(v, v === 'jive' ? '#/feed/messages/jive' : '#/feed/league/' + v, VOICES[v].first, avatarInner(v), 'r-' + v, v === 'jive' ? threads().some(t => t.id === 'jive' && t.unread) : fresh(v))).join('')
    + item('all', '#/feed/league', 'Everyone', UI.leagueCrest(26), 'r-lg', posts.some(p => news.has(p.id)) && cur !== null)
    + '</nav>';
}
const list = (posts, opt = {}) => posts.map(p => renderPost(p, { unread: VISIT && VISIT.ids.has(p.id) && !opt.noNew })).join('');

/* the Gameweek Show pinned at the top of Everyone and For you while it is this gameweek's (Parker, 8 Oct 2026) */
function pinnedGw() { let s = null; try { s = shows().find(x => x.gw === D.gw); } catch (e) { } return showSlot(s, D) ? s.gw : 0; }
/* the commissioner's line where the show would be while it is being voiced (Parker, 9 Oct 2026); members see nothing */
function showNoteFor() {
  const p = showPending(D.gw);
  return p && isCommishTeam() && showSlot({ gw: D.gw }, D) ? showNoteHTML(p) : '';
}
function pinnedShow() {
  const g = pinnedGw(); if (!g) return showNoteFor();
  const s = shows().find(x => x.gw === g);
  return '<div class="fl-art fl-pin">' + UI.sh(D.dlPassed ? 'Replay the Gameweek Show' : 'The Gameweek Show', { aside: 'Pinned' }) + '<div class="fl-art-b">' + showCard(s) + '</div></div>';
}

/* ---------- For you ---------- */
function forYou() {
  const you = UI.you(), posts = buildPosts();
  const pin = pinnedShow();
  if (!you || !TEAMS[you]) {
    return pin + '<div class="fy-pick"><b>Pick your team</b><span>Jive’s messages, press conferences and the posts about your club live here.</span><button class="btn" data-open="menu">Choose your team</button></div>'
      + UI.sh('Latest from the league', { more: 'Everyone', href: '#/feed/league' }) + '<div class="fl">' + list(posts.filter(p => p.audience !== 'you' && !(pin && p.id === 'show:' + D.gw)).slice(0, 8)) + '</div>';
  }
  const th = threads();
  const inbox = th.length ? UI.sh('Messages', { more: 'All', href: '#/feed/messages' }) + '<div class="card inbox">' + th.map(threadRow).join('') + '</div>' : '';
  const call = jiveCall(you);
  const mine = oneMotm(posts.filter(p => !p.wide && (p.teams || []).includes(you) && (p.voice !== 'jive') && p.kind !== 'article'));
  const stream = (call ? [call] : []).concat(mine);
  const art = latestArticle(!!pin);
  const N = 12, shown = stream.slice(0, N);
  const body = shown.map((p, i) => renderPost(p, { unread: VISIT && VISIT.ids.has(p.id) }) + (i === 1 && art ? artBlock(art) : '')).join('') + (shown.length < 2 && art ? artBlock(art) : '');
  return pin + inbox + UI.sh('For ' + you) + (stream.length ? '<div class="fl">' + body + '</div>' : UI.empty('Quiet week for ' + you, 'Nothing about your club yet. Everyone has every post in the league.') + (art ? artBlock(art) : ''))
    + (stream.length > N ? '<a class="fl-more" href="#/feed/league">Every post is in Everyone ›</a>' : '');
}
function latestArticle(pinned) {
  const s = pinned ? null : shows()[0];   /* the show pinned above is not repeated down here */
  const a = allArticles()[0];
  if (s && (!a || s.gw * 2 >= a.ord)) return { show: s };
  return a ? { art: a } : null;
}
function artBlock(x) {
  const lab = x.show ? 'The Gameweek Show' : x.art.gw >= D.gw - 1 ? 'This week’s article' : 'Latest article';
  return '<div class="fl-art">' + UI.sh(lab, { more: 'Articles', href: '#/feed/articles' }) + '<div class="fl-art-b">' + (x.show ? showCard(x.show) : artCard(x.art)) + '</div></div>';
}

/* ---------- League (every post, or one voice) ---------- */
/* quality over quantity: Everyone shows what the league said and did (quotes, receipts, rumours, AI posts, stories)
   plus each gameweek's ten best template posts; everything else is one tap away */
const ALWAYS = new Set(['presser', 'bold', 'receipt', 'called', 'pile', 'remember', 'rumour', 'breaking', 'ai', 'show', 'article']);
/* what earns a place, best first; Clark's thumbnails rank high because they're the ones people screenshot. Manager of the
   Month comes last (Parker, 8 Oct 2026: tone it down; most people have not opened the app yet) */
const RANK = ['ft', 'thumb', 'table', 'record', 'poll', 'preview', 'odds', 'derbies', 'take', 'swing', 'voicenote', 'excl', 'market', 'deal', 'coin', 'board', 'streak', 'steal', 'race', 'sweat', 'model', 'form', 'treat', 'r1', 'fa', 'results', 'sheets', 'motm'];
/* the first screenful of Everyone for someone who has never opened the Feed carries nothing about Manager of the Month */
const FIRST_SCREEN = 8;
const CAP = { ft: 4, preview: 2, thumb: 2, deal: 2 };
const PER_GW = 9;
let EXPAND = false;
function curate(posts) {
  const keep = new Set(), byGw = {};
  posts.forEach(p => {
    if (ALWAYS.has(p.kind) || p.hot || p.social || String(p.id).startsWith('ed:')) { keep.add(p.id); return; }
    (byGw[p.gw || 0] = byGw[p.gw || 0] || []).push(p);
  });
  const rk = k => { const i = RANK.indexOf(k); return i < 0 ? RANK.length : i; };
  Object.values(byGw).forEach(list => {
    const n = {}; let left = PER_GW;
    list.slice().sort((a, b) => rk(a.kind) - rk(b.kind) || b.ts - a.ts).forEach(p => {
      if (left <= 0 || (n[p.kind] || 0) >= (CAP[p.kind] || 1)) return;
      n[p.kind] = (n[p.kind] || 0) + 1; left--; keep.add(p.id);
    });
  });
  return oneMotm(posts.filter(p => keep.has(p.id)));
}
function league(args) {
  const v = args[0] && VOICES[args[0]] ? args[0] : null;
  let posts = buildPosts().filter(p => p.voice !== 'jive');
  const pin = v ? '' : pinnedShow();
  if (pin) posts = posts.filter(p => p.id !== 'show:' + D.gw);   /* pinned above, not again in the stream */
  if (v) posts = posts.filter(p => p.voice === v);
  const all = posts.length;
  if (!v && !EXPAND) posts = curate(posts);
  if (!v && VISIT && VISIT.first) posts = demote(posts, isMotm, FIRST_SCREEN);
  const folded = all - posts.length;
  const shown = posts.slice(0, LIMIT);
  const newN = posts.filter(p => VISIT && VISIT.ids.has(p.id)).length;
  return pin + (v ? voiceHero(v, posts.length) : pressCta(UI.you()))
    + (posts.length ? (newN && !v ? '<div class="fl-newbar"><i></i>' + newN + (VISIT.first ? ' new this gameweek' : ' new since you last looked') + '</div>' : '') + '<div class="fl">' + list(shown) + '</div>'
      + (posts.length > shown.length ? '<button class="fl-more btn ghost" data-more>Show older posts</button>' : folded > 0 ? '<button class="fl-more btn ghost" data-all>Show the other ' + folded + ' posts</button>' : '<div class="fl-end">That’s everything' + (v ? ' from ' + esc(VOICES[v].first) : '') + ' this season.</div>')
      : UI.empty('Nothing yet', 'Posts appear as the league plays: signings, previews, full time.'));
}
function voiceHero(v, n) {
  const V = VOICES[v];
  return '<div class="fvh fvh-' + v + '"><i class="fvh-deco"></i>' + avatar(v, 56)
    + '<div class="fvh-t"><b class="fvh-n">' + esc(V.name) + '</b><span>' + esc(V.handle) + ' · ' + esc(V.role) + '</span></div>'
    + '<p>' + esc(V.beat) + '</p><div class="fvh-f"><span>' + n + ' ' + (n === 1 ? 'post' : 'posts') + '</span><a href="#/feed/league">All voices ›</a></div></div>';
}

/* ---------- Articles ---------- */
function showCard(s) {
  return '<div class="fshow-card">' + mediaHTML({ id: 'show:' + s.gw, media: { type: 'show', gw: s.gw } }, false) + '<button class="sc-open" data-open="post:show:' + s.gw + '">Chapters and captions ›</button></div>';
}
function artCard(a) {
  return '<a class="far" href="' + esc(a.href) + '"><span class="far-k"><b class="n">GW' + a.gw + '</b><em>' + esc(a.kind.toUpperCase()) + '</em></span><span class="far-t"><b>' + esc(a.title) + '</b><span>' + esc(a.sub) + '</span></span><span class="far-go">' + UI.icon('chev', 16, 'var(--p300)') + '</span></a>';
}
/* the commissioner's queue: drafts to read first, then the ones still being written */
function draftCard(d) {
  const kind = KIND(d.kind), g = +d.gw, ready = d.status === 'draft' && d.a;
  const k = '<span class="far-k dr"><b class="n">GW' + g + '</b><em>' + esc(kind.toUpperCase()) + '</em></span>';
  if (ready) {
    const w = dt(d.written);
    return '<a class="far ar-dr" href="' + esc(artHref(d.id)) + '">' + k + '<span class="far-t"><span class="ar-st"><i></i>Draft · only you can see it</span><b>' + esc(d.a.title || 'GW' + g + ' ' + kind.toLowerCase()) + '</b><span>' + (w ? 'Written ' + esc(ago(w)) + '. ' : '') + 'Read it, then approve, rewrite or drop.</span></span><span class="far-go">' + UI.icon('chev', 16, 'var(--b300)') + '</span></a>';
  }
  const failed = d.status === 'failed', left = Math.max(0, maxRedos - (+d.redos || 0)), busy = REV.busy && REV.id === d.id;
  const why = d.error ? esc(String(d.error).slice(0, 160).replace(/[.\s]*$/, '')) + '. ' : 'It stopped after three tries. ';
  /* a failed one can be sent again from here (no computer needed): a rewrite from the stored research */
  const retry = failed && left ? '<button class="btn ghost ar-again" data-am="again" data-id="' + esc(d.id) + '"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Sending…' : 'Try again') + '</button>' : '';
  return '<div class="far ar-dr wip' + (failed ? ' bad' : '') + '">' + k + '<span class="far-t"><span class="ar-st' + (failed ? ' bad' : ' run') + '"><i></i>' + (failed ? 'Couldn’t be written' : d.status === 'research' ? 'Researching the week' : 'Being written') + '</span><b>The GW' + g + ' ' + kind.toLowerCase() + '</b><span>' + (failed ? why + (left ? (left === 1 ? 'One retry left.' : left + ' retries left.') : 'No retries left; the sheet’s Articles: write now starts a fresh one.') : (d.note ? 'Rewriting with your note. ' : '') + 'It lands here for your read when it’s done.') + '</span>' + retry + '</span></div>';
}
const ago = d => { const r = relTime(d); return /^\d+[mh]$/.test(r) ? r + ' ago' : r; };
/* what a missing article is doing: "GW6 preview: being written". Code.gs v3.14 publishes once it passes the checks, so
   only review mode (EMT_ART_REVIEW = yes) says "written, waiting for Parker’s read" */
function waitLine(gw, kind) {
  const w = artWaiting().find(x => +x.gw === gw && KIND(x.kind) === kind);
  if (!w) return null;
  return 'GW' + gw + ' ' + kind.toLowerCase() + ': ' + (w.status !== 'draft' ? 'being written' : artReview() ? 'written, waiting for ' + commishFirst() + '’s read' : 'written, not published yet');
}
function articles(args) {
  const S = shows();
  const arts = allArticles();
  const has = (gw, kind) => arts.some(a => a.gw === gw && a.kind === kind);
  const lines = [], missing = [];
  [[D.gwsDone, 'Recap'], [D.gw, 'Preview']].forEach(([g, kind]) => {
    if (!g || has(g, kind)) return;
    const l = waitLine(g, kind); if (l) lines.push(l); else missing.push('GW' + g + ' ' + kind.toLowerCase());
  });
  /* anything else in the queue (a rewrite of an older week, say) */
  artWaiting().forEach(w => { const g = +w.gw, kind = KIND(w.kind); if ((g === D.gwsDone && kind === 'Recap') || (g === D.gw && kind === 'Preview') || has(g, kind)) return; const l = waitLine(g, kind); if (l && !lines.includes(l)) lines.push(l); });
  /* the commissioner's queue shows only when something needs him: a draft to read (review mode) or an article that
     failed (Try again). In review mode it also lists the ones being written; otherwise those get a line like everyone's */
  const all = isCommish() ? artDrafts().filter(d => ['draft', 'research', 'writing', 'failed'].includes(d.status)) : [];
  const needs = all.some(d => d.status === 'draft' || d.status === 'failed');
  const Q = !needs ? [] : all.filter(d => artReview() || d.status === 'draft' || d.status === 'failed').sort((a, b) => (b.status === 'draft') - (a.status === 'draft') || b.gw - a.gw);
  /* the commissioner has those in his queue above; everyone else gets one line each */
  const notes = lines.filter(l => !Q.some(d => l.indexOf('GW' + d.gw + ' ' + KIND(d.kind).toLowerCase() + ':') === 0));
  return (Q.length ? UI.sh('Waiting for your read', { aside: Q.filter(d => d.status === 'draft' && d.a).length ? Q.filter(d => d.status === 'draft' && d.a).length + ' to read' : '' }) + '<div class="ar-list ar-q">' + Q.map(draftCard).join('') + '</div>' : '')
    + (S.length || showNoteFor() ? UI.sh('The Gameweek Show') + showNoteFor() + S.map(s => '<div class="ar-show">' + showCard(s) + '</div>').join('') : '')
    + UI.sh('Previews and recaps', { aside: arts.length + ' articles' })
    + (notes.length ? '<div class="ar-waits">' + notes.map(l => '<p class="ar-wait"><i></i>' + esc(l) + '.</p>').join('') + '</div>' : '')
    + (arts.length ? '<div class="ar-list">' + arts.map(artCard).join('') + '</div>' : UI.empty('No articles yet', 'Previews land before each deadline, recaps after each gameweek.'))
    + (missing.length ? '<p class="ar-note">Not published yet: ' + esc(missing.join(' and ')) + '.</p>' : '');
}

/* ---------- Messages ---------- */
function threadRow(t) {
  const V = VOICES[t.voice];
  return '<a class="row tap fth-r" href="#/feed/messages/' + t.id + '">' + avatar(t.voice, 44) + '<span class="fth-t"><b>' + (t.id === 'rumours' ? 'The rumour mill <span class="ftag ftag-press">RUMOURS</span>' : esc(V.name) + (t.id === 'archizio' ? ' <span class="ftag ftag-press">PRESS CONFERENCE</span>' : '')) + '</b><span class="ell">' + esc(t.preview) + (t.time ? ' · ' + esc(t.time) : '') + '</span></span>' + (t.unread ? '<i class="fth-dot" aria-label="Unread"></i>' : UI.icon('chev', 16, 'var(--tx4)')) + '</a>';
}
function messages(args) {
  const you = UI.you();
  if (!you || !TEAMS[you]) return '<div class="fy-pick"><b>Pick your team</b><span>Jive Tidlsey is your assistant manager, and Archizio wants a quote from you before every gameweek.</span><button class="btn" data-open="menu">Choose your team</button></div>';
  if (args[0] === 'jive') return jiveThread(you);
  if (args[0] === 'archizio') return pressThread(you);
  if (args[0] === 'rumours') return rumourThread(you);
  const th = threads();
  return (th.length ? '<div class="card inbox list">' + th.map(threadRow).join('') + '</div>' : UI.empty('No messages', 'Jive writes when there’s something to act on before a deadline. Archizio wants a quote before every gameweek.'))
    + '<p class="ar-note">Jive’s messages are only for you. What you say to Archizio goes on the record for the whole league.</p>';
}
const bubble = (v, html, cls = '') => '<div class="fbb fbb-' + v + (cls ? ' ' + cls : '') + '">' + html + '</div>';
function threadHead(v, extra) { return '<div class="fth-h"><a class="fth-back" href="#/feed/messages" aria-label="Back to messages">' + UI.icon('back', 18, 'var(--b300)', 2.4) + '</a>' + avatar(v, 36) + '<span class="fth-who"><b>' + esc(VOICES[v].name) + '</b><span>' + (extra || esc(VOICES[v].handle)) + '</span></span></div>'; }
function jiveThread(you) {
  const J = jivePosts(you), call = jiveCall(you), todo = jiveTodo(you);
  const fit = J.find(p => p.kind === 'fitness'), sc = J.find(p => p.kind === 'scout'), subs = J.find(p => p.kind === 'subs');
  let body = '';
  const when = 'GW' + D.gw + (D.dlPassed ? (UI.week().mode === 'live' ? ' · live' : '') : ' build-up');
  if (fit) body += bubble('jive', fit.text) + '<div class="fbb-media">' + mediaHTML(fit, false) + '</div>';
  if (call) body += bubble('jive', call.text.replace(/^Gaffer, a selection call before the deadline\. /, (fit ? 'And a selection call. ' : 'Gaffer, a selection call. '))) + '<div class="fbb-media">' + mediaHTML(call, false) + '</div>';
  if (sc) body += bubble('jive', sc.text) + '<div class="fbb-media">' + mediaHTML(sc, false) + '</div>';
  if (subs) body += bubble('jive', subs.text) + '<div class="fbb-media">' + mediaHTML(subs, false) + '</div>';
  const c0 = !call && !D.dlPassed ? selectionCall(you) : null, kept = c0 && (lsGet('emt-feed-kept', {}) || {})[callKey(c0)];
  const td = todo.filter(t => t.kind !== 'call');
  if (td.length) body += bubble('jive', 'Before the deadline, gaffer:') + '<div class="fbb-media">' + todoBoard(td) + '</div>';
  if (!body) body = bubble('jive', D.dlPassed ? 'Lineups are locked, gaffer. Nothing to change until the next window opens.' : 'Nothing to act on right now, gaffer. Your XI is fit and starting.');
  const qr = [];
  if (call) qr.push(call.media.kind === 'free' ? '<a class="fqr" href="#/team/transfers">Show free-agent ' + ({ GKP: 'keepers', DEF: 'defenders', MID: 'midfielders', FWD: 'forwards' }[call.media.pos] || 'players') + '</a>' : '<a class="fqr" href="#/team/lineup">Open the lineup</a>');
  if (fit || (call && call.media.kind === 'free')) qr.push('<a class="fqr" href="#/team/lineup">Open the lineup</a>');
  if (sc) qr.push('<button class="fqr" data-open="player:' + esc(sc.media.code) + '">Open ' + esc((UI.player(sc.media.code) || {}).Player || '') + '</button>');
  if (subs) qr.push('<a class="fqr" href="#/matchday/matchup">Open the matchup</a>');
  if (call) qr.push('<button class="fqr" data-fx="keep:' + esc(call.media.key) + '">Keep ' + esc(call.media.out.name) + '</button>');
  if (kept) { body += bubble('jive', 'Noted, gaffer: you’re keeping ' + esc(c0.out.p.Player) + '.'); qr.push('<button class="fqr" data-fx="unkeep:' + esc(callKey(c0)) + '">Show the selection call again</button>'); }
  return threadHead('jive', tagChip('jive')) + '<div class="thread"><div class="fth-when">' + esc(when) + '</div>' + body + (qr.length ? '<div class="fqrs">' + [...new Set(qr)].join('') + '</div>' : '') + '</div>';
}
function todoBoard(items) {
  return '<div class="fjb todo"><div class="fjb-hd"><span class="f-mono fjb-t">TO DO</span><span class="f-mono fjb-m">GW' + D.gw + '</span></div>'
    + items.map((t, i) => '<div class="jt"><span class="f-mono jt-n">' + (i + 1) + '</span><span class="jt-f">' + t.faces.slice(0, 2).map(c => '<span class="jc-f dash xs">' + cut(c, '', '') + '</span>').join('') + '</span><span class="jt-t">' + t.html + '</span>'
      + (t.action.href ? '<a class="jbtn f-mono sm" href="' + esc(t.action.href) + '">' + esc(t.action.label) + '</a>' : '<button class="jbtn f-mono sm" data-open="' + esc(t.action.open) + '">Open</button>') + '</div>').join('')
    + '<div class="fjb-note"><span class="f-chalk">' + (gwDeadline(D.gw) ? 'Sort these before ' + esc(gwDeadline(D.gw).toLocaleDateString(undefined, { weekday: 'long' })) + '.' : 'Sort these before the deadline.') + '</span></div></div>';
}
/* the press room: your line this gameweek (picked or your own words, with a call the data can settle), and answers owed */
function composer(target, picks, P, mine, intro) {
  if (mine) {
    const post = postById(quoteId(mine));
    return '<div class="fth-lab">On the record' + (mine.local ? ' · sending' : '') + '</div>'
      + (post ? '<div class="fbb-media fwide">' + mediaHTML(post, false) + '</div>' : bubble('you', '“' + esc(mine.line) + '”'))
      + '<div class="pq-acts">' + (post ? '<button class="btn" data-fx="presshare:' + esc(post.id) + '">' + UI.icon('share', 16, '#fff') + 'Share</button>' : '') + '<a class="btn ghost" href="#/feed/league">See it in Everyone</a></div>'
      + '<p class="ar-note">No take-backs. ' + (mine.claim ? 'You made a call, so the receipts come out when it settles.' : 'No call in it, so no receipts.') + '</p>';
  }
  const on = PRESS.to === target, sel = on ? PRESS.sel : null;
  const opt = (o, i) => '<button class="pq-o' + (sel === 'p' + i ? ' on' : '') + '" data-fx="qp:' + esc(target) + '|p' + i + '"><b>“' + esc(o.line) + '”</b>'
    + '<span class="pq-m">' + (o.c ? '<em class="pq-chip">' + esc(claimChip(o.c)) + '</em>' + (o.p != null ? '<span>the model: <b class="n">' + pct(o.p) + '</b></span>' : '') : '<span>no call, no receipts</span>') + '</span></button>';
  const typed = on ? PRESS.text : '';
  const allowed = (P.claims || []).filter(c => target === P.target || c.c.type === 'win');
  const chips = '<div class="pq-cs"><span class="pq-cl">Calling</span>' + [['none', 'Nothing']].concat(allowed.map(c => [c.c.type, claimChip(c.c) + (c.p != null ? ' · ' + pct(c.p) : '')])).map(([k, l]) => '<button class="pq-c' + ((on && sel === 'own' ? PRESS.claim : 'none') === k ? ' on' : '') + '" data-fx="qc:' + esc(target) + '|' + k + '">' + esc(l) + '</button>').join('') + '</div>';
  const who = signedIn();
  const btn = !socialLive() ? '<p class="ar-note">Logins aren’t switched on yet.</p>'
    : !who ? '<button class="btn block" data-open="identity">Sign in as ' + esc(short(P.team)) + ' to go on the record</button>'
    : '<button class="btn block" data-fx="qsay:' + esc(target) + '"' + (PRESS.busy ? ' disabled' : '') + '>' + (PRESS.busy ? 'Sending…' : 'Go on the record') + '</button>';
  return (intro || '')
    + '<div class="fth-hint">Pick a line, or say it yourself</div>'
    + '<div class="pq">' + picks.map(opt).join('')
    + '<div class="pq-own' + (sel === 'own' ? ' on' : '') + '"><textarea data-qt="' + esc(target) + '" maxlength="140" rows="2" placeholder="Say it yourself" aria-label="Your own words">' + esc(typed) + '</textarea><span class="pq-n n">' + (140 - typed.length) + '</span>' + chips + '</div></div>'
    + (on && PRESS.err ? '<p class="pq-err">' + esc(PRESS.err) + '</p>' : '')
    + '<div class="pq-go">' + btn + '<p class="ar-note">Everyone in the league sees it, and there are no take-backs. Make a call and the receipts come out when the data settles it.</p></div>';
}
function pressThread(you) {
  const team = signedIn() || you;
  const P = presser(team);
  if (!P) {
    const said = quotes().filter(q => q.team === team && q.gw === D.gw);
    return threadHead('archizio') + '<div class="thread">' + bubble('archizio', D.dlPassed ? 'Team sheets are in, so the press room is shut. It opens again before GW' + (D.gw + 1) + '.' : 'No fixture for ' + esc(team) + ' this week, so no press conference.')
      + said.map(q => { const p = postById(quoteId(q)); return p ? '<div class="fth-lab">You said</div><div class="fbb-media fwide">' + mediaHTML(p, false) + '</div>' : ''; }).join('') + '</div>';
  }
  const replies = P.replies.map(R => '<div class="fth-when">An answer owed</div>' + bubble('archizio', esc((TEAMS[R.to.team] && TEAMS[R.to.team].mgr) || R.to.team) + ' said: “' + esc(R.to.line) + '” Your response?') + composer(R.target, R.picks, P, R.mine)).join('');
  return threadHead('archizio', '<span class="ftag ftag-press">PRESS CONFERENCE</span>') + '<div class="thread">'
    + replies
    + '<div class="fth-when">GW' + D.gw + ' build-up</div>'
    + bubble('archizio', esc(P.q) + (P.w != null ? ' The model has you at ' + pct(P.w) + '.' : ''))
    + composer(P.target, P.picks, P, P.mine)
    + '</div>';
}
/* the rumour mill: start one (anonymous unless you say otherwise), or confirm, deny or pass on what's going round */
function rumourThread(you) {
  const me = signedIn(), R = rumours(), st = { confirmed: 'Confirmed', denied: 'Denied', spreading: 'Spreading' };
  const live = socialLive();
  const compose = '<div class="fth-when">Start one</div>'
    + bubble('archizio', 'Heard something? Tell me. I never name a source, unless you want me to.')
    + '<div class="pq"><div class="pq-own on"><textarea data-rm="new" maxlength="160" rows="3" placeholder="I’m hearing that…" aria-label="Your rumour">' + esc(RUM.text) + '</textarea><span class="pq-n n">' + (160 - RUM.text.length) + '</span>'
    + '<div class="pq-cs rm-abs"><span class="pq-cl">Who’s it about?</span>' + Object.keys(TEAMS).sort((a, b) => firstOf(a).localeCompare(firstOf(b))).map(t => '<button class="pq-c rm-ab' + (RUM.about === t ? ' on' : '') + '" data-fx="rmab:' + esc(t) + '" aria-pressed="' + (RUM.about === t) + '">' + UI.crest(t, 16) + '<b>' + esc(firstOf(t)) + '</b></button>').join('') + '</div>'
    + '<div class="pq-cs"><span class="pq-cl">Source</span><button class="pq-c' + (RUM.anon ? ' on' : '') + '" data-fx="rmanon:1">Anonymous</button><button class="pq-c' + (!RUM.anon ? ' on' : '') + '" data-fx="rmanon:0">Put my name on it</button></div></div></div>'
    + (RUM.err && !RUM.tw ? '<p class="pq-err">' + esc(RUM.err) + '</p>' : '')
    + '<div class="pq-go">' + (!live ? '<p class="ar-note">Logins aren’t switched on yet.</p>' : !me ? '<button class="btn block" data-open="identity">Sign in to whisper to Archizio</button>' : '<button class="btn block" data-fx="rmsay:1"' + (RUM.busy ? ' disabled' : '') + '>' + (RUM.busy ? 'Sending…' : 'Whisper it') + '</button>')
    + '<p class="ar-note">It goes on everyone’s feed. Others can confirm it, deny it, or pass it on with their own twist, and it changes every time it’s passed.</p></div>';
  const card = g => {
    const mine = g.by === me, done = me && g.seen[me], open = RUM.tw === g.id;
    const acts = !me || mine || done || g.status !== 'spreading' ? '<p class="rm-note">' + (mine ? 'Your rumour. You can’t pass it on yourself.' : done ? 'You’ve had your say on this one.' : g.status !== 'spreading' ? st[g.status] + '. It’s out of your hands now.' : 'Sign in to pass it on.') + '</p>'
      : '<div class="rm-acts"><button class="pq-c" data-fx="rmp:' + esc(g.id) + '|confirm">Confirm</button><button class="pq-c" data-fx="rmp:' + esc(g.id) + '|deny">Deny</button><button class="pq-c' + (open ? ' on' : '') + '" data-fx="rmtw:' + esc(g.id) + '">Pass it on, with a twist</button></div>'
        + (open ? '<div class="pq-own on rm-tw"><textarea data-rmt="' + esc(g.id) + '" maxlength="140" rows="2" placeholder="What did you hear?" aria-label="Your version">' + esc(RUM.twText) + '</textarea><span class="pq-n n">' + (140 - RUM.twText.length) + '</span></div>'
          + (RUM.err ? '<p class="pq-err">' + esc(RUM.err) + '</p>' : '') + '<button class="btn block" data-fx="rmp:' + esc(g.id) + '|twist"' + (RUM.busy ? ' disabled' : '') + '>Pass it on</button>' : '');
    const about = g.about ? '<span class="rm-who">' + UI.crest(g.about, 26) + '<span><b>About ' + esc(firstOf(g.about)) + '</b><em>' + esc(g.about) + '</em></span></span>' : '<span class="rm-who"><span><b>About the league</b></span></span>';
    return '<div class="rm-card' + (g.status !== 'spreading' ? ' ' + g.status : '') + '"><div class="rm-h">' + about + '<span class="rm-st">' + st[g.status] + '</span></div>'
      + '<p class="rm-now">“' + esc(g.latest) + '”</p>' + (g.hops > 1 ? '<p class="rm-first">First heard: “' + esc(g.text) + '”</p>' : '')
      + '<p class="rm-meta">Heard ' + g.hops + (g.hops === 1 ? ' time' : ' times') + ' · ' + g.confirms + ' confirm · ' + g.denies + ' deny' + (g.anon ? '' : ' · started by ' + esc(firstOf(g.by))) + '</p>' + acts + '</div>';
  };
  return threadHead('archizio', '<span class="ftag ftag-press">THE RUMOUR MILL</span>') + '<div class="thread">' + compose
    + (R.length ? '<div class="fth-when">Going round</div>' + R.map(card).join('') : '') + '</div>';
}
/* top of Everyone: the press room is open and you haven't spoken (or you've been called out) */
function pressCta(you) {
  const team = signedIn() || you; if (!team || !TEAMS[team]) return '';
  const P = presser(team); if (!P) return '';
  const owed = P.replies.filter(r => !r.mine)[0];
  if (P.mine && !owed) return '';
  const tx = owed ? '<b>' + esc((TEAMS[owed.to.team] && TEAMS[owed.to.team].mgr) || owed.to.team) + ' said something.</b> Archizio wants your answer.' : '<b>Archizio wants a quote</b> before ' + esc(P.nm || 'GW' + P.g) + '. Everyone sees it.';
  return '<a class="fcta" href="#/feed/messages/archizio">' + avatar('archizio', 36) + '<span>' + tx + '</span><em class="ftag ftag-press">PRESS</em></a>';
}

/* ---------- the page ---------- */
export default {
  unread,
  title: 'Feed',
  subs: SUBS,
  render(sub, args) {
    if (!VISIT || document.body.dataset.page !== 'feed') { VISIT = { ids: new Set(unreadIds()), first: !hasSeen() }; LIMIT = 20; }
    let body = '';
    try {
      if (sub === 'foryou') body = forYou();
      else if (sub === 'league') body = league(args);
      else if (sub === 'articles') body = args[0] ? reader(args[0]) : articles(args);
      else if (sub === 'messages') body = messages(args);
    } catch (e) { console.error(e); body = '<div class="err">Couldn’t build the feed. ' + esc(e.message) + '</div>'; }
    const showStories = sub === 'foryou' || sub === 'league';
    if (sub === 'articles' && args[0]) return readerHead() + '<div class="feed f-reader">' + body + '</div>';
    return head(sub, args) + (showStories ? stories(sub, args) : '') + '<div class="feed f-' + sub + '">' + body + '</div>';
  },
  mount(root, sub, args) {
    UI.showOn(root);
    warm();
    articlesWanted();
    if (sub === 'articles' && args[0]) restoreNote();
    if (sub === 'foryou' || sub === 'league') markSeen();
    if (sub === 'messages' && args[0]) markThread(args[0]);
    restoreCarousels(root);
    if (!root.__feedMore) {
      root.__feedMore = 1;
      root.addEventListener('click', e => {
        if (document.body.dataset.page !== 'feed') return;
        if (e.target.closest('[data-all]')) { e.preventDefault(); EXPAND = true; window.MW.render({ keepScroll: true }); return; }
        const m = e.target.closest('[data-more]'); if (!m) return;
        e.preventDefault(); LIMIT += 20; window.MW.render({ keepScroll: true });
      });
    }
  },
};
