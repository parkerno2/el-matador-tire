/* matchday/overview.js — three blocks: your matchup (biggest), the other matchups, the latest from the feed */
import * as UI from '../../ui.js';
import { allArticles, isCommishTeam } from '../../feed/articles.js';
import * as M from './model.js';
import { buildPosts, renderPost, shows, showPending, mmss } from '../../feed/index.js';
import { pic } from '../../feed/voices.js';
import { showSlot, showNoteHTML } from '../../feed/showsync.js';
import { artLeads, railOrder } from '../../feed/curate.js';
import { byes, byeRow, byeCard } from '../byes.js';
import { availSummary } from '../avail.js';

const esc = UI.esc;

/* ---------- shared bits (also used by All matchups) ---------- */
export function stateTag(m) {
  if (m.ph === 'live' && m.st === 'bonus') return '<span class="md-tag">PROVISIONAL</span>';
  if (m.ph === 'live' && m.st === 'settled') return '<span class="md-tag">FULL TIME</span>';
  if (m.ph === 'live') return '<span class="live-dot"><i></i>LIVE</span>';
  if (m.ph === 'prov') return '<span class="md-tag">PROVISIONAL</span>';
  if (m.ph === 'ft') return '<span class="md-tag">FULL TIME</span>';
  if (m.ph === 'locked') return '<span class="md-tag">' + UI.icon('lock', 11, 'currentColor', 2.4) + 'LOCKED</span>';
  /* before the deadline: the deadline's time, never LIVE or a forecast word */
  const dl = M.deadline();
  return dl ? '<span class="md-tag">DEADLINE ' + esc(M.tTime(dl)) + '</span>' : '';
}
/* "Bonus provisional" beside the score, only when nothing can change but bonus (M.settleState decides, once) */
export const bonusNote = m => m.st === 'bonus' ? '<span class="md-bnote">Bonus provisional</span>' : '';
/* a win chance as text: nothing for a side with no chance to show (a settled draw) */
export const pctText = v => v === null || v === undefined ? '' : v + '%';
/* the label that kicks the forecast numbers, with its legend tap */
const projKick = () => UI.legendTap('proj', 'Proj final', 'ln');
/* the two numbers in the middle: the score, or the prediction before anyone kicks off */
export function nums(m) {
  if (m.ph === 'pre' || m.ph === 'locked') {
    if (!M.hasProj()) return { l: '', r: '', dec: false, vs: true };
    return { l: M.f1(m.tl.proj), r: M.f1(m.tr.proj), dec: true };
  }
  return { l: String(m.sl), r: String(m.sr), dec: false };
}
/* the two numbers as markup; "v" when there is nothing to predict with */
export const pairHTML = (n, loL, loR) => n.vs ? '<span class="md-v">v</span>' : UI.score(n.l, n.r, { cls: 'flush', aCls: loL ? 'lo' : '', bCls: loR ? 'lo' : '' });
/* win chance bar coloured by role: you blue v grey; a game without you reads light grey v dark grey */
export function winBar(m, thin) {
  if (!m.win) return '';
  const [cl, cr] = UI.pairCols(m.L, m.R);
  return UI.wbar((m.win.l || 0) / 100, (m.win.d || 0) / 100, (m.win.r || 0) / 100, cl, cr, thin);
}
export const seriesText = s => s || '';
/* the series line as HTML, the record kept on one line */
export const seriesHTML = s => UI.esc(seriesText(s)).replace(/^(Series (?:level )?\d+-\d+(?: \(\d+ drawn\))?)/, '<span class="md-nw">$1</span>');
const youCls = m => (m.mine ? ' md-mine' : '');

/* a record, always labelled */
export const wdl = r => r && r.played ? UI.recL(r) : '';
/* full name, swapped for the league's short name on narrow phones (CSS) */
export const nameHTML = t => '<span class="md-fn">' + esc(t) + '</span><span class="md-sn">' + esc(SHORTOF[t] || t) + '</span>';
/* result wording at full time */
export function resultLine(m) {
  const d = m.sl - m.sr;
  if (!d) return 'Honours even, ' + UI.score(m.sl, m.sr);
  const w = d > 0 ? m.L : m.R, by = Math.abs(d);
  if (m.me === w) return 'You win by ' + by;
  if (m.mine) return FIRSTOF(w) + ' wins by ' + by;
  return esc(w) + ' win by ' + by;
}

/* ---------- 1. your matchup ---------- */
function teamCol(m, t, side) {
  const you = m.me === t;
  return '<div class="md-tm ' + side + '">' + UI.crest(t, 64) + '<b>' + esc(t) + '</b><span class="sub">' + esc(FIRSTOF(t)) + (you ? ' · you' : '') + '</span></div>';
}
function scoreCol(m) {
  const n = nums(m);
  const kick = m.ph === 'locked' || m.ph === 'pre' ? projKick() : '';
  return '<div class="md-sc">' + (kick ? '<span class="md-kick">' + kick + '</span>' : '')
    + '<div class="n md-big' + (n.dec ? ' dec' : '') + '">' + pairHTML(n, m.final && m.sl < m.sr, m.final && m.sr < m.sl) + '</div>'
    + bonusNote(m)
    + (m.series ? '<div class="sub md-ser">' + seriesHTML(m.series) + '</div>' : '') + '</div>';
}
/* the three chances; a settled result shows 100 and 0 and no draw, a settled draw shows 100% draw alone */
function winBlock(m) {
  const w = m.win;
  if (!w) return '';
  const pl = M.projLine(m);
  const showProj = pl && m.ph === 'live' && !w.settled;
  const dr = M.drawText(w);
  return '<div class="md-win">'
    + '<div class="md-wl"><b class="n you">' + pctText(w.l) + '</b>' + (w.drawn ? '' : UI.legendTap('odds', 'win chance', 'ln')) + (dr ? '<span class="md-dr">draw ' + dr + '</span>' : '') + '<b class="n opp">' + pctText(w.r) + '</b></div>'
    + winBar(m)
    + (showProj ? '<div class="md-prj"><span>' + UI.legendTap('proj', 'Proj final', 'ln') + ' <b class="n">' + M.f1(pl.l) + '</b></span><span>' + UI.legendTap('proj', 'Proj final', 'ln') + ' <b class="n">' + M.f1(pl.r) + '</b></span></div>' : '')
    + '</div>';
}
function toPlayBlock(m) {
  const side = (T, r) => {
    const n = T.toPlay.length;
    return '<div class="md-tp' + (r ? ' r' : '') + '">' + (n ? UI.stack(T.toPlay.map(x => x.p), 26, 5) : '<span class="md-none"></span>')
      + '<span class="sub">' + (n ? '<b>' + n + '</b> still to play' : 'All played') + '</span></div>';
  };
  return '<div class="md-tps">' + side(m.tl) + side(m.tr, 1) + '</div>';
}
function starOf(T) {
  const s = T.players.filter(x => x.started && x.st !== 'pre').sort((a, b) => b.pts - a.pts || b.mins - a.mins)[0];
  if (!s) return '<div class="md-star none"><span class="sub">Nobody has kicked off</span></div>';
  const st = M.statusLine(s), b = M.bubble(s);
  return '<div class="md-star" data-open="player:' + esc(s.code) + '">' + UI.face(s.p, 30) + '<div class="ell"><b>' + esc(s.p.Player) + '</b><span class="sub">' + esc(SHORTOF[s.team] || s.team) + ' · <span class="' + (st.live ? 'live-c' : '') + '">' + esc(st.t) + '</span></span></div><span class="pb ' + b.cls + '">' + UI.minus(b.txt) + '</span></div>';
}
function previewBlock(m) {
  const rows = [];
  const dl = M.deadline();
  if (m.ph === 'pre' && dl) rows.push('<div class="md-pv"><span class="md-pi">' + UI.icon('lock', 15, 'var(--p300)') + '</span><div><b>Deadline ' + esc(M.tFull(dl)) + '</b><span class="sub">' + M.countdown(dl, 'passed') + '</span></div></div>');
  if (m.ph === 'locked') { const k = M.firstKo(); if (k) rows.push('<div class="md-pv"><span class="md-pi">' + UI.icon('lock', 15, 'var(--p300)') + '</span><div><b>Lineups locked</b><span class="sub">First kick-off ' + esc(M.tKo(k)) + ' · ' + M.countdown(k, 'under way') + '</span></div></div>'); }
  /* the first of the member's players to kick off (M.firstUp: a game still to come, none for a club with no game left, never a starter counted out) */
  const u = M.firstUp(m.tl.players);
  if (u) rows.push('<div class="md-pv" data-open="player:' + esc(u.x.code) + '">' + UI.face(u.x.p, 30) + '<div><b>' + (m.mine ? 'Your first up: ' : esc(SHORTOF[m.L] || m.L) + ' first up: ') + esc(u.x.p.Player) + '</b><span class="sub">' + esc(M.fxLabel(u.f)) + ' · ' + esc(M.tKo(u.ko)) + '</span></div></div>');
  /* doubts in the XI: availSummary is the one reading of the flags, the same one My team's Lineup draws */
  const A = availSummary(m.tl.xi), flagged = A.flagged;
  /* the split the Lineup bar draws: doubts (still in with a chance) and outs, never one count for both */
  const split = S => [S.doubts.length ? (S.doubts.length === 1 ? 'One doubt' : S.doubts.length + ' doubts') : '', S.outs.length ? S.outs.length + ' out' : ''].filter(Boolean);
  if (m.mine) {
    if (flagged.length) rows.push('<div class="md-pv">' + UI.stack(flagged.map(r => r.p), 30, 3) + '<div><b>' + split(A).join(', ') + ' in your XI</b><span class="sub">' + flagged.map(r => esc(r.p.Player) + ' ' + esc(r.a.text)).join(', ') + '</span></div></div>');
    else rows.push('<div class="md-pv"><span class="md-pi">' + UI.icon('team', 15, 'var(--p300)') + '</span><div><b>No doubts in your XI</b><span class="sub">Every starter is fit to play</span></div></div>');
  } else {
    const B = availSummary(m.tr.xi), d2 = B.flagged;
    const side = S => S.flagged.length ? split(S).join(', ').replace('One doubt', '1 doubt') : '0';
    if (flagged.length + d2.length) rows.push('<div class="md-pv"><span class="md-pi">' + UI.icon('info', 15, 'var(--doubt)') + '</span><div><b>Doubts</b><span class="sub">' + esc(SHORTOF[m.L] || m.L) + ' ' + side(A) + ' · ' + esc(SHORTOF[m.R] || m.R) + ' ' + side(B) + '</span></div></div>');
  }
  return rows.length ? '<div class="md-pvs">' + rows.join('') + '</div>' : '';
}
function lastResult(m) {
  if (!m.mine || !D.gwsDone) return '';
  const f = (D.fx || []).find(x => num(x.GW) === D.gwsDone && (x.Home === m.me || x.Away === m.me) && fin(x.Finished));
  if (!f) return '';
  const h = f.Home === m.me, me = num(h ? f['Home pts'] : f['Away pts']), op = num(h ? f['Away pts'] : f['Home pts']), opp = h ? f.Away : f.Home;
  const r = me > op ? 'w' : me < op ? 'l' : 'd';
  return '<div class="md-last"><span class="fm ' + r + '">' + r.toUpperCase() + '</span><span>GW' + D.gwsDone + ': ' + (r === 'w' ? 'beat ' : r === 'l' ? 'lost to ' : 'drew with ') + esc(opp) + ' <b class="n">' + UI.score(me, op) + '</b></span></div>';
}
function subsNote(m) {
  const T = m.mine ? m.tl : null; if (!T) return '';
  const L = T.subs.filter(s => s.kind === 'locked');
  if (!L.length) return '';
  return '<div class="md-note">' + UI.icon('repost', 13, 'var(--win)') + '<span>Auto-subs locked: ' + L.map(s => '<b>' + esc(s.inn.Player) + '</b> on for ' + esc(s.out.Player)).join(', ') + '</span></div>';
}
function finalBlock(m) {
  const pl = M.projLine(m);
  return '<div class="md-res"><b>' + resultLine(m) + '</b>'
    + (pl ? '<span class="sub">xP <b class="n">' + UI.score(M.f1(pl.l), M.f1(pl.r)) + '</b> · what the performances deserved</span>' : '')
    + (m.ph === 'prov' ? '<span class="sub">Provisional.' + (Object.keys(D.pbonus || {}).length ? ' Bonus is estimated from live BPS.' : '') + '</span>' : '')
    + '</div>';
}
export function hero(m, featured) {
  const L = m.L, R = m.R, href = '#/matchday/matchup/' + m.i;
  const kicker = (m.derby ? esc(m.derby) + ' · ' : '') + 'GW' + D.gw;
  let body = '';
  if (m.ph === 'pre' || m.ph === 'locked') body = winBlock(m) + previewBlock(m) + lastResult(m);
  else if (m.ph === 'live') body = winBlock(m) + toPlayBlock(m) + '<div class="md-stars">' + starOf(m.tl) + starOf(m.tr) + '</div>' + subsNote(m);
  else body = winBlock(m) + finalBlock(m) + '<div class="md-stars">' + starOf(m.tl) + starOf(m.tr) + '</div>';
  /* the card is one tap to the matchup through its stretched link; the legend taps, the players and the buttons sit beside
     that link, never inside it (F47) */
  return '<div class="card hero md-hero tap-host' + youCls(m) + '"><a class="tap-cover" href="' + href + '" aria-label="' + esc(L + ' v ' + R) + ', open the matchup"></a>'
    + UI.glow(L, 'left', .5, 230) + UI.glow(R, 'right', .32, 230)
    + '<div class="md-hin">'
    + '<div class="md-hk"><span class="wide">' + kicker + '</span>' + stateTag(m) + '</div>'
    + '<div class="md-vs">' + teamCol(m, L, 'l') + scoreCol(m) + teamCol(m, R, 'r') + '</div>'
    + body
    + '</div>'
    + (featured ? '<button class="md-pick" data-open="menu">' + UI.icon('team', 16, 'var(--b300)') + '<span><b>Pick your team</b> to make this page yours</span><span class="ch">›</span></button>' : '')
    + '<a class="cta" href="' + href + '">' + (m.ph === 'pre' ? 'Lineups and preview' : 'Formation and stats') + ' <span class="ch">›</span></a>'
    + '</div>';
}

/* ---------- 2. other matchups ---------- */
export function mrow(m) {
  const n = nums(m), href = '#/matchday/matchup/' + m.i;
  const side = (t, r) => '<div class="md-mt' + (r ? ' r' : '') + '">' + (r ? '' : UI.crest(t, 24)) + nameHTML(t) + (r ? UI.crest(t, 24) : '') + '</div>';
  return '<a class="md-mr' + youCls(m) + '" href="' + href + '">'
    + (m.derby || m.mine ? '<div class="md-dt">' + (m.mine ? '<span class="md-you">YOU</span>' : '') + (m.derby ? '<span>' + esc(m.derby) + '</span>' : '') + '<i></i></div>' : '')
    + '<div class="md-mg">' + side(m.L) + '<div class="md-msc"><div class="md-ms n' + (n.dec ? ' dec' : '') + '">' + pairHTML(n, m.final && +n.l < +n.r, m.final && +n.r < +n.l) + '</div>'
      + (m.ph === 'live' && m.st === 'bonus' ? '<span class="md-msl md-bnote">Bonus provisional</span>' : m.ph === 'live' && m.st === 'settled' ? '<span class="md-msl">FT</span>' : m.ph === 'live' ? '<span class="live-dot md-msl"><i></i>LIVE</span>' : m.ph === 'prov' ? (m.st === 'bonus' ? '<span class="md-msl md-bnote">Bonus provisional</span>' : '<span class="md-msl">PROV</span>') : m.ph === 'ft' ? '<span class="md-msl">FT</span>' : '') + '</div>' + side(m.R, 1) + '</div>'
    + (m.win ? '<div class="md-wb"><span class="n' + (m.mine ? ' you-c' : ' l') + '">' + pctText(m.win.l) + '</span>' + winBar(m, true) + '<span class="n">' + pctText(m.win.r) + '</span></div>' : '')
    + '</a>';
}
function footState(list) {
  const ph = list.map(m => m.ph), u = ph.every(x => x === ph[0]) ? ph[0] : 'mixed';
  const bars = '';
  const st = { pre: UI.legendTap('proj', 'Proj final', 'ln') + ' until the deadline', live: '', locked: '', prov: 'Provisional until FPL confirms', ft: '', mixed: '' }[u];
  return [bars, st].filter(Boolean).join('. ') + (st ? '.' : '');
}

/* ---------- 3. the feed rail ---------- */
/* the article the rail carries: this gameweek's preview until the deadline, else the latest recap; { a, k } or null */
function articleFor() {
  const all = allArticles(), R = all.filter(a => a.kind === 'Recap'), P = all.filter(a => a.kind === 'Preview');
  const rc = R.find(r => r.gw === D.gw && D.provOver) || R.find(r => r.gw === D.gwsDone);
  const pv = P.find(p => p.gw === D.gw && !D.dlPassed);
  const a = pv || rc; if (!a) return null;
  return { a, k: pv ? 'preview' : 'recap' };
}
function articleCard(x) {
  if (!x) return '';
  const a = x.a, k = x.k;
  return '<a class="md-rc md-art" href="' + esc(a.href) + '"><span class="md-ak">Gameweek ' + a.gw + ' ' + k + '</span><b>' + esc(a.title) + '</b><span class="sub">' + esc(a.sub || '') + '</span><span class="md-go">Read the ' + k + ' ›</span></a>';
}
/* variety: the newest post from each league voice first, then more without two of one voice side by side.
   Jive stays on My team and in Messages; the hero above already carries his auto-subs and the deadline. */
function railPosts(n) {
  let posts = [];
  try { posts = (buildPosts() || []).filter(p => p.voice !== 'jive'); } catch (e) { console.error(e); }
  const pick = [], used = new Set();
  posts.forEach(p => { if (pick.length < n && !used.has(p.voice)) { pick.push(p); used.add(p.voice); } });
  for (const p of posts) { if (pick.length >= n) break; if (!pick.includes(p) && (!pick.length || pick[pick.length - 1].voice !== p.voice)) pick.push(p); }
  return pick;
}
/* the article leads the rail for its first 24 hours, then sits after the newest voice posts (artLeads, curate.js) */
function feedRail() {
  const x = articleFor(), art = articleCard(x);
  const posts = railPosts(art ? 3 : 4);
  const cards = railOrder(art, posts.map(p => {
    let h = ''; try { h = renderPost(p, { compact: true }); } catch (e) { console.error(e); }
    return h ? '<div class="md-rc">' + h + '</div>' : '';
  }).filter(Boolean), x && artLeads(x.a, Date.now()));
  if (!cards.length) return UI.sh('Latest from the feed', { more: 'Feed', href: '#/feed' }) + '<div class="empty md-empty">Nothing new in the feed yet.</div>';
  return UI.sh('Latest from the feed', { more: 'Feed', href: '#/feed' }) + '<div class="md-rail">' + cards.join('') + '</div>';
}

/* ---------- the Gameweek Show: Malcolm's narrated preview, full screen ----------
   Parker, 8 Oct 2026: it was hard to find. The card sits at the top of Matchday from the moment the script exists until
   the deadline; after the deadline a replay row stays until the gameweek is over (showSlot). Until every line is voiced
   there is no card (Parker, 9 Oct 2026); the commissioner sees one line in its place. */
export function showCard() {
  let s = null; try { s = shows().find(x => x.gw === D.gw); } catch (e) { }
  const slot = showSlot(s, D);
  if (!slot) { const p = showPending(D.gw); return p && isCommishTeam() && showSlot({ gw: D.gw }, D) ? showNoteHTML(p) : ''; }
  if (slot === 'replay') {
    return '<button class="md-show md-show-re" data-fx="show:' + s.gw + '" aria-label="Replay the Gameweek ' + s.gw + ' show"><span class="md-show-av">' + pic('malcolm', 38) + '</span><span class="md-show-t"><b>Replay the Gameweek ' + s.gw + ' Show</b><span class="sub">Malcolm Tyre’s preview of all ' + s.j.chapters.length + ' matchups · ' + mmss(s.dur) + '</span></span><span class="md-show-p">' + UI.icon('play', 16) + '</span></button>';
  }
  const dl = M.deadline(), soon = dl && dl > new Date();
  return '<button class="md-showc" data-fx="show:' + s.gw + '" aria-label="Watch the Gameweek ' + s.gw + ' show">'
    + '<span class="md-showc-top"><span class="md-showc-av">' + pic('malcolm', 44) + '</span><span class="md-showc-k">The Gameweek Show</span><span class="md-showc-t n">' + mmss(s.dur) + '</span></span>'
    + '<span class="md-showc-ttl f-cond">Gameweek ' + s.gw + '</span>'
    + '<span class="md-showc-sub">Malcolm Tyre on all ' + s.j.chapters.length + ' matchups' + (soon ? ' · before the deadline ' + esc(M.tWd(dl)) : '') + '</span>'
    + '<span class="md-showc-ch">' + s.j.chapters.map(c => '<span class="md-showc-c">' + UI.crest(c.home, 20) + '<b>' + esc(FIRSTOF(c.home)) + '</b><i>v</i><b>' + esc(FIRSTOF(c.away)) + '</b>' + UI.crest(c.away, 20) + '</span>').join('') + '</span>'
    + '<span class="md-showc-ft"><span class="md-showc-play">' + UI.icon('play', 18) + '</span><span class="md-showc-by">Watch the show</span></span></button>';
}

/* ---------- the page body ---------- */
export function render() {
  const fx = M.gwFx();
  if (!fx.length) return showCard() + UI.sh('Your matchup') + UI.empty('No matchups this gameweek', 'The fixtures for Gameweek ' + D.gw + ' aren’t in the sheet yet.') + feedRail();
  const yi = M.youIndex(), featured = yi < 0;
  const hi = featured ? M.featuredIndex() : yi;
  const hm = M.mx(hi);
  const others = fx.map((f, i) => i).filter(i => i !== hi).map(M.mx);
  return showCard()
    + UI.sh(featured ? (hm.derby ? 'Match of the week' : 'Closest matchup') : 'Your matchup')
    + hero(hm, featured)
    + UI.sh('Other matchups', { more: 'All', href: '#/matchday/all' })
    + '<div class="card md-mlist">' + others.map(mrow).join('') + '<div class="foot">' + footState(others) + '</div></div>'
    + feedRail();
}
