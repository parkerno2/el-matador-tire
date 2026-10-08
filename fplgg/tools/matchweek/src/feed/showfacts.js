/* feed/showfacts.js — the Gameweek Show and the weekly articles write themselves without anyone's computer.
   · Preview facts: in the last 54 hours before a deadline, any signed-in manager's phone sends the week's facts to the
     league sheet ('showfacts', Code.gs v3.12+), at most once per three-hour slot. The Gameweek Show and the preview
     article (Code.gs v3.13) are both written from them.
   · Recap facts: once every H2H fixture of the latest finished gameweek is final, for five days after its last club
     fixture, the same phones send that gameweek's facts ('artfacts', kind 'recap'), at most once per three-hour slot.
   Every number comes from this app's own engine (the model's win chances and projections, the all-time series, each XI
   with its points, xP, bonus and auto-subs), so what the article says matches what the league sees on screen. */
import { quotes } from './social.js';
import { lsGet, lsSet } from './util.js';

const KEY = 'emt-showfacts', RKEY = 'emt-recapfacts';
const PREVIEW_WINDOW = 54 * 3600e3, RECAP_WINDOW = 5 * 864e5, SLOT = 3 * 3600e3, CAP = 60000;
const r1 = v => Math.round(v * 10) / 10;
const iso = s => { const d = dt(s); return d ? d.toISOString().replace('.000Z', 'Z') : ''; };
const clubFull = c => { try { return clubName(c) || c; } catch (e) { return c; } };
const form = xi => { try { return formation(xi).replace(/–/g, '-'); } catch (e) { return null; } };
const squad = t => (D.ro || []).filter(r => r.Team === t);

/* ---------- the all-time series between two teams, through gameweek g (seeded history plus this season) ---------- */
export function seriesThrough(home, away, g) {
  const x = (TEAMS[home] || {}).ini, y = (TEAMS[away] || {}).ini; if (!x || !y) return null;
  const k = pairKey(x, y), first = k.split('|')[0], sd = SEED[k] || [0, 0, 0], lv = [0, 0, 0];
  (D.fx || []).forEach(f => {
    if (!fin(f.Finished) || num(f.GW) > g) return;
    const a = (TEAMS[f.Home] || {}).ini, b = (TEAMS[f.Away] || {}).ini; if (!a || !b || pairKey(a, b) !== k) return;
    const hp = num(f['Home pts']), ap = num(f['Away pts']);
    if (hp === ap) lv[2]++; else { const w = hp > ap ? a : b; lv[w === first ? 0 : 1]++; }
  });
  const w1 = sd[0] + lv[0], w2 = sd[1] + lv[1], dr = sd[2] + lv[2];
  return x === first ? { home: w1, away: w2, d: dr } : { home: w2, away: w1, d: dr };
}

/* ---------- one side of a matchup in gameweek g: the XI that scored, with auto-subs, xP and bonus ----------
   The current gameweek reads the engine live (autoSubs, as the matchup page does). A finished earlier gameweek reads the
   GW Log (its XI and bench, as League › Results and the Season page do) and replays FPL's auto-sub rule on it; bench order
   isn't logged, so the order whose total equals the sheet's score is the one used. xP is teamXP()'s formula (the picked XI,
   xpOf each GW Stats row); a player's own xP is 0 when he played no minutes, as on the matchup page. */
const playedL = r => num(r['GW mins']) > 0;
function replaySubs(xi0, bench, score) {
  const cnt = (l, pos) => l.reduce((s, x) => s + (x.Pos === pos ? 1 : 0), 0);
  const legal = l => cnt(l, 'GKP') === 1 && cnt(l, 'DEF') >= 3 && cnt(l, 'MID') >= 2 && cnt(l, 'FWD') >= 1;
  const run = order => {
    const xi = xi0.slice(), subs = [], done = new Set();
    order.forEach(b => {
      if (!playedL(b)) return;
      for (let i = 0; i < xi.length; i++) {
        const p = xi[i];
        if (p !== xi0[i] || done.has(i) || playedL(p) || (p.Pos === 'GKP') !== (b.Pos === 'GKP')) continue;
        const trial = xi.slice(); trial[i] = b; if (!legal(trial)) continue;
        xi[i] = b; done.add(i); subs.push({ out: p, inn: b }); break;
      }
    });
    return { xi, subs, sum: xi.reduce((s, r) => s + num(r['GW pts']), 0) };
  };
  const gk = bench.filter(b => b.Pos === 'GKP'), of = bench.filter(b => b.Pos !== 'GKP');
  const perms = a => a.length < 2 ? [a] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map(p => [x].concat(p)));
  const first = run(gk.concat(of));
  if (score == null || first.sum === score) return first;
  for (const p of perms(of)) { const r = run(gk.concat(p)); if (r.sum === score) return r; }
  const none = { xi: xi0.slice(), subs: [], sum: xi0.reduce((s, r) => s + num(r['GW pts']), 0) };
  return none.sum === score ? none : first;
}
function statRow(code, g) { try { return gwsRow(code, g); } catch (e) { return ((g === D.gw ? D.gwsCur : (D.gwsByGw || {})[g]) || {})[String(code)] || null; } }
function playerLine(p, g, ptsOf, minsOf) {
  const code = String(p.Code), r = statRow(code, g), o = { code, name: p.Player, pos: p.Pos, club: p.Club, pts: ptsOf(p), mins: minsOf(p) };
  if (r) { o.g = num(r.G); o.a = num(r.A); o.cs = num(r.CS); o.bonus = num(r.Bonus) || (g === D.gw ? ((D.pbonus || {})[code] || 0) : 0); o.xp = num(r.Mins) > 0 ? r1(xpOf(r)) : 0; }
  return o;
}
export function sideAt(team, g, score) {
  const cur = g === D.gw;
  let picked = [], bench = [], subs = [], eff = [], ptsOf, minsOf;
  if (cur) {
    picked = xiOf(team).slice(); bench = benchOf(team).slice();
    const as = autoSubs(team); eff = as.xi; subs = as.subs.map(s => ({ out: s.out, inn: s.inn }));
    ptsOf = p => num(p['GW pts']) + ((D.pbonus || {})[String(p.Code)] || 0); minsOf = p => num(p['GW mins']);
  } else {
    const rows = (D.gl || []).filter(r => num(r.GW) === g && r.Team === team);
    picked = rows.filter(r => r.Started === 'XI'); bench = rows.filter(r => r.Started === 'BEN');
    const R = replaySubs(picked, bench, score); eff = R.xi; subs = R.subs;
    ptsOf = r => num(r['GW pts']); minsOf = r => num(r['GW mins']);
  }
  const outC = new Set(subs.map(s => String(s.out.Code))), inC = new Set(subs.map(s => String(s.inn.Code)));
  const xi = picked.map(p => { const o = playerLine(p, g, ptsOf, minsOf); o.sub = outC.has(o.code) ? 'out' : null; return o; })
    .concat(subs.map(s => { const o = playerLine(s.inn, g, ptsOf, minsOf); o.sub = 'in'; return o; }));
  const benchL = bench.map(p => { const o = playerLine(p, g, ptsOf, minsOf); delete o.g; delete o.a; delete o.cs; delete o.xp; o.used = inC.has(o.code); return o; });
  const rowsXP = picked.map(p => statRow(p.Code, g));
  const xp = rowsXP.some(Boolean) ? r1(rowsXP.reduce((s, r) => s + (r ? xpOf(r) : 0), 0)) : null;
  const bonus = eff.reduce((s, p) => { const r = statRow(p.Code, g); return s + (num(r && r.Bonus) || (cur ? ((D.pbonus || {})[String(p.Code)] || 0) : 0)); }, 0);
  const sum = eff.reduce((s, p) => s + ptsOf(p), 0);
  const o = { team, mgr: FIRSTOF(team), pts: score == null ? sum : score, xp, bonus, formation: form(eff), xi, bench: benchL };
  if (xp === null) delete o.xp;
  return o;
}

/* ---------- a preview side's numbers in gameweek g: the likely XI's projections, as the matchup page predicts ----------
   This gameweek: the app's own model (epOf, the per-player number on the matchup page; teamProj before the deadline, the
   same pre-match sum after it, so the score doesn't jump at the deadline). An earlier gameweek: the forecast stored for it
   in Predictions, over the XI that was picked. null when there is nothing to show (never a made-up 0.0). */
function predOf(code, g) { const m = (D.predByGw || {})[g] || {}; const v = m[String(code)]; return v == null || v === '' ? null : v; }
function modelOf(code) { try { const v = epOf(code); return v == null || !isFinite(v) ? null : v; } catch (e) { return null; } }
export function likelyXiAt(team, g) {
  if (g === D.gw) { try { return effXiOf(team, true); } catch (e) { return []; } }
  return (D.gl || []).filter(r => num(r.GW) === g && r.Team === team && r.Started === 'XI');
}
export function predictedAt(team, g) {
  if (g === D.gw && !D.dlPassed) { try { const v = teamProj(team); if (v > 0) return v; } catch (e) { } }
  const xi = likelyXiAt(team, g); if (!xi.length) return null;
  let n = 0;
  const s = xi.reduce((t, p) => { const v = projAt(p.Code, g); if (v != null) n++; return t + (v || 0); }, 0);
  return n ? s : null;
}
export const projAt = (code, g) => (g === D.gw ? modelOf(code) : predOf(code, g));
export const flaggedIn = xi => xi.filter(p => { const s = String(p.Status || 'a'); return s === 'd' || 'isun'.includes(s) && s !== ''; });

/* ---------- shared pieces ---------- */
/* g (a recap): the official table, never one with a later gameweek's provisional results folded in */
function tableRows(g) {
  const st = ((g && D.provOver && D.stOfficial) || D.st || []).slice().sort((a, b) => num(b['League Pts']) - num(a['League Pts']) || num(b['Pts For']) - num(a['Pts For']));
  return st.map((s, i) => {
    const o = { pos: i + 1, team: s.Team, mgr: FIRSTOF(s.Team), w: num(s.W), d: num(s.D), l: num(s.L), pts: num(s['League Pts']), pf: num(s['Pts For']), pa: num(s['Pts Against']) };
    if (g) { const f = (D.fx || []).find(x => num(x.GW) === g && (x.Home === s.Team || x.Away === s.Team)); if (f) o.gwPts = num(f.Home === s.Team ? f['Home pts'] : f['Away pts']); }
    return o;
  });
}
function rosters() {
  const out = {};
  Object.keys(TEAMS).forEach(t => { const sq = squad(t); if (sq.length) out[t] = sq.map(p => p.Player + ' (' + p.Club + ')'); });
  return out;
}
/* accepted transactions since the previous gameweek's deadline */
function movesSince(g) {
  const dl = g > 1 ? gwDeadline(g - 1) : null, from = dl ? dl.getTime() : 0;
  return (D.tx || []).filter(t => /^Accepted/i.test(t.Result) && (dt(t['When (UTC)']) || new Date(0)).getTime() > from)
    .sort((a, b) => String(a['When (UTC)']).localeCompare(String(b['When (UTC)'])))
    .map(t => ({ gw: num(t.GW), team: t.Team, in: t.In, out: t.Out, kind: /waiver/i.test(t.Type) ? 'waiver' : /trade/i.test(t.Type) ? 'trade' : 'free agent' }));
}
const plGames = g => (D.cf || []).filter(c => num(c.GW) === g).slice().sort((a, b) => String(a['Kickoff (UTC)']).localeCompare(String(b['Kickoff (UTC)'])));
function weekQuotes(g, full) {
  try {
    return quotes().filter(q => q.gw === g).map(q => full
      ? { team: q.team, mgr: FIRSTOF(q.team), line: q.line, claim: q.claim, model: q.p != null ? Math.round(q.p * 100) + '%' : null, answering: q.re }
      : { team: q.team, mgr: FIRSTOF(q.team), line: q.line });
  } catch (e) { return []; }
}

/* ============================== preview facts ('showfacts') ============================== */
export function computeFacts() {
  const fx = (D.fx || []).filter(f => num(f.GW) === D.gw);
  const res = { kind: 'preview', gw: D.gw, deadline: String(gwDeadline(D.gw)), gwsDone: D.gwsDone, table: tableRows(0), fixtures: [], quotes: [] };
  const results = t => (D.fx || []).filter(f => fin(f.Finished) && (f.Home === t || f.Away === t)).sort((a, b) => num(a.GW) - num(b.GW)).map(f => {
    const me = num(f.Home === t ? f['Home pts'] : f['Away pts']), op = num(f.Home === t ? f['Away pts'] : f['Home pts']);
    return (me > op ? 'W' : me < op ? 'L' : 'D') + me + '-' + op + ' v ' + FIRSTOF(f.Home === t ? f.Away : f.Home) + ' GW' + f.GW;
  });
  const side = t => {
    let xi = []; try { xi = autoSubs(t, true).xi; } catch (e) { }
    const rows = xi.map(x => {
      let ep = null; try { ep = Math.round(projOf(x) * 10) / 10; } catch (e) { }
      let opp = ''; try { opp = (D.cf || []).filter(c => num(c.GW) === D.gw && (c.Home === x.Club || c.Away === x.Club)).map(c => c.Home === x.Club ? 'v ' + c.Away + ' (H)' : 'at ' + c.Home).join(', '); } catch (e) { }
      return { code: String(x.Code), name: x.Player, pos: x.Pos, club: x.Club, status: x.Status || 'a', news: String(x.News || '').slice(0, 80), ep, opp };
    });
    let proj = null; try { proj = Math.round(teamProj(t) * 10) / 10; } catch (e) { }
    let fm = null; try { fm = formation(xi); } catch (e) { }
    return { team: t, mgr: FIRSTOF(t), proj, formation: fm, results: results(t), xi: rows };
  };
  fx.forEach(f => {
    let win = null; try { win = mpxWinPct(hpWin(f)); } catch (e) { }
    let rec = null;
    try {
      const x = (TEAMS[f.Home] || {}).ini, y = (TEAMS[f.Away] || {}).ini, k = pairKey(x, y), first = k.split('|')[0];
      const sd = SEED[k] || [0, 0, 0], lv = LIVEH2H[k] || [0, 0, 0], w1 = sd[0] + lv[0], w2 = sd[1] + lv[1], dr = sd[2] + lv[2];
      rec = x === first ? { home: w1, away: w2, d: dr } : { home: w2, away: w1, d: dr };
    } catch (e) { }
    res.fixtures.push({ home: f.Home, away: f.Away, derby: derbyName(f.Home, f.Away) || null, win, rec, H: side(f.Home), A: side(f.Away) });
  });
  res.quotes = weekQuotes(D.gw, true);
  /* who has who: every real game this gameweek with rostered players (starters and bench) from both sides of a matchup */
  const games = plGames(D.gw);
  res.collisions = fx.map(f => {
    const hs = squad(f.Home), as = squad(f.Away);
    const g = games.map(c => {
      const on = p => p.Club === c.Home || p.Club === c.Away;
      return { pl: clubFull(c.Home) + ' v ' + clubFull(c.Away), ko: iso(c['Kickoff (UTC)']), H: hs.filter(on).map(p => p.Player), A: as.filter(on).map(p => p.Player) };
    }).filter(x => x.H.length && x.A.length);
    return { home: f.Home, away: f.Away, games: g };
  });
  res.slate = games.map(c => ({ home: clubFull(c.Home), away: clubFull(c.Away), ko: iso(c['Kickoff (UTC)']) }));
  res.rosters = rosters();
  res.moves = movesSince(D.gw);
  return res;
}
/* at most one preview post per phone per three-hour slot (and none within 30 minutes of the last try). The recap facts
   ('artfacts') are rate-limited by the server on their own counter (EMT_RF_), so the two kinds never hold each other up:
   main.js sends the recap first, then this, on the same tick. */
let SENT = 0;
export function maybeSendFacts() {
  try {
    if (SENT && Date.now() - SENT < 30 * 60e3) return;
    const a = typeof authRead === 'function' ? authRead() : null;
    if (!a || !D || !D.api || !D.gw || D.dlPassed || !(D.fx || []).some(f => num(f.GW) === D.gw)) return;
    const dl = gwDeadline(D.gw); if (!dl) return;
    const left = dl.getTime() - Date.now(); if (left <= 0 || left > PREVIEW_WINDOW) return;
    const slot = D.gw + ':' + Math.floor(Date.now() / SLOT);
    if (lsGet(KEY, '') === slot) return;
    SENT = Date.now();   /* before the work: a throw below must not retry on every refresh */
    const facts = computeFacts(); if (!facts.fixtures.length) return;
    let body = JSON.stringify(facts);
    if (body.length > CAP) { delete facts.rosters; body = JSON.stringify(facts); }
    if (body.length > CAP) { console.warn('preview facts over ' + CAP + ' characters: not sent'); return; }
    authPost(authBuildReq('showfacts', { team: a.team, token: a.token, gw: D.gw, facts: body }))
      .then(r => { if (r && r.ok) lsSet(KEY, slot); }).catch(() => { });
  } catch (e) { console.error(e); }
}

/* ============================== recap facts ('artfacts', kind 'recap') ============================== */
const lastKick = g => { const k = plGames(g).map(c => dt(c['Kickoff (UTC)'])).filter(Boolean); return k.length ? k[k.length - 1] : null; };
export function recapGw() {
  const g = D && D.gwsDone; if (!g) return 0;
  const fx = (D.fx || []).filter(f => num(f.GW) === g);
  return fx.length && fx.every(f => fin(f.Finished)) ? g : 0;
}
export function computeRecapFacts(g) {
  g = g || recapGw();
  const res = { kind: 'recap', gw: g, table: tableRows(g), fixtures: [], pl: [], rosters: {}, free: [], moves: [], next: null, quotes: [] };
  if (!g) return res;
  (D.fx || []).filter(f => num(f.GW) === g).forEach(f => {
    const hs = num(f['Home pts']), as = num(f['Away pts']);
    res.fixtures.push({ home: f.Home, away: f.Away, derby: derbyName(f.Home, f.Away) || null, hs, as, rec: seriesThrough(f.Home, f.Away, g), H: sideAt(f.Home, g, hs), A: sideAt(f.Away, g, as) });
  });
  res.pl = plGames(g).map(c => {
    const o = { home: clubFull(c.Home), away: clubFull(c.Away), ko: iso(c['Kickoff (UTC)']) };
    if (c['Home goals'] !== '' && c['Home goals'] != null) { o.hs = num(c['Home goals']); o.as = num(c['Away goals']); }
    return o;
  });
  res.rosters = rosters();
  const rows = (D.gwsByGw || {})[g] || {};
  res.free = (D.plr || []).filter(p => p.Owner === 'FREE' && rows[String(p.Code)])
    .map(p => ({ code: String(p.Code), name: p.Player, pos: p.Pos, club: p.Club, pts: num(rows[String(p.Code)].Pts) }))
    .sort((a, b) => b.pts - a.pts).slice(0, 8);
  res.moves = movesSince(g);
  const nf = (D.fx || []).filter(f => num(f.GW) === g + 1), nd = gwDeadline(g + 1);
  if (nf.length || nd) res.next = { gw: g + 1, deadline: nd ? nd.toISOString().replace('.000Z', 'Z') : null, fixtures: nf.map(f => ({ home: f.Home, away: f.Away, derby: derbyName(f.Home, f.Away) || null })) };
  else delete res.next;
  res.quotes = weekQuotes(g, false);
  return res;
}
/* due: signed in, every H2H fixture of the latest finished gameweek final, within five days of its last club fixture,
   and this three-hour slot neither sent nor tried */
let RSENT = 0, RTRIED = '';
function recapSlot() {
  const a = typeof authRead === 'function' ? authRead() : null;
  if (!a || !D || !D.api) return null;
  const g = recapGw(); if (!g) return null;
  const k = lastKick(g); if (!k || Date.now() - k.getTime() > RECAP_WINDOW || Date.now() < k.getTime()) return null;
  const slot = g + ':' + Math.floor(Date.now() / SLOT);
  return lsGet(RKEY, '') !== slot && RTRIED !== slot ? { a, g, slot } : null;
}
export function maybeSendRecapFacts() {
  try {
    if (RSENT && Date.now() - RSENT < 30 * 60e3) return;
    const due = recapSlot(); if (!due) return;
    const { a, g } = due;
    RSENT = Date.now(); RTRIED = due.slot;   /* one try a slot, whatever happens below (a refusal, a throw, too big) */
    const facts = computeRecapFacts(g); if (!facts.fixtures.length) return;
    let body = JSON.stringify(facts);
    if (body.length > CAP) { facts.fixtures.forEach(f => [f.H, f.A].forEach(s => s.bench.forEach(b => { delete b.club; delete b.mins; }))); delete facts.rosters; body = JSON.stringify(facts); }
    if (body.length > CAP) { console.warn('recap facts over ' + CAP + ' characters: not sent'); return; }
    authPost(authBuildReq('artfacts', { team: a.team, token: a.token, gw: g, kind: 'recap', facts: body }))
      .then(r => { if (r && r.ok) lsSet(RKEY, due.slot); }).catch(() => { });
  } catch (e) { console.error(e); }
}
