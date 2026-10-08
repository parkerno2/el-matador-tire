/* League › Derbies: every named rivalry, its all-time series, this season's meetings and what's next. */
import * as UI from '../../ui.js';
import { derbies, scoreOf, winOf } from './data.js';
import { tap } from './overview.js';

const esc = UI.esc;

function seriesText(r) {
  const fa = UI.first(r.a), fb = UI.first(r.b), tot = r.aw + r.bw + r.dr;
  if (!tot) return { lead: 'First ever meeting', rec: '' };
  const dr = r.dr ? ' (' + r.dr + ' drawn)' : '';
  if (r.aw > r.bw) return { lead: fa + ' leads', rec: r.aw + '–' + r.bw + dr };
  if (r.bw > r.aw) return { lead: fb + ' leads', rec: r.bw + '–' + r.aw + dr };
  return { lead: 'Series level', rec: r.aw + '–' + r.bw + dr };
}

function card(r, me) {
  const s = seriesText(r), tot = r.aw + r.bw + r.dr;
  /* in a comparison you are blue and they are grey; a neutral pair reads lilac against grey */
  const aCol = r.a === me ? 'var(--you)' : 'var(--p300)', bCol = r.b === me ? 'var(--you)' : 'var(--opp)';
  const ca = r.b === me ? 'var(--opp)' : aCol;
  const side = (t, cls) => '<span class="sd ' + cls + (t === me ? ' me' : '') + '"' + tap(t, t) + '>' + UI.crest(t, 40) + '<b>' + esc(t) + '</b><span>' + esc(UI.first(t)) + '</span></span>';
  const bar = tot ? '<div class="srb" role="img" aria-label="All-time: ' + esc(UI.first(r.a)) + ' ' + r.aw + ' wins, ' + esc(UI.first(r.b)) + ' ' + r.bw + ' wins, ' + r.dr + ' drawn">'
    + '<i style="flex:' + r.aw + ';background:' + ca + '"></i>' + (r.dr ? '<i style="flex:' + r.dr + ';background:var(--line)"></i>' : '') + '<i style="flex:' + r.bw + ';background:' + bCol + '"></i></div>'
    + '<div class="srl n"><span>' + r.aw + '</span><span>' + r.bw + '</span></div>' : '';
  const meta = [];
  if (r.thisGw) {
    const sc = scoreOf(r.thisGw), flip = r.thisGw.Home !== r.a, l = flip ? sc.a : sc.h, rt = flip ? sc.h : sc.a;
    const wm = UI.week().mode, mode = wm === 'prov' ? 'Full time, provisional' : wm === 'live' ? 'Live' : null;
    let txt;
    if (mode) txt = '<b class="n">' + l + '–' + rt + '</b> <span class="' + (D.provOver ? '' : 'live-c') + '">' + mode.toLowerCase() + '</span>';
    else { const w = mpxWinPct(winOf(r.thisGw)), pa = flip ? w.a : w.h, pb = flip ? w.h : w.a; txt = 'GW' + D.gw + ' · ' + esc(UI.first(r.a)) + ' ' + pa + '%, ' + esc(UI.first(r.b)) + ' ' + pb + '% to win'; }
    meta.push('<span class="m now"><em>This week</em>' + txt + '</span>');
  } else if (r.next) {
    const d = gwDeadline(num(r.next.GW));
    meta.push('<span class="m"><em>Next</em>GW' + num(r.next.GW) + (d ? ' · ' + esc(UI.day(d)) : '') + '</span>');
  } else meta.push('<span class="m"><em>Next</em>not scheduled this season</span>');
  if (r.big) meta.push('<span class="m"><em>Biggest win</em>' + esc(UI.first(r.big.w)) + ' by ' + r.big.m + ', <span class="n">' + r.big.ws + '–' + r.big.ls + '</span> in GW' + r.big.g + '</span>');
  else if (r.played) meta.push('<span class="m"><em>Biggest win</em>none yet, all square</span>');
  const meets = r.playedFx.map(f => { const flip = f.Home !== r.a, h = num(f['Home pts']), a = num(f['Away pts']); return 'GW' + num(f.GW) + ' <span class="n">' + (flip ? a + '–' + h : h + '–' + a) + '</span>'; });
  const go = r.fxIdx >= 0 ? ' data-go="#/matchday/matchup/' + r.fxIdx + '"' : '';
  return '<article class="card lg-derby' + (r.thisGw ? ' wk' : '') + (r.nm ? '' : ' un') + (r.a === me || r.b === me ? ' mine' : '') + '">'
    + '<div class="hd"><h3 class="wide">' + esc(r.nm || 'Unnamed pairing') + '</h3>' + (go ? '<a class="lg-more"' + go + ' href="#/matchday/matchup/' + r.fxIdx + '">Matchup ' + UI.icon('chev', 14, 'currentColor', 2.4) + '</a>' : '') + '</div>'
    + '<div class="vs">' + side(r.a, 'l') + '<div class="mid"><span class="k">All-time</span><b>' + esc(s.lead) + '</b><span class="rec n">' + esc(s.rec) + '</span>' + bar + '</div>' + side(r.b, 'r') + '</div>'
    + '<div class="meta"><span class="m"><em>This season</em>' + (r.played ? r.played + (r.played === 1 ? ' meeting' : ' meetings') + ': ' + meets.join(', ') : 'no meetings yet') + (r.n ? ' · ' + r.n + ' scheduled' : '') + '</span>' + meta.join('') + '</div>'
    + '</article>';
}

export function derbiesPage() {
  const rows = derbies(), me = UI.you();
  const named = rows.filter(r => r.nm), un = rows.filter(r => !r.nm), wkN = named.filter(r => r.thisGw).length;
  return UI.sh('Named rivalries', { aside: named.length + ' named' + (wkN ? ' · ' + wkN + ' this week' : '') })
    + named.map(r => card(r, me)).join('')
    + (un.length ? '<details class="lg-un"><summary class="sh"><h2>Still unnamed</h2><span class="aside">' + un.length + ' pairings ' + UI.icon('chev', 14, 'var(--tx3)', 2.4) + '</span></summary>' + un.map(r => card(r, me)).join('') + '</details>' : '')
    + '<p class="lg-cap">All-time records include the league’s earlier seasons.</p>';
}
