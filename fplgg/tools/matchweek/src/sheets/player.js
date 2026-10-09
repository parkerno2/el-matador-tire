/* Player sheet: data-open="player:CODE" — owned players and free agents.
   Hero = the locked Plate card under a spotlight; then Overview / Matches / Ratings. */
import * as UI from '../ui.js';
import * as K from './kit.js';
import { DEMO, HOUSE } from '../data/tabs.js';   /* house ratings (ROADMAP C3, 9 Oct 2026): the demo and any league on them show no EA figure */

const esc = UI.esc;

/* ---------- who is he ---------- */
function resolve(code) {
  code = String(code || '').trim();
  const raw = UI.player(code);
  if (!raw) return null;
  const own = raw.Team && TEAMS[raw.Team] ? raw : null;
  const prow = (D.plr || []).find(x => String(x.Code) === code) || null;
  const p = own || plrPseudo(raw);                         /* what the card renders */
  const eng = psxRow(own || prow || raw);                  /* what the engine reads (true status for free agents) */
  if (p && !p.Nation && prow && prow.Nation) p.Nation = prow.Nation;
  const status = String((own ? own.Status : (prow || raw).Status) || 'a');
  const news = String((own ? own.News : (prow || raw).News) || '');
  const full = String((prow && prow['Full name']) || '').trim();
  return { code, p, own, prow, eng, status, news, full, club: p.Club, pos: p.Pos };
}
const gwFixtures = (club, g) => (D.cf || []).filter(f => num(f.GW) === g && (f.Home === club || f.Away === club))
  .sort((a, b) => ((K.kickoff(a) || 0) - (K.kickoff(b) || 0)));

/* ---------- hero ---------- */
function draftWords(dr) {
  const m = /^R(\d+)\.(\d+)$/.exec(String(dr || ''));
  if (m) return 'round ' + m[1] + ', pick ' + m[2];
  return String(dr) === 'WV' ? 'waiver add' : '';
}
function ownerChip(x) {
  if (!x.own) return '<span class="ps-own fa">Free agent</span>';
  const t = x.own.Team, w = draftWords(x.own.Drafted);
  return '<button type="button" class="ps-own" data-open="manager:' + esc(t) + '">'
    + UI.crest(t, 20) + '<span class="ell">' + esc(t) + (w ? ' · ' + esc(w) : '') + '</span></button>';
}
function hero(x) {
  const plate = UI.plate(x.p, 230).replace(/ data-open="[^"]*"/, '').replace('<button class="fc', '<button tabindex="-1" aria-hidden="true" class="fc');
  return '<header class="ps-hero"><i class="ps-beam" aria-hidden="true"></i><i class="ps-floor" aria-hidden="true"></i>'
    + '<div class="ps-top">' + ownerChip(x) + '</div>'
    + '<div class="ps-plate">' + plate + '</div></header>';
}
function factChips(x) {
  const { p } = x, o = dynOvr(p), fd = formDelta(p), base = ovrOf(p);
  const nat = p.Nation ? '<span class="ps-fc">' + UI.flag(p.Nation, 11) + esc((typeof NAT !== 'undefined' && NAT[p.Nation]) || p.Nation) + '</span>' : '';
  return '<div class="ps-chips">'
    + '<span class="ps-fc">' + K.cb(p.Club, 18) + esc(K.clubName(p.Club)) + '</span>' + nat
    + '<span class="ps-fc">' + esc(K.POSNAME[p.Pos] || p.Pos) + '</span>'
    + '<span class="ps-fc">OVR <b class="n">' + o + '</b>' + (fd ? '<em class="' + (fd > 0 ? 'up' : 'dn') + '">' + (fd > 0 ? '▲' : '▼') + Math.abs(fd) + '</em><i>base ' + base + '</i>' : '') + '</span>'
    + '</div>';
}
function sentence(s) { s = String(s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/\.$/, '') + '.' : ''; }
function banner(x) {
  const st = x.status, news = x.news.trim();
  if (st === 'a' || !st) return '';
  const [why, rest] = news.split(/\s+-\s+/);
  let chip, text, cls = st === 'd' ? 'doubt' : 'out';
  if (st === 'd') { const m = news.match(/(\d+)%/); chip = m ? m[1] + '%' : 'DOUBT'; text = '<b>Doubtful.</b> ' + esc(sentence(why || 'Fitness doubt')); }
  else if (st === 's') { chip = 'OUT'; text = /^suspended/i.test(news) ? '<b>Suspended</b> ' + esc(news.replace(/^suspended\s*/i, '').replace(/\.$/, '')) + '.' : '<b>Suspended.</b> ' + esc(sentence(news)); }
  else if (st === 'i') { chip = 'OUT'; text = '<b>Injured.</b> ' + esc(sentence(why || 'Injury')) + (rest ? ' ' + esc(sentence(rest)) : ''); }
  else { chip = 'OUT'; text = '<b>Unavailable.</b> ' + esc(sentence(news || 'Not available to pick')); }
  return '<div class="ps-ban ' + cls + '" role="note"><span class="chip ' + cls + '">' + chip + '</span><span class="tx">' + text + '</span><span class="src">FPL news</span></div>';
}

/* ---------- overview: next match ---------- */
function sideHTML(c, club) {
  return '<div class="ps-side' + (c === club ? ' me' : '') + '">' + K.cb(c, 44) + '<b>' + esc(K.clubName(c)) + '</b></div>';
}
function fxMid(f, club) {
  const started = fin(f.Started) || fin(f.Finished), done = fin(f.Finished);
  if (started) {
    const hg = f['Home goals'], has = hg !== '' && hg !== undefined && hg !== null;
    return '<div class="ps-mid"><b class="n">' + (has ? num(hg) + '–' + num(f['Away goals']) : 'v') + '</b>'
      + (done ? '<span class="sub">Full time</span>' : '<span class="live-dot"><i></i>' + (num(f.Mins) ? Math.round(num(f.Mins)) + '’' : 'LIVE') + '</span>') + '</div>';
  }
  const tp = K.timeParts(K.kickoff(f));
  return '<div class="ps-mid"><b class="n">' + esc(tp.t) + '</b><span class="sub">' + (tp.m ? esc(tp.m) + ' · ' : '') + (f.Home === club ? 'home' : 'away') + '</span></div>';
}
function cell(v, lab, cls) { return '<div class="ps-cell' + (cls ? ' ' + cls : '') + '"><b class="n">' + v + '</b><span>' + lab + '</span></div>'; }
function nextMatch(x) {
  const club = x.club, code = x.code;
  let fs = gwFixtures(club, D.gw), g = D.gw, blank = false;
  if (!fs.length) {
    blank = true;
    const later = (D.cf || []).filter(f => num(f.GW) > D.gw && !fin(f.Finished) && (f.Home === club || f.Away === club)).sort((a, b) => num(a.GW) - num(b.GW) || ((K.kickoff(a) || 0) - (K.kickoff(b) || 0)));
    if (!later.length) return UI.sh('Next match') + UI.empty('No fixtures left', 'His club has no more fixtures listed this season.');
    g = num(later[0].GW); fs = later.filter(f => num(f.GW) === g);
  }
  const started = !blank && fxStarted(club), done = !blank && fxFinished(club);
  const ko = K.kickoff(fs[0]);
  let cells;
  if (done) {
    const r = gwsRow(code), pb = (D.pbonus || {})[code] || 0, pts = Math.round(num(x.eng['GW pts'])) + pb;
    cells = cell(pts, pb ? 'points, ' + pb + ' bonus provisional' : 'points') + cell(r ? K.f1(xpOf(r)) : '–', 'expected (xP)', 'mute') + cell(Math.round(num(x.eng['GW mins'])), 'minutes', 'mute');
  } else if (started) {
    const L = hpLive(x.eng), so = L.pts - L.rem;
    cells = cell(K.f1(so).replace(/\.0$/, ''), 'points so far') + cell(K.f1(L.pts), 'projected final', 'mute') + cell(Math.round(num(x.eng['GW mins'])) + '’', 'minutes', 'mute');
  } else {
    const proj = blank ? hpPlayer(x.eng, g).pts : epOf(code), fpl = blank ? null : fplEpOf(code), n = fdrOf(club, fs[0]);
    cells = cell(proj === null || proj === undefined ? '–' : K.f1(proj), blank ? 'projected, GW' + g : 'projected')
      + cell(fpl === null || fpl === undefined ? '–' : K.f1(fpl), 'FPL projection', 'mute')
      + cell(n + '<small> / 5</small>', 'difficulty');
  }
  const head = '<div class="ps-nmh"><span class="k">' + (blank ? 'Gameweek ' + g + ' · next match' : 'Gameweek ' + g + (fs.length > 1 ? ' · double' : '')) + '</span><span class="sub">' + esc(UI.day(ko)) + '</span></div>';
  const rows = fs.map(f => '<div class="ps-fx">' + sideHTML(f.Home, club) + fxMid(f, club) + sideHTML(f.Away, club) + '</div>').join('');
  const blankNote = blank ? '<div class="ps-blank">No match for ' + esc(K.clubName(club)) + ' in gameweek ' + D.gw + '.</div>' : '';
  return UI.sh(blank ? 'Next match' : started ? 'This match' : 'Next match') + '<div class="card ps-nm">' + blankNote + head + rows + '<div class="ps-cells">' + cells + '</div></div>';
}

/* ---------- overview: this gameweek, itemised ---------- */
const sgnPts = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
const sgnX = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
const PSX_STATE = { live: 'On the pitch', bench: 'On the bench, a cameo still possible', off: 'Subbed off', pre: 'Kicking off', done: 'Full time' };
function gwBlock(x) {
  const club = x.club, code = x.code;
  if (!gwFixtures(club, D.gw).length) return '';
  if (fxStarted(club)) {
    const r = gwsRow(code);
    if (!r) return UI.sh('Gameweek ' + D.gw) + UI.empty('No numbers yet', 'His stats land a few minutes after kick-off.');
    const rows = bdOf(r), pb = (D.pbonus || {})[code] || 0, xp = xpOf(r);
    const xs = {}; rows.forEach((b, i) => { if (b.x !== null && b.x !== undefined) xs[i] = b.x; });
    const xr = psxRound(xs, xp);
    const done = fxFinished(club);
    let live = '';
    if (!done) {
      const L = hpLive(x.eng);
      if (L.state !== 'done' && L.state !== 'blank') {
        const rm = Math.round(L.rem * 10) / 10;
        live = '<div class="ps-live"><span class="live-dot"><i></i>' + esc(L.state === 'bench' && rm <= 0 ? 'Did not start' : PSX_STATE[L.state] || 'Live') + '</span>'
          + '<span class="sub">Projected final <b class="n">' + K.f1(L.pts) + '</b> · still to come <b class="n">' + sgnX(rm) + '</b></span></div>';
      }
    }
    if (!r.Mins && !r.Pts) {
      return UI.sh('Gameweek ' + D.gw, { aside: done ? 'full time' : 'live' }) + '<div class="card ps-gw">' + live
        + '<div class="ps-bd two none"><span>' + (done ? 'Did not play. No points this gameweek.' : 'Not on the pitch yet. His breakdown starts when he comes on.') + '</span></div></div>';
    }
    const body = rows.length ? rows.map((b, i) => '<div class="ps-bd"><span>' + esc(b.lbl) + '</span><b class="n">' + sgnPts(b.pts) + '</b><b class="n xv">' + (b.x === null || b.x === undefined ? '–' : sgnX(xr[i])) + '</b></div>').join('')
      : '<div class="ps-bd none"><span>' + (r.Mins ? 'Nothing scored yet' : 'Not on the pitch yet') + '</span></div>';
    const pbRow = pb && !r.Bonus ? '<div class="ps-bd"><span>Bonus, provisional</span><b class="n">' + sgnPts(pb) + '</b><b class="n xv">–</b></div>' : '';
    const cs = r.Mins >= 60 && x.pos !== 'FWD' ? ' · clean-sheet odds ' + Math.round(Math.exp(-r.xGC) * 100) + '%' : '';
    return UI.sh('Gameweek ' + D.gw, { aside: done ? 'points v expected' : 'live, points v expected' })
      + '<div class="card ps-gw">' + live
      + '<div class="ps-bd hd"><span></span><b>PTS</b><b class="xv">xP</b></div>' + body + pbRow
      + '<div class="ps-bd tot"><span>Total</span><b class="n">' + (Math.round(r.Pts) + (r.Bonus ? 0 : pb)) + '</b><b class="n xv">' + K.f1(xp) + '</b></div>'
      + '<div class="foot">xG ' + r.xG.toFixed(2) + ' · xA ' + r.xA.toFixed(2) + cs + '. xP is what the performance deserved: xG for goals, xA for assists, e<sup>−xGC</sup> for clean sheets, his usual rate for defensive contributions. Bonus sits outside xP.</div></div>';
  }
  const h = hpPlayer(x.eng, D.gw);
  if (!h.nfx) return '';
  const P = psxProjParts(h), fpl = fplEpOf(code);
  const list = P.rows.length
    ? P.rows.map(r => '<div class="ps-bd two"><span>' + esc(r.l) + '</span><b class="n xv">' + sgnX(r.v) + '</b></div>').join('')
      + '<div class="ps-bd two tot"><span>Projected total</span><b class="n xv">' + P.tot.toFixed(1) + '</b></div>'
    : '<div class="ps-bd two none"><span>Not expected to play' + (x.news ? ': ' + esc(x.news) : '') + '</span></div>';
  return UI.sh('Projection', { aside: 'Gameweek ' + D.gw + (h.nfx > 1 ? ', double' : '') })
    + '<div class="card ps-gw"><div class="ps-ph"><div class="big"><b class="n">' + K.f1(h.pts) + '</b><span>projected' + (fpl !== null && fpl !== undefined ? ' · FPL ' + K.f1(fpl) : '') + '</span></div>'
    + '<div class="st"><b class="n">' + Math.round(h.pStart * 100) + '%</b><span>start chance</span></div><div class="st"><b class="n">' + Math.round(h.eMin) + '</b><span>expected minutes</span></div></div>'
    + list + '<div class="foot">Start chance and minutes from his recent gameweeks, xG and xA per 90 and the opponent’s strength. It turns into the real breakdown at kick-off.</div></div>';
}

/* ---------- form, season, next five ---------- */
function oppOf(club, g) {
  return gwFixtures(club, g).map(f => ({ o: f.Home === club ? f.Away : f.Home, home: f.Home === club, f }));
}
function apps(x) {
  const out = [];
  Object.keys(D.gwsByGw || {}).map(Number).sort((a, b) => a - b).forEach(g => {
    const r = (D.gwsByGw[g] || {})[x.code]; if (!r) return;
    if (g > D.gw || (g === D.gw && !fxFinished(r.Club))) return;
    const opp = oppOf(r.Club, g); if (!opp.length) return;
    out.push({ g, r, opp });
  });
  return out;
}
function formBlock(x) {
  const all = apps(x), last = all.slice(-5);
  if (!last.length) return UI.sh('Form') + UI.empty('No matches yet', 'His form shows here after his first finished game.');
  const best = all.reduce((b, a) => (!b || a.r.Pts > b.r.Pts ? a : b), null);
  const l3 = all.slice(-3).reduce((s, a) => s + a.r.Pts, 0);
  const chips = last.map(a => '<div class="ps-fm">' + K.pc(a.r.Pts, { dnp: !a.r.Mins, w: 44, h: 34 }) + '<span class="op">' + a.opp.map(o => K.cb(o.o, 22)).join('') + '</span><span class="sub">GW' + a.g + (a.r.Mins ? '' : ' · DNP') + '</span></div>').join('');
  const F = psxForm(x.eng);
  const c = (v, l) => '<div><b class="n">' + v + '</b><span>' + l + '</span></div>';
  const value = F ? '<div class="ps-val">' + c(F.perStart === null ? '–' : K.f1(F.perStart), 'per start') + c(F.xg === null ? '–' : F.xg.toFixed(2), 'xG per 90') + c(F.xa === null ? '–' : F.xa.toFixed(2), 'xA per 90')
    + c(Math.round(F.hitRate * 100) + '%', '6+ pts, ' + F.hits + ' of ' + F.n) + c(F.n >= 3 ? F.floor : '–', 'floor') + c(F.n >= 3 ? F.ceil : '–', 'ceiling') + '</div>' : '';
  return UI.sh('Form', { aside: 'points, last ' + (last.length === 1 ? 'match' : last.length) })
    + '<div class="card ps-form"><div class="ps-fms">' + chips + '</div>'
    + '<div class="ps-fsum"><span>Best <b>' + best.r.Pts + '</b> v ' + esc(K.clubName(best.opp[0].o)) + '</span><span>Last three <b>' + l3 + '</b></span><span>Per game <b>' + plrAvg(x.p).toFixed(1) + '</b></span></div>'
    + value + (F ? '<div class="foot">Floor and ceiling are the 10th and 90th percentile of his gameweek scores' + (F.n < 3 ? ', shown from three appearances' : '') + '. xG and xA per 90 as the projection rates them.</div>' : '') + '</div>';
}
function seasonBlock(x) {
  let G = 0, xG = 0, A = 0, xA = 0, M = 0, B = 0, ap = 0; const bg = [];
  Object.keys(D.gwsByGw || {}).map(Number).forEach(g => {
    if (g > D.gw) return;
    const r = (D.gwsByGw[g] || {})[x.code]; if (!r) return;
    if (g === D.gw && !fxStarted(r.Club)) return;
    G += r.G; xG += r.xG; A += r.A; xA += r.xA; M += r.Mins; B += r.Bonus; if (r.Bonus) bg.push(g); if (r.Mins > 0) ap++;
  });
  const dr = x.own ? String(x.own.Drafted || '') : 'FA', m = /^R(\d+)\.(\d+)$/.exec(dr);
  const draft = m ? ['R' + m[1], 'pick ' + m[2]] : dr === 'WV' ? ['WV', 'waiver add'] : ['Free', 'free agent'];
  const t = (lb, v, cm) => '<div class="tile"><span class="lb">' + lb + '</span><b>' + v + '</b><span class="cm">' + cm + '</span></div>';
  return UI.sh('Season') + '<div class="tiles ps-tiles">'
    + t('Goals', G, 'xG ' + xG.toFixed(2)) + t('Assists', A, 'xA ' + xA.toFixed(2))
    + t('Points', seasonTot(x.p), D.started ? plrAvg(x.p).toFixed(1) + ' a game' : 'season not started')
    + t('Minutes', M, ap ? Math.round(M / ap) + ' a game' : 'none yet')
    + t('Bonus', B, bg.length === 1 ? 'all in GW' + bg[0] : bg.length ? 'in ' + bg.length + ' games' : 'none yet')
    + t('Drafted', draft[0], draft[1]) + '</div>';
}
function nextFiveBlock(x) {
  const club = x.club, start = fxFinished(club) ? D.gw + 1 : D.gw, last = Math.min(38, start + 4);
  if (start > 38) return '';
  const cells = [];
  for (let g = start; g <= last; g++) {
    const fs = gwFixtures(club, g);
    if (!fs.length) { cells.push('<div class="ps-n5 none"><span class="sub">GW' + g + '</span><span class="ps-n5b">–</span><b>No match</b><i></i></div>'); continue; }
    const n = Math.max(...fs.map(f => fdrOf(club, f)));
    cells.push('<div class="ps-n5" title="Difficulty ' + n + ' of 5, ' + K.FDRWORD[n] + '"><span class="sub">GW' + g + '</span><span class="ps-n5b">' + fs.map(f => K.cb(f.Home === club ? f.Away : f.Home, fs.length > 1 ? 22 : 30)).join('') + '</span><b>'
      + fs.map(f => (f.Home === club ? (fs.length > 1 ? 'H' : 'Home') : (fs.length > 1 ? 'A' : 'Away'))).join(' · ') + '</b><i style="background:' + K.fdrColor(n) + '"></i></div>');
  }
  return UI.sh('Next five', { aside: 'bar shows difficulty' }) + '<div class="ps-n5s">' + cells.join('') + '</div>';
}

/* ---------- matches ---------- */
function histRows(code) {
  const out = [], gws = Object.keys(D.gwsByGw || {}).map(Number).filter(g => g > 0 && g <= D.gw).sort((a, b) => a - b);
  gws.forEach(g => {
    const r = (D.gwsByGw[g] || {})[code]; if (!r) return;
    if (g === D.gw && !fxStarted(r.Club) && !r.Mins && !r.Pts) return;
    const opp = gwFixtures(r.Club, g).map(f => {
      const home = f.Home === r.Club, hg = f['Home goals'], ag = f['Away goals'];
      const has = hg !== '' && hg !== undefined && hg !== null && (fin(f.Started) || fin(f.Finished));
      const me = home ? num(hg) : num(ag), them = home ? num(ag) : num(hg);
      return { o: home ? f.Away : f.Home, home, has, sc: has ? me + '–' + them : '', r: me > them ? 'W' : me < them ? 'L' : 'D', live: fin(f.Started) && !fin(f.Finished) };
    });
    out.push({ g, r, opp, xp: xpOf(r) });
  });
  return out;
}
const BALL = '<svg class="ps-ev" width="12" height="12" viewBox="0 0 12 12" aria-label="goal"><circle cx="6" cy="6" r="5.3" fill="#fff"/><path d="M6 3.3 L8.4 5 L7.5 7.8 H4.5 L3.6 5 Z" fill="#0E0A13"/></svg>';
const ASSIST = '<span class="ps-ev as" aria-label="assist">A</span>';
function events(r, pos) {
  let s = '';
  for (let i = 0; i < Math.min(r.G, 4); i++) s += BALL;
  for (let i = 0; i < Math.min(r.A, 4); i++) s += ASSIST;
  if (r.CS && r.Mins >= 60 && pos !== 'FWD') s += '<span class="ps-ev cs">CS</span>';
  if ((pos === 'GKP' || pos === 'DEF') && r.GC && r.Mins) s += '<span class="ps-ev gc">' + r.GC + ' conceded</span>';
  if (pos === 'GKP' && r.Saves >= 3) s += '<span class="ps-ev gc">' + r.Saves + ' saves</span>';
  if (r.PS) s += '<span class="ps-ev cs">pen saved</span>';
  if (r.PM) s += '<span class="ps-ev rc">pen missed</span>';
  if (r.OG) s += '<span class="ps-ev rc">own goal</span>';
  if (r.YC) s += '<i class="ps-ev yc" aria-label="yellow card"></i>';
  if (r.RC) s += '<i class="ps-ev rd" aria-label="red card"></i>';
  if (r.Bonus) s += '<span class="ps-ev bn">+' + r.Bonus + ' bonus</span>';
  return s;
}
function matchesPanel(x) {
  const rows = histRows(x.code);
  if (!rows.length) return '<div style="height:12px"></div>' + UI.empty('No matches yet', 'Every gameweek he plays lands here: opponent, result, minutes, points and xP.');
  const T = { pts: 0, xp: 0, min: 0, g: 0, a: 0, cs: 0, gc: 0 };
  const list = rows.slice().reverse().map(({ g, r, opp, xp }) => {
    T.pts += r.Pts; T.xp += xp; T.min += r.Mins; T.g += r.G; T.a += r.A; T.cs += r.CS; T.gc += r.GC;
    const live = opp.some(o => o.live) || (g === D.gw && !fxFinished(r.Club));
    const name = opp.length ? opp.map(o => '<b>' + esc(K.clubName(o.o)) + '</b> <span class="sub">(' + (o.home ? 'H' : 'A') + ')</span>').join('<br>') : '<b>No match</b>';
    const resx = opp.filter(o => o.has).map(o => K.res(o.r, o.sc, o.live)).join(' ');
    return '<div class="ps-ml' + (g === D.gw ? ' cur' : '') + '"><span class="gw sub">GW' + g + '</span><span class="bd">' + (opp.length ? opp.map(o => K.cb(o.o, opp.length > 1 ? 22 : 28)).join('') : '') + '</span>'
      + '<div class="mn"><div class="nm">' + name + '</div><div class="l2">' + resx + events(r, x.pos) + '<span class="xp">xP ' + K.f1(xp) + '</span></div></div>'
      + '<span class="mi n">' + r.Mins + '’</span>' + K.pc(r.Pts, { dnp: !r.Mins && !live, live: live && r.Mins > 0, w: 36, h: 28 }) + '</div>';
  }).join('');
  const tt = (l, v) => '<div><b class="n">' + v + '</b><span>' + l + '</span></div>';
  return UI.sh('Match log', { aside: K.plural(rows.length, 'gameweek') }) + '<div class="card ps-mls">' + list + '</div>'
    + UI.sh('Season totals') + '<div class="card ps-tot">' + tt('points', T.pts) + tt('xP', K.f1(T.xp)) + tt('minutes', T.min) + tt('goals', T.g) + tt('assists', T.a) + tt('clean sheets', T.cs) + tt('conceded', T.gc) + '</div>'
    + K.note('Points as FPL scored them, bonus included. xP is what the performance deserved, bonus left out.');
}

/* ---------- ratings ---------- */
const RCOL = v => v >= 80 ? 'var(--win)' : v >= 70 ? 'var(--sk-good2)' : v >= 60 ? 'var(--doubt)' : 'var(--loss)';
function tierText(t, p) {
  switch (t) {
    case 'potm': return esc(p.Player) + ' holds the Premier League Player of the Month award. The card lasts until the next one is announced.';
    case 'totw': return esc(p.Player) + ' hauled 10 or more points. The black and gold lasts until his next match finishes.';
    case 'spec': return 'A round 1 or 2 draft pick carries the league colours all season.';
    case 'elite': return 'Elite tier: rated 85 or more on current form.';
    case 'gold': return 'Gold tier: rated 78 to 84 on current form.';
    default: return 'Silver tier: rated under 78 on current form.';
  }
}
/* the house rating in words (the engine's houseRank): his place among his position by projected points */
function houseWhy(p) {
  const h = typeof houseRank === 'function' ? houseRank(p) : null;
  if (!h || !(h.proj > 0)) return ' Matchweek rates him from his projected points; with none projected he sits at the floor of 62.';
  const pos = (K.POSPL[p.Pos] || 'players').toLowerCase();
  return ' Matchweek rates him from his projected points: ' + K.ord(h.rank) + ' of the ' + pos + ' in the Premier League, against a pool of ' + h.pool
    + (h.rank > h.pool ? ', so past the pool.' : '.');
}
function ratingsPanel(x) {
  const { p } = x, fc = (D.fc27 || {})[x.code], gk = p.Pos === 'GKP';
  const labs = gk ? ['DIV', 'HAN', 'KIC', 'REF', 'SPD', 'POS'] : ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];
  const full = gk ? ['Diving', 'Handling', 'Kicking', 'Reflexes', 'Speed', 'Positioning'] : ['Pace', 'Shooting', 'Passing', 'Dribbling', 'Defending', 'Physical'];
  const keys = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
  const o = dynOvr(p), base = ovrOf(p), fd = formDelta(p);
  const why = 'The card shows <b>' + o + '</b>: his base rating of ' + base + (fd ? (fd > 0 ? ', plus ' : ', minus ') + Math.abs(fd) + ' for recent form' : ', with no change for form') + '.'
    + (HOUSE || !(fc && fc.ovr) ? houseWhy(p) : ' FC 27 rates him ' + Math.round(fc.ovr) + ' overall.');
  const has = !HOUSE && fc && keys.some(k => fc[k]);
  const grid = has ? '<div class="ps-at">' + keys.map((k, i) => { const v = Math.round(fc[k] || 0);
    return '<div class="at" title="' + full[i] + '"><span>' + labs[i] + '</span><b class="n" style="color:' + RCOL(v) + '">' + v + '</b><i><u style="width:' + Math.min(99, v) + '%;background:' + RCOL(v) + '"></u></i></div>'; }).join('') + '</div>'
    : HOUSE ? '<div class="ps-none">' + (DEMO ? 'The demo league' : 'This league') + ' shows no attribute ratings: every player is rated from his projected points, position by position.</div>'
    : '<div class="ps-none">FC 27 has no attribute ratings for him yet.</div>';
  let league = '';
  if (x.own) {
    const s = leagueStats(x.own), pool = (D.ro || []).filter(r => r.Pos === p.Pos), avg = plrAvg(x.own), apc = pctRank(avg, pool.map(r => plrAvg(r)));
    const bar = (l, v, pc) => '<div class="ps-lp"><span>' + l + '</span><b class="n">' + v + '</b><i><u style="width:' + Math.max(2, pc) + '%"></u></i><em>' + K.ord(pc) + '</em></div>';
    league = UI.sh('In this league', { aside: 'percentile' }) + '<div class="card pad ps-lps">'
      + bar('Points', s.pts, s.pc.pts) + bar('Per game', avg.toFixed(1), apc) + bar('Team of the Week', s.totw, s.pc.totw) + bar('Impact', s.imp, s.imp)
      + '<div class="sub ps-lpn">Against the league’s ' + s.n + ' rostered ' + (K.POSPL[p.Pos] || 'players').toLowerCase() + '. Impact blends points, per game, last three, TOTW picks and points above the best free agent.</div></div>';
  }
  return UI.sh('Ratings', { aside: HOUSE ? (DEMO ? 'Demo league' : 'Matchweek') : 'FC 27' }) + '<div class="card pad ps-rt">' + grid
    + '<div class="ps-why">' + why + ' Form counts his last four finished games and moves the card between −3 and +5.</div>'
    + '<div class="ps-why">' + tierText(tierOf(p), p) + '</div></div>' + league;
}

/* ---------- the sheet ---------- */
export default {
  cls: 'sk-player',
  render(arg) {
    const x = resolve(arg);
    if (!x) return '<div class="sk-miss">' + UI.empty('Player not found', 'He may have left the Premier League or the data is still loading.') + '</div>';
    const nm = (x.full || x.p.Player || '').trim(), size = nm.length > 22 ? 24 : nm.length > 15 ? 28 : 34;
    return hero(x)
      + '<div class="ps-id"><h2 class="wide ps-name" style="font-size:' + size + 'px">' + esc(nm) + '</h2>' + (x.full && x.full !== x.p.Player && !x.full.includes(x.p.Player) ? '<div class="sub ps-web">' + esc(x.p.Player) + '</div>' : '') + factChips(x) + '</div>'
      + banner(x)
      + K.tabs([['overview', 'Overview'], ['matches', 'Matches'], ['ratings', 'Ratings']], 'overview')
      + K.panel('overview', nextMatch(x) + gwBlock(x) + formBlock(x) + seasonBlock(x) + nextFiveBlock(x), true)
      + K.panel('matches', null) + K.panel('ratings', null)
      + '<div class="sk-end"></div>';
  },
  mount(el, arg) {
    const x = () => resolve(arg);
    K.wireTabs(el, { matches: () => matchesPanel(x()), ratings: () => ratingsPanel(x()) });
  },
};
