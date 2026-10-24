/* My team · Overview: the club header (in head.js), To do from Jive, This gameweek. */
import * as UI from '../../ui.js';
import { jiveTodo } from '../../feed/index.js';
import { esc, safe, memo, curFx, dlText, dayTime, dayDate, f1, mgrName, chev, words, asOf, projOfTeam } from './bits.js';
import { byes, nextMatch } from '../byes.js';
import * as M from '../matchday/model.js';
import { availChip, availRing } from '../avail.js';

const DRAFT = 'https://draft.premierleague.com/';

/* ---------- To do, signed by Jive ---------- */
function todoFace(code) {
  const p = UI.player(code) || { Code: code, Player: '' };
  const fa = !p.Team || !TEAMS[p.Team];
  let chip = availChip(p, 'tm-fchip');
  if (!chip && fa && (UI.player(code) || {}).Owner === 'FREE') chip = '<span class="chip free tm-fchip">FREE</span>';
  return '<span class="tm-tdf" data-open="player:' + esc(p.Code) + '" aria-label="' + esc(p.Player || 'Player') + '">' + UI.face(p, 40) + chip + '</span>';
}
function todoItem(it) {
  const faces = (it.faces || []).filter(Boolean);
  const pic = faces.length > 1 ? '<span class="tm-tds">' + faces.slice(0, 3).map(c => '<span data-open="player:' + esc(c) + '">' + UI.face(c, 30) + '</span>').join('') + '</span>' : faces.length ? todoFace(faces[0]) : '';
  const a = it.action || {};
  const act = a.label ? (a.open ? '<a class="tm-tda" href="#" data-open="' + esc(a.open) + '">' : '<a class="tm-tda" href="' + esc(a.href || '#/team') + '"' + (/^https?:/.test(a.href || '') ? ' target="_blank" rel="noopener"' : '') + '>') + esc(a.label) + ' ' + chev + '</a>' : '';
  return '<div class="tm-td' + (faces.length > 1 ? ' many' : '') + '">' + pic + '<div class="tm-tdb"><p>' + (it.html || '') + '</p>' + act + '</div></div>';
}
export function todoBlock(team) {
  const items = safe(() => jiveTodo(team), []) || [];
  if (!items.length) return '';
  const w = UI.week();
  const nextDl = w.preDl ? w.dl : gwDeadline(D.gw + 1);
  const when = nextDl ? (w.preDl ? 'Deadline ' + dlText(nextDl) + ' · ' + dayTime(nextDl) : 'GW' + (D.gw + 1) + ' deadline · ' + UI.dayFull(nextDl)) : '';
  return UI.sh('To do')
    + '<section class="card tm-todo" aria-label="To do from Jive Tidlsey">'
    + '<div class="tm-jh"><span class="tm-jmark" aria-hidden="true">' + UI.icon('clip', 15, '#EEF3EA', 2) + '</span>'
    + '<div class="tm-jw"><b>From Jive Tidlsey</b>' + (when ? '<span class="sub">' + esc(when) + '</span>' : '') + '</div>'
    + '<span class="tm-count n">' + items.length + ' TO DO</span></div>'
    + items.slice(0, 3).map(todoItem).join('')
    + '<div class="foot"><a class="tm-ext" href="' + DRAFT + '" target="_blank" rel="noopener">Open FPL Draft ' + chev + '</a></div>'
    + '</section>';
}

/* ---------- This gameweek: your matchup, you on the left in blue ---------- */
export function gwState(team, f) { return memo('gws|' + team, () => gwState0(team, f)); }
/* deadline passed but no ball kicked: still a projection, now with the lineups locked */
const kicked = () => (D.cf || []).some(x => num(x.GW) === D.gw && (fin(x.Started) || fin(x.Finished)));
function gwState0(team, f) {
  const opp = f.Home === team ? f.Away : f.Home, home = f.Home === team;
  const s = mscore(f), prov = D.provOver && !s.done;
  const o = { opp, home, s, prov };
  if (s.done || prov) {
    o.st = s.done ? 'ft' : 'prov';
    o.me = home ? s.hs : s.as2; o.them = home ? s.as2 : s.hs;
    o.lab = s.done ? 'final' : 'provisional';
    o.sub = D.hasXP && num(f.GW) === D.gw ? 'xP ' + UI.score(f1(teamXP(team)), f1(teamXP(opp))) : '';   /* markup, as in the live branch: never esc() it */
  } else if (s.liveNow && kicked()) {
    o.st = 'live';
    o.settle = M.settleState(f);   /* 'open' while a game can still change the score; 'bonus' or 'settled' once only bonus or nothing can */
    o.me = home ? s.hs : s.as2; o.them = home ? s.as2 : s.hs;
    o.lab = o.settle === 'bonus' ? 'Bonus provisional' : o.settle === 'settled' ? 'full time' : 'live';
    o.sub = D.hasEP ? UI.legendTap('proj', 'Proj final', 'ln') + ' ' + UI.score(f1(projOfTeam(team)), f1(projOfTeam(opp))) : '';
  } else {
    o.st = 'pred';
    o.me = D.hasEP ? f1(projOfTeam(team)) : '-'; o.them = D.hasEP ? f1(projOfTeam(opp)) : '-';
    o.lab = D.dlPassed ? 'locked in' : UI.legendTap('proj', 'Proj final', 'ln');   /* markup: the label is a tap to the legend */
    o.sub = '';
  }
  if (o.st === 'pred' || o.st === 'live') {
    /* the matchday model's chances: held to 1..99 while anything can change, 100 and 0 with no draw once it cannot */
    const w = M.winPct(f);
    if (w && (w.settled || isFinite(w.h))) o.win = { me: home ? w.h : w.a, d: w.d, them: home ? w.a : w.h, settled: w.settled, drawn: w.drawn };
  }
  return o;
}
function xiStrip(team, live) {
  const as = asOf(team, true), order = { GKP: 0, DEF: 1, MID: 2, FWD: 3 };
  const xi = as.xi.slice().sort((a, b) => order[a.Pos] - order[b.Pos]);
  let toPlay = 0;
  const faces = xi.map(p => {
    let ring = '', cls = '';
    const started = fxStarted(p.Club), done = fxFinished(p.Club);
    if (live && started) { if (done) cls = 'done'; else ring = 'var(--live)'; }
    else { toPlay++; ring = availRing(p).ring || ''; }
    return UI.face(p, 28, { ring, ringW: 2, cls });
  }).join('');
  const lab = live ? (toPlay ? words(toPlay).replace(/^./, c => c.toUpperCase()) + ' to play' : 'All played') : 'Lineup';
  return '<a class="tm-xi" href="#/team/lineup" aria-label="Lineup"><span class="tm-xif">' + faces + '</span><span class="tm-xil">' + esc(lab) + ' ' + chev + '</span></a>';
}
export function gwBlock(team) {
  const f = curFx(team);
  if (!f) return UI.sh('This gameweek') + UI.empty('No match this gameweek', 'Your next matchup shows here when the fixtures list has one.');
  const o = gwState(team, f), opp = o.opp;
  const nm = derbyName(f.Home, f.Away), sr = M.seriesLine(team, opp);
  const head = (nm ? esc(nm) + ' · GW' + D.gw : 'Gameweek ' + D.gw);
  const live = o.st === 'live';
  const pulse = live && o.settle === 'open';   /* the dot and the green score go once nothing but bonus can change */
  const lab = '<span class="sub tm-lab' + (pulse ? ' live-c' : '') + '">' + (pulse ? '<span class="live-dot"><i></i></span>' : '') + o.lab + '</span>';
  let foot = '';
  if (o.win) {
    const pc = v => v === null ? '' : v + '%', dr = M.drawText(o.win);
    foot = '<div class="tm-wl n"><span class="you-c">' + pc(o.win.me) + '</span>' + UI.wbar((o.win.me || 0) / 100, (o.win.d || 0) / 100, (o.win.them || 0) / 100, ...UI.pairCols(team, opp)) + '<span class="opp-c">' + pc(o.win.them) + '</span></div>'
      + '<div class="tm-wlc sub">' + (o.win.drawn ? 'draw 100%' : UI.legendTap('odds', 'win chance', 'ln') + (dr ? ' · draw <span class="n">' + dr + '</span>' : '')) + (o.sub && !o.win.settled ? ' · ' + o.sub : '') + '</div>';
  } else if (o.st === 'ft' || o.st === 'prov') {
    const d = o.me - o.them;
    foot = '<div class="tm-res"><span class="fm ' + (d > 0 ? 'w' : d < 0 ? 'l' : 'd') + '">' + (d > 0 ? 'W' : d < 0 ? 'L' : 'D') + '</span><span>' + (d > 0 ? 'Won by ' + d : d < 0 ? 'Lost by ' + (-d) : 'Drawn') + (o.st === 'prov' ? ', until FPL confirms' : '') + '</span>' + (o.sub ? '<span class="sub">' + o.sub + '</span>' : '') + '</div>';
  }
  return UI.sh('This gameweek', { more: 'Matchup', href: '#/matchday/matchup' })
    + '<section class="card tm-gw" aria-label="Your matchup this gameweek">'
    + UI.glow(team, 'left', .35, 200) + UI.glow(opp, 'right', .2, 200)
    + '<div class="tm-gwin">'
    + '<div class="tm-gwt"><span class="wide">' + head + '</span>' + (sr ? '<span class="sub">' + esc(sr) + '</span>' : '') + '</div>'
    + '<div class="tm-gwr">'
    + '<div class="tm-side me">' + UI.crest(team, 40) + '<b>' + esc(UI.short(team)) + '</b>' + lab + '</div>'
    + '<div class="tm-score n' + (pulse ? ' live' : '') + '">' + UI.score(o.me, o.them, { cls: 'flush' }) + '</div>'
    + '<button class="tm-side them" data-open="manager:' + esc(opp) + '" aria-label="' + esc(opp) + ', ' + esc(mgrName(opp)) + '">' + UI.crest(opp, 40) + '<b>' + esc(UI.short(opp)) + '</b><span class="sub">' + (fbxRec(opp) ? '<span class="n">' + esc(fbxRec(opp)) + '</span> W-D-L' : esc(mgrName(opp))) + '</span></button>'
    + '</div>' + foot + '</div>'
    + xiStrip(team, live || o.st === 'prov')
    + '</section>';
}

export function switchLine(team) {
  if (UI.signedIn()) return '';
  const first = (mgrName(team) || '').split(' ')[0];
  return '<div class="tm-switch"><button data-unpick="1">Not ' + esc(first) + '? Pick another club</button></div>';
}
