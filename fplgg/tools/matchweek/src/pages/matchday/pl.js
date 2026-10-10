/* matchday/pl.js — this gameweek's Premier League games by kick-off, with every league player in each one */
import * as UI from '../../ui.js';
import * as M from './model.js';

const esc = UI.esc;
export const PLS = { open: new Set(), all: false };
const key = x => x.Home + '|' + x.Away;

/* everyone rostered at a club: effective XI first, then bench; by owner, then points (the old fxPlayers order) */
function clubPlayers(club) {
  return M.memo('clubpl|' + club, () => {
    const xiSet = new Set(); Object.keys(TEAMS).forEach(t => M.team(t).xiL.forEach(p => xiSet.add(t + '|' + p.Code)));
    const likely = new Set(); Object.keys(TEAMS).forEach(t => M.team(t).xi.forEach(p => likely.add(t + '|' + p.Code)));
    return (D.ro || []).filter(p => p.Club === club && TEAMS[p.Team]).map(p => {
      const k = p.Team + '|' + p.Code, xi = (D.dlPassed || D.provOver) ? xiSet.has(k) : likely.has(k);
      return { p, xi, x: M.pl(p) };
    }).sort((a, b) => (b.xi - a.xi) || String(a.p.Team).localeCompare(String(b.p.Team)) || b.x.pts - a.x.pts || (b.x.proj || 0) - (a.x.proj || 0));
  });
}
function bub(o) {
  const x = o.x;
  if (!x.started) return '<span class="md-pv2 pj"><b class="n">' + (x.proj === null ? '–' : M.f1(x.proj)) + '</b><i>PROJ</i></span>';
  const lab = x.dgw ? 'GW' : x.finished ? 'PTS' : 'LIVE';
  return '<span class="md-pv2 ' + (x.finished ? 'bk' : 'lv') + '"><b class="n">' + M.int(x.pts) + '</b><i>' + lab + '</i></span>';
}
function prow(o) {
  const p = o.p, x = o.x, me = UI.you() === p.Team;
  return '<div class="md-pp' + (o.xi ? '' : ' bn') + (me ? ' me' : '') + '" data-open="player:' + esc(p.Code) + '" role="button" tabindex="0">'
    + UI.crest(p.Team, 16) + UI.face(p, 26) + '<span class="ell"><b>' + esc(p.Player) + '</b><span class="sub">' + esc(SHORTOF[p.Team] || p.Team) + ' · ' + esc(String(p.Pos).slice(0, 3)) + (o.xi ? '' : ' · bench') + (x.dgw ? ' · 2 games' : '') + '</span></span>' + bub(o) + '</div>';
}
function fxRow(x) {
  const k = key(x), open = PLS.all || PLS.open.has(k);
  const done = fin(x.Finished), live = M.liveFx(x), sc = M.hasScore(x);
  const hp = clubPlayers(x.Home), ap = clubPlayers(x.Away);
  const nXI = hp.filter(o => o.xi).length + ap.filter(o => o.xi).length, nAll = hp.length + ap.length;
  const ko = M.koOf(x);
  const st = done ? '<span class="md-pst">FT</span>' : live ? '<span class="md-pst lv">' + Math.round(num(x.Mins)) + '’</span>' : '';
  const mid = '<span class="md-pm">' + (sc ? '<b class="n md-ps">' + num(x['Home goals']) + '<i>–</i>' + num(x['Away goals']) + '</b>' : '<span class="n md-pk">' + esc(M.tTime(ko)) + '</span>') + st + '</span>';
  /* your men in this game, before you open it */
  const me = UI.you();
  const mine = me ? hp.concat(ap).filter(o => o.p.Team === me && o.xi) : [];
  const side = (list, club) => '<div class="md-px"><div class="md-pxh">' + UI.badge(club, 16) + esc(clubName(club)) + '</div>' + (list.length ? list.map(prow).join('') : '<span class="sub md-pxn">No league players</span>') + '</div>';
  return '<div class="md-pr' + (open ? ' open' : '') + (live ? ' live' : '') + '">'
    + '<button class="md-prb" data-md-pl="' + esc(k) + '" aria-expanded="' + open + '">'
    + '<span class="md-pc">' + UI.badge(x.Home, 20) + '<b>' + esc(x.Home) + '</b></span>' + mid + '<span class="md-pc r"><b>' + esc(x.Away) + '</b>' + UI.badge(x.Away, 20) + '</span>'
    + '<span class="md-pn" title="League starters in this game">' + nXI + '<i>/' + nAll + '</i></span>' + UI.icon('chev', 14, 'var(--tx3)') + '</button>'
    + (mine.length && !open ? '<div class="md-pmine">' + UI.crest(me, 14) + mine.map(o => esc(o.p.Player) + (o.x.started ? ' <b class="n">' + M.int(o.x.pts) + '</b>' : '')).join(' · ') + '</div>' : '')
    + (open ? '<div class="md-pxs">' + side(hp, x.Home) + side(ap, x.Away) + '</div>' : '')
    + '</div>';
}
function snapshot(rows) {
  const live = rows.filter(M.liveFx); if (!live.length) return '';
  const clubs = new Set(live.flatMap(x => [x.Home, x.Away]));
  const per = {}; let tot = 0;
  Object.keys(TEAMS).forEach(t => M.team(t).xiL.forEach(p => { if (clubs.has(p.Club)) { per[t] = (per[t] || 0) + 1; tot++; } }));
  const me = UI.you();
  const chips = Object.keys(per).sort((a, b) => per[b] - per[a] || a.localeCompare(b)).map(t => '<span class="md-snc' + (t === me ? ' me' : '') + '" data-open="manager:' + esc(t) + '" role="button" tabindex="0">' + UI.crest(t, 18) + '<b class="n">' + per[t] + '</b></span>').join('');
  return UI.sh('On the pitch now') + '<div class="card pad md-snap"><div class="md-snh"><span class="live-dot"><i></i>LIVE</span><span><b class="n">' + tot + '</b> league starter' + (tot === 1 ? '' : 's') + ' in <b class="n">' + live.length + '</b> live game' + (live.length === 1 ? '' : 's') + '</span></div><div class="md-sncs">' + chips + '</div></div>';
}
export function render() {
  const rows = M.gwCf();
  if (!rows.length) return '<div style="height:12px"></div>' + UI.empty('No Premier League fixtures', 'The fixture list for Gameweek ' + D.gw + ' isn’t in the sheet yet.');
  const done = rows.filter(x => fin(x.Finished)).length, live = rows.filter(M.liveFx).length, left = rows.length - done - live;
  const days = []; rows.forEach(x => { const d = M.koOf(x), k = M.dayKey(d); let g = days.find(y => y.k === k); if (!g) { g = { k, d, list: [] }; days.push(g); } g.list.push(x); });
  const summary = [done ? done + ' finished' : '', live ? live + ' live' : '', left ? left + ' still to come' : ''].filter(Boolean).join(', ');
  return snapshot(rows)
    + UI.sh('Gameweek ' + D.gw + ' fixtures', { aside: '<button class="md-all" data-md-plall="1">' + (PLS.all ? 'Hide all' : 'Show all') + '</button>' })
    + '<p class="md-cap top">' + esc(summary.charAt(0).toUpperCase() + summary.slice(1)) + '.</p>'
    + days.map(g => '<div class="md-day">' + esc(g.d ? M.tDayLong(g.d) : 'Date to be confirmed') + '</div><div class="card md-pl">' + g.list.map(fxRow).join('') + '</div>').join('');
}
