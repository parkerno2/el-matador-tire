/* League › Overview: the table (hero), the Manager of the Month race, the prize pool. Three blocks, nothing else. */
import * as UI from '../../ui.js';
import { table, movement, tableSummary, odds, oddsReady, pctTxt, motm, payouts, halfway, wk, ord, money, perName, PAY, FINAL, POT, dayWord, dayMonth, koOf, begun } from './data.js';

const esc = UI.esc;
export const tap = (team, label) => ' data-open="manager:' + esc(team) + '" role="button" tabindex="0" aria-label="' + esc(label) + '"';
/* "the Gulls" reads right; "the Palmers" doesn't: the article only for clubs whose full name has one */
export const theShort = t => (/^The /.test(t) ? 'the ' : '') + UI.short(t);

export function formDots(team) {
  const f = String(formOf(team) || '').split('');
  const lab = f.filter(c => c !== '-').join(' ');
  return '<span class="fdots" role="img" aria-label="Last five, oldest first: ' + esc(lab || 'none yet') + '">' + f.map(c => '<i class="' + (c === 'W' ? 'w' : c === 'L' ? 'l' : c === 'D' ? 'd' : 'e') + '"></i>').join('') + '</span>';
}
export function moveTag(n) {
  if (n == null) return '<span class="mv nil" aria-hidden="true"></span>';
  if (n > 0) return '<span class="mv up" aria-label="up ' + n + '">▲' + n + '</span>';
  if (n < 0) return '<span class="mv dn" aria-label="down ' + (-n) + '">▼' + (-n) + '</span>';
  return '<span class="mv eq" aria-label="no change">–</span>';
}
const PRIZE = [PAY.first, PAY.second, PAY.third];

/* ---------- block 1: the table ---------- */
export function tableBlock() {
  const rows = table(), mv = movement(), sum = tableSummary(), w = wk(), me = UI.you();
  const ready = oddsReady(), od = ready ? odds() : null;
  const maxT = od ? Math.max(1, ...rows.map(r => od.title[r.team] || 0)) : 1;
  const after = w.basis ? 'After gameweek ' + w.basis + ' of 38' : 'Before gameweek 1 of 38';
  const tag = w.prov ? '<span class="lg-tag prov">Provisional</span>' : w.live ? '<span class="lg-tag live"><i></i>GW' + D.gw + ' live</span>' : '';
  let h = '<section class="lg-hero lg-tbl" aria-labelledby="lg-tbl-h">'
    + '<div class="lg-tbl-hd"><div class="l"><h2 id="lg-tbl-h" class="wide">The table</h2><span>' + after + '</span>' + tag + '</div>'
    + '<div class="r"><b class="n">' + esc(sum.big) + '</b><span>' + esc(sum.sub) + '</span></div></div>'
    + '<div class="lg-th" aria-hidden="true"><span>#</span><span></span><span>Team</span><span>W–D–L</span><span>Pts</span><span>Title</span></div>';
  rows.forEach((r, i) => {
    const you = r.team === me, prize = i < 3 && begun() && PRIZE[i];
    const v = od ? od.title[r.team] || 0 : null;
    const lab = ord(r.pos) + ', ' + r.team + ', ' + r.pts + ' points, ' + r.w + ' won ' + r.d + ' drawn ' + r.l + ' lost' + (v != null ? ', title chance ' + pctTxt(v) : '');
    h += '<div class="lg-tr' + (you ? ' you' : '') + (prize ? ' prize' : '') + '" style="--tc:' + UI.tc(r.team) + '"' + tap(r.team, lab) + '>'
      + '<span class="pos"><b class="n">' + r.pos + '</b>' + moveTag(mv ? mv.by[r.team] : null) + '</span>'
      + UI.crest(r.team, 32)
      + '<span class="nm"><span class="tn">' + esc(r.team) + '</span><span class="l2">'
      + (you ? '<b class="me">You</b>' : '<span class="mg">' + esc(UI.first(r.team)) + '</span>')
      + '<span class="pf"><b class="n">' + r.pf + '</b> for</span>' + formDots(r.team)
      + (prize ? '<span class="pz n">' + money(prize) + '</span>' : '') + '</span></span>'
      + '<span class="rec n">' + r.w + '–' + r.d + '–' + r.l + '</span>'
      + '<span class="pts n">' + r.pts + '</span>'
      + '<span class="tc">' + (od ? '<b class="n">' + pctTxt(v) + '</b><span class="tb"><i style="width:' + Math.max(2, v / maxT * 100).toFixed(1) + '%"></i></span>'
        : '<b class="n">' + UI.waitN() + '</b><span class="tb wait"><i></i></span>') + '</span>'
      + '</div>';
    if (i === 2) h += '<div class="lg-zone"><i></i>' + (begun() ? 'Prize places above' : 'Top three win') + ' · ' + money(FINAL) + ' at GW38<i></i></div>';
  });
  const notes = [];
  if (w.live) notes.push('The table moves when GW' + D.gw + ' is over.');
  if (w.prov) notes.push('GW' + D.gw + ' is in at full time and provisional until FPL confirms it.');
  h += '<div class="foot lg-foot">' + (notes.length ? '<p>' + notes.join(' ') + '</p>' : '') + '<a class="lg-more" href="#/league/results">Every result ' + UI.icon('chev', 14, 'currentColor', 2.4) + '</a></div></section>';
  return h;
}

/* ---------- block 2: Manager of the Month ---------- */
export function motmBlock() {
  const m = motm(), me = UI.you(), w = wk();
  const range = 'GW' + m.a + '–' + m.b;
  const leader = m.rows.slice().sort((p, q) => q.banked - p.banked)[0];
  let when;
  if (m.st.complete) when = 'decided';
  else if (!m.st.started) when = 'starts ' + dayWord(m.firstKo);
  else when = 'ends ' + dayWord(m.lastKo);
  const pips = m.gws.map(x => '<span class="pip ' + x.st + '"><i></i><span class="n">' + (x.st === 'live' ? 'GW' + x.g + ' LIVE' : x.st === 'prov' ? 'GW' + x.g + ' FT' : 'GW' + x.g) + '</span></span>').join('');
  const played = m.gws.filter(x => x.st === 'done').length;
  const bits = [];
  if (played) bits.push(played + ' of ' + m.gws.length + ' played');
  if (w.live && m.gws.some(x => x.st === 'live')) bits.push('GW' + D.gw + ' live');
  if (w.prov && m.gws.some(x => x.st === 'prov')) bits.push('GW' + D.gw + ' at full time');
  let state;
  if (m.st.complete) state = UI.short(leader.t) + ' win it with ' + leader.banked;
  else if (!m.anyBanked) state = played + ' of ' + m.gws.length + ' played · nothing banked yet';
  else state = bits.join(', ') + ' · ' + UI.short(leader.t) + ' lead on ' + leader.banked;
  const last = m.last ? perName(m.last.per) + ' went to ' + m.last.who.map(theShort).join(' and ') + ' (' + m.last.pts + ')' : '';
  const maxV = Math.max(1, ...m.rows.map(r => r.hi)) * 1.04;
  const pc = v => Math.max(0, Math.min(100, v / maxV * 100)).toFixed(1);
  const favWin = Math.max(...m.rows.map(r => r.win));
  const colHead = m.st.complete ? 'Points, ' + range : 'Projected, ' + range;
  let h = '<section class="lg-hero lg-motm" aria-labelledby="lg-motm-h">'
    + '<div class="lg-motm-top"><div class="hd"><div><span class="k">Manager of the Month</span><h2 id="lg-motm-h" class="wide">' + esc(perName(m.per)) + ' race</h2>'
    + '<span class="sub">Most points in ' + range + ' · ' + esc(when) + '</span></div><span class="lg-cash n">' + money(PAY.motm) + '</span></div>'
    + '<div class="lg-pips" aria-label="' + played + ' of ' + m.gws.length + ' gameweeks played">' + pips + '</div>'
    + '<div class="lg-pipnote"><span>' + esc(state) + '</span>' + (last ? '<span>' + esc(last) + '</span>' : '') + '</div></div>'
    + '<div class="lg-mh" aria-hidden="true"><span></span><span>' + esc(colHead) + '</span><span>' + (m.st.complete ? 'Pts' : 'Proj') + '</span><span>Win</span></div>';
  m.rows.forEach((r, i) => {
    const you = r.t === me;
    const winTxt = r.win >= 0.995 && r.win < 1 ? '>99%' : r.win > 0 && r.win < 0.005 ? '<1%' : Math.round(r.win * 100) + '%';
    const lab = r.t + ': ' + r.banked + ' banked, ' + Math.round(r.proj) + ' projected, likely ' + Math.round(r.lo) + ' to ' + Math.round(r.hi) + ', win chance ' + winTxt;
    h += '<div class="lg-mr' + (you ? ' you' : '') + '" style="--tc:' + UI.tc(r.t) + '"' + tap(r.t, lab) + '>'
      + '<span class="rk n">' + (i + 1) + '</span>' + UI.crest(r.t, 24)
      + '<span class="ln"><span class="tn">' + esc(r.t) + '</span><span class="lane" aria-hidden="true">'
      + (r.sd > 0.01 ? '<span class="rg" style="left:' + pc(r.lo) + '%;width:' + (pc(r.hi) - pc(r.lo)).toFixed(1) + '%"></span>' : '')
      + (r.proj > r.banked + 0.05 ? '<span class="pj" style="left:' + pc(r.banked) + '%;width:' + (pc(r.proj) - pc(r.banked)).toFixed(1) + '%"></span>' : '')
      + (r.banked > 0 ? '<span class="bk" style="width:' + pc(r.banked) + '%"></span>' : '')
      + '<span class="mk" style="left:' + pc(r.proj) + '%"></span></span></span>'
      + '<b class="n pr">' + Math.round(r.proj) + '</b><b class="n wn' + (r.win === favWin && r.win > 0 ? ' fav' : '') + '">' + winTxt + '</b></div>';
  });
  h += '<div class="lg-key" aria-hidden="true"><span><i class="k-mk"></i>projected total</span><span><i class="k-rg"></i>likely range</span><span><i class="k-bk"></i>banked</span></div>'
    + '<div class="foot lg-foot"><a class="lg-more" href="#/league/money">Every month so far ' + UI.icon('chev', 14, 'currentColor', 2.4) + '</a></div></section>';
  return h;
}

/* ---------- block 3: the prize pool ---------- */
export function poolBlock() {
  const P = payouts(), rows = table(), hw = halfway(), m = motm(), done = D.gwsDone, over = done >= 38;
  const holder = i => rows[i] ? rows[i].team : null;
  const on = begun();
  const step = (i, cls, amt, lab) => {
    const t = on ? holder(i) : null;
    return '<div class="lg-step ' + cls + '"' + (t ? ' data-open="manager:' + UI.esc(t) + '"' : '') + '>' + (t ? UI.crest(t, i === 0 ? 48 : 40) : '<span class="lg-ghost"><svg width="' + (i === 0 ? 48 : 40) + '" height="' + Math.round((i === 0 ? 48 : 40) * 1.08) + '" viewBox="0 0 100 108" aria-hidden="true"><path d="' + UI.SHAPES.shield + '"/></svg></span>') + '<span class="who"><b>' + esc(t ? UI.short(t) : 'Up for grabs') + '</b><span>' + (t ? (over ? 'champions' : 'for now') : '&nbsp;') + '</span></span>'
      + '<div class="blk"><b class="n">' + money(amt) + '</b><span>' + lab + '</span></div></div>';
  };
  const pos = g => (g / 38 * 100).toFixed(2);
  const track = '<div class="lg-track" role="img" aria-label="' + P.stops.length + ' payouts across 38 gameweeks, ' + P.stops.filter(s => s.paid).length + ' paid">'
    + '<div class="ln"></div><div class="fill" style="width:' + pos(done) + '%"></div>'
    + P.stops.map(s => '<span class="st' + (s.paid ? ' paid' : '') + (s.gw === 19 ? ' half' : '') + (s.gw === 38 ? ' end' : '') + '" style="left:' + pos(s.gw) + '%"></span>').join('')
    + (done > 0 && done < 38 ? '<span class="now" style="left:' + pos(done) + '%"></span>' : '')
    + '</div>';
  const nowAlign = done < 4 ? 'l' : done > 34 ? 'r' : 'c';
  const startTxt = done ? 'GW' + done + ' <b>now</b>' : 'Starts <b>' + esc(dayMonth(koOf(1, 'first'))) + '</b>';
  const labels = '<div class="lg-tlab top"><span class="' + nowAlign + '" style="left:' + pos(done) + '%">' + startTxt + '</span></div>'
    + track
    + '<div class="lg-tlab"><span class="c" style="left:' + pos(19) + '%">GW19<br><b>' + money(PAY.half) + ' halfway</b></span><span class="r" style="left:100%">GW38<br><b>' + money(FINAL + PAY.motm) + ' final day</b></span></div>';
  /* halfway tile */
  const hwTxt = hw.decided ? UI.short(hw.team) + ' took it' : on ? UI.short(hw.team) + ', for now' : 'Top of the table after GW19';
  /* Manager of the Month tile: this month's leader once points are banked, else the favourite */
  const fav = m.anyBanked ? m.rows.slice().sort((p, q) => q.banked - p.banked)[0].t : m.rows.slice().sort((p, q) => q.win - p.win)[0].t;
  const mTxt = m.st.complete ? UI.short(fav) + ' took ' + perName(m.per) : m.anyBanked ? UI.short(fav) + ' lead ' + perName(m.per) : UI.short(fav) + ' favourites for ' + perName(m.per);
  /* next payout */
  let next = '';
  if (P.next) {
    const s = P.next, d = koOf(s.gw, 'last'), parts = [];
    s.items.forEach(x => {
      if (x.kind === 'motm') parts.push(esc(perName(x.per)) + '’s Manager of the Month');
      if (x.kind === 'half') parts.push('the halfway leader’s ' + money(PAY.half));
      if (x.kind === 'final') parts.push('the final ' + money(FINAL) + ' for the top three');
    });
    const cur = s.items.find(x => x.kind === 'motm');
    const starts = cur && !periodStarted(cur.per) ? ' Starts ' + dayWord(koOf(cur.per[1], 'first')) + '.' : '';
    next = '<div class="lg-next"><i></i><span>Next payout: <b>' + parts.join(' and ') + '</b>, after GW' + s.gw + (d ? ' on ' + esc(dayMonth(d)) : '') + '.' + esc(starts) + '</span></div>';
  } else next = '<div class="lg-next"><i></i><span>Every prize has been paid. See you next season.</span></div>';
  return '<section class="lg-hero lg-pool" aria-labelledby="lg-pool-h">'
    + '<div class="lg-pool-top"><span id="lg-pool-h" class="k">Prize pool · 38 gameweeks</span><b class="big n">' + money(POT) + '</b>'
    + '<div class="lg-pool-sub"><b>' + money(P.left) + '</b> still to win · ' + money(P.paid) + ' paid so far</div></div>'
    + '<div class="lg-podium">' + step(1, 's2', PAY.second, '2nd') + step(0, 's1', PAY.first, '1st') + step(2, 's3', PAY.third, '3rd') + '</div>'
    + '<div class="lg-season"><div class="hd"><span class="k">The season so far</span><span class="sub">' + P.stops.filter(s => s.paid).length + ' of ' + P.stops.length + ' payouts made</span></div>' + labels + '</div>'
    + '<div class="lg-ptiles">'
    + '<div class="lg-pt"><span class="k">Halfway · GW19</span><b class="n">' + money(PAY.half) + '</b><span class="h">' + (on ? UI.crest(hw.team, 18) : '') + '<span>' + esc(hwTxt) + '</span></span></div>'
    + '<div class="lg-pt"><span class="k">Manager of the Month</span><b class="n">' + money(PAY.motm) + ' <small>× 9</small></b><span class="h">' + UI.crest(fav, 18) + '<span>' + esc(mTxt) + '</span></span></div>'
    + '</div>' + next
    + '<div class="lg-pool-more"><a class="lg-more" href="#/league/money">Every prize and the Baha market ' + UI.icon('chev', 14, 'currentColor', 2.4) + '</a></div>'
    + '</section>';
}
function periodStarted(p) { return D.gw > p[1] || (D.gw === p[1] && D.dlPassed) || D.gwsDone >= p[1]; }

export function overview() {
  return tableBlock() + motmBlock() + poolBlock();
}
