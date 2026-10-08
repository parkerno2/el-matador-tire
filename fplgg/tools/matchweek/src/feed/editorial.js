/* feed/editorial.js — one-off stories the voices run by hand (Parker's commissions). The premise can be a joke;
   every number in them still comes from the league data, frozen at the gameweek the story ran, so it never goes stale. */
import { esc, short, relTime, oddsTxt } from './util.js';
import { sim } from './facts.js';

const strong = s => '<strong>' + s + '</strong>';
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
const ordTop = n => n === 1 ? 'top of the table' : ORD[n] + ' in the table';

/* the table and a club's run, using only gameweeks up to g */
function tableTo(g) {
  const T = {};
  Object.keys(TEAMS).forEach(t => { T[t] = { t, w: 0, d: 0, l: 0, pf: 0, pa: 0, res: [] }; });
  (D.fx || []).filter(f => num(f.GW) <= g && fin(f.Finished)).sort((a, b) => num(a.GW) - num(b.GW)).forEach(f => {
    const h = num(f['Home pts']), a = num(f['Away pts']);
    [[f.Home, h, a, f.Away], [f.Away, a, h, f.Home]].forEach(([t, me, op, opp]) => {
      const r = T[t]; if (!r) return;
      r.pf += me; r.pa += op;
      const k = me > op ? 'W' : me < op ? 'L' : 'D'; r[k.toLowerCase()]++; r.res.push({ k, opp, gw: num(f.GW) });
    });
  });
  const rows = Object.values(T).map(r => ({ ...r, pts: r.w * 3 + r.d, n: r.res.length }));
  rows.sort((a, b) => b.pts - a.pts || b.pf - a.pf);
  rows.forEach((r, i) => { r.pos = i + 1; });
  return rows;
}

/* ---------- 7 Oct 2026, before GW6: the Kobbie Mainoo Fan investigation ---------- */
function kmfProbe(out) {
  const T = 'Kobbie Mainoo Fan', G = 5;
  if (!TEAMS[T] || (D.gwsDone || 0) < G) return;
  const rows = tableTo(G), r = rows.find(x => x.t === T); if (!r || !r.n) return;
  let run = 0; for (let i = r.res.length - 1; i >= 0 && r.res[i].k !== 'L'; i--) run++;
  const lastL = [...r.res].reverse().find(x => x.k === 'L');
  const paRank = 1 + rows.filter(x => x.pa < r.pa).length, avgPA = (r.pa / r.n).toFixed(1);
  const mv = (D.tx || []).filter(t => t.Team === T && /accept/i.test(String(t.Result)) && num(t.GW) <= G), moves = mv.length;
  const movesTx = moves === 0 ? 'The club has not made a single move all season. Investigators find that suspicious too.'
    : moves === 1 ? 'The club has made one move all season: ' + esc(mv[0].In) + ' in for ' + esc(mv[0].Out) + ', GW' + num(mv[0].GW) + ' ' + (/waiver/i.test(mv[0].Type) ? 'waivers' : 'free agency') + '. That is under review too.'
    : 'All ' + moves + ' of the club’s completed moves this season are under review.';
  const S = D.gwsDone === G ? sim() : null, last = S && S.last && S.last[T] != null ? oddsTxt(S.last[T]) : null;
  const rec = r.w + '–' + r.d + '–' + r.l, mgr = (TEAMS[T] && TEAMS[T].mgr) || 'Baha';
  const unbeaten = run >= 2 ? 'unbeaten in ' + ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'][run] : '';
  const at = new Date('2026-10-07T13:05:00Z'), at2 = new Date('2026-10-07T13:12:00Z'), hot = Date.now() < Date.parse('2026-10-10T10:00:00Z');
  const article = [
    strong('EXCLUSIVE.') + ' UEFA and FPL have opened a joint investigation into the finances of ' + esc(T) + ', sources close to El Matador Tire confirm.',
    'The club is ' + ordTop(r.pos) + ' after ' + G + ' gameweeks on ' + r.pts + ' points (' + rec + ')' + (unbeaten ? ', ' + unbeaten + (lastL ? ' since losing to ' + esc(lastL.opp) + ' in GW' + lastL.gw : '') : '') + '. Investigators want to know how.',
    'The concern is history. This is the club the league named its last-place market after.' + (last ? ' After GW' + G + ', the model prices finishing last at ' + last + '.' : ''),
    'Opponents have scored ' + r.pa + ' against them, ' + avgPA + ' a week, the ' + (paRank === 1 ? 'fewest' : ORD[paRank] + ' fewest') + ' in the league. A schedule that kind is being looked at closely.',
    'Comparisons with Manchester City are being drawn. ' + movesTx,
    esc(mgr) + ' has not responded to requests for comment. The press room is open until the GW' + (G + 1) + ' deadline.',
  ];
  out.push({
    id: 'ed:kmf-probe', voice: 'archizio', kind: 'breaking', ts: at, time: relTime(at), gw: G, teams: [T], players: [], hot, viral: true,
    text: strong('BREAKING.') + ' UEFA and FPL have opened an investigation into the finances of ' + esc(T) + '. ' + ordTop(r.pos).replace(/^./, c => c.toUpperCase()) + (unbeaten ? ', ' + unbeaten : '') + '. Questions are being asked.',
    media: { type: 'probe', team: T, rec, pos: r.pos, run },
    article,
    facts: 'Satire: the investigation is made up. The numbers are real: H2H Fixtures and Transactions to GW' + G + (last ? ', the title-odds simulation' : ''),
    detail: [{ k: 'Record after GW' + G, v: rec + ' · ' + r.pts + ' pts' }, { k: 'Table', v: ordTop(r.pos) }, { k: 'Points against', v: r.pa + ' (' + avgPA + ' a week)' }, { k: 'Completed moves', v: String(moves) }].concat(last ? [{ k: 'Chance of finishing last', v: last }] : []),
    links: [{ label: short(T), open: 'manager:' + T }], share: 'Breaking: UEFA and FPL open an investigation into ' + T + '. ' + rec + ' after GW' + G + '. Via @archizio',
  });
  out.push({
    id: 'ed:kmf-files', voice: 'clark', kind: 'thumb', ts: at2, time: relTime(at2), gw: G, teams: [T], players: [], hot, viral: true,
    text: strong('THE BAHA FILES.') + ' ' + ordTop(r.pos).replace(/^./, c => c.toUpperCase()) + ', ' + rec + (unbeaten ? ', ' + unbeaten : '') + ', and now UEFA are involved. This is the man with a market named after finishing last. Full video up now.',
    media: { type: 'thumb', img: 'press/kmf-probe.png', t1: 'UNDER INVESTIGATION', t2: 'HOW IS BAHA ' + (r.pos === 1 ? 'TOP' : ORD[r.pos].toUpperCase()) + '?!', lo: 'THE BAHA FILES', chip: 'GW' + G, style: 'split', lock: true },
    facts: 'Satire. Record and table: H2H Fixtures to GW' + G, detail: [{ k: 'Record after GW' + G, v: rec }, { k: 'Table', v: ordTop(r.pos) }],
    links: [{ label: 'Read Archizio’s story', open: 'post:ed:kmf-probe' }], share: 'The Baha Files: how is ' + T + ' ' + (r.pos === 1 ? 'top' : ORD[r.pos]) + '? Via @ClarkMoldridge',
  });
}

export function editorialPosts() {
  const out = [];
  try { kmfProbe(out); } catch (e) { console.error(e); }
  return out;
}
