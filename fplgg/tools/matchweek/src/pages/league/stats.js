/* League › Stats (the old Lab, rebuilt): compare up to four managers across six measures, the luck index in both
   modes, the managers, the golden boot and the season's records. */
import * as UI from '../../ui.js';
import { lab, metricSeries, tiles, boot, labRecords, table, sgn, teams, ord } from './data.js';
import { lineChart } from './chart.js';
import { tap } from './overview.js';

const esc = UI.esc;
const KEY = 'emt-lg-lab';
const S = { sel: null, metric: 'pts', luck: 'perf' };
try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j) { if (Array.isArray(j.sel)) S.sel = j.sel; if (j.metric) S.metric = j.metric; if (j.luck) S.luck = j.luck; } } catch (e) { }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };

const METRICS = {
  pts: { label: 'Points', title: 'Points per gameweek', rank: 'Average per gameweek', agg: 'avg', fmt: v => String(Math.round(v)), rfmt: v => v.toFixed(1), note: 'Scores as the scoreboard counts them, auto-subs included.' },
  race: { label: 'Race', title: 'League points, week by week', rank: 'Table points', agg: 'last', fmt: v => String(v), rfmt: v => String(v), floor0: 1, note: 'Three for a win, one for a draw. The table’s own tiebreak, points for, isn’t drawn.' },
  luck: { label: 'Luck', title: 'Luck per gameweek', rank: 'Season luck', agg: 'sum', zero: 1, fmt: v => sgn(v), rfmt: v => sgn(v), note: 'Points minus xP, the points the XI’s performance deserved. Bonus is left out of both. Above the line, the ball bounced your way.' },
  margin: { label: 'Margin', title: 'Winning margin per gameweek', rank: 'Season margin', agg: 'sum', zero: 1, fmt: v => sgn(v, 0), rfmt: v => sgn(v, 0), note: 'Your score minus your opponent’s. Above the line is a win.' },
  pa: { label: 'Against', title: 'Points against per gameweek', rank: 'Average against', agg: 'avg', fmt: v => String(Math.round(v)), rfmt: v => v.toFixed(1), note: 'What your opponent scored each week. Low is lucky.' },
  bench: { label: 'Bench', title: 'Points left on the bench', rank: 'Season bench points', agg: 'sum', floor0: 1, fmt: v => String(Math.round(v)), rfmt: v => String(Math.round(v)), note: 'Points scored by players who started the week on your bench and didn’t come on.' },
};

function selection() {
  const me = UI.you(), ok = (S.sel || []).filter(t => TEAMS[t]).slice(0, 4);
  if (ok.length) return ok;
  return [me || table()[0].team];
}
/* comparison colours: you in blue, everyone else in the house greys and purples, never team colours side by side */
const CMP = ['var(--opp)', 'var(--p300)', 'var(--p500)', 'var(--p100)'];
function colorOf(t, me) {
  if (t === me) return 'var(--you)';
  const others = selection().filter(x => x !== me), i = others.indexOf(t);
  return CMP[i < 0 ? 0 : i % CMP.length];
}

function compare() {
  const me = UI.you(), sel = selection(), M = METRICS[S.metric] || METRICS.pts, key = METRICS[S.metric] ? S.metric : 'pts';
  const ser = teams().map(t => ({ key: t, label: UI.short(t), color: colorOf(t, me), on: sel.includes(t), vals: metricSeries(t, key) }));
  const xs = [...new Set(ser.flatMap(s => s.vals.map(v => v.g)))].sort((a, b) => a - b);
  const chips = table().map(r => {
    const t = r.team, on = sel.includes(t);
    return '<button class="lg-pick' + (on ? ' on' : '') + '" data-pick="' + esc(t) + '" aria-pressed="' + on + '" style="--c:' + colorOf(t, me) + '">' + UI.crest(t, 24) + '<span>' + esc(UI.short(t)) + '</span></button>';
  }).join('');
  const mets = Object.keys(METRICS).map(k => '<button class="' + (k === key ? 'on' : '') + '" data-metric="' + k + '" aria-pressed="' + (k === key) + '">' + METRICS[k].label + '</button>').join('');
  /* the season ranking under the chart doubles as the chart's table */
  const rank = ser.map(s => {
    const v = s.vals; if (!v.length) return { s, v: null };
    const val = M.agg === 'avg' ? v.reduce((a, b) => a + b.v, 0) / v.length : M.agg === 'last' ? v[v.length - 1].v : v.reduce((a, b) => a + b.v, 0);
    return { s, v: val };
  }).filter(r => r.v != null).sort((a, b) => b.v - a.v);
  const mx = Math.max(0.001, ...rank.map(r => Math.abs(r.v)));
  const signed = M.zero;
  const rankH = rank.map((r, i) => {
    const w = Math.abs(r.v) / mx * (signed ? 50 : 100);
    const bar = signed ? '<span class="bar dv"><i style="' + (r.v >= 0 ? 'left:50%' : 'right:50%') + ';width:' + w.toFixed(1) + '%;background:' + (r.s.on ? r.s.color : 'var(--tx4)') + '"></i></span>'
      : '<span class="bar"><i style="width:' + Math.max(1.5, w).toFixed(1) + '%;background:' + (r.s.on ? r.s.color : 'var(--tx4)') + '"></i></span>';
    return '<button class="r' + (r.s.on ? ' on' : '') + (r.s.key === me ? ' you' : '') + '" data-pick="' + esc(r.s.key) + '" aria-pressed="' + r.s.on + '"><span class="i n">' + (i + 1) + '</span>' + UI.crest(r.s.key, 18) + '<span class="nm">' + esc(r.s.label) + '</span>' + bar + '<b class="n">' + M.rfmt(r.v) + '</b></button>';
  }).join('');
  const anyLive = ser.some(s => s.on && s.vals.some(v => v.live));
  const chart = xs.length ? lineChart({ id: 'lg-ch', xs, series: ser, fmt: M.fmt, zero: M.zero, floor0: M.floor0, label: M.title + ' for ' + sel.map(UI.short).join(', ') }) : UI.empty('Nothing to draw yet', 'The chart starts once gameweek 1 has scores.');
  return UI.sh('Compare managers', { aside: sel.length + ' of 4 picked' })
    + '<div class="card lg-lab">'
    + '<div class="lg-picks" role="group" aria-label="Pick up to four managers">' + chips + '</div>'
    + '<div class="lg-mets" role="group" aria-label="Measure">' + mets + '</div>'
    + '<div class="lg-ct"><b>' + esc(M.title) + '</b><span>Tap or drag the chart to read a gameweek</span></div>'
    + chart
    + '<div class="lg-rank"><div class="hd"><span>' + esc(M.rank) + '</span><span>Tap to compare</span></div>' + rankH + '</div>'
    + '<div class="foot">' + esc(M.note) + (anyLive ? ' A hollow dot is the live week.' : '') + ' A fifth pick replaces the first.</div>'
    + '</div>';
}

function luckCard() {
  const { luck, sched } = lab(), me = UI.you(), perf = S.luck !== 'sched';
  const rows = perf
    ? Object.keys(luck).filter(t => TEAMS[t]).map(t => ({ t, d: luck[t].act - luck[t].x, sub: Math.round(luck[t].act) + ' · xP ' + luck[t].x.toFixed(1) }))
    : Object.keys(sched).filter(t => TEAMS[t]).map(t => { const s = sched[t]; return { t, d: s.pts - s.ap, sub: 'beats ' + (Math.round(s.beat * 10) / 10) + ' of ' + s.opp + (s.cw + s.cd + s.cl ? ' · close ' + s.cw + '–' + s.cd + '–' + s.cl + ' W–D–L' : '') }; });
  rows.sort((a, b) => b.d - a.d);
  const tog = '<div class="seg lg-seg" role="group" aria-label="Luck measure"><button class="' + (perf ? 'on' : '') + '" data-luck="perf" aria-pressed="' + perf + '">Performance</button><button class="' + (!perf ? 'on' : '') + '" data-luck="sched" aria-pressed="' + !perf + '">Results</button></div>';
  if (!rows.length) return UI.sh('Luck index') + UI.empty('No luck to measure yet', 'It starts once gameweek 1 is played.');
  const mx = Math.max(0.1, ...rows.map(r => Math.abs(r.d)));
  const body = rows.map(r => '<div class="lg-lk' + (r.t === me ? ' you' : '') + '"' + tap(r.t, r.t + ', ' + sgn(r.d)) + '>' + UI.crest(r.t, 20)
    + '<span class="nm"><b>' + esc(UI.short(r.t)) + '</b><span>' + esc(r.sub) + '</span></span>'
    + '<span class="dv"><i class="' + (r.d >= 0 ? 'p' : 'm') + '" style="width:' + (Math.abs(r.d) / mx * 50).toFixed(1) + '%"></i></span>'
    + '<b class="v n">' + sgn(r.d) + '</b></div>').join('');
  const cap = perf
    ? 'Performance: points scored minus xP, the points each XI’s performances deserved, season to date. Bonus is left out of both. Right of the line, the ball has bounced your way; left, you deserved more.'
    : 'Results: league points banked minus what an all-play schedule would have given, your score against all seven rivals every week (3 for a win, 1 for a draw, scaled to one game). Right of the line, the fixture list has been kind. Close counts games decided by ' + CLOSE_MARGIN + ' or fewer.';
  return '<div class="sh"><h2>Luck index</h2><span class="aside">' + tog + '</span></div>'
    + '<div class="card lg-luck"><div class="ax"><span>Unlucky</span><span>Lucky</span></div>' + body + '<div class="foot">' + esc(cap) + ' The two are never added together.</div></div>';
}

function managerTiles() {
  const T = tiles(), me = UI.you();
  return UI.sh('The managers') + '<div class="lg-mts">' + T.map(r => {
    const star = r.star;
    return '<div class="lg-mt' + (r.team === me ? ' you' : '') + '"' + tap(r.team, r.team + ', open the team') + '>'
      + UI.glow(r.team, 'left', .32, 150)
      + '<div class="top">' + UI.crest(r.team, 32) + '<span class="tx"><b>' + esc(r.team) + '</b><span>' + esc(r.mgr) + ' · ' + ord(r.pos) + '</span></span></div>'
      + '<div class="st"><span><b class="n">' + (r.avg == null ? '–' : r.avg.toFixed(1)) + '</b><i>per GW</i></span><span><b class="n">' + (r.best || '–') + '</b><i>best GW</i></span><span><b class="n">' + r.w + '–' + r.d + '–' + r.l + '</b><i>W–D–L</i></span></div>'
      + (star && r.starPts > 0 ? '<div class="star">' + UI.face(star, 30) + '<span><i>Star man · <em class="n">' + r.starPts + ' pts started</em></i><b>' + esc(star.Player) + '</b></span></div>' : '')
      + '</div>';
  }).join('') + '</div>';
}

function goldenBoot() {
  const rows = boot(), me = UI.you();
  if (!rows.length) return '';
  const mx = Math.max(1, ...rows.map(r => r.xi));
  return UI.sh('Golden boot', { aside: 'Started points only' }) + '<div class="card lg-boot">' + rows.map((p, i) => {
    const pl = UI.player(p.code) || { Code: p.code, Player: p.name };
    return '<div class="r' + (p.owner === me ? ' you' : '') + '" data-open="player:' + esc(p.code) + '" role="button" tabindex="0" aria-label="' + esc(p.name + ', ' + p.xi + ' points started, ' + p.owner) + '">'
      + '<span class="i n">' + (i + 1) + '</span>' + UI.face(pl, 34)
      + '<span class="nm"><b>' + esc(p.name) + '</b><span>' + UI.crest(p.owner, 14) + esc(UI.short(p.owner)) + (p.bench ? ' · +' + p.bench + ' on the bench' : '') + '</span></span>'
      + '<span class="bar"><i style="width:' + (p.xi / mx * 100).toFixed(1) + '%"></i></span><b class="v n">' + Math.round(p.xi) + '</b></div>';
  }).join('') + '<div class="foot">Only weeks a player was in the starting XI count for his manager. A benched haul counts for nothing.</div></div>';
}

function recs() {
  const R = labRecords();
  if (!R.haul && !R.ben && !R.run && !R.loss) return '';
  const tile = (lab, v, lines) => '<div class="tile lg-rec"><span class="lb">' + lab + '</span><b class="n">' + v + '</b>' + lines + '</div>';
  const line = (t, txt) => '<span class="w">' + UI.crest(t, 16) + '<span>' + txt + '</span></span>';
  const cap = (list, f) => list.slice(0, 3).map(f).join('') + (list.length > 3 ? '<span class="w more">and ' + (list.length - 3) + ' more</span>' : '');
  return UI.sh('Season records') + '<div class="tiles lg-recs">'
    + (R.haul ? tile('Biggest haul', R.haul.v, cap(R.haul.who, x => line(x.t, esc(x.name) + ' · GW' + x.g))) : '')
    + (R.ben ? tile('Most left on the bench', R.ben.v, cap(R.ben.who, x => line(x.t, esc(UI.short(x.t)) + ' · GW' + x.g))) : '')
    + (R.run ? tile('Longest winning run', R.run.v, cap(R.run.who, x => line(x.t, esc(UI.short(x.t)) + ' · GW' + x.from + '–' + x.to))) : '')
    + (R.loss ? tile('Best score in a defeat', R.loss.v, cap(R.loss.who, x => line(x.t, esc(UI.short(x.t)) + ' · ' + R.loss.v + '–' + x.op + ' v ' + esc(UI.short(x.o)) + ', GW' + x.g))) : '')
    + '</div><p class="lg-cap">Finished gameweeks only. A haul counts when the player started.</p>';
}

export function statsPage() {
  const any = teams().some(t => (lab().ser[t] || []).length);
  if (!any) return '<div style="height:12px"></div>' + UI.empty('The stats start after gameweek 1', 'Charts, luck and records draw themselves once the first scores land.') + managerTiles();
  return compare() + luckCard() + managerTiles() + goldenBoot() + recs();
}

/* ---------- interactions ---------- */
function pick(t) {
  const sel = selection().slice(), i = sel.indexOf(t);
  if (i >= 0) { if (sel.length > 1) sel.splice(i, 1); }
  else { if (sel.length >= 4) sel.shift(); sel.push(t); }
  S.sel = sel; save(); window.MW.render({ keepScroll: true });
}
function setIdx(ch, i) {
  const n = +ch.dataset.n; i = Math.max(0, Math.min(n - 1, i));
  ch.dataset.i = i;
  ch.querySelectorAll('.ro').forEach(r => { r.hidden = +r.dataset.i !== i; });
  const L = +ch.dataset.l, R = +ch.dataset.r, W = +ch.dataset.w, x = n === 1 ? L + (W - L - R) / 2 : L + i * (W - L - R) / (n - 1);
  const cx = ch.querySelector('.cx'); if (cx) { cx.setAttribute('x1', x.toFixed(1)); cx.setAttribute('x2', x.toFixed(1)); cx.classList.toggle('show', i !== n - 1); }
}
function idxFromEvent(ch, e) {
  const svg = ch.querySelector('svg'), b = svg.getBoundingClientRect(), n = +ch.dataset.n;
  const L = +ch.dataset.l, R = +ch.dataset.r, W = +ch.dataset.w;
  const x = (e.clientX - b.left) / b.width * W;
  return n === 1 ? 0 : Math.round((x - L) / ((W - L - R) / (n - 1)));
}
export function mountStats(root) {
  if (root.__lgStats) return;
  root.__lgStats = 1;
  root.addEventListener('click', e => {
    if (document.body.dataset.page !== 'league' || document.body.dataset.sub !== 'stats') return;
    const p = e.target.closest('[data-pick]'); if (p) { e.preventDefault(); pick(p.dataset.pick); return; }
    const m = e.target.closest('[data-metric]'); if (m) { S.metric = m.dataset.metric; save(); window.MW.render({ keepScroll: true }); return; }
    const l = e.target.closest('[data-luck]'); if (l) { S.luck = l.dataset.luck; save(); window.MW.render({ keepScroll: true }); }
  });
  let drag = false;
  root.addEventListener('pointerdown', e => { const ch = e.target.closest('.lg-chart'); if (!ch) return; drag = true; setIdx(ch, idxFromEvent(ch, e)); });
  root.addEventListener('pointermove', e => { const ch = e.target.closest('.lg-chart'); if (!ch || (!drag && e.pointerType !== 'mouse')) return; setIdx(ch, idxFromEvent(ch, e)); });
  addEventListener('pointerup', () => { drag = false; });
  root.addEventListener('keydown', e => {
    const ch = e.target.closest && e.target.closest('.lg-chart'); if (!ch) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setIdx(ch, (ch.dataset.i != null ? +ch.dataset.i : +ch.dataset.n - 1) + (e.key === 'ArrowLeft' ? -1 : 1)); }
  });
}
