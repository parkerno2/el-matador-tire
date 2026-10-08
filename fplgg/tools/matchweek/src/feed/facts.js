import * as UI from '../ui.js';
/* feed/facts.js — every number a post states is computed here, from D and the engine. Nothing is invented. */
import { dt, byName, ptsOver, minsOver, startsOver, finishedGws, fxOf, fxFor, oppOf, chanceOf, lsGet, lsSet, bump, gwDoneTime } from './util.js';

/* ---------- memo per data load ---------- */
let MK = -1, M = {};
export function memo(k, f) { if (MK !== LOADED_AT) { MK = LOADED_AT; M = {}; } return k in M ? M[k] : (M[k] = f()); }

/* ---------- engine calls the posts repeat: once per data load ---------- */
const wpRaw = f => memo('wr|' + f.GW + '|' + f.Home + '|' + f.Away, () => hpWin(f));
export const wp = f => memo('wp|' + f.GW + '|' + f.Home + '|' + f.Away, () => mpxWinPct(wpRaw(f)));
/* a team's projected total this gameweek: hpWin already worked it out (muH/muA = hpTeam = teamProj for the current week) */
export const tp = t => memo('tp|' + t, () => { const f = (D.fx || []).find(x => num(x.GW) === D.gw && (x.Home === t || x.Away === t)); if (!f) return teamProj(t); const w = wpRaw(f); if (w.done) return teamProj(t); return f.Home === t ? w.muH : w.muA; });
export const ex = t => memo('ex|' + t, () => effXiOf(t, true));
export const ms = f => memo('ms|' + f.GW + '|' + f.Home + '|' + f.Away, () => mscore(f));

/* ---------- results of a gameweek ---------- */
const glFor = (g, team) => memo('glidx', () => { const m = {}; (D.gl || []).forEach(r => { const k = num(r.GW) + '|' + r.Team; (m[k] = m[k] || []).push(r); }); return m; })[g + '|' + team] || [];
function statLine(code, g) {
  const r = (D.gwsByGw[g] || {})[String(code)]; if (!r) return '';
  const b = [];
  if (r.G) b.push(r.G + ' ' + (r.G === 1 ? 'goal' : 'goals'));
  if (r.A) b.push(r.A + ' ' + (r.A === 1 ? 'assist' : 'assists'));
  if (!b.length && r.CS && (r.Pos === 'DEF' || r.Pos === 'GKP')) b.push('clean sheet');
  if (r.Saves >= 3 && r.Pos === 'GKP') b.push(r.Saves + ' saves');
  if (r.Bonus) b.push(r.Bonus + ' bonus');
  return b.slice(0, 2).join(' · ');
}
/* started players of a team in a gameweek with their points: GW Log for finished weeks, the live XI for the current one */
export function startersOf(team, g) {
  if (g < D.gw) {
    return glFor(g, team).filter(r => r.Started === 'XI').map(r => ({ code: String(r.Code), name: r.Player, pts: num(r['GW pts']), mins: num(r['GW mins']), pos: r.Pos, club: r.Club }));
  }
  return effXiOf(team).map(p => ({ code: String(p.Code), name: p.Player, pts: num(p['GW pts']) + ((D.pbonus || {})[String(p.Code)] || 0), mins: num(p['GW mins']), pos: p.Pos, club: p.Club }));
}
function bonusOf(code, g) { return (((D.gwsByGw[g] || {})[String(code)] || {}).Bonus) || 0; }
export function starMan(f) {
  const g = num(f.GW);
  const all = [];
  [f.Home, f.Away].forEach(t => startersOf(t, g).forEach(s => all.push({ ...s, team: t })));
  if (!all.length) return null;
  all.sort((a, b) => b.pts - a.pts || bonusOf(b.code, g) - bonusOf(a.code, g) || b.mins - a.mins);
  const s = all[0];
  return s.pts > 0 ? { ...s, line: statLine(s.code, g) } : null;
}
export function results(g) {
  return memo('res|' + g, () => fxOf(g).map(f => {
    const s = ms(f), hs = s.hs, as = s.as2;
    const done = s.done || (num(f.GW) === D.gw && D.provOver);
    const win = hs === as ? null : hs > as ? f.Home : f.Away, lose = hs === as ? null : hs > as ? f.Away : f.Home;
    const hauls = [];
    [f.Home, f.Away].forEach(t => startersOf(t, g).forEach(x => { if (x.pts >= 10) hauls.push({ ...x, team: t }); }));
    hauls.sort((a, b) => b.pts - a.pts);
    return { f, g, home: f.Home, away: f.Away, hs, as, done, live: s.liveNow && !done, nm: derbyName(f.Home, f.Away), margin: Math.abs(hs - as), win, lose, star: done ? starMan(f) : null, hauls };
  }));
}

/* ---------- bench points in a defeat (GW Log BEN rows; only when the log's XI adds up to the score, so no auto-sub counted them) ---------- */
export function benchStory(g) {
  return memo('bench|' + g, () => {
    const out = [];
    results(g).forEach(r => {
      if (!r.lose || g >= D.gw) return;
      const rows = glFor(g, r.lose); if (!rows.length) return;
      const xi = rows.filter(x => x.Started === 'XI').reduce((s, x) => s + num(x['GW pts']), 0);
      const score = r.lose === r.home ? r.hs : r.as;
      if (xi !== score) return;
      const bench = rows.filter(x => x.Started === 'BEN').map(x => ({ code: String(x.Code), name: x.Player, pts: num(x['GW pts']), mins: num(x['GW mins']), pos: x.Pos }));
      const tot = bench.reduce((s, x) => s + x.pts, 0);
      if (tot < 10) return;
      bench.sort((a, b) => b.pts - a.pts);
      out.push({ r, team: r.lose, opp: r.win, tot, top: bench[0], bench, margin: r.margin, score, oppScore: r.lose === r.home ? r.as : r.hs });
    });
    return out.sort((a, b) => b.top.pts - a.top.pts);
  });
}

/* ---------- form, runs ---------- */
export function record(team) {
  const fx = (D.fx || []).filter(f => fin(f.Finished) && (f.Home === team || f.Away === team)).sort((a, b) => num(a.GW) - num(b.GW));
  const res = fx.map(f => { const me = f.Home === team ? num(f['Home pts']) : num(f['Away pts']), op = f.Home === team ? num(f['Away pts']) : num(f['Home pts']); return me > op ? 'W' : me < op ? 'L' : 'D'; });
  let run = 0, kind = res.length ? res[res.length - 1] : ''; for (let i = res.length - 1; i >= 0 && res[i] === kind; i--) run++;
  return { res, w: res.filter(x => x === 'W').length, d: res.filter(x => x === 'D').length, l: res.filter(x => x === 'L').length, run, kind, played: res.length };
}
export const tableOrder = () => D.st.slice().sort((a, b) => num(b['League Pts']) - num(a['League Pts']) || num(b['Pts For']) - num(a['Pts For']));
export const posOf = team => tableOrder().findIndex(s => s.Team === team) + 1;

/* ---------- records ---------- */
export function recordsTo(g) {
  let hi = null, lo = null;
  (D.fx || []).forEach(f => {
    if (!fin(f.Finished) || num(f.GW) > g) return;
    [[f.Home, num(f['Home pts'])], [f.Away, num(f['Away pts'])]].forEach(([t, p]) => {
      if (!hi || p > hi.p) hi = { p, who: [[t, num(f.GW)]] }; else if (p === hi.p) hi.who.push([t, num(f.GW)]);
      if (!lo || p < lo.p) lo = { p, who: [[t, num(f.GW)]] }; else if (p === lo.p) lo.who.push([t, num(f.GW)]);
    });
  });
  return { hi, lo };
}

/* ---------- Manager of the Month ---------- */
export function motmTotals(per) { return memo('motm|' + per[0], () => motmTotals0(per)); }
function motmTotals0(per) {
  const live = D.dlPassed && !D.mw.some(w => num(w.GW) === D.gw && fin(w.Finished));
  const t = {}; let n = 0;
  (D.fx || []).forEach(f => {
    const g = num(f.GW); if (g < per[1] || g > per[2]) return;
    if (!fin(f.Finished) && !(live && g === D.gw)) return;
    /* effPtsOf() for these weeks equals mscore()'s live-corrected score, which the posts already hold */
    const sc = g === D.gw ? ms(f) : null;
    t[f.Home] = (t[f.Home] || 0) + (sc ? sc.hs : effPtsOf(f, f.Home)); t[f.Away] = (t[f.Away] || 0) + (sc ? sc.as2 : effPtsOf(f, f.Away)); n++;
  });
  return { rows: Object.entries(t).sort((a, b) => b[1] - a[1]), any: n > 0 };
}
export function periodDone(per) { for (let g = per[1]; g <= per[2]; g++) { const w = D.mw.find(x => num(x.GW) === g); if (!w || !fin(w.Finished)) return false; } return true; }

/* ---------- luck (two separate components, never blended) ---------- */
/* Performance luck through the last finished gameweek: luckAgg()'s formula (started points excl. bonus v xP, GW Log XI)
   without the live week, so a post that says GW1–5 means GW1–5 even while GW6 is being played. */
export function perfLuck() {
  return memo('luck', () => {
    const upto = D.gwsDone, logXI = {}, logGws = new Set(), out = {};
    (D.gl || []).forEach(r => { const g = num(r.GW); logGws.add(g); if (r.Started === 'XI') logXI[g + '|' + String(r.Code) + '|' + r.Team] = 1; });
    Object.keys(D.gwsByGw || {}).forEach(g => {
      if (num(g) > upto) return;
      Object.keys(D.gwsByGw[g]).forEach(code => {
        const r = D.gwsByGw[g][code]; if (!r.Owner) return;
        if (logGws.has(num(g)) && !logXI[num(g) + '|' + String(code) + '|' + r.Owner]) return;
        const t = out[r.Owner] = out[r.Owner] || { act: 0, x: 0 }; t.act += r.Pts - r.Bonus; t.x += xpOf(r);
      });
    });
    return Object.keys(out).map(t => ({ team: t, act: out[t].act, x: out[t].x, d: out[t].act - out[t].x })).sort((a, b) => b.d - a.d);
  });
}
/* Results luck (all-play) through the last finished gameweek: schedLuck()'s formula on finished weeks only */
export function resultsLuck() {
  return memo('sched', () => {
    const out = {}, byGw = {};
    (D.fx || []).forEach(f => { const g = num(f.GW); if (g <= D.gwsDone && fin(f.Finished)) (byGw[g] = byGw[g] || []).push(f); });
    Object.keys(byGw).forEach(g => {
      const fs = byGw[g]; if (fs.length < 4) return;
      const sc = {}; fs.forEach(f => { sc[f.Home] = num(f['Home pts']); sc[f.Away] = num(f['Away pts']); });
      if (Object.keys(sc).length < 8) return;
      fs.forEach(f => [f.Home, f.Away].forEach(t => {
        const opp = f.Home === t ? f.Away : f.Home, mine = sc[t], theirs = sc[opp];
        const act = mine > theirs ? 3 : mine === theirs ? 1 : 0;
        let beat = 0, tie = 0; Object.keys(sc).forEach(o => { if (o === t) return; if (mine > sc[o]) beat++; else if (mine === sc[o]) tie++; });
        const o2 = out[t] = out[t] || { pts: 0, ap: 0, gws: 0 }; o2.pts += act; o2.ap += (beat + tie * .5) / 7 * 3; o2.gws++;
      }));
    });
    return Object.keys(out).map(t => ({ team: t, pts: out[t].pts, ap: out[t].ap, d: out[t].pts - out[t].ap, gws: out[t].gws })).sort((a, b) => a.d - b.d);
  });
}
/* the player who has outrun his expected points the most for a team (started weeks only) */
export function luckiestPlayer(team) { return memo('lp|' + team, () => luckiestPlayer0(team)); }
function luckiestPlayer0(team) {
  const logXI = {}; (D.gl || []).forEach(r => { if (r.Team === team && r.Started === 'XI') logXI[num(r.GW) + '|' + r.Code] = 1; });
  const acc = {};
  Object.keys(D.gwsByGw || {}).forEach(g => { if (num(g) > D.gwsDone) return; Object.values(D.gwsByGw[g]).forEach(r => { if (r.Owner !== team || !logXI[num(g) + '|' + r.Code]) return; const a = acc[r.Code] = acc[r.Code] || { code: r.Code, name: r.Player, d: 0 }; a.d += (r.Pts - r.Bonus) - xpOf(r); }); });
  return Object.values(acc).sort((a, b) => b.d - a.d)[0] || null;
}

/* ---------- the free-agent market ---------- */
export function freeAgents(n = 3) {
  return memo('fa|' + n, () => {
    const win = finishedGws(3); if (!win.length) return [];
    const last2 = win.slice(-2);
    return (D.plr || []).filter(p => p.Owner === 'FREE' && p.Status !== 'u' && p.Status !== 'n')
      .map(p => ({ p, l3: ptsOver(p.Code, win), l2: ptsOver(p.Code, last2), season: num(p['Season pts']) }))
      .filter(x => x.l3 > 0)
      .sort((a, b) => b.l3 - a.l3 || b.season - a.season).slice(0, n)
      .map(x => { const t = lastDrop(x.p.Player); return { ...x, n: win.length, droppedBy: t ? t.Team : '', droppedOn: t ? dt(t['When (UTC)']) : null }; });
  });
}
function lastDrop(name) { return (D.tx || []).filter(t => t.Out === name && /^Accepted/.test(t.Result)).sort((a, b) => String(b['When (UTC)']).localeCompare(String(a['When (UTC)'])))[0] || null; }

/* ---------- draft picks ---------- */
const pickOf = p => { const m = String(p.Drafted || '').match(/^R(\d+)\.(\d+)/); return m ? { r: +m[1], k: +m[2] } : null; };
/* season points through the last finished gameweek (GW Stats), so a post that says "after GW5" stays GW5 while GW6 is live.
   Before the deadline this equals FPL's Season pts exactly; if GW Stats is missing a week, fall back to Season pts. */
export function seasonTo(p) {
  const gws = finishedGws();
  return gws.length && gws.length >= D.gwsDone ? ptsOver(p.Code, gws) : num(p['Season pts']);
}
export function roundOne() { return (D.ro || []).filter(p => { const k = pickOf(p); return k && k.r === 1; }).map(p => ({ p, pick: pickOf(p), pts: seasonTo(p) })).sort((a, b) => b.pts - a.pts || a.pick.k - b.pick.k); }
export function worstPick() {
  if (D.gwsDone < 3) return null;
  const c = (D.ro || []).map(p => ({ p, pick: pickOf(p), pts: seasonTo(p) })).filter(x => x.pick && x.pick.r <= 4).sort((a, b) => a.pts - b.pts || a.pick.r - b.pick.r);
  return c[0] || null;
}
export const pickText = k => 'R' + k.r + '.' + k.k;

/* the most season points from any pick after round seven (the counterpart to worstPick); skip a player another post leads with */
export function latePick(skip) {
  if (D.gwsDone < 3) return null;
  const c = (D.ro || []).map(p => ({ p, pick: pickOf(p), pts: seasonTo(p) })).filter(x => x.pick && x.pick.r >= 8 && x.pts > 0 && String(x.p.Code) !== String(skip || ''))
    .sort((a, b) => b.pts - a.pts || b.pick.r - a.pick.r || b.pick.k - a.pick.k);
  if (!c[0]) return null;
  const more = (D.ro || []).filter(p => seasonTo(p) > c[0].pts).length;
  return { ...c[0], more };
}

/* ---------- form ---------- */
/* the last n gameweeks with every H2H fixture finished, oldest first */
export function finishedFxGws(n) {
  const gws = [...new Set((D.fx || []).filter(f => fin(f.Finished) && num(f.GW) <= D.gwsDone).map(f => num(f.GW)))].sort((a, b) => a - b);
  return n ? gws.slice(-n) : gws;
}
const fxPts = (f, t) => f.Home === t ? num(f['Home pts']) : num(f['Away pts']);
/* a team's H2H points scored over some finished gameweeks */
export function teamPtsIn(team, gws) { return (D.fx || []).filter(f => fin(f.Finished) && gws.includes(num(f.GW)) && (f.Home === team || f.Away === team)).reduce((s, f) => s + fxPts(f, team), 0); }
/* a team's best and worst finished score this season, with the gameweeks */
export function seasonRange(team) {
  const s = (D.fx || []).filter(f => fin(f.Finished) && (f.Home === team || f.Away === team)).map(f => ({ g: num(f.GW), p: fxPts(f, team) }));
  if (!s.length) return null;
  const hi = s.reduce((a, b) => b.p > a.p ? b : a), lo = s.reduce((a, b) => b.p < a.p ? b : a);
  return { hi: hi.p, hiGw: hi.g, lo: lo.p, loGw: lo.g, n: s.length };
}
/* the last finished meeting of two teams before a gameweek (this season's H2H Fixtures) */
export function lastMeeting(a, b, before) {
  return (D.fx || []).filter(f => fin(f.Finished) && num(f.GW) < before && ((f.Home === a && f.Away === b) || (f.Home === b && f.Away === a))).sort((x, y) => num(y.GW) - num(x.GW))[0] || null;
}
/* the form guide: league points over the last three finished gameweeks */
export function formGuide() {
  return memo('form', () => {
    const gws = finishedFxGws(3); if (gws.length < 3) return null;
    const t = {}; Object.keys(TEAMS).forEach(n => { t[n] = { team: n, lp: 0, pf: 0, res: [] }; });
    gws.forEach(g => fxOf(g).forEach(f => {
      if (!fin(f.Finished) || !t[f.Home] || !t[f.Away]) return;
      const h = num(f['Home pts']), a = num(f['Away pts']);
      t[f.Home].pf += h; t[f.Away].pf += a;
      t[f.Home].res.push(h > a ? 'W' : h < a ? 'L' : 'D'); t[f.Away].res.push(a > h ? 'W' : a < h ? 'L' : 'D');
      if (h > a) t[f.Home].lp += 3; else if (a > h) t[f.Away].lp += 3; else { t[f.Home].lp++; t[f.Away].lp++; }
    }));
    return { gws, rows: Object.values(t).sort((a, b) => b.lp - a.lp || b.pf - a.pf) };
  });
}
/* an owned, available player who has scored 6+ in each of the last three finished gameweeks: the biggest total */
export function hotStreak() {
  return memo('streak', () => {
    const win = finishedGws(3); if (win.length < 3) return null;
    const c = (D.ro || []).filter(p => p.Status === 'a').map(p => ({ p, per: win.map(g => ((D.gwsByGw[g] || {})[String(p.Code)] || {}).Pts || 0), mins: win.map(g => ((D.gwsByGw[g] || {})[String(p.Code)] || {}).Mins || 0) }))
      .filter(x => x.per.every(v => v >= 6)).map(x => ({ ...x, tot: x.per.reduce((s, v) => s + v, 0) }))
      .sort((a, b) => b.tot - a.tot || b.per[2] - a.per[2] || String(a.p.Player).localeCompare(String(b.p.Player)));
    if (!c[0]) return null;
    const p = c[0].p, log = win.map(g => (D.gl || []).find(r => num(r.GW) === g && String(r.Code) === String(p.Code)) || null);
    return { ...c[0], win, log };
  });
}
/* the top scorer of a finished gameweek whom nobody started (GW Log XIs): unowned, or on his owner's bench */
export function unstarted(g, skip) {
  const rows = (D.gl || []).filter(r => num(r.GW) === g); if (!rows.length) return null;
  const xi = new Set(rows.filter(r => r.Started === 'XI').map(r => String(r.Code)));
  const c = Object.values(D.gwsByGw[g] || {}).filter(r => !xi.has(String(r.Code)) && !skip.has(String(r.Code))).sort((a, b) => b.Pts - a.Pts || b.Mins - a.Mins);
  for (const r of c) {
    if (r.Pts < 8) return null;
    const ben = rows.find(x => String(x.Code) === String(r.Code) && x.Started === 'BEN');
    if (!ben && r.Owner && r.Owner !== 'FREE') continue;           /* owned but missing from the log: don't guess */
    return { r, owner: ben ? ben.Team : '', line: statLine(r.Code, g) };
  }
  return null;
}
/* how a finished gameweek went against FPL's frozen projections (D.predByGw), summed over each selected XI */
export function modelCheck(g) {
  return memo('model|' + g, () => {
    const E = (D.predByGw || {})[g], fx = fxOf(g); if (!E || !fx.length) return null;
    const out = [];
    for (const f of fx) {
      if (!fin(f.Finished)) return null;
      for (const t of [f.Home, f.Away]) {
        const xi = glFor(g, t).filter(r => r.Started === 'XI');
        if (xi.length !== 11 || xi.some(r => E[String(r.Code)] === null || E[String(r.Code)] === undefined)) return null;
        const proj = xi.reduce((s, r) => s + E[String(r.Code)], 0), act = fxPts(f, t);
        out.push({ team: t, proj, act, d: act - proj });
      }
    }
    return out.sort((a, b) => b.d - a.d);
  });
}

/* ---------- injuries and doubts ---------- */
export function flagged(team) {
  const xi = xiOf(team), xiSet = new Set(xi.map(p => String(p.Code)));
  const sq = squadOf(team).filter(p => p.Status && p.Status !== 'a');
  const order = p => (p.Status === 'd' ? chanceOf(p) : -1);
  return { xi: sq.filter(p => xiSet.has(String(p.Code))).sort((a, b) => order(a) - order(b)), bench: sq.filter(p => !xiSet.has(String(p.Code))).sort((a, b) => order(a) - order(b)) };
}

/* ---------- Jive: the selection call ---------- */
export function selectionCall(team) {
  return memo('call|' + team, () => {
    if (!team || !TEAMS[team] || D.dlPassed) return null;
    const gw = D.gw, win = finishedGws(5);
    const xi = xiOf(team), bench = benchOf(team);
    const info = p => { const h = hpPlayer(p, gw); return { p, ps: h.pStart, emin: h.eMin, pts: h.pts, mins: minsOver(p.Code, win), starts: startsOver(p.Code, win), n: win.length, nfx: h.nfx }; };
    const weak = xi.map(info).filter(x => x.nfx > 0 && x.ps < .5 && x.p.Status === 'a').sort((a, b) => a.ps - b.ps || a.pts - b.pts);
    for (const w of weak) {
      const pos = w.p.Pos;
      const fromBench = bench.filter(b => b.Pos === pos && b.Status !== 'i' && b.Status !== 's' && b.Status !== 'u').map(info).filter(b => b.pts >= w.pts + .4 && b.ps >= .55).sort((a, b) => b.pts - a.pts)[0];
      const pool = (D.plr || []).filter(p => p.Owner === 'FREE' && p.Pos === pos && p.Status === 'a' && num(p.Mins) > 0).sort((a, b) => num(b['Season pts']) - num(a['Season pts'])).slice(0, 24);
      const fa = pool.map(info).filter(b => b.pts >= w.pts + .5 && b.ps >= .6).sort((a, b) => b.pts - a.pts)[0];
      const alt = fromBench && (!fa || fromBench.pts >= fa.pts - .2) ? { ...fromBench, kind: 'bench' } : fa ? { ...fa, kind: 'free' } : null;
      if (alt) return { team, gw, out: w, alt, win };
    }
    return null;
  });
}
/* the opponent's danger man: the top projection in their XI */
export function dangerMan(team) {
  const f = fxFor(team, D.gw); if (!f) return null;
  const opp = oppOf(f, team);
  const xi = ex(opp);
  const best = xi.map(p => ({ p, ep: epOf(p.Code) || 0 })).sort((a, b) => b.ep - a.ep)[0];
  return best ? { opp, f, ...best } : null;
}

/* ---------- live swing: the win chance before a ball was kicked (locked XIs, pre-match projections) v now ---------- */
export function preKick(f) {
  const side = t => { const xi = ex(t); let mu = 0, v = 0; xi.forEach(p => { const m = hpPlayer(p, D.gw).pts; mu += m; const s = hpSd(m); v += s * s; }); return { mu, sd: Math.sqrt(v) * 1.2 }; };
  const H = side(f.Home), A = side(f.Away), sd = Math.sqrt(H.sd * H.sd + A.sd * A.sd) || 1, diff = H.mu - A.mu;
  const h = 1 - hpNorm((.5 - diff) / sd), a = hpNorm((-.5 - diff) / sd), d = Math.max(0, 1 - h - a);
  return { ...mpxWinPct({ h, d, a }), muH: H.mu, muA: A.mu };
}

/* ---------- transactions: waiver runs and free-agent moves ---------- */
export function dealGroups() {
  return memo('deals', () => {
    const G = {};
    (D.tx || []).forEach(t => {
      const w = dt(t['When (UTC)']); if (!w) return;
      const type = /waiver/i.test(t.Type) ? 'W' : 'F';
      const k = t.Team + '|' + num(t.GW) + '|' + type + (type === 'F' ? '|' + w.toISOString().slice(0, 10) : '');
      const g = G[k] = G[k] || { key: k, team: t.Team, gw: num(t.GW), type, rows: [], at: w };
      g.rows.push({ ...t, when: w });
      if (w > g.at) g.at = w;
    });
    return Object.values(G).map(g => {
      g.rows.sort((a, b) => a.when - b.when);
      g.ok = g.rows.filter(r => /^Accepted/i.test(r.Result));
      g.no = g.rows.filter(r => !/^Accepted/i.test(r.Result));
      g.ok.forEach(r => { r.pin = byName(r.In, r.Team, g.gw); r.pout = byName(r.Out, r.Team, g.gw); });
      return g;
    }).sort((a, b) => b.at - a.at);
  });
}
/* claims that more than one club made for the same player in one gameweek's waivers */
export function contested() {
  return memo('contest', () => {
    const by = {};
    (D.tx || []).filter(t => /waiver/i.test(t.Type)).forEach(t => { const k = num(t.GW) + '|' + t.In; (by[k] = by[k] || []).push(t); });
    const out = {};
    Object.keys(by).forEach(k => {
      const rows = by[k], teams = [...new Set(rows.map(r => r.Team))]; if (teams.length < 2) return;
      const won = rows.find(r => /^Accepted/i.test(r.Result));
      const gw = +k.split('|')[0];
      (out[gw] = out[gw] || []).push({ name: rows[0].In, winner: won ? won.Team : null, losers: teams.filter(t => !won || t !== won.Team), teams, p: byName(rows[0].In, won ? won.Team : rows[0].Team, gw), at: rows.map(r => dt(r['When (UTC)'])).filter(Boolean).sort((a, b) => b - a)[0] });
    });
    return out;
  });
}
/* why a claim was denied, stated only from the log */
export function deniedWhy(t) {
  const when = dt(t['When (UTC)']);
  const got = (D.tx || []).filter(x => x !== t && x.In === t.In && x.Team !== t.Team && /^Accepted/i.test(x.Result) && dt(x['When (UTC)']) <= when).sort((a, b) => String(b['When (UTC)']).localeCompare(String(a['When (UTC)'])))[0];
  if (got) return { kind: 'taken', by: got.Team, at: dt(got['When (UTC)']) };
  if (/drop gone/i.test(t.Result)) return { kind: 'drop' };
  return { kind: 'invalid' };
}

/* ---------- title odds and the Baha market: simulate() is heavy (~0.5 s), so it runs once per data load after first paint ---------- */
let SIMQ = false, SAVED_AT = -1;
export const sim = () => (UI.oddsReady() ? UI.titleOdds() : null);
export function simWanted() {
  if (!D.started) return;
  if (UI.oddsReady()) { if (SAVED_AT !== LOADED_AT) { SAVED_AT = LOADED_AT; saveOdds(UI.titleOdds()); } return; }
  if (SIMQ) return;
  SIMQ = true;
  UI.warmOdds(v => { SIMQ = false; if (v) { SAVED_AT = LOADED_AT; saveOdds(v); } bump(); });
}
/* this phone keeps the odds it computed after each finished gameweek, so the next week can say who moved */
function saveOdds(v) {
  const g = D.gwsDone; if (!g || D.liveNow || D.provOver) return;
  const s = lsGet('emt-feed-odds', {}) || {};
  if (!s[g]) { s[g] = { title: v.title, last: v.last }; Object.keys(s).map(Number).sort((a, b) => b - a).slice(4).forEach(k => delete s[k]); lsSet('emt-feed-odds', s); }
}
export function oddsBefore() { const s = lsGet('emt-feed-odds', {}) || {}; const g = D.gwsDone - 1; return s[g] ? { gw: g, ...s[g] } : null; }

/* ---------- the Gameweek Show (show/gwN.json + clips) ---------- */
const SHOWS = {}; let SHOWQ = false;
export const shows = () => Object.values(SHOWS).filter(Boolean).sort((a, b) => b.gw - a.gw);
export function showsWanted() {
  if (SHOWQ) return; SHOWQ = true;
  /* a show is published with its written preview, and the show began in GW4 (its preview introduced Malcolm in the booth) */
  const gws = [...new Set((typeof PREVIEWS !== 'undefined' ? PREVIEWS : []).map(p => p.gw).concat(D.gw ? [D.gw] : []))].filter(g => g >= 4);
  let left = gws.length; if (!left) return;
  const fromSheet = g => g === D.gw && D.api ? fetch(D.api + (D.api.indexOf('?') > -1 ? '&' : '?') + 'show=' + g + '&meta=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(r => r && r.ok && r.script && Array.isArray(r.script.chapters) ? r.script : null).catch(() => null) : Promise.resolve(null);
  gws.forEach(g => fetch('show/gw' + g + '.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null).then(j => j || fromSheet(g)).then(j => {
    if (j && j.gw === g && Array.isArray(j.chapters)) {
      const clips = ['open'].concat(...j.chapters.map((c, i) => c.beats.map((_, b) => 'c' + (i + 1) + 'b' + b)), ['close']);
      const txt = k => k === 'open' ? j.open : k === 'close' ? j.close : (j.chapters[+k.slice(1, k.indexOf('b')) - 1] || { beats: [] }).beats[+k.slice(k.indexOf('b') + 1)] || '';
      /* repo clips carry measured lengths; a script still being voiced gets an estimate from its words */
      const dur = clips.reduce((s, k) => s + ((j.dur || {})[k] || (String(txt(k)).replace(/\[[^\[\]]*\]/g, ' ').trim().split(/\s+/).filter(Boolean).length / 2.7 + .9)), 0);   /* the audio tags (v3.26) are not spoken words */
      SHOWS[g] = { gw: g, j, clips, dur, base: 'show/gw' + g + '/', at: dt(j.rendered) };
    } else SHOWS[g] = null;
    if (--left === 0) { bump(); if (['feed', 'matchday'].includes(document.body.dataset.page) && window.MW && !document.getElementById('gs')) window.MW.render({ keepScroll: true }); }
  }));
}
export const mmss = s => { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export { gwDoneTime };
