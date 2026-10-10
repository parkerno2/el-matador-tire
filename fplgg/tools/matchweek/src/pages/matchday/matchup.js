/* matchday/matchup.js — one matchup: pinned header, then Formation | List | Stats | History */
import * as UI from '../../ui.js';
import * as M from './model.js';
import { stateTag, nums, winBar, seriesText, resultLine, pairHTML, wdl } from './overview.js';

const esc = UI.esc;
export const ST = { tab: 'formation', xp: false, lines: new Set(), bench: false };
const POS = [['FWD', 'Forwards', 'FWD'], ['MID', 'Midfield', 'MID'], ['DEF', 'Defence', 'DEF'], ['GKP', 'Goalkeeper', 'GK']];
const POSL = { GKP: 'Goalkeeper', DEF: 'Defenders', MID: 'Midfielders', FWD: 'Forwards' };
const short = t => SHORTOF[t] || t;

/* ---------- header ---------- */
function fixtureChips(cur) {
  const fx = M.gwFx(); if (fx.length < 2) return '';
  return '<nav class="md-fxs" aria-label="Matchups this gameweek">' + fx.map((f, i) => {
    const m = M.mx(i), n = nums(m);
    return '<a href="#/matchday/matchup/' + i + '" class="' + (i === cur ? 'on' : '') + (m.mine ? ' md-mine' : '') + '"' + (i === cur ? ' aria-current="true"' : '') + '>'
      + UI.crest(m.L, 16) + '<span class="n">' + pairHTML(n) + '</span>' + UI.crest(m.R, 16) + '</a>';
  }).join('') + '</nav>';
}
function header(m) {
  const n = nums(m), pl = M.projLine(m);
  const side = t => '<div class="md-hs" data-open="manager:' + esc(t) + '" role="button" tabindex="0" aria-label="' + esc(t) + ', manager sheet">' + UI.crest(t, 36)
    + '<b>' + esc(t) + '</b><span class="sub">' + esc(M.who(m, t)) + '</span></div>';
  const toPlay = T => T.toPlay.length;
  let foot = '';
  if (m.final) foot = '<div class="md-hf c"><span>' + resultLine(m) + (pl ? ' · xP ' + M.f1(pl.l) + '–' + M.f1(pl.r) : '') + '</span></div>';
  else if (pl && (m.ph === 'pre' || m.ph === 'locked')) foot = m.win ? '<div class="md-hf c"><span>Win chance · draw ' + m.win.d + '%</span></div>' : '';
  else if (pl) {
    const live = m.ph === 'live';
    const col = (v, T, r) => '<span class="md-hfs' + (r ? ' r' : '') + '"><span>proj <b class="n">' + M.f1(v) + '</b></span>' + (live ? '<em>' + toPlay(T) + ' to play</em>' : '') + '</span>';
    foot = '<div class="md-hf">' + col(pl.l, m.tl) + '<span class="md-hfc">' + (m.win ? 'Win chance' : '') + '</span>' + col(pl.r, m.tr, 1) + '</div>';
  }
  const kick = m.ph === 'locked' ? 'Proj final' : '';
  return '<header class="md-mh' + (m.mine ? ' md-mine' : '') + '" id="md-mh">' + UI.glow(m.L, 'left', .45, 200) + UI.glow(m.R, 'right', .3, 200)
    + '<div class="md-mhin"><div class="md-mhk"><span class="wide">' + (m.derby ? esc(m.derby) + ' · ' : '') + 'GW' + D.gw + '</span>' + stateTag(m) + '</div>'
    + '<div class="md-mhv">' + side(m.L) + '<div class="md-mhc">' + (kick ? '<span class="md-kick">' + kick + '</span>' : '') + '<div class="n md-mbig' + (n.dec ? ' dec' : '') + '">' + pairHTML(n) + '</div></div>' + side(m.R) + '</div>'
    + (m.win ? '<div class="md-mw"><b class="n' + (m.mine ? ' you-c' : '') + '">' + m.win.l + '%</b>' + winBar(m) + '<b class="n opp-c">' + m.win.r + '%</b></div>' : '')
    + foot + '</div></header>'
    + '<div class="md-pin" aria-hidden="true"><div class="md-pinin"><span class="md-pinl">' + UI.crest(m.L, 20) + '<b class="ell">' + esc(short(m.L)) + '</b></span><span class="n md-pins">' + pairHTML(n) + '</span><span class="md-pinl r"><b class="ell">' + esc(short(m.R)) + '</b>' + UI.crest(m.R, 20) + '</span>'
    + (m.ph === 'live' ? '<span class="live-dot"><i></i></span>' : '<span></span>') + (m.win ? '<span class="md-pinb">' + winBar(m, true) + '</span>' : '') + '</div></div>';
}

/* ---------- formation: both XIs on one pitch ---------- */
const ICON_UP = '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1.5 L8.5 5.5 H6.2 V8.5 H3.8 V5.5 H1.5 Z" fill="#fff"/></svg>';
function token(x, T, mode) {
  const st = M.statusLine(x, true), b = M.bubble(x, mode);
  const sub = T.subs.find(s => String(s.inn.Code) === x.code);
  /* every player on a small Plate (Parker, 8 Oct 2026) with the one status badge (Parker, 10 Oct 2026: UI.plateStatus; a
     sub outranks a doubt, and a doubt stops mattering once his match has started); the line under the card is only the
     kick-off, the minute or FT */
  const mark = sub ? (sub.kind === 'locked' ? 'in' : 'inl') : '';
  const title = sub ? (sub.kind === 'locked' ? 'On for ' : 'Likely on for ') + sub.out.Player : '';
  const badge = UI.plateStatus(x.p, mark, { title, flag: !x.started, dnp: !!st.dnp });
  const line = st.t;
  const label = x.p.Player + ', ' + (b.cls === 'pj' ? 'projected ' + b.txt : b.cls === 'xp' ? 'xP ' + b.txt : b.txt + ' points') + (badge ? ', ' + badge.t : '') + (line ? ', ' + line : '');
  /* a double-figure haul turns the bubble gold, a banked blank goes quiet */
  const pv = parseFloat(b.txt), tone = (b.cls === 'bk' || b.cls === 'lv') && pv >= 10 ? 'haul' : b.cls === 'bk' && pv <= 1 ? 'blank' : '';
  return '<span class="md-tk" data-open="player:' + esc(x.code) + '" role="button" tabindex="0" aria-label="' + esc(label) + '"><span class="md-ph">'
    + UI.plateMini(x.p, 64, { noOpen: true, mark, title, flag: !x.started, dnp: !!st.dnp, bubble: { st: b.cls, txt: b.txt, cls: tone, live: x.live } }) + '</span>'
    + '<span class="md-sl' + (st.live ? ' lv' : '') + '">' + esc(line) + '</span></span>';
}
function half(T, top, mode) {
  const order = top ? ['GKP', 'DEF', 'MID', 'FWD'] : ['FWD', 'MID', 'DEF', 'GKP'];
  return order.map(pos => {
    const g = T.players.filter(x => x.pos === pos);
    return '<div class="md-row n' + Math.max(1, g.length) + '">' + g.map(x => token(x, T, mode)).join('') + '</div>';
  }).join('');
}
/* the xP switch sits in the top team bar (Parker, 10 Oct 2026: the legend row is gone, the pitch starts under the tabs);
   a tap on it changes the bubbles and never opens the manager sheet (pages/matchday.js stops the tap there) */
const xpSwitch = m => D.hasXP && (m.tl.done.length + m.tr.done.length) > 0 && !m.final;
function teamBar(m, T, top, mode) {
  const you = m.me === T.t, sc = T.t === m.L ? m.sl : m.sr;
  const n = nums(m), big = T.t === m.L ? n.l : n.r;
  const xpv = mode === 'xp' && T.xpBlend !== null;
  const pj = m.final ? (T.xp !== null ? 'xP <b class="n">' + M.f1(T.xp) + '</b>' : '') : xpv ? 'xP + proj <b class="n">' + M.f1(T.xpBlend) + '</b>' : M.hasProj() ? 'proj <b class="n">' + M.f1(T.proj) + '</b>' : '';
  const sw = top && xpSwitch(m) ? '<button type="button" class="md-xpt' + (ST.xp ? ' on' : '') + '" data-md-xp="' + (ST.xp ? '0' : '1') + '" aria-pressed="' + !!ST.xp + '" aria-label="Show xP in the bubbles">xP</button>' : '';
  return '<div class="md-tb ' + (top ? 'top' : 'bot') + '" data-open="manager:' + esc(T.t) + '" role="button" tabindex="0">' + UI.crest(T.t, 32)
    + '<div class="ell"><b>' + esc(T.t) + '</b><span class="sub">' + esc(M.who(m, T.t)) + ' · ' + esc(T.form) + '</span></div>'
    + '<span class="sub md-tbp">' + pj + '</span>' + sw + '<b class="n md-tbs' + (you ? ' you-c' : m.mine ? ' opp-c' : '') + '">' + (m.ph === 'pre' || m.ph === 'locked' ? '' : sc) + '</b></div>';
}
function pitch(m) {
  const mode = ST.xp && D.hasXP ? 'xp' : 'pts';
  return '<div class="md-pw' + (m.mine ? ' md-mine' : '') + '">' + teamBar(m, m.tr, true, mode)
    + '<div class="md-pitch"><div class="md-lines" aria-hidden="true"><i class="hl"></i><i class="cc"></i><i class="cs"></i><i class="bx t"></i><i class="sx t"></i><i class="ar t"></i><i class="bx b"></i><i class="sx b"></i><i class="ar b"></i></div>'
    + '<div class="md-half t">' + half(m.tr, true, mode) + '</div><div class="md-half b">' + half(m.tl, false, mode) + '</div></div>'
    + teamBar(m, m.tl, false, mode) + '</div>'
    + (lineupsLocked() || m.ph !== 'pre' ? '' : '<p class="md-cap">Likely lineups until the deadline' + (M.deadline() ? ', ' + esc(M.tFull(M.deadline())) : '') + '.</p>');
}

/* ---------- head-to-head rows (List tab and the By line drawer) ---------- */
function cell(x, T, r) {
  if (!x) return '<div class="md-hc' + (r ? ' r' : '') + ' none"><span class="sub">–</span></div>';
  const st = M.statusLine(x, true), sub = T.subs.find(s => String(s.inn.Code) === x.code);
  const tag = sub ? UI.subChip(sub.kind === 'locked' ? 'in' : 'inl') : (!x.started ? UI.statusChip(x.p) : st.dnp ? '<span class="chip out">DID NOT PLAY</span>' : '');
  const where = x.fx ? M.fxOpp(x.fx, x.club) : '';
  return '<div class="md-hc' + (r ? ' r' : '') + '" data-open="player:' + esc(x.code) + '" role="button" tabindex="0">' + UI.face(x.p, 32)
    + '<div class="ell"><b>' + esc(x.p.Player) + '</b>' + tag + '<span class="sub">' + (where ? esc(where).replace(/ /g, '\u00a0') + ' · ' : '') + '<span class="' + (st.live ? 'live-c' : '') + '">' + esc(st.t).replace(/ /g, '\u00a0') + '</span></span></div></div>';
}
function mid(x, y, m) {
  const v = x => { if (!x) return '<span class="md-hv"></span>'; const b = M.bubble(x); return '<span class="md-hv"><span class="pb ' + b.cls + '">' + b.txt + '</span>' + (x.started && !x.finished && M.hasProj() && !m.final ? '<small class="n">' + M.f1(x.final) + '</small>' : '') + '</span>'; };
  return '<div class="md-hm">' + v(x) + v(y) + '</div>';
}
function pairRows(m, pos) {
  const sort = l => l.slice().sort((a, b) => b.final - a.final);
  const a = sort(m.tl.players.filter(x => x.pos === pos)), b = sort(m.tr.players.filter(x => x.pos === pos));
  const n = Math.max(a.length, b.length), out = [];
  for (let i = 0; i < n; i++) out.push('<div class="md-h2h">' + cell(a[i], m.tl) + mid(a[i], b[i], m) + cell(b[i], m.tr, 1) + '</div>');
  return out.join('');
}
const sumOf = (l, k) => l.reduce((s, x) => s + x[k], 0);
function lineVals(m, T, pos) {
  const g = T.players.filter(x => x.pos === pos);
  return { now: sumOf(g.filter(x => x.started), 'pts'), proj: sumOf(g, 'final'), xp: g.reduce((s, x) => s + (x.xp || 0), 0), n: g.length };
}

/* ---------- By line ---------- */
function byLine(m) {
  const pre = m.ph === 'pre' || m.ph === 'locked', fin_ = m.final;
  const rows = POS.map(([pos, lab]) => {
    const a = lineVals(m, m.tl, pos), b = lineVals(m, m.tr, pos);
    const share = v => (fin_ ? v.now : v.proj);
    const tot = (share(a) + share(b)) || 1, open = ST.lines.has(pos);
    const big = v => pre ? M.f1(v.proj) : M.int(v.now);
    const small = v => pre ? v.n + (v.n === 1 ? ' player' : ' players') : fin_ ? (D.hasXP ? 'xP ' + M.f1(v.xp) : '') : (M.hasProj() ? 'proj ' + M.f1(v.proj) : '');
    return '<button class="md-lr' + (open ? ' open' : '') + '" data-md-line="' + pos + '" aria-expanded="' + open + '"><span class="v"><b class="n' + (m.mine ? ' you-c' : '') + '">' + big(a) + '</b><span class="n">' + small(a) + '</span></span>'
      + '<span class="c"><span>' + lab + '</span>' + UI.wbar(Math.max(0, share(a)) / tot, 0, Math.max(0, share(b)) / tot, m.mine ? 'var(--you)' : 'var(--opp)', m.mine ? 'var(--opp)' : 'var(--tx4)', true) + '</span>'
      + '<span class="v r"><b class="n' + (m.mine ? ' opp-c' : '') + '">' + big(b) + '</b><span class="n">' + small(b) + '</span></span>' + UI.icon('chev', 14, 'var(--tx3)') + '</button>'
      + (open ? '<div class="md-lx">' + pairRows(m, pos) + '</div>' : '');
  }).join('');
  const lab = pre ? 'PREDICTED' : fin_ ? 'POINTS' : 'NOW';
  return UI.sh('By line')
    + '<div class="card md-bl"><div class="md-blh"><span class="' + (m.mine ? 'you-c' : '') + '">' + esc(M.who(m, m.L).toUpperCase()) + '</span><span>' + lab + '</span><span class="' + (m.mine ? 'opp-c' : '') + '">' + esc(M.who(m, m.R).toUpperCase()) + '</span></div>' + rows + '</div>';
}

/* ---------- What decides it ---------- */
function decides(m) {
  if (m.final) return '';
  const pre = m.ph === 'pre' || m.ph === 'locked';
  const A = m.tl.split, B = m.tr.split, max = Math.max(A.banked + A.rem, B.banked + B.rem, 1);
  const cL = m.mine ? 'var(--you)' : 'var(--opp)', cR = m.mine ? 'var(--opp)' : 'var(--tx4)';
  const bar = (S, c) => '<div class="md-sb"><i style="width:' + (100 * S.banked / max).toFixed(1) + '%;background:' + c + '"></i><i class="h" style="width:' + (100 * Math.max(0, S.rem) / max).toFixed(1) + '%;--c:' + c + '"></i></div>';
  let h = '';
  if (!pre) {
    h += '<div class="md-sbg"><span>' + esc(M.who(m, m.L)) + '</span>' + bar(A, cL) + '<b class="n">' + M.f1(A.banked + A.rem) + '</b>'
      + '<span>' + esc(M.who(m, m.R)) + '</span>' + bar(B, cR) + '<b class="n">' + M.f1(B.banked + B.rem) + '</b></div>'
      + '<div class="md-key"><span><i style="background:var(--opp)"></i>banked</span><span><i class="h" style="--c:var(--opp)"></i>still to come (projected)</span></div>';
  }
  h += '<div class="md-tiles2"><div class="md-t2"><b class="n' + (m.mine ? ' you-c' : '') + '">' + M.f1(Math.max(0, A.rem)) + '</b><span class="sub">' + (pre ? 'predicted for ' : 'still to come for ') + (m.me === m.L ? 'you' : esc(FIRSTOF(m.L))) + '</span></div>'
    + '<div class="md-t2"><b class="n' + (m.mine ? ' opp-c' : '') + '">' + M.f1(Math.max(0, B.rem)) + '</b><span class="sub">' + (pre ? 'predicted for ' : 'still to come for ') + esc(FIRSTOF(m.R)) + '</span></div></div>';
  const big = m.tl.players.map(x => ({ x, s: 'L' })).concat(m.tr.players.map(x => ({ x, s: 'R' })))
    .filter(o => !o.x.started && !o.x.blank).sort((a, b) => b.x.final - a.x.final).slice(0, 3);
  if (big.length) {
    h += '<div class="k">' + (pre ? 'Biggest predictions' : 'Biggest still to kick off') + '</div><div class="md-bg">'
      + big.map(o => '<div class="md-bgr" data-open="player:' + esc(o.x.code) + '" role="button" tabindex="0">' + UI.face(o.x.p, 32) + '<div class="ell"><b>' + esc(o.x.p.Player) + '</b><span class="sub">' + esc(M.who(m, o.s === 'L' ? m.L : m.R)) + ' · ' + esc(M.fxLabel(o.x.fx)) + ' · ' + esc(M.tKo(o.x.ko)) + '</span></div><b class="n ' + (m.mine ? (o.s === 'L' ? 'you-c' : 'opp-c') : '') + '">' + M.f1(o.x.final) + '</b></div>').join('')
      + '</div>';
  }
  return UI.sh('What decides it') + '<div class="card pad md-dec">' + h + '</div>';
}

/* ---------- benches and auto-subs ---------- */
function benchCol(m, T, r) {
  const outL = new Set(T.subs.filter(s => s.kind === 'locked').map(s => String(s.out.Code)));
  const outK = new Set(T.subs.filter(s => s.kind === 'likely').map(s => String(s.out.Code)));
  return '<div class="md-bc' + (r ? ' r' : '') + '">' + (T.bench.length ? T.bench.map(p => {
    const x = M.pl(p), c = String(p.Code);
    const tag = outL.has(c) ? UI.subChip('out') : outK.has(c) ? UI.subChip('outl') : UI.statusChip(p);
    const pts = x && x.started && x.mins > 0 ? '<span class="pb ' + (x.finished ? 'bk' : 'lv') + ' md-pbs">' + M.int(x.pts) + '</span>' : '';
    return '<div class="md-bp" data-open="player:' + esc(c) + '" role="button" tabindex="0">' + UI.face(p, 28) + '<div class="ell"><b>' + esc(p.Player) + '</b>' + tag + '</div>' + pts + '</div>';
  }).join('') : '<span class="sub">No bench</span>') + '</div>';
}
export function subLines(T, kind, opt = {}) {
  const L = T.subs.filter(s => s.kind === kind);
  return L.map(s => '<div class="md-asr' + (kind === 'likely' ? ' lk' : '') + '">' + (opt.crest ? UI.crest(T.t, 18) : '') + '<span class="md-asi">' + ICON_UP + '</span><span><b>' + esc(s.inn.Player) + '</b> ' + (kind === 'locked' ? 'on' : 'likely on') + ' for ' + esc(s.out.Player) + ' <span class="sub">(' + esc(M.subReason(s)) + ')</span></span></div>').join('');
}
/* a starter whose match finished without him and nobody came on (no fit cover on the bench) stays on the pitch with
   the red "!"; the Bench card says it in words, under the auto-sub lines */
export function dnpLines(T, opt = {}) {
  return T.players.filter(x => x.finished && !(x.mins > 0)).map(x => '<div class="md-asr no">' + (opt.crest ? UI.crest(T.t, 18) : '') + '<span class="md-asi"><b>!</b></span><span><b>' + esc(x.p.Player) + '</b> did not play <span class="sub">(' + esc(M.fxLabel(x.fx)) + ' finished, no cover on the bench)</span></span></div>').join('');
}
function benches(m) {
  const any = k => m.tl.subs.concat(m.tr.subs).some(s => s.kind === k);
  const dnp = dnpLines(m.tl) + dnpLines(m.tr);
  const notes = (any('locked') || any('likely') || dnp) ? '<div class="md-asl">' + subLines(m.tl, 'locked') + subLines(m.tr, 'locked') + subLines(m.tl, 'likely') + subLines(m.tr, 'likely') + dnp + '</div>' : '';
  return UI.sh('Bench') + '<div class="card md-bench"><div class="md-bcs">' + benchCol(m, m.tl) + benchCol(m, m.tr, 1) + '</div>' + notes + '</div>';
}

/* ---------- tabs ---------- */
function tabFormation(m) { return pitch(m) + byLine(m) + decides(m) + benches(m); }
function tabList(m) {
  const tot = T => ({ now: sumOf(T.players.filter(x => x.started), 'pts'), proj: T.proj });
  const a = tot(m.tl), b = tot(m.tr), pre = m.ph === 'pre' || m.ph === 'locked';
  const groups = ['GKP', 'DEF', 'MID', 'FWD'].map(pos => '<div class="md-lg">' + POSL[pos] + '</div>' + pairRows(m, pos)).join('');
  const totals = '<div class="md-h2h md-tot"><div class="md-hc"><b>Total</b></div><div class="md-hm"><span class="md-hv"><b class="n' + (m.mine ? ' you-c' : '') + '">' + (pre ? M.f1(a.proj) : m.sl) + '</b>' + (!pre && !m.final && M.hasProj() ? '<small class="n">' + M.f1(a.proj) + '</small>' : '') + '</span><span class="md-hv"><b class="n">' + (pre ? M.f1(b.proj) : m.sr) + '</b>' + (!pre && !m.final && M.hasProj() ? '<small class="n">' + M.f1(b.proj) + '</small>' : '') + '</span></div><div class="md-hc r"><b>Total</b></div></div>';
  return '<div class="card md-list">' + groups + totals + '</div>' + benches(m);
}

/* paired stat bars, FotMob style: the leader's number filled */
function statRow(lab, a, b, fmt, opt = {}) {
  const lo = opt.lowWins;
  const lead = a === b ? 0 : (lo ? (a < b ? -1 : 1) : (a > b ? -1 : 1));
  const t = Math.abs(a) + Math.abs(b) || 1;
  const f = fmt || (v => M.int(v));
  return '<div class="md-sr"><b class="n md-sv' + (lead < 0 ? ' lead l' : '') + '">' + f(a) + '</b><div class="md-sc2"><span>' + lab + '</span>' + (opt.noBar ? '' : '<div class="md-sbars"><i class="l' + (lead < 0 ? ' on' : '') + '"><u style="width:' + (100 * Math.abs(a) / t).toFixed(1) + '%"></u></i><i class="r' + (lead > 0 ? ' on' : '') + '"><u style="width:' + (100 * Math.abs(b) / t).toFixed(1) + '%"></u></i></div>') + '</div><b class="n md-sv' + (lead > 0 ? ' lead r' : '') + '">' + f(b) + '</b></div>';
}
function rowsSum(T, fn) { return T.xiL.reduce((s, p) => { const r = (D.gwsCur || {})[String(p.Code)]; return s + (r && fxStarted(p.Club) ? fn(r, p) : 0); }, 0); }
function tabStats(m) {
  const pre = m.ph === 'pre' || m.ph === 'locked';
  const out = [];
  const sec = (t, rows, cap) => UI.sh(t) + '<div class="card md-stats' + (m.mine ? ' md-mine' : '') + '"><div class="md-shd"><span class="' + (m.mine ? 'you-c' : '') + '">' + esc(short(m.L)) + '</span><span class="' + (m.mine ? 'opp-c' : '') + '">' + esc(short(m.R)) + '</span></div>' + rows + (cap ? '<div class="foot">' + cap + '</div>' : '') + '</div>';
  if (pre) {
    const parts = T => { const o = { app: 0, goals: 0, assists: 0, cs: 0, gc: 0, saves: 0, defcon: 0, bonus: 0, cards: 0, emin: 0, ps: 0, n: 0 }; T.xi.forEach(p => { const h = hpPlayer(p, D.gw); Object.keys(h.parts || {}).forEach(k => { o[k] += h.parts[k]; }); o.emin += h.eMin || 0; o.ps += h.pStart || 0; o.n++; }); return o; };
    const a = parts(m.tl), b = parts(m.tr), d1 = v => M.f1(v);
    let r = '';
    if (M.hasProj()) r += statRow('Predicted points', m.tl.proj, m.tr.proj, d1);
    r += statRow('Goals', a.goals, b.goals, d1) + statRow('Assists', a.assists, b.assists, d1) + statRow('Clean sheets', a.cs, b.cs, d1) + statRow('Appearance', a.app, b.app, d1)
      + statRow('Defensive contributions', a.defcon, b.defcon, d1) + statRow('Saves', a.saves, b.saves, d1) + statRow('Bonus', a.bonus, b.bonus, d1)
      + statRow('Goals conceded', a.gc, b.gc, d1) + statRow('Cards', a.cards, b.cards, d1);
    out.push(sec('Where the prediction comes from', r, ''));
    out.push(sec('Minutes', statRow('Expected minutes', a.emin, b.emin) + statRow('Average chance to start', a.n ? 100 * a.ps / a.n : 0, b.n ? 100 * b.ps / b.n : 0, v => M.int(v) + '%'), ''));
  } else {
    const A = m.tl, B = m.tr, g = (T, k) => rowsSum(T, r => num(r[k]));
    let r = statRow('Points', m.sl, m.sr);
    if (!m.final && M.hasProj()) r += statRow('Projected final', A.proj, B.proj, M.f1);
    if (D.hasXP) r += m.final ? statRow('xP', A.xp, B.xp, M.f1) : statRow('xP so far', A.xpPlayed, B.xpPlayed, M.f1);
    r += statRow('Goals', g(A, 'G'), g(B, 'G')) + statRow('Assists', g(A, 'A'), g(B, 'A'))
      + statRow('Expected goals (xG)', g(A, 'xG'), g(B, 'xG'), v => v.toFixed(2)) + statRow('Expected assists (xA)', g(A, 'xA'), g(B, 'xA'), v => v.toFixed(2))
      + statRow('Clean sheets', rowsSum(A, (r2, p) => (CSPTS[p.Pos] && num(r2.CS) ? 1 : 0)), rowsSum(B, (r2, p) => (CSPTS[p.Pos] && num(r2.CS) ? 1 : 0)))
      + statRow('Bonus', rowsSum(A, (r2, p) => num(r2.Bonus) || ((D.pbonus || {})[String(p.Code)] || 0)), rowsSum(B, (r2, p) => num(r2.Bonus) || ((D.pbonus || {})[String(p.Code)] || 0)))
      + statRow('Defensive contribution points', rowsSum(A, (r2, p) => (num(r2.DefCon) >= (DCTH[p.Pos] || 99) ? 2 : 0)), rowsSum(B, (r2, p) => (num(r2.DefCon) >= (DCTH[p.Pos] || 99) ? 2 : 0)))
      + statRow('Saves', g(A, 'Saves'), g(B, 'Saves'))
      + statRow('Yellow cards', g(A, 'YC'), g(B, 'YC'), null, { lowWins: true })
      + statRow('Minutes played', g(A, 'Mins'), g(B, 'Mins'));
    if (!m.final) r += statRow('Players still to play', A.toPlay.length, B.toPlay.length) + statRow('Playing now', A.playing.length, B.playing.length);
    out.push(sec('This gameweek', r, Object.keys(D.pbonus || {}).length ? 'Bonus includes provisional bonus until FPL confirms it.' : ''));
    if (D.hasXP && (A.done.length + B.done.length)) {
      /* the same lens as luckAgg(): effective XI (locked subs), GW Stats points minus bonus against xpOf() */
      const ax = T => { const rs = T.xiL.filter(p => fxStarted(p.Club)).map(p => (D.gwsCur || {})[String(p.Code)]).filter(r2 => r2 && num(r2.Mins) > 0); const act = rs.reduce((s, r2) => s + num(r2.Pts) - num(r2.Bonus), 0), xp = rs.reduce((s, r2) => s + xpOf(r2), 0); return { act, xp, n: rs.filter(r2 => num(r2.Mins) > 0).length }; };
      const a = ax(A), b = ax(B);
      const tile = (T, v, cls) => '<div class="md-t2"><span class="k">' + esc(M.who(m, T.t)) + '</span><b class="n ' + cls + '">' + M.signed(v.act - v.xp) + '</b><span class="sub">' + M.int(v.act) + ' actual · ' + M.f1(v.xp) + ' xP</span><span class="sub">' + v.n + ' played</span></div>';
      out.push(UI.sh('Actual v expected') + '<div class="card pad"><div class="md-tiles2">' + tile(A, a, m.mine ? 'you-c' : '') + tile(B, b, m.mine ? 'opp-c' : '') + '</div></div>');
    }
  }
  /* minutes risk and who plays whom, from the engine's matchup block */
  const d = M.memo('mpx|' + m.i, () => mpxData(m.f));
  const flipped = m.flip;
  if (d.risk) {
    const R = flipped ? [d.risk[1], d.risk[0]] : d.risk;
    const col = (L, t) => '<div class="md-rk">' + (L.length ? L.map(o => '<div class="md-rkr" data-open="player:' + esc(o.p.Code) + '" role="button" tabindex="0">' + UI.face(o.p, 26) + '<span class="ell">' + esc(o.p.Player) + '</span><b class="n">' + Math.round(o.ps * 100) + '%</b></div>').join('') : '<span class="sub">None</span>') + '</div>';
    out.push(UI.sh('Minutes risk', { aside: 'chance to start' }) + '<div class="card md-rks"><div class="md-shd"><span>' + esc(short(m.L)) + '</span><span>' + esc(short(m.R)) + '</span></div><div class="md-rkc">' + col(R[0], m.L) + col(R[1], m.R) + '</div></div>');
  }
  if (d.clash) {
    out.push(UI.sh('Who plays whom') + '<div class="card md-clash">' + d.clash.map(o => {
      const x = o.x, inPlay = fin(x.Started) && !fin(x.Finished);
      const L = flipped ? o.a : o.h, R = flipped ? o.h : o.a;
      const names = l => l.map(p => esc(p.Player)).join(', ');
      return '<div class="md-cl"><span class="l">' + UI.stack(L, 24, 3) + '<span class="sub">' + names(L) + '</span></span><b class="md-clm"><span>' + esc(x.Home) + ' <i>v</i> ' + esc(x.Away) + '</span><span class="sub' + (inPlay ? ' live-c' : '') + '">' + (inPlay ? Math.round(num(x.Mins)) + '’' : esc(M.tKo(M.koOf(x)))) + '</span></b><span class="r">' + UI.stack(R, 24, 3) + '<span class="sub">' + names(R) + '</span></span></div>';
    }).join('') + '</div>');
  }
  return out.join('');
}
function tabHistory(m) {
  const a = m.L, b = m.R, rec = M.record(a, b), mt = M.meetings(a, b);
  let h = '';
  /* series */
  if (rec) {
    const lead = rec.a > rec.b ? a : rec.b > rec.a ? b : null;
    const head = !rec.n ? 'First ever meeting' : lead ? (lead === m.me ? 'You lead the series' : FIRSTOF(lead) + ' leads the series') : 'The series is level';
    const t = rec.n || 1;
    h += UI.sh('Series') + '<div class="card md-ser2' + (m.mine ? ' md-mine' : '') + '">' + (m.derby ? '<div class="md-dn wide">' + esc(m.derby) + '</div>' : '')
      + '<div class="md-sh2">' + esc(head) + '</div>'
      + (rec.n ? '<div class="md-s3"><div><b class="n' + (m.mine ? ' you-c' : '') + '">' + rec.a + '</b><span class="sub">' + (m.me === a ? 'You won' : esc(FIRSTOF(a)) + ' won') + '</span></div><div><b class="n">' + rec.d + '</b><span class="sub">Drawn</span></div><div><b class="n' + (m.mine ? ' opp-c' : '') + '">' + rec.b + '</b><span class="sub">' + (m.me === b ? 'You won' : esc(FIRSTOF(b)) + ' won') + '</span></div></div>'
        + UI.wbar(rec.a / t, rec.d / t, rec.b / t, ...UI.pairCols(a, b)) : '')
      + '<div class="foot">' + (rec.seeded ? rec.seeded + ' meeting' + (rec.seeded === 1 ? '' : 's') + ' before this season (' + rec.seedA + '–' + rec.seedB + (rec.seedD ? ', ' + rec.seedD + ' drawn' : '') + ', scores not recorded)' : 'No meetings before this season') + (mt.length ? ', ' + mt.length + ' this season.' : ', none yet this season.') + '</div></div>';
  }
  /* this season's meetings, this week, the next one */
  const rows = mt.map(f => { const l = num(f.Home === a ? f['Home pts'] : f['Away pts']), r = num(f.Home === a ? f['Away pts'] : f['Home pts']); return { f, l, r, gw: num(f.GW), d: l - r }; });
  const big = rows.filter(o => o.d).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0];
  const next = (D.fx || []).filter(f => num(f.GW) > D.gw && ((f.Home === a && f.Away === b) || (f.Home === b && f.Away === a))).sort((x, y) => num(x.GW) - num(y.GW))[0];
  const n = nums(m);
  let rs = rows.map(o => {
    const res = o.d > 0 ? 'w' : o.d < 0 ? 'l' : 'd';
    return '<div class="row"><span class="md-gw n">GW' + o.gw + '</span>' + (m.mine ? '<span class="fm ' + res + '">' + res.toUpperCase() + '</span>' : '') + '<span class="ell md-mtx">' + esc(short(a)) + ' <b class="n md-scr">' + o.l + '–' + o.r + '</b> ' + esc(short(b)) + '</span>' + (big === o ? '<span class="chip mute">BIGGEST WIN</span>' : '') + '</div>';
  }).join('');
  if (!m.final || !rows.some(o => o.gw === D.gw)) rs += '<div class="row md-now"><span class="md-gw n">GW' + D.gw + '</span><span class="ell md-mtx">' + esc(short(a)) + ' <b class="n md-scr">' + (n.vs ? 'v' : n.l + '–' + n.r) + '</b> ' + esc(short(b)) + '</span>' + stateTag(m) + '</div>';
  if (next) { const nd = gwDeadline(num(next.GW)); rs += '<div class="row"><span class="md-gw n">GW' + num(next.GW) + '</span><span class="ell md-mtx sub">Next meeting' + (nd ? ', deadline ' + esc(nd.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })) : '') + '</span></div>'; }
  h += UI.sh('This season') + '<div class="card">' + rs + '<div class="foot">' + (big ? 'Biggest win this season: ' + esc(big.d > 0 ? a : b) + ', ' + Math.max(big.l, big.r) + '–' + Math.min(big.l, big.r) + ' in GW' + big.gw + '.' : rows.length ? 'Every meeting this season has been a draw.' : 'Their first meeting this season.') + '</div></div>';
  /* tale of the tape */
  const row = t => (D.st || []).find(s => s.Team === t) || {};
  const ra = row(a), rb = row(b), A = m.tl.rec, B = m.tr.rec;
  if (A && B && (A.played || B.played)) {
    const pl = r => num(r.W) + num(r.D) + num(r.L);
    const form = t => '<span class="fdots">' + [...formOf(t)].filter(c => c !== '-').map(c => '<i class="' + c.toLowerCase() + '"></i>').join('') + '</span>';
    h += UI.sh('Season so far') + '<div class="card md-stats' + (m.mine ? ' md-mine' : '') + '"><div class="md-shd"><span class="' + (m.mine ? 'you-c' : '') + '">' + esc(short(a)) + '</span><span class="' + (m.mine ? 'opp-c' : '') + '">' + esc(short(b)) + '</span></div>'
      + statRow('League position', A.pos, B.pos, v => ORD(v), { lowWins: true, noBar: true })
      + statRow('League points', num(ra['League Pts']), num(rb['League Pts']))
      + statRow('Points for', num(ra['Pts For']), num(rb['Pts For']))
      + statRow('Average score', pl(ra) ? num(ra['Pts For']) / pl(ra) : 0, pl(rb) ? num(rb['Pts For']) / pl(rb) : 0, M.f1)
      + statRow('Points against', num(ra['Pts Against']), num(rb['Pts Against']), null, { lowWins: true })
      + '<div class="md-sr md-rec"><b class="n md-sv">' + A.w + '–' + A.d + '–' + A.l + '</b><div class="md-sc2"><span>Won–drawn–lost</span></div><b class="n md-sv">' + B.w + '–' + B.d + '–' + B.l + '</b></div>'
      + '<div class="md-sr md-rec"><span class="md-sv">' + form(a) + '</span><div class="md-sc2"><span>Form, last five</span></div><span class="md-sv">' + form(b) + '</span></div>'
      + '</div>';
  }
  return h;
}

/* ---------- the page body ---------- */
export function render(args) {
  const fx = M.gwFx();
  if (!fx.length) return '<div style="height:12px"></div>' + UI.empty('No matchups this gameweek', 'The fixtures for Gameweek ' + D.gw + ' aren’t in the sheet yet.');
  let i = args && args.length ? parseInt(args[0], 10) : NaN;
  if (!(i >= 0 && i < fx.length)) { const y = M.youIndex(); i = y >= 0 ? y : M.featuredIndex(); }
  const m = M.mx(i);
  const tabs = [['formation', 'Formation'], ['list', 'List'], ['stats', 'Stats'], ['history', 'History']];
  const body = ST.tab === 'list' ? tabList(m) : ST.tab === 'stats' ? tabStats(m) : ST.tab === 'history' ? tabHistory(m) : tabFormation(m);
  return fixtureChips(i) + header(m)
    + '<div class="seg md-seg" role="tablist">' + tabs.map(([k, l]) => '<button role="tab" data-md-tab="' + k + '" aria-selected="' + (ST.tab === k) + '" class="' + (ST.tab === k ? 'on' : '') + '">' + l + '</button>').join('') + '</div>'
    + '<div class="md-tab">' + body + '</div>';
}
