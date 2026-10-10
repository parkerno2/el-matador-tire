/* matchday/week.js — the gameweek's mechanics: deadline, what's left by day, auto-subs, provisional bonus, next deadline */
import * as UI from '../../ui.js';
import * as M from './model.js';
import { subLines } from './matchup.js';
import { nameHTML } from './overview.js';

const esc = UI.esc;

function timeline(ph) {
  const dl = M.deadline(), k1 = M.firstKo(), kN = M.lastKo(), nd = M.nextDeadline(), now = new Date();
  const cf = M.gwCf(), first = cf[0], last = cf[cf.length - 1];
  const items = [];
  const st = d => !d ? 'nx' : d <= now ? 'dn' : 'nx';
  if (dl) items.push({ s: st(dl), t: 'Deadline', d: M.tFull(dl), x: dl > now ? '<span data-md-until="' + dl.getTime() + '">in ' + M.until(dl) + '</span>. Lineups lock.' : 'Lineups locked.' });
  if (k1) items.push({ s: ph === 'locked' ? 'nw' : st(k1), t: 'First kick-off', d: M.tFull(k1), x: esc(M.fxLabel(first)) + (ph === 'locked' ? ' · <span data-md-until="' + k1.getTime() + '">in ' + M.until(k1) + '</span>' : '') });
  if (ph === 'live') { const lv = cf.filter(M.liveFx).length, left = cf.filter(x => !fin(x.Started)).length; items.push({ s: 'nw', t: 'Now', d: lv ? lv + ' live' : 'Between games', x: left + ' game' + (left === 1 ? '' : 's') + ' still to kick off' }); }
  if (kN) items.push({ s: ph === 'prov' || ph === 'ft' ? 'dn' : 'nx', t: 'Last kick-off', d: M.tFull(kN), x: esc(M.fxLabel(last)) });
  items.push({ s: ph === 'ft' ? 'dn' : ph === 'prov' ? 'nw' : 'nx', t: 'Full time, confirmed', d: ph === 'ft' ? 'Done' : ph === 'prov' ? 'Waiting on FPL' : 'After the last match', x: 'FPL adds the official bonus and makes auto-subs final' });
  if (nd) items.push({ s: 'nx', t: 'GW' + (D.gw + 1) + ' deadline', d: M.tFull(nd), x: 'in ' + M.until(nd) });
  return '<div class="card md-tl">' + items.map(i => '<div class="md-ti ' + i.s + '"><i></i><div><span class="k">' + esc(i.t) + '</span><b>' + esc(i.d) + '</b><span class="sub">' + i.x + '</span></div></div>').join('') + '</div>';
}

/* league starters still to kick off, per team and day */
function toPlay(ph) {
  if (ph === 'prov' || ph === 'ft') return '';
  const cf = M.gwCf().filter(x => !fin(x.Started));
  if (!cf.length) return '';
  const days = []; cf.forEach(x => { const d = M.koOf(x), k = M.dayKey(d); if (!days.find(y => y.k === k)) days.push({ k, d }); });
  const me = UI.you();
  const teams = Object.keys(TEAMS).map(t => {
    const T = M.team(t), c = {};
    T.players.forEach(x => x.fxs.forEach(fx => { if (fin(fx.Started)) return; const k = M.dayKey(M.koOf(fx)); c[k] = (c[k] || 0) + 1; }));
    const tot = Object.values(c).reduce((a, b) => a + b, 0);
    return { t, c, tot, live: T.playing.length };
  }).sort((a, b) => (b.t === me) - (a.t === me) || b.tot - a.tot || a.t.localeCompare(b.t));
  const max = Math.max(1, ...teams.flatMap(r => days.map(d => r.c[d.k] || 0)));
  const cols = 'grid-template-columns:minmax(0,1fr) repeat(' + days.length + ',38px) 40px;--md-dn:' + days.length;
  return UI.sh('Still to play', { aside: 'league starters by day' })
    + '<div class="card md-grid"><div class="md-gh" style="' + cols + '"><span></span>' + days.map(d => '<span>' + esc(d.d ? M.tWd(d.d) : 'TBC') + '</span>').join('') + '<span>Left</span></div>'
    + teams.map(r => '<div class="md-gr' + (r.t === me ? ' me' : '') + '" style="' + cols + '"><span class="md-gt" data-open="manager:' + esc(r.t) + '">' + UI.crest(r.t, 18) + '<span class="ell">' + esc(SHORTOF[r.t] || r.t) + '</span>' + (r.live ? '<span class="live-dot" title="' + r.live + ' playing now"><i></i>' + r.live + '</span>' : '') + '</span>'
      + days.map(d => { const v = r.c[d.k] || 0; return '<span class="md-gc' + (v ? '' : ' z') + '" style="--a:' + (v ? (.18 + .62 * v / max).toFixed(2) : 0) + '">' + (v || '·') + '</span>'; }).join('')
      + '<b class="n md-gtot">' + r.tot + '</b></div>').join('')
    + '</div>';
}

/* the table if every live score held: the official table plus this week's results as they stand (tiebreak: points for) */
function ifEnded(ph) {
  if (ph !== 'live' || !(D.st || []).length) return '';
  const row = s => ({ t: s.Team, lp: num(s['League Pts']), pf: num(s['Pts For']), w: num(s.W), d: num(s.D), l: num(s.L) });
  const order = list => list.slice().sort((a, b) => b.lp - a.lp || b.pf - a.pf);
  const before = order(D.st.map(row)), now = {};
  D.st.forEach(s => { now[s.Team] = row(s); });
  M.gwFx().forEach(f => {
    const sc = mscore(f), H = now[f.Home], A = now[f.Away]; if (!H || !A) return;
    H.pf += sc.hs; A.pf += sc.as2;
    if (sc.hs > sc.as2) { H.lp += 3; H.w++; A.l++; } else if (sc.as2 > sc.hs) { A.lp += 3; A.w++; H.l++; } else { H.lp++; A.lp++; H.d++; A.d++; }
  });
  const after = order(Object.values(now)), me = UI.you();
  const rows = after.map((r, i) => {
    const was = before.findIndex(x => x.t === r.t), mv = was - i;
    const move = mv > 0 ? '<span class="md-mv up">' + UI.icon('up', 11, 'currentColor', 3) + mv + '</span>' : mv < 0 ? '<span class="md-mv dn">' + UI.icon('up', 11, 'currentColor', 3) + (-mv) + '</span>' : '<span class="md-mv">–</span>';
    return '<div class="md-tr' + (r.t === me ? ' me' : '') + '" data-open="manager:' + esc(r.t) + '" role="button" tabindex="0"><span class="n md-tp2">' + (i + 1) + '</span>' + move + UI.crest(r.t, 20) + '<span class="ell md-tn">' + nameHTML(r.t) + '</span><span class="n sub">' + r.w + '–' + r.d + '–' + r.l + '</span><span class="n md-tpf">' + r.pf + '</span><b class="n md-tlp">' + r.lp + '</b></div>';
  }).join('');
  const mine = me ? after.findIndex(r => r.t === me) : -1, was = me ? before.findIndex(r => r.t === me) : -1;
  const lead = mine >= 0 ? '<div class="md-tlead">You’d be <b>' + ORD(mine + 1) + '</b>' + (mine < was ? ', up ' + (was - mine) : mine > was ? ', down ' + (mine - was) : ', no change') + '.</div>' : '';
  return UI.sh('If it ended now', { aside: 'live scores held' }) + '<div class="card md-tbl">' + lead + '<div class="md-th"><span>#</span><span></span><span></span><span>Team</span><span>W–D–L</span><span>PF</span><span>Pts</span></div>' + rows
    + '</div>';
}

function autoSubs_() {
  const me = UI.you();
  const ts = Object.keys(TEAMS).sort((a, b) => (b === me) - (a === me) || a.localeCompare(b)).map(M.team);
  const withSubs = ts.filter(T => T.subs.length), none = ts.filter(T => !T.subs.length);
  return UI.sh('Auto-subs', { aside: 'every team' })
    + '<div class="card md-asw">' + (withSubs.length ? withSubs.map(T => '<div class="md-ast"><div class="md-asth" data-open="manager:' + esc(T.t) + '" role="button" tabindex="0">' + UI.crest(T.t, 20) + '<b>' + esc(T.t) + '</b>' + (T.t === me ? '<span class="md-you">YOU</span>' : '') + '</div>' + subLines(T, 'locked') + subLines(T, 'likely') + '</div>').join('') : '<div class="pad sub">' + (M.phase() === 'pre' ? 'None expected yet. Until the deadline, likely lineups already leave out players FPL has flagged.' : 'No auto-subs anywhere so far. Every starter has played or is still due to.') + '</div>')
    + (none.length && withSubs.length ? '<div class="md-asn">' + none.map(T => UI.crest(T.t, 16)).join('') + '<span class="sub">No auto-subs: ' + none.map(T => esc(SHORTOF[T.t] || T.t)).join(', ') + '</span></div>' : '') + '</div>';
}

function provBonus() {
  const pb = D.pbonus || {}; const codes = Object.keys(pb); if (!codes.length) return '';
  const fxs = M.gwCf().filter(x => fin(x.Finished));
  const blocks = fxs.map(x => {
    const rows = codes.map(c => (D.gwsCur || {})[c]).filter(r => r && (r.Club === x.Home || r.Club === x.Away)).map(r => ({ r, b: pb[r.Code] })).sort((a, b) => b.b - a.b || b.r.BPS - a.r.BPS);
    if (!rows.length) return '';
    return '<div class="md-pbx"><div class="md-pbh">' + UI.badge(x.Home, 16) + '<b>' + esc(x.Home) + ' ' + num(x['Home goals']) + '–' + num(x['Away goals']) + ' ' + esc(x.Away) + '</b>' + UI.badge(x.Away, 16) + '</div>'
      + rows.map(o => { const ro = (D.ro || []).find(p => String(p.Code) === String(o.r.Code)); const own = ro && TEAMS[ro.Team] ? ro.Team : null;
        return '<div class="md-pbr" data-open="player:' + esc(o.r.Code) + '" role="button" tabindex="0"><span class="pb lv">+' + o.b + '</span>' + UI.face(o.r.Code, 26) + '<span class="ell"><b>' + esc(o.r.Player) + '</b><span class="sub">' + esc(o.r.Club) + ' · ' + o.r.BPS + ' BPS</span></span>' + (own ? UI.crest(own, 18) + '<span class="sub">' + esc(SHORTOF[own] || own) + '</span>' : '<span class="sub">Not owned</span>') + '</div>'; }).join('') + '</div>';
  }).join('');
  if (!blocks) return '';
  return UI.sh('Provisional bonus') + '<div class="card md-pbw">' + blocks + '</div>';
}

function provNote(ph) {
  if (ph !== 'prov') return '';
  return '<div class="card pad md-prov"><b>All matches finished. Provisional full time.</b><span class="sub">' + (Object.keys(D.pbonus || {}).length ? 'Estimated bonus is counted. ' : '') + 'FPL usually confirms within a few hours; bonus and late stat changes can still move points, and the table updates when it does.</span></div>';
}

export function render() {
  const ph = M.phase();
  if (ph === 'none') return '<div style="height:12px"></div>' + UI.empty('No fixtures yet', 'Gameweek ' + D.gw + ' has no fixtures in the sheet.');
  const pre = ph === 'pre';
  return (ph === 'prov' ? '<div style="height:12px"></div>' + provNote(ph) : '')
    + UI.sh('Gameweek ' + D.gw, { aside: { pre: 'before the deadline', locked: 'locked', live: 'live', prov: 'provisional', ft: 'full time' }[ph] })
    + timeline(ph)
    + (pre && !lineupsLocked() ? '<p class="md-cap">Likely lineups until the deadline.</p>' : '')
    + toPlay(ph) + ifEnded(ph) + autoSubs_() + provBonus();
}
