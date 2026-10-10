/* matchday/all.js — every matchup this gameweek, rich rows, then the next gameweek */
import * as UI from '../../ui.js';
import * as M from './model.js';
import { stateTag, nums, winBar, seriesText, seriesHTML, resultLine, nameHTML, pairHTML, wdl } from './overview.js';

const esc = UI.esc;

function card(m) {
  const n = nums(m), pl = M.projLine(m), href = '#/matchday/matchup/' + m.i;
  const rec = T => T.rec && T.rec.played ? ORD(T.rec.pos) + ' · ' + wdl(T.rec) : '';
  const side = (T, r) => '<div class="md-as' + (r ? ' r' : '') + '">' + UI.crest(T.t, 36) + '<b>' + esc(T.t) + '</b><span class="sub">' + esc(M.who(m, T.t)) + '</span><span class="sub n">' + esc(rec(T)) + '</span></div>';
  let foot = [];
  if (m.ph === 'live') foot.push('<span><b class="n">' + m.tl.toPlay.length + '</b> to play</span>', pl ? '<span>Proj final <b class="n">' + M.f1(pl.l) + '–' + M.f1(pl.r) + '</b></span>' : '', '<span><b class="n">' + m.tr.toPlay.length + '</b> to play</span>');
  else if (m.final) foot.push('<span>' + resultLine(m) + '</span>', pl ? '<span>xP <b class="n">' + M.f1(pl.l) + '–' + M.f1(pl.r) + '</b></span>' : '');
  else foot.push('<span>' + seriesHTML(m.series || '') + '</span>');
  return '<a class="card md-ac' + (m.mine ? ' md-mine' : '') + '" href="' + href + '">' + UI.glow(m.L, 'left', .28, 180) + UI.glow(m.R, 'right', .2, 180)
    + '<div class="md-ack">' + (m.mine ? '<span class="md-you">YOU</span>' : '') + '<span class="wide">' + (m.derby ? esc(m.derby) : esc(FIRSTOF(m.L) + ' v ' + FIRSTOF(m.R))) + '</span>' + stateTag(m) + '</div>'
    + '<div class="md-acv">' + side(m.tl) + '<div class="md-acs"><div class="n md-acb' + (n.dec ? ' dec' : '') + '">' + pairHTML(n, m.final && +n.l < +n.r, m.final && +n.r < +n.l) + '</div>'
    + (m.ph === 'live' || m.final ? '<span class="sub">' + seriesHTML(m.series || '') + '</span>' : '') + '</div>' + side(m.tr, 1) + '</div>'
    + (m.win ? '<div class="md-acw"><b class="n' + (m.mine ? ' you-c' : '') + '">' + m.win.l + '%</b><div>' + winBar(m) + '<span class="sub">win chance · draw ' + m.win.d + '%</span></div><b class="n">' + m.win.r + '%</b></div>' : '')
    + '<div class="md-acf">' + foot.filter(Boolean).join('') + '</div></a>';
}

function nextGw() {
  const g = D.gw + 1, rows = (D.fx || []).filter(f => num(f.GW) === g);
  if (!rows.length) return '';
  const dl = gwDeadline(g), me = UI.you();
  const order = rows.map((f, i) => ({ f, i })).sort((a, b) => ((me && (b.f.Home === me || b.f.Away === me)) ? 1 : 0) - ((me && (a.f.Home === me || a.f.Away === me)) ? 1 : 0) || a.i - b.i);
  const list = order.map(({ f }) => {
    const flip = me === f.Away, L = flip ? f.Away : f.Home, R = flip ? f.Home : f.Away, mine = me === L;
    let a = null, b = null, w = null;
    try { a = hpTeam(L, g); b = hpTeam(R, g); const ww = hpWin(f), pc = mpxWinPct(ww); w = flip ? { l: pc.a, d: pc.d, r: pc.h } : { l: pc.h, d: pc.d, r: pc.a }; } catch (e) { }
    const ok = a !== null && b !== null && isFinite(a) && isFinite(b);
    const nm = derbyName(f.Home, f.Away), sr = series(f.Home, f.Away);
    const side = (t, r) => '<div class="md-mt' + (r ? ' r' : '') + '" data-open="manager:' + esc(t) + '">' + (r ? '' : UI.crest(t, 24)) + nameHTML(t) + (r ? UI.crest(t, 24) : '') + '</div>';
    return '<div class="md-mr md-nx' + (mine ? ' md-mine' : '') + '">' + (nm || mine ? '<div class="md-dt">' + (mine ? '<span class="md-you">YOU</span>' : '') + (nm ? '<span>' + esc(nm) + '</span>' : '') + '<i></i></div>' : '')
      + '<div class="md-mg">' + side(L) + '<div class="md-ms n dec">' + (ok ? M.f1(a) + '<i>–</i>' + M.f1(b) : 'v') + '</div>' + side(R, 1) + '</div>'
      + (w && ok ? '<div class="md-wb"><span class="n' + (mine ? ' you-c' : ' l') + '">' + w.l + '%</span>' + UI.wbar(w.l / 100, w.d / 100, w.r / 100, ...UI.pairCols(L, R), true) + '<span class="n">' + w.r + '%</span></div>' : '')
      + (sr ? '<div class="sub md-nxs">' + seriesHTML(sr) + '</div>' : '')
      + '</div>';
  }).join('');
  return UI.sh('Gameweek ' + g, { aside: dl ? 'Deadline ' + esc(M.tFull(dl)) : '' })
    + '<div class="card md-mlist">' + list + '</div>';
}

export function render() {
  const fx = M.gwFx();
  if (!fx.length) return '<div style="height:12px"></div>' + UI.empty('No matchups this gameweek', 'The fixtures for Gameweek ' + D.gw + ' aren’t in the sheet yet.') + nextGw();
  const yi = M.youIndex();
  const order = fx.map((f, i) => i).sort((a, b) => (b === yi) - (a === yi) || a - b);
  const ms = order.map(M.mx);
  const ph = M.phase();
  const lead = { pre: 'Predicted until the deadline' + (M.deadline() ? ', ' + M.tFull(M.deadline()) : '') + '.', locked: '', live: '', prov: 'All matches finished. Provisional until FPL confirms.', ft: '' }[ph] || '';
  return UI.sh('Gameweek ' + D.gw, { aside: ms.length + ' matchups' }) + (lead ? '<p class="md-cap top">' + esc(lead) + '</p>' : '')
    + '<div class="md-acs-list">' + ms.map(card).join('') + '</div>'
    + nextGw();
}
