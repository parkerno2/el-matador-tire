/* matchday/overview.js — three blocks: your matchup (biggest), the other matchups, the latest from the feed */
import * as UI from '../../ui.js';
import * as M from './model.js';
import { buildPosts, renderPost, shows, mmss } from '../../feed/index.js';

const esc = UI.esc;

/* ---------- shared bits (also used by All matchups) ---------- */
export function stateTag(m) {
  if (m.ph === 'live') return '<span class="live-dot"><i></i>LIVE</span>';
  if (m.ph === 'prov') return '<span class="md-tag">PROVISIONAL</span>';
  if (m.ph === 'ft') return '<span class="md-tag">FULL TIME</span>';
  if (m.ph === 'locked') return '<span class="md-tag">' + UI.icon('lock', 11, 'currentColor', 2.4) + 'LOCKED</span>';
  return '<span class="md-tag">PREDICTED</span>';
}
/* the two numbers in the middle: the score, or the prediction before anyone kicks off */
export function nums(m) {
  if (m.ph === 'pre' || m.ph === 'locked') {
    if (!M.hasProj()) return { l: '', r: '', dec: false, vs: true };
    return { l: M.f1(m.tl.proj), r: M.f1(m.tr.proj), dec: true };
  }
  return { l: String(m.sl), r: String(m.sr), dec: false };
}
/* the two numbers as markup; "v" when there is nothing to predict with */
export const pairHTML = (n, loL, loR) => n.vs ? '<span class="md-v">v</span>' : '<span' + (loL ? ' class="lo"' : '') + '>' + n.l + '</span><i>–</i><span' + (loR ? ' class="lo"' : '') + '>' + n.r + '</span>';
/* win chance bar coloured by role: you blue v grey; a game without you reads light grey v dark grey */
export function winBar(m, thin) {
  if (!m.win) return '';
  const [cl, cr] = UI.pairCols(m.L, m.R);
  return UI.wbar(m.win.l / 100, m.win.d / 100, m.win.r / 100, cl, cr, thin);
}
export const seriesText = s => s ? s.replace(/ leads /, ' leads the series ') : '';
/* the series line as HTML, the record kept on one line */
export const seriesHTML = s => UI.esc(seriesText(s)).replace(/(\d+–\d+(?: \(\d+ drawn\))?)$/, '<span class="md-nw">$1</span>');
const youCls = m => (m.mine ? ' md-mine' : '');

/* a record, always labelled */
export const wdl = r => r && r.played ? UI.recL(r) : '';
/* full name, swapped for the league's short name on narrow phones (CSS) */
export const nameHTML = t => '<span class="md-fn">' + esc(t) + '</span><span class="md-sn">' + esc(SHORTOF[t] || t) + '</span>';
/* result wording at full time */
export function resultLine(m) {
  const d = m.sl - m.sr;
  if (!d) return 'Honours even, ' + m.sl + '–' + m.sr;
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
  const kick = m.ph === 'locked' ? 'Proj final' : '';
  return '<div class="md-sc">' + (kick ? '<span class="md-kick">' + kick + '</span>' : '')
    + '<div class="n md-big' + (n.dec ? ' dec' : '') + '">' + pairHTML(n, m.final && m.sl < m.sr, m.final && m.sr < m.sl) + '</div>'
    + (m.series ? '<div class="sub md-ser">' + seriesHTML(m.series) + '</div>' : '') + '</div>';
}
function winBlock(m) {
  if (!m.win) return '';
  const pl = M.projLine(m);
  const showProj = pl && m.ph === 'live';
  return '<div class="md-win">'
    + '<div class="md-wl"><b class="n you">' + m.win.l + '%</b><span>win chance</span><span class="md-dr">draw ' + m.win.d + '%</span><b class="n opp">' + m.win.r + '%</b></div>'
    + winBar(m)
    + (showProj ? '<div class="md-pj"><span>Projected <b class="n">' + M.f1(pl.l) + '</b></span><span>Projected <b class="n">' + M.f1(pl.r) + '</b></span></div>' : '')
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
  return '<div class="md-star" data-open="player:' + esc(s.code) + '">' + UI.face(s.p, 30) + '<div class="ell"><b>' + esc(s.p.Player) + '</b><span class="sub">' + esc(SHORTOF[s.team] || s.team) + ' · <span class="' + (st.live ? 'live-c' : '') + '">' + esc(st.t) + '</span></span></div><span class="pb ' + b.cls + '">' + b.txt + '</span></div>';
}
function previewBlock(m) {
  const rows = [];
  const dl = M.deadline();
  if (m.ph === 'pre' && dl) rows.push('<div class="md-pv"><span class="md-pi">' + UI.icon('lock', 15, 'var(--p300)') + '</span><div><b>Deadline ' + esc(M.tFull(dl)) + '</b><span class="sub" data-md-until="' + dl.getTime() + '">' + (dl > new Date() ? 'in ' + M.until(dl) : 'passed') + '</span></div></div>');
  if (m.ph === 'locked') { const k = M.firstKo(); if (k) rows.push('<div class="md-pv"><span class="md-pi">' + UI.icon('lock', 15, 'var(--p300)') + '</span><div><b>Lineups locked</b><span class="sub">First kick-off ' + esc(M.tKo(k)) + ' · <span data-md-until="' + k.getTime() + '">in ' + M.until(k) + '</span></span></div></div>'); }
  /* the first of your players to kick off (both sides' first if you aren't in it) */
  const firstUp = T => T.players.filter(x => !x.started && x.ko).sort((a, b) => a.ko - b.ko)[0];
  const f = firstUp(m.tl);
  if (f) rows.push('<div class="md-pv" data-open="player:' + esc(f.code) + '">' + UI.face(f.p, 30) + '<div><b>' + (m.mine ? 'Your first up: ' : esc(SHORTOF[m.L] || m.L) + ' first up: ') + esc(f.p.Player) + '</b><span class="sub">' + esc(M.fxLabel(f.fx)) + ' · ' + esc(M.tKo(f.ko)) + '</span></div></div>');
  /* doubts in the XI */
  const doubts = m.tl.players.filter(x => x.doubt || x.out);
  if (m.mine) {
    if (doubts.length) rows.push('<div class="md-pv">' + UI.stack(doubts.map(x => x.p), 30, 3) + '<div><b>' + (doubts.length === 1 ? 'One doubt' : doubts.length + ' doubts') + ' in your XI</b><span class="sub">' + doubts.map(x => esc(x.p.Player) + ' ' + (x.out ? 'out' : x.chance + '%')).join(', ') + '</span></div></div>');
    else rows.push('<div class="md-pv"><span class="md-pi">' + UI.icon('team', 15, 'var(--p300)') + '</span><div><b>No doubts in your XI</b><span class="sub">Every starter is fit to play</span></div></div>');
  } else {
    const d2 = m.tr.players.filter(x => x.doubt || x.out);
    if (doubts.length + d2.length) rows.push('<div class="md-pv"><span class="md-pi">' + UI.icon('info', 15, 'var(--doubt)') + '</span><div><b>Doubts</b><span class="sub">' + esc(SHORTOF[m.L] || m.L) + ' ' + doubts.length + ' · ' + esc(SHORTOF[m.R] || m.R) + ' ' + d2.length + '</span></div></div>');
  }
  return rows.length ? '<div class="md-pvs">' + rows.join('') + '</div>' : '';
}
function lastResult(m) {
  if (!m.mine || !D.gwsDone) return '';
  const f = (D.fx || []).find(x => num(x.GW) === D.gwsDone && (x.Home === m.me || x.Away === m.me) && fin(x.Finished));
  if (!f) return '';
  const h = f.Home === m.me, me = num(h ? f['Home pts'] : f['Away pts']), op = num(h ? f['Away pts'] : f['Home pts']), opp = h ? f.Away : f.Home;
  const r = me > op ? 'w' : me < op ? 'l' : 'd';
  return '<div class="md-last"><span class="fm ' + r + '">' + r.toUpperCase() + '</span><span>GW' + D.gwsDone + ': ' + (r === 'w' ? 'beat ' : r === 'l' ? 'lost to ' : 'drew with ') + esc(opp) + ' <b class="n">' + me + '–' + op + '</b></span></div>';
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
    + (pl ? '<span class="sub">xP <b class="n">' + M.f1(pl.l) + '</b> – <b class="n">' + M.f1(pl.r) + '</b> · what the performances deserved</span>' : '')
    + (m.ph === 'prov' ? '<span class="sub">Provisional. ' + (Object.keys(D.pbonus || {}).length ? 'Bonus is estimated from live BPS. ' : '') + 'FPL usually confirms within a few hours.</span>' : '')
    + '</div>';
}
export function hero(m, featured) {
  const L = m.L, R = m.R, href = '#/matchday/matchup/' + m.i;
  const kicker = (m.derby ? esc(m.derby) + ' · ' : '') + 'GW' + D.gw;
  let body = '';
  if (m.ph === 'pre' || m.ph === 'locked') body = winBlock(m) + previewBlock(m) + lastResult(m);
  else if (m.ph === 'live') body = winBlock(m) + toPlayBlock(m) + '<div class="md-stars">' + starOf(m.tl) + starOf(m.tr) + '</div>' + subsNote(m);
  else body = finalBlock(m) + '<div class="md-stars">' + starOf(m.tl) + starOf(m.tr) + '</div>';
  return '<div class="card hero md-hero' + youCls(m) + '" data-go="' + href + '" role="link" tabindex="0" aria-label="' + esc(L + ' v ' + R) + ', open the matchup">'
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
      + (m.ph === 'live' ? '<span class="live-dot md-msl"><i></i>LIVE</span>' : m.ph === 'prov' ? '<span class="md-msl">PROV</span>' : m.ph === 'ft' ? '<span class="md-msl">FT</span>' : '') + '</div>' + side(m.R, 1) + '</div>'
    + (m.win ? '<div class="md-wb"><span class="n' + (m.mine ? ' you-c' : ' l') + '">' + m.win.l + '%</span>' + winBar(m, true) + '<span class="n">' + m.win.r + '%</span></div>'
      : m.final ? '<div class="md-wb md-fin"><span>' + resultLine(m) + '</span></div>' : '')
    + '</a>';
}
function footState(list) {
  const ph = list.map(m => m.ph), u = ph.every(x => x === ph[0]) ? ph[0] : 'mixed';
  const bars = list.some(m => m.win) ? 'Bars show each side’s win chance' : '';
  const st = { pre: 'Scores are predicted', live: 'All games live', locked: 'Lineups locked, nothing kicked off yet', prov: 'Provisional results', ft: 'Full time', mixed: '' }[u];
  return [bars, st].filter(Boolean).join('. ') + '.';
}

/* ---------- 3. the feed rail ---------- */
function articleCard() {
  const rc = (RECAPS || []).find(r => r.gw === D.gw && D.provOver) || (RECAPS || []).find(r => r.gw === D.gwsDone);
  const pv = (PREVIEWS || []).find(p => p.gw === D.gw && !D.dlPassed);
  const a = pv || rc; if (!a) return '';
  const k = pv ? 'preview' : 'recap';
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
function feedRail() {
  const art = articleCard();
  const posts = railPosts(art ? 3 : 4);
  const cards = [];
  if (art) cards.push(art);
  posts.forEach(p => {
    let h = ''; try { h = renderPost(p, { compact: true }); } catch (e) { console.error(e); }
    if (h) cards.push('<div class="md-rc">' + h + '</div>');
  });
  if (!cards.length) return UI.sh('Latest from the feed', { more: 'Feed', href: '#/feed' }) + '<div class="empty md-empty">Nothing new in the feed yet.</div>';
  return UI.sh('Latest from the feed', { more: 'Feed', href: '#/feed' }) + '<div class="md-rail">' + cards.join('') + '</div>';
}

/* ---------- the Gameweek Show: Malcolm's narrated preview, full screen ---------- */
function showBanner() {
  let s = null; try { s = shows().find(x => x.gw === D.gw); } catch (e) { }
  if (!s || D.provOver) return '';
  return '<button class="md-show" data-fx="show:' + s.gw + '"><span class="md-show-av f-cond">MT</span><span class="md-show-t"><b>The Gameweek ' + s.gw + ' Show</b><span class="sub">Malcolm Tyre on all ' + s.j.chapters.length + ' matchups · ' + mmss(s.dur) + '</span></span><span class="md-show-p">' + UI.icon('play', 16) + '</span></button>';
}

/* ---------- the page body ---------- */
export function render() {
  const fx = M.gwFx();
  if (!fx.length) return UI.sh('Your matchup') + UI.empty('No matchups this gameweek', 'The fixtures for Gameweek ' + D.gw + ' aren’t in the sheet yet.') + feedRail();
  const yi = M.youIndex(), featured = yi < 0;
  const hi = featured ? M.featuredIndex() : yi;
  const hm = M.mx(hi);
  const others = fx.map((f, i) => i).filter(i => i !== hi).map(M.mx);
  return UI.sh(featured ? (hm.derby ? 'Match of the week' : 'Closest matchup') : 'Your matchup')
    + hero(hm, featured)
    + showBanner()
    + UI.sh('Other matchups', { more: 'All', href: '#/matchday/all' })
    + '<div class="card md-mlist">' + others.map(mrow).join('') + '<div class="foot">' + footState(others) + '</div></div>'
    + feedRail();
}
