/* League › Results: scores by gameweek, every gameweek's four results, season records. */
import * as UI from '../../ui.js';
import { table, grid, resultGws, scoreOf, records } from './data.js';
import { tap } from './overview.js';
import { byes } from '../byes.js';

const esc = UI.esc;
const OPEN = new Set();       // which gameweeks are expanded (kept across refreshes)
let TOUCHED = false;          // once the viewer opens or closes one, their choice wins over the default
let GRIDX = null;             // the grid's horizontal scroll, kept across refreshes

const RES = { w: 'Won', d: 'Drew', l: 'Lost' };
/* full name, or the short one on the narrowest phones */
const nm2 = t => '<span class="t"><span class="full">' + esc(t) + '</span><span class="shrt">' + esc(UI.short(t)) + '</span></span>';

function gridCard() {
  const G = grid(), rows = table(), me = UI.you();
  if (!G.gws.length) return '';
  const head = '<tr><th class="tm" scope="col">Team</th>' + G.gws.map(({ g, live, prov }) => '<th scope="col" class="' + (live ? (prov ? 'pv' : 'lv') : '') + '">' + (live ? '<em>' + (prov ? 'FT' : 'LIVE') + '</em>' : '') + 'GW' + g + '</th>').join('') + '<th scope="col" class="pf">PF</th><th scope="col" class="pf pa">PA</th></tr>';
  const body = rows.map(r => {
    const t = r.team;
    const tds = G.gws.map(({ g, live, prov }) => {
      const c = G.cell[t + '|' + g];
      if (!c) return byes(g).includes(t) ? '<td aria-label="GW' + g + ': bye"><span class="c none"><span class="by">Bye</span></span></td>' : '<td><span class="c none">-</span></td>';
      const hi = !live && c.p === G.top[g], lo = !live && c.p === G.bot[g];
      const showRes = !live || prov;
      const lab = 'GW' + g + ': ' + c.p + ' against ' + c.opp + ' ' + c.op + (showRes ? ', ' + RES[c.r].toLowerCase() : ', live') + (hi ? ', top score of the week' : lo ? ', lowest score of the week' : '');
      return '<td aria-label="' + esc(lab) + '"><span class="c ' + (showRes ? c.r : 'lv') + (hi ? ' hi' : '') + (lo ? ' lo' : '') + '"><b class="n">' + c.p + '</b>' + (showRes ? '<i>' + c.r.toUpperCase() + '</i>' : '') + '</span></td>';
    }).join('');
    return '<tr class="' + (t === me ? 'you' : '') + '"><th scope="row" class="tm"' + tap(t, t + ', open the team') + '>' + UI.crest(t, 18) + '<span>' + esc(UI.short(t)) + '</span></th>' + tds + '<td class="pf n">' + r.pf + '</td><td class="pf pa n">' + r.pa + '</td></tr>';
  }).join('');
  return UI.sh('Scores by gameweek', { aside: G.gws.filter(x => !x.live).length + ' played' })
    + '<div class="card lg-grid"><div class="sc" tabindex="0" role="region" aria-label="Scores by gameweek, scrolls sideways"><table><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>'
    + '<div class="lg-legend"><span><i class="fm w">W</i>won</span><span><i class="fm d">D</i>drew</span><span><i class="fm l">L</i>lost</span><span><i class="rg hi"></i>week’s top</span><span><i class="rg lo"></i>week’s lowest</span></div>'
    + '</div>';
}

function gwCards() {
  const gws = resultGws().slice().reverse(), me = UI.you(), G = grid();
  if (!gws.length) return '';
  if (!TOUCHED) { OPEN.clear(); OPEN.add(gws[0].g); }
  const curRows = D.fx.filter(f => num(f.GW) === D.gw);
  return UI.sh('Gameweek by gameweek') + gws.map(({ g, live, prov }) => {
    const fs = D.fx.filter(f => num(f.GW) === g);
    const dl = gwDeadline(g);
    let top = '';
    if (!live && G.top[g] != null) {
      const who = Object.keys(TEAMS).filter(t => (G.cell[t + '|' + g] || {}).p === G.top[g]);
      top = 'Top score ' + G.top[g] + ' · ' + who.map(UI.short).join(', ');
    } else top = prov ? 'Full time, provisional' : 'Live now';
    const rows = fs.map(f => {
      const s = scoreOf(f), nm = derbyName(f.Home, f.Away);
      /* the member's own side and score first when the member plays (set order, milestone M2); every other matchup as the fixture list has it */
      const flip = !!me && f.Away === me, L = flip ? f.Away : f.Home, R = flip ? f.Home : f.Away, ls = flip ? s.a : s.h, rs = flip ? s.h : s.a;
      const lw = ls > rs, rw = rs > ls;
      const done = s.done || prov;
      const side = (t, win, cls) => '<span class="side ' + cls + (done && win ? ' win' : done && !(lw || rw) ? ' draw' : done ? ' lose' : '') + (t === me ? ' me' : '') + '"' + tap(t, t) + '>'
        + (cls === 'h' ? UI.crest(t, 24) + nm2(t) : nm2(t) + UI.crest(t, 24)) + '</span>';
      const idx = num(f.GW) === D.gw ? curRows.indexOf(f) : -1;
      const sc = '<span class="sc' + (live && !prov ? ' lv' : '') + '"' + (idx >= 0 ? ' data-go="#/matchday/matchup/' + idx + '" role="button" tabindex="0" aria-label="Open the matchup"' : '') + '>'
        + UI.score(ls, rs, { aCls: done && rw ? 'dim' : '', bCls: done && lw ? 'dim' : '' })
        + '</span>';
      return '<div class="lg-res">' + side(L, lw, 'h') + sc + side(R, rw, 'a') + '</div>' + (nm ? '<div class="lg-dn">' + esc(nm) + '</div>' : '');
    }).join('');
    return '<details class="card lg-gw" data-gw="' + g + '"' + (OPEN.has(g) ? ' open' : '') + '><summary><span class="g"><b>Gameweek ' + g + '</b><span>' + (dl ? esc(UI.day(dl)) + ' · ' : '') + esc(top) + '</span></span>'
      + (live ? '<span class="lg-tag ' + (prov ? 'prov' : 'live') + '">' + (prov ? 'Provisional' : '<i></i>Live') + '</span>' : '') + UI.icon('chev', 16, 'var(--tx3)', 2.4) + '</summary>'
      + '<div class="body">' + rows + '</div></details>';
  }).join('');
}

function recordTiles() {
  const R = records();
  if (!R.hi) return '';
  const who = (list, fmt) => {
    const by = {}; list.forEach(x => { (by[x.t] = by[x.t] || []).push(x); });
    const ks = Object.keys(by);
    return ks.slice(0, 3).map(t => '<span class="w">' + UI.crest(t, 16) + '<span>' + esc(UI.short(t)) + ' · ' + by[t].map(fmt).join(', ') + '</span></span>').join('') + (ks.length > 3 ? '<span class="w more">and ' + (ks.length - 3) + ' more</span>' : '');
  };
  const tile = (lab, v, body) => '<div class="tile lg-rec"><span class="lb">' + lab + '</span><b class="n">' + v + '</b>' + body + '</div>';
  return UI.sh('Season records') + '<div class="tiles lg-recs">'
    + tile('Highest score', R.hi.v, who(R.hi.who, x => 'GW' + x.g))
    + tile('Lowest score', R.lo.v, who(R.lo.who, x => 'GW' + x.g))
    + (R.big ? tile('Biggest win', 'by ' + R.big.v, who(R.big.who, x => UI.score(x.s, x.os) + ' v ' + esc(UI.short(x.o)) + ', GW' + x.g)) : '')
    + (R.close ? tile('Closest win', 'by ' + R.close.v, who(R.close.who, x => UI.score(x.s, x.os) + ' v ' + esc(UI.short(x.o)) + ', GW' + x.g)) : '')
    + '</div><p class="lg-cap">Finished gameweeks only.</p>';
}

export function results() {
  if (!resultGws().length) return '<div style="height:12px"></div>' + UI.empty('No results yet', 'Scores land here once gameweek 1 kicks off.');
  return gridCard() + gwCards() + recordTiles();
}

export function mountResults(root) {
  const sc = root.querySelector('.lg-grid .sc');
  if (sc) {
    /* the grid opens on the latest gameweeks with a whole column against the team names, never a sliver of one
       (11 Oct 2026: the half-hidden cells showed stray W and L letters beside the names): the last column gets just
       enough room after it that the far end lines a column up with the names, so the latest weeks, PF and PA all show
       whole */
    const align = () => {
      if (!sc.isConnected) return;
      const tm = sc.querySelector('tbody .tm'), lasts = sc.querySelectorAll('tr > :last-child');
      if (!tm) return;
      lasts.forEach(c => { c.style.paddingRight = ''; });
      const keep = GRIDX;
      sc.scrollLeft = sc.scrollWidth;
      const edge = tm.getBoundingClientRect().right, tds = [...tm.parentNode.querySelectorAll('td')];
      /* a column's minimum width can swallow part of the added room, so measure again until nothing is cut */
      for (let i = 0; i < 4; i++) {
        sc.scrollLeft = sc.scrollWidth;
        const cut = tds.find(td => { const r = td.getBoundingClientRect(); return r.left < edge - 1 && r.right > edge + 1; });
        if (!cut) break;
        const add = Math.ceil(cut.getBoundingClientRect().right - edge);
        lasts.forEach(c => { c.style.paddingRight = (parseFloat(getComputedStyle(c).paddingRight) + add) + 'px'; });
      }
      sc.scrollLeft = keep == null ? sc.scrollWidth : keep;
    };
    /* measured now, on the next frame and once the fonts are in (the names' width moves the edge) */
    align(); requestAnimationFrame(align);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(align);
    /* a position at the far end means "follow the latest weeks", not a fixed offset */
    sc.addEventListener('scroll', () => { GRIDX = sc.scrollLeft >= sc.scrollWidth - sc.clientWidth - 2 ? null : sc.scrollLeft; }, { passive: true });
  }
  root.querySelectorAll('details.lg-gw').forEach(d => {
    d.addEventListener('toggle', () => { const g = +d.dataset.gw; if (d.open) OPEN.add(g); else OPEN.delete(g); });
    const s = d.querySelector('summary'); s && s.addEventListener('click', () => { TOUCHED = true; });
  });
}
