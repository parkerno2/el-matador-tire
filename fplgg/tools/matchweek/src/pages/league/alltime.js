/* League › All-time (Parker's Q5, 10 Oct 2026): every manager who has played a season, one table sortable by its main
   columns, the all-time records under it. Numbers from src/alltime.js (the history files plus this season's finished
   matches); this season's new managers are in with their one season. */
import * as UI from '../../ui.js';
import { allTime, nameOf, f1, f2, thisSeason } from '../../alltime.js';
import { tap } from './overview.js';

const esc = UI.esc;
const KEY = 'emt-lg-at';
export const COLS = [
  { id: 'p', label: 'P', v: r => r.P },
  { id: 'w', label: 'W-D-L', v: r => r.W },
  { id: 'pts', label: 'Pts', v: r => r.Pts },
  { id: 'ppm', label: 'PPM', v: r => r.ppm },
  { id: 'avg', label: 'Avg', v: r => r.avg },
];
const S = { sort: 'pts', dir: -1 };
try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && COLS.some(c => c.id === j.sort)) { S.sort = j.sort; S.dir = j.dir === 1 ? 1 : -1; } } catch (e) { }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };
export const sortState = () => ({ sort: S.sort, dir: S.dir });
export function setSort(id) {
  if (!COLS.some(c => c.id === id)) return;
  if (S.sort === id) S.dir = -S.dir; else { S.sort = id; S.dir = -1; }
  save();
}
/* the rows in the chosen order: the column, then league points, then points per match, then the code */
export function sortedRows(rows, sort, dir) {
  const col = COLS.find(c => c.id === sort) || COLS[2];
  return rows.slice().sort((p, q) => dir * (col.v(p) - col.v(q)) || q.Pts - p.Pts || q.ppm - p.ppm || p.code.localeCompare(q.code));
}
/* a manager's crest: his current team's, else his code in a circle */
export function mark(m, px) {
  return m.team ? UI.crest(m.team, px) : '<span class="at-code" style="width:' + px + 'px;height:' + px + 'px"><em>' + esc(m.code) + '</em></span>';
}
const seasonsWord = n => n + (n === 1 ? ' season' : ' seasons');
const titlesWord = n => n + (n === 1 ? ' title' : ' titles');
const when = (s, g) => s + ' GW' + g;

export function tableBlock() {
  const A = allTime(), rows = sortedRows(A.rows, S.sort, S.dir), me = UI.you();
  const th = COLS.map(c => '<button type="button" data-sort="' + c.id + '"' + (c.id === S.sort ? ' class="on" aria-sort="' + (S.dir < 0 ? 'descending' : 'ascending') + '"' : '') + '>' + c.label + '</button>').join('');
  let h = '<section class="card at-tbl" aria-label="All-time table">'
    + '<div class="at-th"><span>#</span><span></span><span>Manager</span>' + th + '</div>';
  rows.forEach((r, i) => {
    const you = r.team && r.team === me, name = nameOf(r.code);
    const lab = (i + 1) + ', ' + name + (you ? ' (you)' : '') + (r.team ? ', ' + r.team : '') + ', ' + r.P + ' played, ' + r.W + ' won ' + r.D + ' drawn ' + r.L + ' lost, ' + r.Pts + ' points, ' + f2(r.ppm) + ' a match, ' + f1(r.avg) + ' a gameweek';
    /* the team is the crest, your row its bar and tint, a title a trophy beside the name (one per title), so the lines stay whole at 360 px */
    const tt = r.titles ? '<i class="tt" role="img" aria-label="' + titlesWord(r.titles) + '">' + UI.icon('league', 12, 'currentColor', 2.2).repeat(r.titles) + '</i>' : '';
    h += '<div class="at-tr' + (you ? ' you' : '') + '"' + (r.team ? tap(r.team, lab) : ' aria-label="' + esc(lab) + '"') + '>'
      + '<span class="pos n">' + (i + 1) + '</span>' + mark(r, 30)
      + '<span class="nm"><span class="l1"><b class="ell">' + esc(name) + '</b>' + tt + '</span><span class="l2 ell">' + esc(seasonsWord(r.played)) + '</span></span>'
      + '<span class="n v' + (S.sort === 'p' ? ' on' : '') + '">' + r.P + '</span>'
      + '<span class="n v rec' + (S.sort === 'w' ? ' on' : '') + '">' + r.W + '-' + r.D + '-' + r.L + '</span>'
      + '<b class="n v pts' + (S.sort === 'pts' ? ' on' : '') + '">' + r.Pts + '</b>'
      + '<span class="n v' + (S.sort === 'ppm' ? ' on' : '') + '">' + f2(r.ppm) + '</span>'
      + '<span class="n v' + (S.sort === 'avg' ? ' on' : '') + '">' + f1(r.avg) + '</span>'
      + '</div>';
  });
  return h + '</section>';
}
export function recordsBlock() {
  const A = allTime(), R = A.records;
  if (!R.hi) return '';
  const who = code => { const m = A.managers[code]; return '<span class="w">' + mark(m, 16) + '<span>' + esc(nameOf(code)) + '</span></span>'; };
  const tile = (lab, v, w, sub) => '<div class="tile at-rec"><span class="lb">' + lab + '</span><b class="n">' + v + '</b>' + w + '<span class="sub">' + esc(sub) + '</span></div>';
  let h = '<div class="tiles at-recs">';
  h += tile('Highest score', R.hi.v.v, who(R.hi.code), when(R.hi.v.season, R.hi.v.gw) + ' v ' + nameOf(R.hi.v.opp));
  if (R.bigWin) h += tile('Biggest win', R.bigWin.v.my + '-' + R.bigWin.v.their, who(R.bigWin.code), 'by ' + R.bigWin.v.m + ', ' + when(R.bigWin.v.season, R.bigWin.v.gw) + ' v ' + nameOf(R.bigWin.v.opp));
  if (R.winRun) h += tile('Longest winning run', R.winRun.v.n, who(R.winRun.code), when(R.winRun.v.from.season, R.winRun.v.from.gw) + ' to ' + when(R.winRun.v.to.season, R.winRun.v.to.gw));
  if (R.lossRun) h += tile('Longest losing run', R.lossRun.v.n, who(R.lossRun.code), when(R.lossRun.v.from.season, R.lossRun.v.from.gw) + ' to ' + when(R.lossRun.v.to.season, R.lossRun.v.to.gw));
  return h + '</div>';
}
export function alltimePage() {
  const A = allTime();
  if (!A.rows.length) return UI.sh('All-time') + UI.empty('No seasons yet', 'The all-time table starts with the first finished gameweek.');
  const past = A.seasons.filter(s => !s.current).map(s => s.season), cur = thisSeason();
  const aside = past.length ? past.join(', ') + ' and ' + cur + ' so far' : cur + ' so far';
  return UI.sh('All-time', { aside: esc(aside) }) + tableBlock() + (A.records.hi ? UI.sh('Records') + recordsBlock() : '') + '<p class="lg-cap">Finished gameweeks only.</p>';
}
export function mountAlltime(root) {
  if (root.__lgAt) return;
  root.__lgAt = 1;
  root.addEventListener('click', e => {
    if (document.body.dataset.page !== 'league' || document.body.dataset.sub !== 'alltime') return;
    const b = e.target.closest('[data-sort]'); if (!b) return;
    e.preventDefault(); setSort(b.dataset.sort); window.MW.render({ keepScroll: true });
  });
}
