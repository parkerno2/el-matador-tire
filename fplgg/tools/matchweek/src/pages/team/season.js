/* My team · Season: summary, results by gameweek, points v expected, luck (two parts), table position, star man, season numbers. */
import * as UI from '../../ui.js';
import { esc, memo, f1, sgn, ord, results, stRow, mgrName, plrRow, luck, sched, asOf } from './bits.js';

export const SEL = { gw: null };

function summary(team, R) {
  const done = R.filter(r => !r.live);
  const st = stRow(team), pf = num(st['Pts For']);
  const pfMap = Object.fromEntries((D.st || []).map(s => [s.Team, num(s['Pts For'])]));
  const pfRank = 1 + Object.keys(pfMap).filter(t => pfMap[t] > pf).length;
  const avg = done.length ? done.reduce((s, r) => s + r.my, 0) / done.length : 0;
  const best = done.slice().sort((a, b) => b.my - a.my || a.g - b.g)[0], worst = done.slice().sort((a, b) => a.my - b.my || a.g - b.g)[0];
  const lgAvg = (() => { const a = []; (D.fx || []).forEach(f => { if (fin(f.Finished)) a.push(num(f['Home pts']), num(f['Away pts'])); }); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; })();
  const tile = (lb, v, cm) => '<div class="tile"><span class="lb">' + lb + '</span><b class="n">' + v + '</b><span class="cm">' + cm + '</span></div>';
  return '<div class="tiles tm-tiles">'
    + tile('Points for', pf, ord(pfRank) + ' in the league')
    + tile('Average', done.length ? f1(avg) : '–', done.length ? 'a gameweek · league ' + f1(lgAvg) : 'no gameweeks yet')
    + tile('Best gameweek', best ? best.my : '–', best ? 'GW' + best.g + ' ' + (best.home ? 'v ' : 'at ') + esc(UI.short(best.opp)) + ' · ' + (best.res === 'W' ? 'won' : best.res === 'L' ? 'lost' : 'drew') : '–')
    + tile('Worst gameweek', worst ? worst.my : '–', worst ? 'GW' + worst.g + ' ' + (worst.home ? 'v ' : 'at ') + esc(UI.short(worst.opp)) + ' · ' + (worst.res === 'W' ? 'won' : worst.res === 'L' ? 'lost' : 'drew') : '–')
    + '</div>';
}

function resultsBlock(team, R) {
  const T = { w: 0, d: 0, l: 0, pf: 0, pa: 0 };
  const rows = R.slice().reverse().map(r => {
    const lv = r.live && !D.provOver;   /* at provisional full time the result stands, marked provisional */
    if (!lv) T[r.res.toLowerCase()]++;
    T.pf += r.my; T.pa += r.their;
    const chip = lv ? '<span class="fm lv">LIVE</span>' : '<span class="fm ' + r.res.toLowerCase() + (r.live ? ' prov' : '') + '"' + (r.live ? ' title="Provisional until FPL confirms"' : '') + '>' + r.res + '</span>';
    return '<button class="row tap tm-rr" data-open="manager:' + esc(r.opp) + '">'
      + '<span class="tm-rg n">GW' + r.g + '</span>' + chip
      + '<span class="tm-rs n">' + r.my + '<i>–</i>' + r.their + '</span>'
      + UI.crest(r.opp, 24)
      + '<span class="tm-ro"><b class="ell">' + (r.home ? 'v ' : 'at ') + '<span class="tm-full">' + esc(r.opp) + '</span><span class="tm-short">' + esc(UI.short(r.opp)) + '</span></b>' + (r.nm ? '<span class="sub ell">' + esc(r.nm) + '</span>' : '') + '</span>'
      + '<span class="tm-rp"><b class="n">' + ord(r.pos) + (r.live ? '*' : '') + '</b><span class="sub">after</span></span></button>';
  }).join('');
  const anyLive = R.some(r => r.live);
  return UI.sh('Results', { aside: T.w + '–' + T.d + '–' + T.l + ' W–D–L' })
    + '<div class="card tm-rl">' + rows + (anyLive ? '<div class="foot">* live, it moves until FPL confirms.</div>' : '') + '</div>';
}

/* points (bonus excluded) v xP per gameweek: columns with an expected tick; tap a column for the numbers */
function xpChart(team) {
  const A = luck()[team];
  const gws = A ? Object.keys(A.gws).map(Number).sort((a, b) => a - b) : [];
  if (!gws.length) return UI.sh('Points v expected') + UI.empty('Nothing to chart yet', 'This fills in once gameweek stats arrive.');
  const vals = gws.map(g => ({ g, a: A.gws[g].act, x: A.gws[g].x, live: g === D.gw && !D.provOver && D.liveNow }));
  const mx = Math.max(10, ...vals.map(v => Math.max(v.a, v.x)));
  const top = Math.ceil(mx / 10) * 10;
  const sel = vals.find(v => v.g === SEL.gw) || vals[vals.length - 1];
  const every = gws.length > 20 ? 5 : gws.length > 10 ? 2 : 1;
  const cols = vals.map((v, i) => '<button class="tm-xc' + (v.g === sel.g ? ' on' : '') + (v.live ? ' live' : '') + '" data-xgw="' + v.g + '" data-a="' + v.a + '" data-x="' + f1(v.x) + '" aria-label="GW' + v.g + ': ' + v.a + ' points excluding bonus, ' + f1(v.x) + ' expected">'
    + '<span class="tm-xb" style="height:' + (v.a / top * 100).toFixed(1) + '%"></span>'
    + '<span class="tm-xt" style="bottom:' + (v.x / top * 100).toFixed(1) + '%"></span>'
    + '<span class="tm-xg n">' + ((i % every === 0 || i === vals.length - 1) ? v.g : '') + '</span></button>').join('');
  const read = v => '<b>GW' + v.g + (v.live ? ' (live)' : '') + '</b> <span class="n">' + v.a + '</span> scored, <span class="n">' + f1(v.x) + '</span> expected, <span class="' + (v.a - v.x >= 0 ? 'win-c' : 'loss-c') + ' n">' + sgn(v.a - v.x) + '</span>';
  return UI.sh('Points v expected', { aside: 'bonus left out' })
    + '<div class="card tm-xch">'
    + '<div class="tm-xleg"><span><i class="b"></i>Points</span><span><i class="t"></i>Expected (xP)</span></div>'
    + '<div class="tm-xplot"><div class="tm-xax n" aria-hidden="true"><span style="bottom:100%">' + top + '</span><span style="bottom:50%">' + top / 2 + '</span><span style="bottom:0">0</span></div>'
    + '<div class="tm-xcols"><i class="tm-xgl" style="bottom:0"></i><i class="tm-xgl" style="bottom:50%"></i><i class="tm-xgl" style="bottom:100%"></i>' + cols + '</div></div>'
    + '<div class="tm-xread sub" aria-live="polite">' + read(sel) + '</div>'
    + '</div>';
}

function luckBlock(team) {
  const P = luck()[team], S = sched()[team];
  if (!P && !S) return '';
  const card = (lb, d, unit, line, more) => '<div class="tile tm-lk"><span class="lb">' + lb + '</span><b class="n ' + (d >= 0.05 ? 'win-c' : d <= -0.05 ? 'loss-c' : '') + '">' + sgn(d) + '</b>' + (unit ? '<span class="cm">' + unit + '</span>' : '') + '<span class="tm-lkl">' + line + '</span>' + (more ? '<span class="cm">' + more + '</span>' : '') + '</div>';
  const pD = P ? P.act - P.x : 0, sD = S ? S.pts - S.ap : 0;
  return UI.sh('Luck')
    + '<div class="tiles tm-lks">'
    + (P ? card('Performance', pD, '', '<span class="n">' + Math.round(P.act) + '</span> scored, <span class="n">' + f1(P.x) + '</span> expected.', '') : '')
    + (S ? card('Results', sD, '', '<span class="n">' + S.pts + '</span> banked, <span class="n">' + f1(S.ap) + '</span> if you played all seven every week.', 'You beat ' + f1(S.beat).replace(/\.0$/, '') + ' of ' + S.opp + ' scores. Close games ' + S.cw + '–' + S.cd + '–' + S.cl + ' (W–D–L).') : '')
    + '</div>';
}

function posChart(team, R) {
  const pts = R.map(r => ({ g: r.g, p: r.pos, live: r.live }));
  if (pts.length < 2) return '';
  const W = 340, H = 150, L = 26, Rr = 14, T = 12, B = 22, n = pts.length;
  const x = i => L + (n < 2 ? (W - L - Rr) / 2 : i * (W - L - Rr) / (n - 1)), y = p => T + (p - 1) * (H - T - B) / 7;
  const every = n > 20 ? 5 : n > 10 ? 2 : 1;
  const grid = [1, 4, 8].map(p => '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(p) + '" y2="' + y(p) + '" stroke="var(--hair)" stroke-width="1"/><text x="' + (L - 8) + '" y="' + (y(p) + 4) + '" text-anchor="end" class="tm-ax">' + ord(p) + '</text>').join('');
  const line = '<polyline points="' + pts.map((d, i) => x(i) + ',' + y(d.p)).join(' ') + '" fill="none" stroke="var(--p300)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
  const dots = pts.map((d, i) => '<circle cx="' + x(i) + '" cy="' + y(d.p) + '" r="' + (i === n - 1 ? 5 : 4) + '" fill="' + (d.live ? 'var(--live)' : 'var(--p300)') + '" stroke="var(--card)" stroke-width="2"><title>GW' + d.g + ': ' + ord(d.p) + (d.live ? ' (live)' : '') + '</title></circle>').join('');
  const lab = pts.map((d, i) => (i % every === 0 || i === n - 1) ? '<text x="' + x(i) + '" y="' + (H - 4) + '" text-anchor="middle" class="tm-ax">GW' + d.g + '</text>' : '').join('');
  const last = pts[n - 1];
  const end = '<text x="' + Math.min(x(n - 1), W - Rr) + '" y="' + (y(last.p) - 10) + '" text-anchor="end" class="tm-axv">' + ord(last.p) + '</text>';
  const best = Math.min(...pts.map(d => d.p)), worst = Math.max(...pts.map(d => d.p));
  return UI.sh('Table position')
    + '<div class="card tm-pos"><svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Table position after each gameweek, ' + pts.map(d => 'GW' + d.g + ' ' + ord(d.p)).join(', ') + '">' + grid + line + dots + lab + end + '</svg>'
    + '<div class="foot">Highest ' + ord(best) + ', lowest ' + ord(worst) + '.</div></div>';
}

/* the squad's top scorer counting only weeks he started for you (GW Log for finished weeks, the effective XI this week) */
export function starRows(team) {
  return memo('star|' + team, () => {
    const m = {};
    (D.gl || []).forEach(r => {
      if (r.Team !== team || r.Started !== 'XI' || num(r.GW) >= D.gw) return;
      const k = String(r.Code), o = m[k] = m[k] || { code: k, name: r.Player, pts: 0, starts: 0, best: null };
      const v = num(r['GW pts']); o.pts += v; o.starts++; if (!o.best || v > o.best.v) o.best = { v, g: num(r.GW) };
    });
    asOf(team, false).xi.forEach(p => {
      if (!fxStarted(p.Club)) return;
      const k = String(p.Code), o = m[k] = m[k] || { code: k, name: p.Player, pts: 0, starts: 0, best: null };
      const v = num(p['GW pts']); o.pts += v; o.starts++; o.live = !fxFinished(p.Club); if (!o.best || v > o.best.v) o.best = { v, g: D.gw };
    });
    return Object.values(m).sort((a, b) => b.pts - a.pts || b.starts - a.starts);
  });
}
function starBlock(team) {
  const rows = starRows(team);
  if (!rows.length || rows[0].pts <= 0) return '';
  const s = rows[0], p = UI.player(s.code) || plrPseudo(plrRow(s.code) || { Code: s.code, Player: s.name });
  const gone = !p.Team || p.Team !== team;
  const next = rows.slice(1, 4);
  return UI.sh('Star man', { aside: 'points in your XI' })
    + '<div class="card tm-star"><div class="tm-starc">' + UI.plate(p, 112) + '</div>'
    + '<div class="tm-stari"><span class="k">Most points for you</span><b class="tm-starn">' + esc(s.name) + '</b>'
    + '<span class="tm-starv"><b class="n">' + s.pts + '</b> pts in <span class="n">' + s.starts + '</span> start' + (s.starts === 1 ? '' : 's') + '</span>'
    + (s.best ? '<span class="sub">Best: <span class="n">' + s.best.v + '</span> in GW' + s.best.g + (gone ? ' · since left the squad' : '') + '</span>' : '')
    + (next.length ? '<div class="tm-runs">' + next.map((r, i) => '<button class="tm-run" data-open="player:' + esc(r.code) + '"><span class="n muted">' + (i + 2) + '</span>' + UI.face(r.code, 24) + '<span class="ell">' + esc(r.name) + '</span><b class="n">' + r.pts + '</b></button>').join('') + '</div>' : '')
    + '</div></div>';
}

/* production's Season numbers (tsxSeasonHTML), same engine (tsxCalc) and the same sentences */
function numbersBlock(team) {
  const fgs = tsxFinGws(); if (!fgs.length) return '';
  const S = tsxCalc()[team]; if (!S) return '';
  const n8 = Object.keys(TEAMS).length, rows = [];
  const row = (lab, val, ctx, unit) => '<div class="row tm-sn2"><span class="tm-snl"><b>' + lab + '</b><span class="sub">' + ctx + '</span></span><span class="tm-snv"><b class="n">' + val + '</b>' + (unit ? '<span class="sub">' + unit + '</span>' : '') + '</span></div>';
  const rec = o => o.w + '–' + o.d + '–' + o.l;
  const A = S.ap;
  if (A.last) rows.push(row('All-play record', rec(A), 'Would be ' + ord(A.rank) + ' against all seven every week' + (A.rank === A.pos ? ', same as the table' : ', actually ' + ord(A.pos)) + (A.live ? ' (GW' + A.live + ' live)' : ''), 'W\u2013D\u2013L'));
  const C = S.close;
  rows.push(row('Close games', rec(C), C.n ? 'Matchups decided by ' + C.margin + ' or fewer' : 'No matchup decided by ' + C.margin + ' or fewer yet', 'W\u2013D\u2013L'));
  const P = S.pa;
  rows.push(row('Points against', P.v, P.rank === 1 ? 'Most in the league: the toughest schedule' : P.rank === n8 ? 'Fewest in the league: the kindest schedule' : ord(P.rank) + ' most in the league · average ' + Math.round(P.avg)));
  if (S.pos.n) rows.push('<div class="row tm-sn2 full"><span class="tm-snl"><b>Points by position</b><span class="sub">XI points a gameweek v the league average</span></span><span class="tm-pcs4">'
    + [['GKP', 'GK'], ['DEF', 'DEF'], ['MID', 'MID'], ['FWD', 'FWD']].map(([k, l]) => { const d = S.pos[k].d; return '<span><i>' + l + '</i><b class="n ' + (Math.abs(d) < .05 ? '' : d > 0 ? 'win-c' : 'loss-c') + '">' + sgn(d) + '</b></span>'; }).join('') + '</span></div>');
  const Bn = S.bench;
  if (Bn.worst) rows.push(row('Points left on the bench', Bn.v, tsxLeagueOrd(Bn.rank, n8) + ' · worst: ' + Bn.worst.v + ' in GW' + Bn.worst.g));
  const Wv = S.wire;
  rows.push(row('Waiver pickups', Wv.v, 'XI points · league average ' + Math.round(Wv.avg) + (Wv.best && Wv.best.v > 0 ? ' · best: ' + esc(Wv.best.name) + ', ' + Wv.best.v : '')));
  const Dr = S.draft;
  if (Dr.hit) rows.push(row('Best pick: ' + esc(Dr.hit.name), Dr.hit.pts, 'Taken ' + ord(Dr.hit.pick) + ', ' + ord(Dr.hit.rank) + ' in points of the ' + Dr.n + ' drafted'));
  if (Dr.miss) { const bad = Dr.miss.pick - Dr.miss.rank < 0; rows.push(row((bad ? 'Biggest miss: ' : 'Weakest early pick: ') + esc(Dr.miss.name), Dr.miss.pts, 'Taken ' + ord(Dr.miss.pick) + ', ' + ord(Dr.miss.rank) + ' in points of the ' + Dr.n + ' drafted' + (Dr.miss.gone ? ' · since dropped' : ''))); }
  const span = fgs.length > 1 ? 'GW' + fgs[0] + '–' + fgs[fgs.length - 1] : 'GW' + fgs[0];
  return UI.sh('Season numbers', { aside: span }) + '<div class="card tm-nums">' + rows.join('') + '</div>';
}

export function seasonPage(team) {
  const R = results(team);
  if (!R.length) return UI.empty('The season starts with GW' + D.gw, 'Results, points against expected, luck and your star man land here after the first gameweek.');
  return summary(team, R) + resultsBlock(team, R) + xpChart(team) + luckBlock(team) + posChart(team, R) + starBlock(team) + numbersBlock(team);
}
