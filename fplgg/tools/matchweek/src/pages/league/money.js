/* League › Money: who holds each prize, Manager of the Month month by month, the Baha market, the pot. */
import * as UI from '../../ui.js';
import { table, halfway, motm, payouts, periodTotals, periodState, odds, oddsReady, pctTxt, bahaTeam, PAY, POT, money, perName, dayWord, koOf, words, curPeriodIdx, begun } from './data.js';
import { tap } from './overview.js';

const esc = UI.esc;

function holders() {
  const rows = table(), hw = halfway(), m = motm(), over = D.gwsDone >= 38, me = UI.you();
  const who = (t, sub) => '<span class="who"' + tap(t, t) + '>' + UI.crest(t, 32) + '<span class="tx"><b' + (t === me ? ' class="you-c"' : '') + '>' + esc(t) + '</b><span>' + sub + '</span></span></span>';
  const row = (kick, amt, body, paid) => '<div class="lg-hold"><span class="pz"><span class="k">' + kick + '</span><b class="n">' + amt + '</b>' + (paid ? '<span class="chip gold">Paid</span>' : '') + '</span>' + body + '</div>';
  const pts = d => words(d) + (d === 1 ? ' point' : ' points');
  const st = n => {
    if (over) return 'won it';
    if (n === 0) { const d = rows[0].pts - rows[1].pts; return d ? pts(d) + ' clear of ' + UI.short(rows[1].team) : 'level with ' + UI.short(rows[1].team) + ', ahead on points for'; }
    const d = rows[n - 1].pts - rows[n].pts; return d ? pts(d) + ' behind ' + UI.short(rows[n - 1].team) : 'level with ' + UI.short(rows[n - 1].team) + ', behind on points for';
  };
  let hwSub;
  if (hw.decided) hwSub = 'top after GW19 with ' + hw.pts + ' points';
  else hwSub = (hw.gap ? pts(hw.gap) + ' clear' : 'level on points, ahead on points for') + ' · ' + hw.togo + ' gameweek' + (hw.togo === 1 ? '' : 's') + ' to go';
  const lead = m.rows.slice().sort((p, q) => q.banked - p.banked)[0], fav = m.rows.slice().sort((p, q) => q.win - p.win)[0];
  const mSub = m.st.complete ? perName(m.per) + ' winner with ' + lead.banked
    : m.anyBanked ? 'leads ' + perName(m.per) + ' on ' + lead.banked + ' · ' + Math.round(lead.win * 100) + '% to win'
    : 'favourites for ' + perName(m.per) + ' · ' + Math.round(fav.win * 100) + '% to win';
  const on = begun(), open = sub => '<span class="who none"><span class="tx"><b>Up for grabs</b><span>' + sub + '</span></span></span>';
  const k1 = koOf(1, 'first'), starts = 'The season starts ' + (k1 ? esc(UI.day(k1)) : 'with GW1');
  return UI.sh('Who holds each prize', { aside: over ? 'Final' : on ? 'As it stands' : 'Before GW1' })
    + '<div class="card lg-holds">'
    + row('1st', money(PAY.first), on ? who(rows[0].team, st(0)) : open(starts), over)
    + row('2nd', money(PAY.second), on ? who(rows[1].team, st(1)) : open(starts), over)
    + row('3rd', money(PAY.third), on ? who(rows[2].team, st(2)) : open(starts), over)
    + row('Top at GW19', money(PAY.half), on ? who(hw.team, hwSub) : open('Whoever tops the table after GW19'), hw.decided)
    + row('Manager of the Month', money(PAY.motm) + '<small> × 9</small>', who(m.anyBanked ? lead.t : fav.t, mSub), false)
    + '</div>';
}

function motmHistory() {
  const cur = curPeriodIdx(), me = UI.you(), m = motm();
  const rows = PERIODS.map((p, i) => {
    const st = periodState(p), range = 'GW' + p[1] + '–' + p[2];
    const head = '<span class="per"><b>' + esc(perName(p)) + '</b><span class="n">' + range + '</span></span>';
    let body, tag, cls = '';
    if (st.complete) {
      const t = periodTotals(p), order = Object.keys(t).sort((a, b) => t[b] - t[a]), top = t[order[0]], winners = order.filter(x => t[x] === top), next = order.find(x => t[x] < top);
      body = '<span class="w">' + winners.map(w => UI.crest(w, 24)).join('') + '<span class="tx"><b' + (winners.includes(me) ? ' class="you-c"' : '') + '>' + esc(winners.join(' and ')) + '</b><span>' + top + ' points' + (next ? ' · ' + (top - t[next]) + ' clear of ' + esc(UI.short(next)) : '') + '</span></span></span>';
      tag = '<span class="amt n">' + money(PAY.motm) + '</span>'; cls = 'won';
    } else if (i === cur) {
      const lead = m.rows.slice().sort((a, b) => b.banked - a.banked)[0], fav = m.rows.slice().sort((a, b) => b.win - a.win)[0];
      if (m.anyBanked) body = '<span class="w">' + UI.crest(lead.t, 24) + '<span class="tx"><b' + (lead.t === me ? ' class="you-c"' : '') + '>' + esc(lead.t) + '</b><span>leads on ' + lead.banked + ' · ' + m.gws.filter(x => x.st === 'done').length + ' of ' + m.gws.length + ' played</span></span></span>';
      else body = '<span class="w">' + UI.crest(fav.t, 24) + '<span class="tx"><b' + (fav.t === me ? ' class="you-c"' : '') + '>' + esc(fav.t) + '</b><span>favourites, ' + Math.round(fav.win * 100) + '% · starts ' + esc(dayWord(koOf(p[1], 'first'))) + '</span></span></span>';
      tag = '<span class="chip ' + (m.anyBanked ? 'sub' : 'mute') + '">' + (m.anyBanked ? 'Leading' : 'Next') + '</span>'; cls = 'cur';
    } else {
      const d = koOf(p[1], 'first');
      body = '<span class="w up"><span class="tx"><span>Starts ' + (d ? esc(UI.day(d)) : 'GW' + p[1]) + '</span></span></span>';
      tag = ''; cls = 'up';
    }
    return '<div class="lg-mrow ' + cls + '">' + head + body + tag + '</div>';
  }).join('');
  const won = PERIODS.filter(p => periodState(p).complete).length;
  return UI.sh('Manager of the Month', { aside: won + ' of 9 paid' })
    + '<div class="card lg-mhist">' + rows + '<div class="foot">Most points across the month’s gameweeks wins ' + money(PAY.motm) + '. Months follow the league’s calendar, so some have more gameweeks than others.</div></div>';
}

function market() {
  const t = bahaTeam(), ready = oddsReady(), od = ready ? odds() : null;
  if (!od) return UI.sh('The Baha market') + '<div class="card lg-mkt"><div class="dial wait"><span class="in"><b class="n">' + UI.waitN() + '</b><span>chance</span></span></div><div class="q"><b>Will Baha finish 8th?</b><span class="sub">Pricing 5,000 simulated seasons…</span></div></div>';
  const v = od.last[t] || 0, hot = v >= 25;
  const ranked = Object.keys(od.last).sort((a, b) => od.last[b] - od.last[a]);
  const top = ranked.slice(0, 3);
  if (!top.includes(t)) top.push(t);
  const mx = Math.max(1, ...top.map(x => od.last[x]));
  const verdict = v >= 50 ? 'Trending wooden spoon' : v >= 25 ? 'Genuinely in danger' : v >= 5 ? 'Worth watching' : 'Safe for now';
  const mine = UI.you();
  return UI.sh('The Baha market', { aside: 'Resolves at GW38' })
    + '<div class="card lg-mkt-card"><div class="lg-mkt">'
    + '<div class="dial' + (hot ? ' hot' : '') + '" style="--v:' + Math.min(100, v).toFixed(1) + '" role="img" aria-label="' + esc(pctTxt(v)) + ' chance"><span class="in"><b class="n">' + (v > 0 && v < 1 ? '<1%' : pctTxt(v)) + '</b><span>chance</span></span></div>'
    + '<div class="q"><b>Will Baha finish 8th?</b><span class="sub">The chance ' + esc(t) + ' ends the season bottom, from 5,000 simulated seasons. Most likely 8th: ' + esc(ranked[0]) + ', ' + pctTxt(od.last[ranked[0]]) + '.</span><span class="vd' + (hot ? ' hot' : '') + '">' + verdict + '</span></div></div>'
    + '<div class="lg-odds">' + top.map(x => '<div class="r' + (x === t ? ' baha' : '') + (x === mine ? ' you' : '') + '" style="--tc:' + UI.tc(x) + '"' + tap(x, x + ', ' + pctTxt(od.last[x]) + ' to finish 8th') + '>' + UI.crest(x, 20) + '<span class="nm">' + esc(UI.short(x)) + '</span><span class="bar"><i style="width:' + Math.max(1.5, od.last[x] / mx * 100).toFixed(1) + '%"></i></span><b class="n">' + pctTxt(od.last[x]) + '</b></div>').join('') + '</div>'
    + '<div class="foot">Chance of finishing 8th. It moves at full time, never during games.</div></div>';
}

function pot() {
  const parts = [
    { lab: '1st', amt: PAY.first, cls: 'p1' }, { lab: '2nd', amt: PAY.second, cls: 'p2' }, { lab: '3rd', amt: PAY.third, cls: 'p3' },
    { lab: 'Top at GW19', amt: PAY.half, cls: 'p4' }, { lab: 'Manager of the Month, 9\u00a0×\u00a0' + money(PAY.motm), amt: PAY.motm * 9, cls: 'p5' },
  ];
  const P = payouts();
  return UI.sh('The pot') + '<div class="card lg-pot pad">'
    + '<div class="eq"><b class="n">' + money(PAY.buyin) + '</b><span>buy-in</span><i>×</i><b class="n">' + Object.keys(TEAMS).length + '</b><span>managers</span><i>=</i><b class="n gold-c">' + money(POT) + '</b></div>'
    + '<div class="split" role="img" aria-label="How the pot is split">' + parts.map(p => '<i class="' + p.cls + '" style="flex:' + p.amt + '"></i>').join('') + '</div>'
    + '<div class="rows">' + parts.map(p => '<div class="r"><i class="' + p.cls + '"></i><span>' + esc(p.lab) + '</span><b class="n">' + money(p.amt) + '</b><em class="n">' + Math.round(p.amt / POT * 1000) / 10 + '%</em></div>').join('') + '</div>'
    + '<p class="sub">' + money(P.paid) + ' paid so far, ' + money(P.left) + ' still to win. Level on points at the end? Points for decides the places.</p></div>';
}

export function moneyPage() {
  return holders() + motmHistory() + market() + pot();
}
