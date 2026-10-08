/* feed/showfacts.js — the Gameweek Show writes itself without anyone's computer.
   In the last 30 hours before a deadline, any signed-in manager's phone sends the week's facts to the league sheet
   (Code.gs v3.12 'showfacts'), at most every three hours. The facts come from this app's own engine (the model's win
   chances, projections, the all-time series, each XI with flags), so what Malcolm says matches what the show draws.
   Apps Script then has Claude write the script, ElevenLabs voice it, and the app plays it. */
import { quotes } from './social.js';
import { lsGet, lsSet } from './util.js';

const KEY = 'emt-showfacts';
export function computeFacts() {
  const fx = (D.fx || []).filter(f => num(f.GW) === D.gw);
  const res = { gw: D.gw, deadline: String(gwDeadline(D.gw)), gwsDone: D.gwsDone, table: [], fixtures: [], quotes: [] };
  const st = (D.st || []).slice().sort((a, b) => num(b['League Pts']) - num(a['League Pts']) || num(b['Pts For']) - num(a['Pts For']));
  st.forEach((s, i) => res.table.push({ pos: i + 1, team: s.Team, mgr: FIRSTOF(s.Team), w: num(s.W), d: num(s.D), l: num(s.L), pts: num(s['League Pts']), pf: num(s['Pts For']), pa: num(s['Pts Against']) }));
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
    let form = null; try { form = formation(xi); } catch (e) { }
    return { team: t, mgr: FIRSTOF(t), proj, formation: form, results: results(t), xi: rows };
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
  try { res.quotes = quotes().filter(q => q.gw === D.gw).map(q => ({ team: q.team, mgr: FIRSTOF(q.team), line: q.line, claim: q.claim, model: q.p != null ? Math.round(q.p * 100) + '%' : null, answering: q.re })); } catch (e) { }
  return res;
}
let SENT = 0;
export function maybeSendFacts() {
  try {
    if (SENT && Date.now() - SENT < 30 * 60e3) return;
    const a = typeof authRead === 'function' ? authRead() : null;
    if (!a || !D || !D.api || !D.gw || D.dlPassed || !(D.fx || []).some(f => num(f.GW) === D.gw)) return;
    const dl = gwDeadline(D.gw); if (!dl) return;
    const left = dl.getTime() - Date.now(); if (left <= 0 || left > 30 * 3600e3) return;
    const slot = D.gw + ':' + Math.floor(Date.now() / (3 * 3600e3));
    if (lsGet(KEY, '') === slot) return;
    const facts = computeFacts(); if (!facts.fixtures.length) return;
    SENT = Date.now();
    authPost(authBuildReq('showfacts', { team: a.team, token: a.token, gw: D.gw, facts: JSON.stringify(facts) }))
      .then(r => { if (r && r.ok) lsSet(KEY, slot); }).catch(() => { });
  } catch (e) { console.error(e); }
}
