/* My team · Squad: all fifteen with status, rating and form, plus the squad health summary. */
import * as UI from '../../ui.js';
import { esc, memo, f1, sgn, chips, ppg, seasonPts, seasonMins, lastSum, POSN, words } from './bits.js';
import { availSummary, availChip, availRing } from '../avail.js';

export const SORT = { squad: 'lineup' };
try { const v = localStorage.getItem('emt-tm-ssort'); if (['lineup', 'pts', 'form', 'ovr'].includes(v)) SORT.squad = v; } catch (e) { }

/* squad health: last three counted gameweeks against each player's own mean (production's squadHealth logic, 13 Sep fix) */
export function health(team) {
  return memo('health|' + team, () => {
    const all = Object.keys(D.gwsByGw || {}).map(Number).filter(g => g < D.gw || (g === D.gw && D.dlPassed)).sort((a, b) => a - b);
    if (!all.length) return null;
    const last = all.slice(-3);
    const rows = squadOf(team).map(p => {
      const mine = all.filter(g => g < D.gw || fxStarted(p.Club)); if (mine.length < 2) return null;
      const at = g => ((D.gwsByGw[g] || {})[String(p.Code)] || {}).Pts || 0;
      const win = mine.slice(-3);
      const l3 = win.reduce((s, g) => s + at(g), 0) / win.length;
      const avg = mine.reduce((s, g) => s + at(g), 0) / mine.length;
      return { p, l3, d: l3 - avg };
    }).filter(r => r && Math.abs(r.d) >= 0.5 && (r.l3 > 0 || r.d < 0));
    return {
      n: last.length,
      up: rows.filter(r => r.d > 0).sort((a, b) => b.d - a.d).slice(0, 3),
      dn: rows.filter(r => r.d < 0).sort((a, b) => a.d - b.d).slice(0, 3),
    };
  });
}
function healthBlock(team) {
  const sq = squadOf(team);
  const A = availSummary(sq), outs = A.outs, dbt = A.doubts, fit = A.n.fit;
  const H = health(team);
  const avail = '<div class="tm-avail"><span><i class="ok"></i><b class="n">' + fit + '</b> available</span>'
    + '<span><i class="dbt"></i><b class="n">' + dbt.length + '</b> doubtful</span>'
    + '<span><i class="out"></i><b class="n">' + outs.length + '</b> out</span></div>';
  const col = (rows, up) => '<div class="tm-hcol"><span class="tm-hk ' + (up ? 'win-c' : 'loss-c') + '">' + UI.icon('up', 12, 'currentColor', 2.6).replace('<svg', '<svg' + (up ? '' : ' style="transform:rotate(180deg)"')) + (up ? 'Trending up' : 'Trending down') + '</span>'
    + (rows.length ? rows.map(r => '<button class="tm-hr" data-open="player:' + esc(r.p.Code) + '">' + UI.face(r.p, 26) + '<span class="tm-hn"><b class="ell">' + esc(r.p.Player) + '</b><span class="sub n">' + UI.minus(f1(r.l3)) + ' a game</span></span><span class="tm-hd n ' + (up ? 'win-c' : 'loss-c') + '">' + sgn(r.d) + '</span></button>').join('')
      : '<span class="sub tm-hnone">Nobody' + (up ? ' above' : ' below') + ' his usual</span>') + '</div>';
  return UI.sh('Squad health')
    + '<div class="card tm-health">' + avail + (H ? '<div class="tm-hcols">' + col(H.up, 1) + col(H.dn, 0) + '</div>' : '<p class="sub tm-hnone pad">Form trends show once two gameweeks are played.</p>') + '</div>';
}

function sqRow(p, bench) {
  const o = dynOvr(p), fd = formDelta(p), a = ppg(p), m = seasonMins(p);
  const st = availChip(p);
  return '<div class="row tap tm-sr" data-open="player:' + esc(p.Code) + '" role="button" tabindex="0">'
    + UI.face(p, 40, availRing(p))
    + '<div class="tm-sm"><div class="tm-sn"><b class="ell">' + esc(p.Player) + '</b>' + st + (bench ? '<span class="chip mute">BENCH</span>' : '') + '</div>'
    + '<span class="sub">' + POSN[p.Pos] + ' · ' + esc(p.Club) + ' · <span class="n">' + m + '</span> min</span>'
    + '<div class="tm-sc">' + chips(p, 5, 1) + '</div></div>'
    /* two numbers, each labelled (11 Oct 2026: the rating and the points sat side by side in the same big type): the
       rating small in its box, the word Rating always under it with the form arrow; the points big, marked pts */
    + '<div class="tm-ovr"><b class="n">' + o + '</b><span class="k">Rating' + (fd ? ' <i class="' + (fd > 0 ? 'win-c' : 'loss-c') + '">' + (fd > 0 ? '▲' : '▼') + Math.abs(fd) + '</i>' : '') + '</span></div>'
    + '<div class="tm-spt"><b class="n">' + UI.minus(seasonPts(p)) + '<small>pts</small></b>' + (a ? '<span class="sub"><span class="n">' + UI.minus(f1(a)) + '</span> a game</span>' : '<span class="sub">no games</span>') + '</div>'
    + '</div>';
}

export function squadPage(team) {
  const xi = xiOf(team), bench = benchOf(team);
  if (!xi.length && !bench.length) return UI.empty('No squad yet', 'Your fifteen show here once the draft is in.');
  const xiSet = new Set(xi.map(p => p.Code));
  const all = xi.concat(bench);
  const S = SORT.squad;
  const seg = '<div class="tm-ctl"><span class="sub">Sort</span><span class="seg" role="tablist" aria-label="Sort the squad">'
    + [['lineup', 'Lineup'], ['pts', 'Points'], ['form', 'Last 5'], ['ovr', 'Rating']].map(([k, l]) => '<button data-ssort="' + k + '" role="tab" aria-selected="' + (S === k) + '"' + (S === k ? ' class="on"' : '') + '>' + l + '</button>').join('') + '</span></div>';
  let rows;
  if (S === 'lineup') {
    const order = { GKP: 0, DEF: 1, MID: 2, FWD: 3 };
    const x = xi.slice().sort((a, b) => order[a.Pos] - order[b.Pos]);
    rows = '<div class="tm-sgh k">' + (lineupsLocked() ? 'Starting XI' : 'Likely XI') + '</div><div class="card tm-sq">' + x.map(p => sqRow(p)).join('') + '</div>'
      + '<div class="tm-sgh k">Bench</div><div class="card tm-sq">' + bench.map(p => sqRow(p)).join('') + '</div>';
  } else {
    const key = S === 'pts' ? seasonPts : S === 'form' ? lastSum : dynOvr;
    const sorted = all.slice().sort((a, b) => key(b) - key(a) || seasonPts(b) - seasonPts(a));
    rows = '<div class="card tm-sq">' + sorted.map(p => sqRow(p, !xiSet.has(p.Code))).join('') + '</div>';
  }
  const n = all.length;
  return healthBlock(team)
    + UI.sh('Squad', { aside: words(n).replace(/^./, c => c.toUpperCase()) + ' players ' + UI.legendTap('rating', 'Rating', 'ln') })
    + seg + rows;
}
