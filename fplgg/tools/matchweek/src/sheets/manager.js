/* Manager sheet: data-open="manager:<team>" — another club's profile, dressed in THEIR colours.
   Header (crest, manager, table strip, form) · Overview / Squad / Results / Season / All-time. */
import * as UI from '../ui.js';
import * as K from './kit.js';
import { allTime, managerOf, nameOf, f1, f2, pct } from '../alltime.js';
import { mark } from '../pages/league/alltime.js';
import { words } from '../pages/league/data.js';
import { winPct, drawText, settleState, seriesLine } from '../pages/matchday/model.js';
import { availOf, availChip, availRing, plateOf } from '../pages/avail.js';

const esc = UI.esc;
const gwFx = g => (D.fx || []).filter(f => num(f.GW) === g);

/* ---------- data ---------- */
function curFixture(team) { return gwFx(D.gw).find(f => f.Home === team || f.Away === team) || null; }
function nextFixture(team) {
  const cur = (D.fx || []).find(x => num(x.GW) === D.gw && (x.Home === team || x.Away === team) && !mscore(x).done);
  return cur || (typeof nextFixtureOf === 'function' ? nextFixtureOf(team) : null) || null;
}
const posAt = g => K.memo('pos|' + g, () => posAfter(g));
/* results: light for the header (no luck pass), full (league position after, xP) for the Results tab */
function results(team) {
  return K.memo('res|' + team, () => resFixtures(team).map(f => {
    const g = num(f.GW), home = f.Home === team, opp = home ? f.Away : f.Home;
    const my = effPtsOf(f, team), their = effPtsOf(f, opp), live = !fin(f.Finished);
    return { g, f, home, opp, my, their, live, res: my > their ? 'W' : my < their ? 'L' : 'D', nm: derbyName(f.Home, f.Away) };
  }));
}
function resultsFull(team) {
  const agg = (K.luck()[team] || { gws: {} }).gws || {};
  return results(team).map(r => Object.assign({}, r, { pos: posAt(r.g)[team], xp: agg[r.g] ? agg[r.g].x : null }));
}
/* you are always the blue one, your opponent grey; a game without you reads light grey v the quiet number grey (--num2: these
   colour the next match's score and win chances, numbers, so never the label grey --tx3, which is under 7:1 on a card) */
function sides(team, opp) { const me = UI.you(); return team === me ? ['var(--you)', 'var(--opp)'] : opp === me ? ['var(--opp)', 'var(--you)'] : ['var(--opp)', 'var(--num2)']; }
const shortName = t => UI.short(t);
function titleTxt(team) {
  if (!K.titleReady()) return UI.waitN();
  return pctTxt(((K.titleOdds() || {}).title || {})[team] || 0);
}

/* ---------- header ---------- */
function formChips(team) {
  const done = results(team).filter(r => !r.live || D.provOver).slice(-5);
  if (!done.length) return '';
  return done.map((r, i) => '<span class="fm ' + r.res.toLowerCase() + (i === done.length - 1 ? ' last' : '') + '" title="GW' + r.g + ': ' + UI.scoreText(r.my, r.their) + '">' + r.res + '</span>').join('');
}
function lastLine(team) {
  const rs = results(team), r = rs[rs.length - 1];
  if (!r) return '';
  const where = (r.home ? 'v ' : 'at ') + shortName(r.opp);
  if (r.live && !D.provOver) return (r.my > r.their ? 'Leading ' : r.my < r.their ? 'Trailing ' : 'Level ') + UI.score(r.my, r.their) + ' ' + esc(where) + ', live';
  return (r.res === 'W' ? 'Won ' : r.res === 'L' ? 'Lost ' : 'Drew ') + UI.score(r.my, r.their) + ' ' + esc(where) + (r.live ? ', provisional' : '');
}
function header(team) {
  const col = UI.teamColors(team), pr = (PROFILE && PROFILE[team]) || {}, s = K.standOf(team), me = UI.you();
  const cur = curFixture(team), oppNow = cur ? (cur.Home === team ? cur.Away : cur.Home) : null;
  const kick = team === me ? 'Your club' : oppNow && oppNow === me ? 'Your opponent, gameweek ' + D.gw : '';
  const pat = K.patternBg(pr.pattern, col.accent, .12);
  const bg = 'linear-gradient(180deg,' + col.deep + ' 0%,color-mix(in oklab,' + col.deep + ' 48%,var(--base)) 52%,var(--base) 100%)';
  const mgr = K.nameOf(team), ph = pr.photo;
  return '<header class="ms-hd" style="background:' + bg + ';--tl:' + col.light + '">'
    + '<i class="ms-band" style="background:' + col.accent + '"></i>'
    + (pat ? '<i class="ms-pat" style="background:' + pat + '"></i>' : '')
    + '<i class="ms-sheen"></i><span class="ms-wm" aria-hidden="true">' + UI.crest(team, 220) + '</span>'
    + '<div class="ms-id"><span class="ms-cr">' + UI.glow(team, 'left', .5, 170) + UI.crest(team, 64) + '</span><div class="ms-nm">'
    + (kick ? '<span class="k" style="color:' + col.light + '">' + esc(kick) + '</span>' : '')
    + '<h2 class="wide">' + esc(team) + '</h2>'
    + '<span class="ms-mg">' + (ph ? '<span class="sk-av" style="width:22px;height:22px"><img src="' + esc(ph) + '" alt=""></span>' : '') + esc(mgr) + '</span></div></div>'
    + '<div class="ms-glass">'
    + '<div><b class="n">' + (s.has ? K.ord(s.pos) : '-') + '</b><span>in the table</span></div>'
    + '<div><b class="n">' + (s.has ? s.pts : '-') + '</b><span>points</span></div>'
    + '<div><b class="n">' + (s.has ? K.rec(s) : '-') + '</b><span>W-D-L</span></div>'
    + '<div><b class="n" data-title>' + titleTxt(team) + '</b><span>' + UI.legendTap('odds', 'title chance', 'ln') + '</span></div></div>'
    + '<div class="ms-form"><span class="k">Form</span>' + (formChips(team) || '<span class="sub">No results yet</span>') + '<span class="sub ms-last">' + lastLine(team) + '</span></div>'
    + '</header>';
}

/* ---------- overview ---------- */
function nextMatchCard(team) {
  const f = nextFixture(team);
  if (!f) return UI.sh('Next match') + UI.empty('Season finished', 'No more fixtures for ' + team + '.');
  const g = num(f.GW), home = f.Home === team, opp = home ? f.Away : f.Home, nm = derbyName(f.Home, f.Away);
  /* the member's own side and score come first when the member is in this match; otherwise this manager's */
  const L = opp === UI.you() ? opp : team, R = L === team ? opp : team, homeL = f.Home === L;
  const [cA, cB] = sides(team, opp), [cL, cR] = L === team ? [cA, cB] : [cB, cA], dl = gwDeadline(g), ko = dl ? UI.day(dl) : '';
  let mid, bar = '', cap = '';
  if (g === D.gw) {
    const m = mxScore(f), locked = UI.week().mode === 'locked';
    if (locked) { m.st = 'pred'; m.nums = [K.f1(teamProj(f.Home)), K.f1(teamProj(f.Away))]; }
    const mine = homeL ? m.nums[0] : m.nums[1], theirs = homeL ? m.nums[1] : m.nums[0];
    const ss = settleState(f);
    const bnote = ss === 'bonus' && (m.st === 'live' || m.st === 'prov');
    if (m.st === 'live' && ss === 'settled') m.st = 'ft';   /* every game of both XIs is over and no bonus is pending: full time, as Matchday says */
    const st = m.st === 'live' && !bnote ? '<span class="live-dot"><i></i>LIVE</span>' : bnote ? '<span class="state ft">PROVISIONAL</span>' : m.st === 'ft' ? '<span class="state ft">FULL TIME</span>' : m.st === 'prov' ? '<span class="state ft">PROVISIONAL</span>' : '<span class="k">' + UI.legendTap('proj', 'Proj', 'ln') + (locked ? ', locked' : '') + '</span>';
    mid = '<div class="ms-sc">' + UI.score(mine, theirs, { aStyle: 'color:' + cL, bStyle: 'color:' + cR }) + '</div>' + st + (bnote ? '<span class="md-bnote">Bonus provisional</span>' : '');
    if (m.st === 'live' && D.hasEP) cap = UI.legendTap('proj', 'Proj final', 'ln') + ' ' + UI.score(K.f1(teamProj(L)), K.f1(teamProj(R)));
  } else {
    mid = '<div class="ms-sc">' + UI.score(K.f1(hpTeam(L, g)), K.f1(hpTeam(R, g)), { aStyle: 'color:' + cL, bStyle: 'color:' + cR }) + '</div><span class="k">' + UI.legendTap('proj', 'Proj', 'ln') + '</span>';
  }
  if (!mscore(f).done && !D.provOver) {
    /* the one helper every screen uses (matchday/model.js winPct): a result that can still change never reads 100% or 0%, a draw
       that rounds to 0 reads "under 1%", and a settled result reads 100% and no draw word */
    const w = winPct(f), a = homeL ? w.h : w.a, b = homeL ? w.a : w.h, dr = drawText(w);
    const mid2 = w.drawn ? 'draw 100%' : UI.legendTap('odds', 'win chance', 'ln') + (dr ? ' · draw ' + dr : '');
    bar = '<div class="ms-wb">' + UI.wbar((a || 0) / 100, (w.d || 0) / 100, (b || 0) / 100, cL, cR) + '<div class="ms-wbl"><b class="n" style="color:' + cL + '">' + (a === null ? '' : a + '%') + '</b><span class="sub">' + mid2 + '</span><b class="n" style="color:' + cR + '">' + (b === null ? '' : b + '%') + '</b></div></div>';
  }
  K.memo('h2h', () => { if (typeof buildH2H === 'function') buildH2H(); return 1; });
  const os = K.standOf(opp), sr = seriesLine(L, R);
  const block = t => t === team
    ? '<div class="ms-tm">' + UI.crest(team, 40) + '<b>' + esc(shortName(team)) + '</b><span class="sub">' + (home ? 'home' : 'away') + '</span></div>'
    : '<div class="ms-tm"><button type="button" class="ms-op" data-open="manager:' + esc(opp) + '" aria-label="' + esc(opp) + '">' + UI.crest(opp, 40) + '</button><b>' + esc(shortName(opp)) + '</b><span class="sub">' + (os.has ? K.ord(os.pos) + ' · ' + os.pts + ' pts' : esc(K.nameOf(opp))) + '</span></div>';
  const i = gwFx(g).indexOf(f);
  /* this week's card is one tap to the matchup through its stretched link; the legend taps and the opponent's crest sit beside
     that link, never inside it (F47) */
  const go = g === D.gw && i >= 0 ? '<a class="tap-cover" href="#/matchday/matchup/' + i + '" aria-label="' + esc(L + ' v ' + R) + ', open the matchup"></a>' : '';
  return UI.sh(g === D.gw ? 'This week' : 'Next match', { aside: nm ? esc(nm) : '' })
    + '<div class="card ms-nx' + (go ? ' tap tap-host' : '') + '">' + go
    + '<div class="ms-nxk"><span class="k">Gameweek ' + g + (ko ? ' · ' + esc(ko) : '') + '</span>' + (go ? '<span class="more">Matchup ›</span>' : '') + '</div>'
    + '<div class="ms-nxr">' + block(L)
    + '<div class="ms-mid">' + mid + '</div>'
    + block(R) + '</div>'
    + bar + (cap || sr ? '<div class="foot">' + [cap, sr && esc(sr)].filter(Boolean).join(' · ') + '</div>' : '') + '</div>';
}
function lineup(team) {
  const as = autoSubs(team, true), xi = as.xi;
  if (!xi || xi.length < 11) return UI.sh('Lineup') + UI.empty('No lineup yet', 'Their XI shows once the squad is in.');
  const col = UI.teamColors(team), real = (D.ro || []).some(r => r.Team === team && r['GW XI'] === 'XI');
  const rows = ['FWD', 'MID', 'DEF', 'GKP'].map(pos => { const g = xi.filter(p => p.Pos === pos); return g.length ? '<div class="row">' + g.map(p => UI.plate(plateOf(p), 64, { flag: availOf(p).matters })).join('') + '</div>' : ''; }).join('');
  const inXi = new Set(xi.map(p => String(p.Code)));
  const bench = benchOf(team).filter(p => !inXi.has(String(p.Code))).concat(squadOf(team).filter(p => !inXi.has(String(p.Code)) && !benchOf(team).includes(p)));
  const subs = as.subs.length ? '<div class="ms-subs">' + as.subs.map(s => '<span><b>' + esc(s.inn.Player) + '</b> ' + (s.kind === 'likely' ? 'likely on' : 'on') + ' for ' + esc(s.out.Player) + '</span>').join('') + '</div>' : '';
  return UI.sh('Lineup', { aside: formation(xi) + (real ? '' : ' · likely XI') })
    + '<div class="card ms-pitch" style="--pt:' + col.deep + '"><i class="ms-lines" aria-hidden="true"></i>' + rows + '</div>'
    + (bench.length ? '<div class="ms-bench"><span class="k">Bench</span>' + bench.map(p => { const a = availOf(p), fl = a.matters && a.state !== 'fit'; return '<button type="button" data-open="player:' + esc(p.Code) + '"' + (fl ? ' title="' + esc(p.Player + ', ' + a.text) + '" aria-label="' + esc(p.Player + ', ' + a.text) + '"' : '') + '>' + UI.face(p, 30, fl ? availRing(p) : {}) + '<span>' + esc(p.Player) + '</span>' + (fl ? '<span class="chip ' + (a.state === 'out' ? 'out' : 'doubt') + '">' + esc(a.label.length > 5 ? 'OUT' : a.label) + '</span>' : '') + '</button>'; }).join('') + '</div>' : '')
    + subs;
}
function topScorer(team) {
  const ex = K.effXi(team), inEx = new Set(ex.map(p => String(p.Code)));
  const rows = squadOf(team).map(p => { const s = K.xiStarted(p.Code), cur = inEx.has(String(p.Code)) ? num(p['GW pts']) : 0; return { p, xi: s.xi + cur, bench: s.bench + (cur ? 0 : num(p['GW pts'])) }; })
    .sort((a, b) => b.xi - a.xi || ovrOf(b.p) - ovrOf(a.p));
  const h = rows[0]; if (!h || !h.xi) return '';
  const sec = rows[1];
  return UI.sh('Top scorer', { aside: 'started weeks only' }) + '<div class="card ms-top"><span class="ms-tp">' + UI.plate(plateOf(h.p), 104, { flag: availOf(h.p).matters }) + '</span><div class="ms-tt">'
    + '<b class="wide">' + esc(h.p.Player) + '</b><span class="sub">' + esc(K.clubName(h.p.Club)) + ' · ' + esc(K.POSNAME[h.p.Pos] || h.p.Pos) + '</span>'
    + '<div class="ms-tn"><b class="n">' + h.xi + '</b><span>points in the XI</span></div>'
    + '<span class="sub">' + (h.bench ? h.bench + ' more left on the bench · ' : '') + 'season total ' + seasonTot(h.p) + '</span>'
    + (sec && sec.xi ? '<span class="sub">Next: ' + esc(sec.p.Player) + ', ' + sec.xi + '</span>' : '') + '</div></div>';
}

/* ---------- squad ---------- */
function gwBubble(p) {
  /* the number and what it is, as the Plate's bubble says it: pts once his match is over, live while it is on, Proj before */
  const wrap = (cls, txt, lab) => '<span class="ms-pg"><span class="pb ' + cls + '">' + txt + '</span><span>' + lab + '</span></span>';
  if (fxStarted(p.Club)) return wrap(fxFinished(p.Club) ? 'bk' : 'lv', UI.minus(Math.round(num(p['GW pts']) + ((D.pbonus || {})[String(p.Code)] || 0))), fxFinished(p.Club) ? 'pts' : 'live');
  const e = D.hasEP ? epOf(p.Code) : null;
  return wrap('prj', e === null ? '-' : UI.minus(K.f1(e)), 'Proj');
}
function squadPanel(team) {
  const sq = squadOf(team); if (!sq.length) return UI.empty('No squad', 'This team has no players listed.');
  const inXi = new Set(K.effXi(team).map(p => String(p.Code)));
  const grp = ['GKP', 'DEF', 'MID', 'FWD'].map(pos => {
    const ps = sq.filter(p => p.Pos === pos).sort((a, b) => (inXi.has(String(b.Code)) - inXi.has(String(a.Code))) || num(b['Season pts']) - num(a['Season pts']));
    if (!ps.length) return '';
    return UI.sh(K.POSPL[pos], { aside: (pos === 'GKP' ? UI.legendTap('proj', 'Proj', 'ln') + ' · ' + UI.legendTap('rating', 'rating', 'ln') + ' · ' : '') + ps.length }) + '<div class="card">' + ps.map(p => '<div class="row tap ms-pl" data-open="player:' + esc(p.Code) + '">'
      + UI.face(p, 38) + '<div class="ms-pn"><span class="ms-pnt"><b class="ell">' + esc(p.Player) + '</b>' + availChip(p) + '</span><span class="sub ell">' + esc(K.clubName(p.Club)) + ' · ' + (inXi.has(String(p.Code)) ? 'XI' : 'bench') + ' · rating ' + dynOvr(p) + '</span></div>'
      + '<div class="ms-ps"><b class="n">' + seasonTot(p) + '</b><span>season</span></div>' + gwBubble(p) + '</div>').join('') + '</div>';
  }).join('');
  return grp + clubGrid(team);
}
function clubGrid(team) {
  const clubs = [...new Set(squadOf(team).slice().sort((a, b) => (num(a.Slot) || 99) - (num(b.Slot) || 99)).map(p => p.Club))];
  const gws = [0, 1, 2, 3, 4].map(i => D.gw + i).filter(g => g <= 38);
  if (!clubs.length || !gws.length) return '';
  const cell = (c, g) => {
    const fs = (D.cf || []).filter(x => num(x.GW) === g && (x.Home === c || x.Away === c));
    if (!fs.length) return '<span class="ms-fd none">-</span>';
    return '<span class="ms-fd">' + fs.map(f => { const h = f.Home === c, n = fdrOf(c, f); return '<i class="fd-' + (n <= 2 ? 'e' : n === 3 ? 'n' : n === 4 ? 'h' : 'x') + '" title="' + esc(K.clubName(h ? f.Away : f.Home)) + ' (' + (h ? 'H' : 'A') + '), ' + K.FDRWORD[n] + '">' + esc(h ? f.Away : f.Home) + '<em>' + (h ? 'H' : 'A') + '</em></i>'; }).join('') + '</span>';
  };
  return UI.sh('Their clubs, next five', { aside: 'FPL difficulty' }) + '<div class="card ms-grid"><div class="ms-gr hd"><span></span>' + gws.map(g => '<span>GW' + g + '</span>').join('') + '</div>'
    + clubs.map(c => '<div class="ms-gr"><span class="cl">' + K.cb(c, 22) + '</span>' + gws.map(g => cell(c, g)).join('') + '</div>').join('') + '</div>';
}

/* ---------- results ---------- */
function resultsPanel(team) {
  const rs = resultsFull(team);
  let html = '';
  if (!rs.length) html += UI.sh('Results') + UI.empty('No results yet', 'Every gameweek’s score lands here.');
  else {
    const T = { w: 0, d: 0, l: 0, pf: 0, pa: 0 };
    const rows = rs.slice().reverse().map(r => {
      const lv = r.live && !D.provOver; if (!lv) T[r.res.toLowerCase()]++; T.pf += r.my; T.pa += r.their;
      return '<div class="ms-r' + (r.live ? ' lv' : '') + '"><span class="gw sub">GW' + r.g + '</span>' + UI.crest(r.opp, 24)
        + '<div class="ms-ro"><b class="ell">' + (r.home ? 'v ' : 'at ') + esc(shortName(r.opp)) + '</b><span class="sub ell">' + esc(r.nm || K.nameOf(r.opp)) + '</span></div>'
        + K.res(r.res, UI.score(r.my, r.their), lv) + '<span class="ms-rp n">' + (r.pos ? K.ord(r.pos) : '') + (r.live ? '*' : '') + '</span><span class="ms-rx n">' + (r.xp === null ? '-' : K.f1(r.xp)) + '</span></div>';
    }).join('');
    html += UI.sh('Results', { aside: UI.recL(T.w, T.d, T.l) })
      + '<div class="card"><div class="ms-r hd"><span class="gw"></span><span></span><span></span><span>Score</span><span class="ms-rp">Pos</span><span class="ms-rx nt">xP</span></div>' + rows
      + '<div class="ms-r tot"><span class="gw"></span><span></span><b>Points for and against</b><span class="n">' + UI.score(T.pf, T.pa) + '</span><span class="ms-rp"></span><span class="ms-rx"></span></div></div>'
      + (rs.some(r => r.live) ? K.note('* live, moves until FPL confirms.') : '');
  }
  const up = (D.fx || []).filter(f => (f.Home === team || f.Away === team) && num(f.GW) > D.gw).sort((a, b) => num(a.GW) - num(b.GW)).slice(0, 5);
  if (up.length) {
    html += UI.sh('Fixtures', { aside: 'next ' + up.length }) + '<div class="card">' + up.map(f => {
      const g = num(f.GW), home = f.Home === team, opp = home ? f.Away : f.Home, nm = derbyName(f.Home, f.Away), dl = gwDeadline(g);
      const w = mpxWinPct(hpWin(f)), p = home ? w.h : w.a;
      return '<div class="ms-r up" data-open="manager:' + esc(opp) + '"><span class="gw sub">GW' + g + '</span>' + UI.crest(opp, 24)
        + '<div class="ms-ro"><b class="ell">' + (home ? 'v ' : 'at ') + esc(shortName(opp)) + '</b><span class="sub ell">' + esc([dl ? UI.day(dl) : '', nm || ''].filter(Boolean).join(' · ')) + '</span></div>'
        + '<span class="ms-wc"><b class="n">' + p + '%</b><span>to win</span></span></div>';
    }).join('') + '</div>';
  }
  return html + chartBlock(team);
}
function chartBlock(team) {
  const A = (K.luck()[team] || { gws: {} }).gws || {}, gws = Object.keys(A).map(Number).sort((a, b) => a - b);
  if (!gws.length) return '';
  const W = 340, H = 156, PL = 28, PR = 30, PT = 22, PB = 24, n = gws.length;
  const max = Math.max(10, ...gws.map(g => Math.max(A[g].act, A[g].x)));
  const top = Math.ceil(max / 10) * 10;
  const x = i => n < 2 ? (PL + W - PR) / 2 : PL + i * (W - PL - PR) / (n - 1), y = v => PT + (1 - v / top) * (H - PT - PB);
  const line = k => gws.map((g, i) => x(i).toFixed(1) + ',' + y(A[g][k]).toFixed(1)).join(' ');
  const grid = [0, .5, 1].map(f => '<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + y(top * f) + '" y2="' + y(top * f) + '" class="gl"/><text x="' + (PL - 6) + '" y="' + (y(top * f) + 3.5) + '" class="ax" text-anchor="end">' + Math.round(top * f) + '</text>').join('');
  const dots = k => gws.map((g, i) => '<circle cx="' + x(i) + '" cy="' + y(A[g][k]) + '" r="4" class="' + (k === 'x' ? 'xpe' : k) + '"/>').join('');
  const axis = gws.map((g, i) => '<text x="' + x(i) + '" y="' + (H - 6) + '" class="ax" text-anchor="middle">' + g + '</text>').join('');
  const hit = gws.map((g, i) => '<rect class="hit" data-g="' + g + '" x="' + (x(i) - (W - PL - PR) / Math.max(1, n - 1) / 2) + '" y="0" width="' + ((W - PL - PR) / Math.max(1, n - 1)) + '" height="' + H + '"><title>GW' + g + ': actual ' + K.f1(A[g].act) + ', xP ' + K.f1(A[g].x) + '</title></rect>').join('');
  const L = gws[n - 1], la = A[L].act, lx = A[L].x, sep = Math.abs(y(la) - y(lx)) < 12 ? (la >= lx ? [-6, 6] : [6, -6]) : [0, 0];
  const lab = '<text x="' + (x(n - 1) + 8) + '" y="' + (y(la) + 4 + sep[0]) + '" class="dl act">' + Math.round(la) + '</text><text x="' + (x(n - 1) + 8) + '" y="' + (y(lx) + 4 + sep[1]) + '" class="dl xpe">' + K.f1(lx) + '</text>';
  const tot = K.luck()[team] || { act: 0, x: 0 };
  return UI.sh('Actual v xP', { aside: UI.legendTap('luck', 'What xP means', 'ln') }) + '<div class="card ms-ch"><div class="ms-lg"><span><i class="act"></i>Actual, bonus excluded</span><span><i class="xpe"></i>xP</span></div>'
    + '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Actual points without bonus against xP, by gameweek">' + grid
    + (n > 1 ? '<polyline points="' + line('x') + '" class="ln xpe"/><polyline points="' + line('act') + '" class="ln act"/>' : '') + dots('x') + dots('act') + axis + lab + hit + '</svg>'
    + '<div class="ms-ro2 sub" data-readout>Season: actual ' + Math.round(tot.act) + ', xP ' + K.f1(tot.x) + '.</div></div>';
}

/* ---------- season ---------- */
function luckBlock(team) {
  const P = K.luck(), S = K.sched(), p = P[team], s = S[team];
  if (!p && !s) return UI.sh('Luck', { aside: UI.legendTap('luck', 'What luck means', 'ln') }) + UI.empty('No luck to measure yet', 'It needs a finished gameweek.');
  const rankOf = (map, f) => { const v = f(map[team]); return 1 + Object.keys(map).filter(t => f(map[t]) > v).length; };
  let html = UI.sh('Luck', { aside: UI.legendTap('luck', 'What luck means', 'ln') }) + '<div class="card">';
  if (p) {
    const d = p.act - p.x, rk = rankOf(P, o => o.act - o.x);
    html += '<div class="ms-lk"><div><span class="k">Performance</span><b class="n ' + (d >= 0 ? 'win-c' : 'loss-c') + '">' + K.sgn(d) + '</b></div>'
      + '<p>Scored <b>' + Math.round(p.act) + '</b> from the XI with bonus taken out, against an xP of <b>' + K.f1(p.x) + '</b>. ' + (d >= 0 ? 'Running hot' : 'Deserved more') + ', ' + K.ord(rk) + ' luckiest of ' + Object.keys(P).length + '.' + '</p></div>';
  }
  if (s) {
    const d = s.pts - s.ap, rk = rankOf(S, o => o.pts - o.ap);
    html += '<div class="ms-lk"><div><span class="k">Results</span><b class="n ' + (d >= 0 ? 'win-c' : 'loss-c') + '">' + K.sgn(d) + '</b></div>'
      + '<p>Banked <b>' + s.pts + '</b> league points, worth <b>' + K.f1(s.ap) + '</b> against all ' + words(apRivals()) + ' every week. Their scores beat ' + K.f1(s.beat).replace(/\.0$/, '') + ' of ' + s.opp + '. '
      + (d >= 0 ? 'The fixture list has been kind' : 'The fixture list has been unkind') + ', ' + K.ord(rk) + ' of ' + Object.keys(S).length + '.'
      + ((s.cw + s.cl + s.cd) ? ' Close games (' + CLOSE_MARGIN + ' or fewer): ' + UI.recL(s.cw, s.cd, s.cl) + '.' : '') + '</p></div>';
  }
  return html + '</div>';
}
function seasonRows(team) {
  const fgs = tsxFinGws(); if (!fgs.length) return '';
  const S = tsxCalc()[team]; if (!S) return '';
  const rows = [], n8 = Object.keys(TEAMS).length;
  const row = (l, v, c, u) => rows.push('<div class="row ms-sn"><div><b>' + l + '</b><span class="sub">' + c + '</span></div><span class="ms-snv"><b class="n">' + v + '</b>' + (u ? '<span class="sub">' + u + '</span>' : '') + '</span></div>');
  const st = K.standOf(team), pfRank = 1 + K.standings().filter(x => num(x['Pts For']) > st.pf).length;
  const mine = results(team).filter(r => !r.live), best = mine.reduce((b, r) => (!b || r.my > b.my ? r : b), null);
  row('Points for', st.pf, K.ord(pfRank) + ' in the league' + (mine.length ? ' · ' + K.f1(mine.reduce((s, r) => s + r.my, 0) / mine.length) + ' a week' : '') + (best ? ' · best ' + best.my + ' in GW' + best.g : ''));
  const A = S.ap; if (A.last) row('All-play record', tsxRec(A), 'Would be ' + K.ord(A.rank) + ' against all ' + words(apRivals()) + ' every week' + (A.rank === A.pos ? ', same as the table' : ', actually ' + K.ord(A.pos)), 'W-D-L');
  const C = S.close; row('Close games', tsxRec(C), C.n ? 'Matchups decided by ' + C.margin + ' or fewer' : 'None decided by ' + C.margin + ' or fewer yet', 'W-D-L');
  const P = S.pa; row('Points against', P.v, P.rank === 1 ? 'Most in the league: the toughest schedule' : P.rank === n8 ? 'Fewest in the league: the kindest schedule' : K.ord(P.rank) + ' most in the league · average ' + Math.round(P.avg));
  if (S.pos.n) rows.push('<div class="row ms-sn"><div><b>Points by position</b><span class="sub">XI points a gameweek v the league average</span></div><div class="ms-pp">' + TSX_POS.map(([k]) => { const d = S.pos[k].d; return '<span><i>' + k + '</i><b class="n ' + (Math.abs(d) < .05 ? '' : d > 0 ? 'win-c' : 'loss-c') + '">' + tsxSgn(d, 1) + '</b></span>'; }).join('') + '</div></div>');
  const B = S.bench; if (B.worst) row('Left on the bench', B.v, tsxLeagueOrd(B.rank, n8) + ' · worst ' + B.worst.v + ' in GW' + B.worst.g);
  const W = S.wire; row('Waiver pickups', W.v, 'XI points · league average ' + Math.round(W.avg) + (W.best && W.best.v > 0 ? ' · best ' + esc(W.best.name) + ', ' + W.best.v : ''));
  const Dr = S.draft;
  if (Dr.hit) row('Best pick: ' + esc(Dr.hit.name), Dr.hit.pts, 'Taken ' + K.ord(Dr.hit.pick) + ', ' + K.ord(Dr.hit.rank) + ' in points of the ' + Dr.n + ' drafted');
  if (Dr.miss) row((Dr.miss.pick - Dr.miss.rank < 0 ? 'Biggest miss: ' : 'Weakest early pick: ') + esc(Dr.miss.name), Dr.miss.pts, 'Taken ' + K.ord(Dr.miss.pick) + ', ' + K.ord(Dr.miss.rank) + ' in points of the ' + Dr.n + ' drafted' + (Dr.miss.gone ? ' · since dropped' : ''));
  const span = fgs.length > 1 ? 'GW' + fgs[0] + '-' + fgs[fgs.length - 1] : 'GW' + fgs[0];
  return UI.sh('Season numbers', { aside: span }) + '<div class="card">' + rows.join('') + '</div>';
}
function moves(team) {
  const tx = (D.tx || []).filter(t => t.Team === team).slice().sort((a, b) => String(b['When (UTC)'] || '').localeCompare(String(a['When (UTC)'] || '')) || num(b.GW) - num(a.GW)).slice(0, 8);
  if (!tx.length) return UI.sh('Recent moves') + UI.empty('No moves yet', 'Waivers and free-agent signings show here.');
  return UI.sh('Recent moves') + '<div class="card">' + tx.map(t => {
    const ok = /accept|success/i.test(t.Result || ''), pend = /pending/i.test(t.Result || '');
    return '<div class="row ms-tx' + (ok || pend ? '' : ' dim') + '"><span class="gw sub">' + (t.GW ? 'GW' + num(t.GW) : '') + '</span><div class="ms-mv"><span class="in"><i>IN</i>' + esc(t.In || '-') + '</span><span class="out"><i>OUT</i>' + esc(t.Out || '-') + '</span></div>'
      + '<span class="ms-tr"><b>' + esc(t.Type || '') + '</b><span class="sub">' + esc(t.Result || '') + '</span></span></div>';
  }).join('') + '</div>';
}

/* ---------- all-time (Parker's Q5, 10 Oct 2026): his line, his records, his finishes by season, his 2025/26 draft, his record against every other manager ---------- */
const whenAt = (s, g) => s + ' GW' + g;
/* a manager's seasons, latest first, with the seasons no file covers listed between them as not recorded (never as 0 games) */
const seasonList = (m, A) => { const first = parseInt(m.seasons[0].season, 10); return m.seasons.concat(A.gaps.filter(g => parseInt(g, 10) > first).map(g => ({ season: g, gap: true }))).sort((p, q) => parseInt(q.season, 10) - parseInt(p.season, 10)); };
export function alltimePanel(team) {
  const m = managerOf(team);
  if (!m || !m.P) return UI.sh('All-time') + UI.empty('No finished match yet', 'The all-time numbers start with the first finished gameweek.');
  const A = allTime();
  const cell = (v, l) => '<div><b class="n">' + v + '</b><span>' + l + '</span></div>';
  let html = UI.sh('All-time', { aside: m.played + (m.played === 1 ? ' season' : ' seasons') + (m.titles ? ' · ' + m.titles + (m.titles === 1 ? ' title' : ' titles') : '') })
    + '<div class="card at-line">' + cell(m.P, 'played') + cell(m.W + '-' + m.D + '-' + m.L, 'W-D-L') + cell(m.Pts, 'points') + cell(f2(m.ppm), 'per match')
    + cell(m.PF, 'for') + cell(m.PA, 'against') + cell(f1(m.avg), 'a gameweek') + cell(pct(m.winPct), 'won') + '</div>';
  /* records */
  const row = (l, v, c) => '<div class="row ms-sn"><div><b>' + l + '</b><span class="sub">' + esc(c) + '</span></div><span class="ms-snv"><b class="n">' + v + '</b></span></div>';
  let rec = '';
  if (m.hi) rec += row('Highest score', m.hi.v, whenAt(m.hi.season, m.hi.gw) + ' v ' + nameOf(m.hi.opp));
  if (m.lo) rec += row('Lowest score', m.lo.v, whenAt(m.lo.season, m.lo.gw) + ' v ' + nameOf(m.lo.opp));
  if (m.bigWin) rec += row('Biggest win', UI.score(m.bigWin.my, m.bigWin.their), 'by ' + m.bigWin.m + ', ' + whenAt(m.bigWin.season, m.bigWin.gw) + ' v ' + nameOf(m.bigWin.opp));
  if (m.bigLoss) rec += row('Heaviest defeat', UI.score(m.bigLoss.my, m.bigLoss.their), 'by ' + m.bigLoss.m + ', ' + whenAt(m.bigLoss.season, m.bigLoss.gw) + ' v ' + nameOf(m.bigLoss.opp));
  if (m.winRun) rec += row('Longest winning run', m.winRun.n, whenAt(m.winRun.from.season, m.winRun.from.gw) + ' to ' + whenAt(m.winRun.to.season, m.winRun.to.gw));
  if (m.lossRun) rec += row('Longest losing run', m.lossRun.n, whenAt(m.lossRun.from.season, m.lossRun.from.gw) + ' to ' + whenAt(m.lossRun.to.season, m.lossRun.to.gw));
  rec += row('All-play record', m.allplay.w + '-' + m.allplay.t + '-' + m.allplay.l, 'W-D-L against every other manager each gameweek, over ' + m.allplay.seasons + (m.allplay.seasons === 1 ? ' recorded season' : ' recorded seasons'));
  html += UI.sh('Records', { aside: 'over ' + m.played + (m.played === 1 ? ' recorded season' : ' recorded seasons') }) + '<div class="card">' + rec + '</div>';
  /* finishes by season */
  html += UI.sh('Seasons') + '<div class="card"><div class="at-sr hd"><span>Season</span><span>Team</span><span>Finish</span><span>W-D-L</span><span>Pts</span></div>'
    + seasonList(m, A).map(s => s.gap ? '<div class="at-sr gap"><span class="n">' + esc(s.season) + '</span><span class="tm">not recorded</span><span></span><span></span><span></span></div>' : '<div class="at-sr' + (s.title ? ' ttl' : '') + '"><span class="n">' + esc(s.season) + '</span><span class="tm">' + esc(s.team) + '</span><span class="n">' + (s.P ? K.ord(s.rank) + (s.current && !s.complete ? '*' : '') : '-') + (s.title ? '<i>title</i>' : '') + '</span><span class="n">' + s.W + '-' + s.D + '-' + s.L + '</span><b class="n">' + s.Pts + '</b></div>').join('')
    + '</div>' + (m.seasons.some(s => s.current && !s.complete) ? K.note('* so far, finished gameweeks only.') : '');
  /* the earlier seasons' drafts */
  m.drafts.forEach(d => {
    html += UI.sh(d.season + ' draft') + '<div class="card">'
      + '<div class="row ms-sn"><div><b>First pick</b></div><span class="ms-snv"><b>' + esc(d.pick) + '</b></span></div>'
      + (d.star ? '<div class="row ms-sn"><div><b>Best player</b><span class="sub">' + esc(d.star.pos_club || '') + '</span></div><span class="ms-snv"><b>' + esc(d.star.player) + '</b><span class="sub"><span class="n">' + d.star.pts + '</span> pts</span></span></div>' : '')
      + '</div>';
  });
  /* head to head: the same records as the Derbies page's series */
  const opps = Object.keys(m.h2h).map(c => A.managers[c]).filter(Boolean).sort((p, q) => p.rank - q.rank);
  if (opps.length) html += UI.sh('Head to head', { aside: 'W-D-L' }) + '<div class="card">' + opps.map(o => { const r = m.h2h[o.code];
    return '<div class="at-hr"' + (o.team ? ' data-open="manager:' + esc(o.team) + '" role="button" tabindex="0"' : '') + '>' + mark(o, 24) + '<span class="nm ell">' + esc(nameOf(o.code)) + '</span><b class="n">' + r.w + '-' + r.d + '-' + r.l + '</b><span class="n pf">' + r.pf + '-' + r.pa + '</span></div>'; }).join('') + '</div>';
  return html;
}

/* ---------- the sheet ---------- */
export default {
  cls: 'sk-manager',
  render(team) {
    if (!TEAMS[team]) return '<div class="sk-miss">' + UI.empty('Team not found', 'That club isn’t in this league.') + '</div>';
    return header(team)
      + K.tabs([['overview', 'Overview'], ['squad', 'Squad'], ['results', 'Results'], ['season', 'Season'], ['alltime', 'All-time']], 'overview')
      + K.panel('overview', nextMatchCard(team) + lineup(team) + topScorer(team), true)
      + K.panel('squad', null) + K.panel('results', null) + K.panel('season', null) + K.panel('alltime', null)
      + '<div class="sk-end"></div>';
  },
  mount(el, team) {
    if (!TEAMS[team]) return;
    K.wireTabs(el, { squad: () => squadPanel(team), results: () => resultsPanel(team), season: () => luckBlock(team) + seasonRows(team) + moves(team), alltime: () => alltimePanel(team) });
    const rp = el.querySelector('[data-panel="results"]');
    if (rp) rp.addEventListener('click', e => {
      const h = e.target.closest('.ms-ch .hit'); if (!h) return;
      const g = h.dataset.g, A = ((K.luck()[team] || {}).gws || {})[g]; const o = el.querySelector('[data-readout]');
      el.querySelectorAll('.ms-ch .hit').forEach(r => r.classList.toggle('on', r === h));
      if (A && o) o.innerHTML = '<b>GW' + g + '</b>: actual ' + Math.round(A.act) + ', xP ' + K.f1(A.x) + ' (' + K.sgn(A.act - A.x) + ')';
    });
    if (!K.titleReady()) UI.warmOdds();
  },
};
