/* My team · Fixtures: your players' clubs over the next five gameweeks, and your next four league matchups. */
import * as UI from '../../ui.js';
import { esc, memo, fdK, f1, mgrName, dayDate, chev } from './bits.js';

export const FIX = { sort: 'players' };
try { const v = localStorage.getItem('emt-tm-fsort'); if (v === 'players' || v === 'easy') FIX.sort = v; } catch (e) { }

function gwsAhead() {
  const max = Math.max(...(D.cf || []).map(x => num(x.GW)), 0) || 38;
  const g0 = D.dlPassed ? D.gw + 1 : D.gw;
  const out = []; for (let g = g0; g <= Math.min(max, g0 + 4); g++) out.push(g);
  return out;
}
function grid(team) {
  const gws = gwsAhead();
  if (!gws.length) return UI.empty('No fixtures left', 'The season’s fixture list is complete.');
  const xi = new Set(xiOf(team).map(p => p.Code));
  const sq = squadOf(team);
  const clubs = [...new Set(sq.map(p => p.Club))].map(c => {
    const ps = sq.filter(p => p.Club === c).sort((a, b) => (xi.has(b.Code) ? 1 : 0) - (xi.has(a.Code) ? 1 : 0));
    const cells = gws.map(g => (D.cf || []).filter(x => num(x.GW) === g && (x.Home === c || x.Away === c)));
    const diff = cells.reduce((s, fs) => s + (fs.length ? fs.reduce((t, f) => t + fdrOf(c, f), 0) / fs.length - (fs.length - 1) * 1.5 : 4.5), 0);
    return { c, ps, cells, diff, nXi: ps.filter(p => xi.has(p.Code)).length };
  });
  clubs.sort(FIX.sort === 'easy' ? (a, b) => a.diff - b.diff || b.ps.length - a.ps.length : (a, b) => b.nXi - a.nXi || b.ps.length - a.ps.length || a.diff - b.diff);
  const cell = (c, fs) => {
    if (!fs.length) return '<span class="tm-gc blank" title="No fixture">–</span>';
    return '<span class="tm-gc' + (fs.length > 1 ? ' dbl' : '') + '">' + fs.map(f => {
      const h = f.Home === c, o = h ? f.Away : f.Home, n = fdrOf(c, f);
      return '<span class="tm-fd fd-' + fdK(n) + '" title="' + esc(clubName(o)) + ' (' + (h ? 'H' : 'A') + '), ' + FDRLAB[n].toLowerCase() + '"><b>' + esc(o) + '</b><i>' + (h ? 'H' : 'A') + '</i></span>';
    }).join('') + '</span>';
  };
  return '<div class="card tm-grid" style="--cols:' + gws.length + '">'
    + '<div class="tm-gr tm-gh"><span></span>' + gws.map(g => '<span class="n">GW' + g + '</span>').join('') + '</div>'
    + clubs.map(r => '<div class="tm-gr"><span class="tm-gcl"><b>' + esc(r.c) + '</b><span class="sub">' + r.ps.map(p => '<span' + (xi.has(p.Code) ? '' : ' class="bn"') + '>' + esc(p.Player) + '</span>').join(', ') + '</span></span>' + r.cells.map(fs => cell(r.c, fs)).join('') + '</div>').join('')
    + '<div class="tm-leg">' + [['e', 'Easy'], ['n', 'Medium'], ['h', 'Hard'], ['x', 'Very hard']].map(([k, l]) => '<span><i class="fd-' + k + '"></i>' + l + '</span>').join('') + '<span class="tm-legn">Faded names are on your bench</span></div>'
    + '</div>';
}

function matchups(team) {
  return memo('next4|' + team, () => (D.fx || []).filter(f => num(f.GW) > D.gw && (f.Home === team || f.Away === team) && !fin(f.Finished))
    .sort((a, b) => num(a.GW) - num(b.GW)).slice(0, 4).map(f => {
      const home = f.Home === team, opp = home ? f.Away : f.Home, w = hpWin(f);
      const pc = w && isFinite(w.h) ? mpxWinPct(w) : null;
      return { f, g: num(f.GW), home, opp, nm: derbyName(f.Home, f.Away), w, me: pc ? (home ? pc.h : pc.a) : null, d: pc ? pc.d : null, them: pc ? (home ? pc.a : pc.h) : null, muMe: w ? (home ? w.muH : w.muA) : null, muThem: w ? (home ? w.muA : w.muH) : null };
    }));
}
function matchupsBlock(team) {
  const rows = matchups(team);
  if (!rows.length) return UI.sh('Next four matchups') + UI.empty('No league matchups left', 'That’s the season. The final table is on League.');
  return UI.sh('Next four matchups', { aside: 'win chance' })
    + '<div class="card tm-nm">' + rows.map(r => {
      const dl = gwDeadline(r.g);
      return '<button class="row tap tm-nmr" data-open="manager:' + esc(r.opp) + '">'
        + '<span class="tm-nmg n">GW' + r.g + '</span>' + UI.crest(r.opp, 32)
        + '<span class="tm-nmm"><b>' + (r.home ? 'v ' : 'at ') + esc(r.opp) + '</b><span class="sub ell">' + (dl ? esc(dayDate(dl)) + ' · ' : '') + esc(r.nm || mgrName(r.opp)) + '</span>'
        + (r.me !== null ? UI.wbar(r.me / 100, r.d / 100, r.them / 100, ...UI.pairCols(team, r.opp), true) : '') + '</span>'
        + '<span class="tm-nmp"><b class="n">' + (r.me !== null ? r.me + '%' : '–') + '</b><span class="sub n">' + (r.muMe !== null ? f1(r.muMe) + '–' + f1(r.muThem) : '') + '</span></span>'
        + '</button>';
    }).join('')
    + '</div>';
}

export function fixturesPage(team) {
  const seg = '<div class="tm-ctl"><span class="sub">Sort</span><span class="seg" role="tablist" aria-label="Sort clubs"><button data-fsort="players" role="tab" aria-selected="' + (FIX.sort === 'players') + '"' + (FIX.sort === 'players' ? ' class="on"' : '') + '>Most starters</button><button data-fsort="easy" role="tab" aria-selected="' + (FIX.sort === 'easy') + '"' + (FIX.sort === 'easy' ? ' class="on"' : '') + '>Easiest run</button></span></div>';
  return UI.sh('Your clubs, next five', { aside: 'FPL difficulty' }) + seg + grid(team) + matchupsBlock(team);
}
