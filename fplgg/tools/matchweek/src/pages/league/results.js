/* League › Results: scores by gameweek, every gameweek's four results, season records. */
import * as UI from '../../ui.js';
import { table, grid, resultGws, scoreOf, records, wk } from './data.js';
import { tap } from './overview.js';

const esc = UI.esc;
const OPEN = new Set();       // which gameweeks are expanded (kept across refreshes)
let TOUCHED = false;          // once the viewer opens or closes one, their choice wins over the default
let GRIDX = null;             // the grid's horizontal scroll, kept across refreshes

const RES = { w: 'Won', d: 'Drew', l: 'Lost' };
/* full name, or the short one on the narrowest phones */
const nm2 = t => '<span class="t"><span class="full">' + esc(t) + '</span><span class="shrt">' + esc(UI.short(t)) + '</span></span>';

function gridCard() {
  const G = grid(), rows = table(), me = UI.you(), w = wk();
  if (!G.gws.length) return '';
  const head = '<tr><th class="tm" scope="col">Team</th>' + G.gws.map(({ g, live, prov }) => '<th scope="col" class="' + (live ? (prov ? 'pv' : 'lv') : '') + '">' + (live ? '<em>' + (prov ? 'FT' : 'LIVE') + '</em>' : '') + 'GW' + g + '</th>').join('') + '<th scope="col" class="pf">PF</th><th scope="col" class="pf pa">PA</th></tr>';
  const body = rows.map(r => {
    const t = r.team;
    const tds = G.gws.map(({ g, live, prov }) => {
      const c = G.cell[t + '|' + g];
      if (!c) return '<td><span class="c none">–</span></td>';
      const hi = !live && c.p === G.top[g], lo = !live && c.p === G.bot[g];
      const showRes = !live || prov;
      const lab = 'GW' + g + ': ' + c.p + ' against ' + c.opp + ' ' + c.op + (showRes ? ', ' + RES[c.r].toLowerCase() : ', live') + (hi ? ', top score of the week' : lo ? ', lowest score of the week' : '');
      return '<td aria-label="' + esc(lab) + '"><span class="c ' + (showRes ? c.r : 'lv') + (hi ? ' hi' : '') + (lo ? ' lo' : '') + '"><b class="n">' + c.p + '</b>' + (showRes ? '<i>' + c.r.toUpperCase() + '</i>' : '') + '</span></td>';
    }).join('');
    return '<tr class="' + (t === me ? 'you' : '') + '"><th scope="row" class="tm"' + tap(t, t + ', open the team') + '>' + UI.crest(t, 18) + '<span>' + esc(UI.short(t)) + '</span></th>' + tds + '<td class="pf n">' + r.pf + '</td><td class="pf pa n">' + r.pa + '</td></tr>';
  }).join('');
  const lv = G.gws.find(x => x.live);
  return UI.sh('Scores by gameweek', { aside: G.gws.filter(x => !x.live).length + ' played' + (lv ? ' · GW' + lv.g + (lv.prov ? ' at full time' : ' live') : '') })
    + '<div class="card lg-grid"><div class="sc" tabindex="0" role="region" aria-label="Scores by gameweek, scrolls sideways"><table><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>'
    + '<div class="lg-legend"><span><i class="fm w">W</i>won</span><span><i class="fm d">D</i>drew</span><span><i class="fm l">L</i>lost</span><span><i class="rg hi"></i>week’s top</span><span><i class="rg lo"></i>week’s lowest</span></div>'
    + (w.live ? '<div class="foot">GW' + D.gw + ' scores are live and count once the gameweek is over. PF and PA are the table’s points for and against.</div>' : w.prov ? '<div class="foot">GW' + D.gw + ' is provisional until FPL confirms it.</div>' : '')
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
      const s = scoreOf(f), hw = s.h > s.a, aw = s.a > s.h, nm = derbyName(f.Home, f.Away);
      const done = s.done || prov;
      const side = (t, win, cls) => '<span class="side ' + cls + (done && win ? ' win' : done && !(hw || aw) ? ' draw' : done ? ' lose' : '') + (t === me ? ' me' : '') + '"' + tap(t, t) + '>'
        + (cls === 'h' ? UI.crest(t, 24) + nm2(t) : nm2(t) + UI.crest(t, 24)) + '</span>';
      const idx = num(f.GW) === D.gw ? curRows.indexOf(f) : -1;
      const sc = '<span class="sc' + (live && !prov ? ' lv' : '') + '"' + (idx >= 0 ? ' data-go="#/matchday/matchup/' + idx + '" role="button" tabindex="0" aria-label="Open the matchup"' : '') + '>'
        + '<b class="n' + (done && aw ? ' dim' : '') + '">' + s.h + '</b><i>–</i><b class="n' + (done && hw ? ' dim' : '') + '">' + s.a + '</b>'
        + '</span>';
      return '<div class="lg-res">' + side(f.Home, hw, 'h') + sc + side(f.Away, aw, 'a') + '</div>' + (nm ? '<div class="lg-dn">' + esc(nm) + '</div>' : '');
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
    + (R.big ? tile('Biggest win', 'by ' + R.big.v, who(R.big.who, x => x.s + '–' + x.os + ' v ' + esc(UI.short(x.o)) + ', GW' + x.g)) : '')
    + (R.close ? tile('Closest win', 'by ' + R.close.v, who(R.close.who, x => x.s + '–' + x.os + ' v ' + esc(UI.short(x.o)) + ', GW' + x.g)) : '')
    + '</div><p class="lg-cap">Finished gameweeks only. A shared record lists everyone who holds it.</p>';
}

export function results() {
  if (!resultGws().length) return '<div style="height:12px"></div>' + UI.empty('No results yet', 'Scores land here once gameweek 1 kicks off.');
  return gridCard() + gwCards() + recordTiles();
}

export function mountResults(root) {
  const sc = root.querySelector('.lg-grid .sc');
  if (sc) {
    sc.scrollLeft = GRIDX == null ? sc.scrollWidth : GRIDX;
    sc.addEventListener('scroll', () => { GRIDX = sc.scrollLeft; }, { passive: true });
  }
  root.querySelectorAll('details.lg-gw').forEach(d => {
    d.addEventListener('toggle', () => { const g = +d.dataset.gw; if (d.open) OPEN.add(g); else OPEN.delete(g); });
    const s = d.querySelector('summary'); s && s.addEventListener('click', () => { TOUCHED = true; });
  });
}
