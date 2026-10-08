/* My team · Lineup: small Plate cards on a pitch in your colours (or a list with the numbers alone), the bench in auto-sub order, Jive's selection call. */
import * as UI from '../../ui.js';
import { jiveCall } from '../../feed/index.js';
import { mediaHTML } from '../../feed/render.js';
import { esc, safe, frame, f1, words, list, plateMarked, subMarks, gwFix, oppChip, curFx, chanceOf, chanceTxt, POSN, asOf, projOfTeam } from './bits.js';
import { gwState } from './overview.js';

export const VIEW = { lineup: 'pitch' };
try { const v = localStorage.getItem('emt-tm-lview'); if (v === 'list' || v === 'pitch') VIEW.lineup = v; } catch (e) { }

const ORDER = { GKP: 0, DEF: 1, MID: 2, FWD: 3 };
const outLabel = p => { const s = p.Status; return s === 's' ? 'BANNED' : s === 'd' ? chanceTxt(p).toUpperCase() : 'OUT'; };

/* lines from the back: GK, DEF, MID, FWD; a five-man line splits 3 + 2 (two holders behind three, or three centre-backs behind two wing-backs) */
function lines(xi) {
  const out = [];
  ['FWD', 'MID', 'DEF', 'GKP'].forEach(pos => {
    const g = xi.filter(p => p.Pos === pos);
    if (!g.length) return;
    if (g.length >= 5) {
      if (pos === 'MID') { out.push({ pos, ps: g.slice(0, 3) }); out.push({ pos, ps: g.slice(3) }); }
      else { out.push({ pos, ps: g.slice(3) }); out.push({ pos, ps: g.slice(0, 3) }); }
    } else out.push({ pos, ps: g });
  });
  return out;
}

export function lineupData(team) {
  const as = asOf(team, true);
  const xi = as.xi.slice().sort((a, b) => ORDER[a.Pos] - ORDER[b.Pos]);
  const marks = subMarks(as);
  const bench0 = benchOf(team);
  const innSet = new Set(as.subs.map(s => s.inn.Code));
  const f = curFx(team);
  const st = f ? gwState(team, f) : null;
  const fm = ['DEF', 'MID', 'FWD'].map(p => xi.filter(x => x.Pos === p).length).join('-');
  /* doubts that still matter: flagged starters whose match hasn't begun */
  const doubts = xi.filter(p => p.Status === 'd' && !flaggedOut(p) && !fxStarted(p.Club));
  return { as, xi, marks, bench0, innSet, st, fm, doubts };
}

function toolbar(team, L) {
  let val;
  if (!L.st) val = '<span class="sub">No match</span>';
  else if (L.st.st === 'pred') val = '<span class="sub">' + 'Projected' + ' <b class="n">' + L.st.me + '</b></span>';
  else if (L.st.st === 'live') val = '<span class="sub"><span class="live-c">Live</span> <b class="n">' + L.st.me + '</b> · proj <b class="n sm">' + f1(projOfTeam(team)) + '</b></span>';
  else val = '<span class="sub">' + (L.st.st === 'prov' ? 'Provisional' : 'Final') + ' <b class="n">' + L.st.me + '</b></span>';
  let chip = '';
  if (L.doubts.length) {
    const ch = [...new Set(L.doubts.map(chanceOf))];
    chip = '<span class="chip doubt">' + L.doubts.length + (ch.length === 1 && ch[0] !== null ? ' AT ' + ch[0] + '%' : L.doubts.length > 1 ? ' DOUBTS' : ' DOUBT') + '</span>';
  }
  const seg = '<span class="seg" role="tablist" aria-label="View"><button data-lview="pitch" role="tab" aria-selected="' + (VIEW.lineup === 'pitch') + '"' + (VIEW.lineup === 'pitch' ? ' class="on"' : '') + '>Pitch</button><button data-lview="list" role="tab" aria-selected="' + (VIEW.lineup === 'list') + '"' + (VIEW.lineup === 'list' ? ' class="on"' : '') + '>List</button></span>';
  return '<div class="tm-bar"><span class="tm-fmn n">' + L.fm + '</span><i class="tm-vr"></i>' + val + chip + seg + '</div>';
}

function pitch(team, L) {
  const F = frame(team), ls = lines(L.xi), n = Math.max(3, ...ls.map(l => l.ps.length));
  const rows = ls.map(l => '<div class="tm-prow' + (l.pos === 'GKP' ? ' gk' : '') + '">' + (l.pos === 'GKP' ? '<i class="tm-mk-a" aria-hidden="true"></i>' : '') + l.ps.map(p => plateMarked(p, 100, L.marks, true)).join('') + '</div>').join('');
  return '<div class="tm-pitch" style="--s1:' + F.s1 + ';--s2:' + F.s2 + ';--mk:' + F.mark + ';--edge:' + F.edge + ';--n:' + n + ';--gap:' + (n > 3 ? 8 : 12) + 'px">'
    + '<i class="tm-mk-c" aria-hidden="true"></i><i class="tm-mk-o" aria-hidden="true"></i>'
    + '<span class="tm-pwm" aria-hidden="true">' + UI.crest(team, 200) + '</span>'
    + '<div class="tm-rows">' + rows + '</div></div>';
}

/* the bench: as set (auto-sub order); a bench player who comes on is shown on the pitch, the starter he replaces takes his slot here */
function benchSlots(L) {
  const swap = {}; L.as.subs.forEach(s => { swap[s.inn.Code] = s.out; });
  let k = 0;
  return L.bench0.map(p => {
    const lab = p.Pos === 'GKP' ? 'GK' : ['1st', '2nd', '3rd', '4th'][k++] || '';
    const shown = swap[p.Code] || p;
    return { lab, p: shown, swapped: !!swap[p.Code], orig: p };
  });
}
function coverNote(L) {
  const bench = L.bench0.filter(p => !L.innSet.has(p.Code));
  const dOut = L.doubts.filter(p => p.Pos !== 'GKP'), dGk = L.doubts.find(p => p.Pos === 'GKP');
  const bOut = bench.filter(p => p.Pos !== 'GKP');
  const can = bOut.filter(p => !flaggedOut(p) && !(fxStarted(p.Club) && fxFinished(p.Club) && !num(p['GW mins'])));
  const gone = bOut.filter(p => flaggedOut(p));
  const notes = [];
  if (dOut.length && can.length < dOut.length) {
    const ch = [...new Set(dOut.map(chanceOf))];
    const who = can.map(p => esc(p.Player) + (p.Status === 'd' ? ' (' + chanceTxt(p) + ')' : ''));
    const starters = dOut.length === 1 ? esc(dOut[0].Player) + ' (' + chanceTxt(dOut[0]) + ')' : 'your ' + words(dOut.length) + ' ' + (ch.length === 1 && ch[0] !== null ? ch[0] + '% ' : 'doubtful ') + 'starters';
    const lead = gone.length ? '<b>' + esc(list(gone.map(p => p.Player))) + (gone.length > 1 ? ' are' : ' is') + ' out</b>, so ' : '';
    notes.push(lead + (can.length ? (lead ? 'only ' : 'Only ') + list(who) + ' can come on for ' + starters + '.' : (lead ? 'nobody' : 'Nobody') + ' on your bench can come on for ' + starters + '.'));
  }
  if (dGk) {
    const gk = bench.find(p => p.Pos === 'GKP');
    if (!gk || flaggedOut(gk)) notes.push('<b>' + esc(dGk.Player) + ' is ' + chanceTxt(dGk) + '</b> and ' + (gk ? esc(gk.Player) + ' is out' : 'there is no keeper on your bench') + ', so no keeper can come on.');
  }
  return notes.map(t => '<div class="tm-cover">' + t.replace(/^./, c => c.toUpperCase()) + '</div>').join('');
}
function benchBlock(L, asList) {
  const slots = benchSlots(L);
  if (!slots.length) return '';
  const subs = L.as.subs;
  const subLine = subs.length ? '<div class="tm-subs">' + subs.map(s => '<span><b>' + esc(s.inn.Player) + '</b> on for ' + esc(s.out.Player) + (s.kind === 'likely' ? ' <i class="doubt-c">if he misses out</i>' : '') + '</span>').join('') + '</div>' : '';
  const body = asList
    ? '<div class="card tm-list">' + slots.map(s => listRow(s.p, L, s.lab, s.swapped)).join('') + '</div>'
    : '<div class="card tm-bench"><p class="sub">In auto-sub order. The keeper only replaces a keeper.</p><div class="tm-bslots">'
      + slots.map(s => {
        const p = s.p, out = flaggedOut(p) && !s.swapped;
        return '<div class="tm-bs"><span class="tm-bl n">' + (s.swapped ? (L.marks[s.p.Code] === 'outl' ? 'Likely off' : 'Off') : s.lab) + '</span><span class="tm-bc">' + plateMarked(p, 80, L.marks, true) + (out ? '<span class="chip out tm-bout">' + outLabel(p) + '</span>' : '') + '</span></div>';
      }).join('') + '</div>' + subLine + coverNote(L) + '</div>';
  return UI.sh('Bench') + (asList ? subLine.replace('tm-subs', 'tm-subs pad') : '') + body + (asList ? coverNote(L).replace(/tm-cover/g, 'tm-cover solo') : '');
}

/* list view row: face, name, position, club, this week's opponent (difficulty) or score, the number alone (no pill:
   projection muted, live points green, banked points bold; UI.plateNum, the same number the small Plate wears), status */
function listRow(p, L, lab, off) {
  const g = gwFix(p);
  let opp = '<span class="tm-fd blank">BLANK</span>', pts;
  if (!g.blank) {
    if (g.started) opp = '<span class="tm-lsc' + (g.done ? '' : ' on') + '"><b>' + esc(g.opp) + '</b> ' + (g.home ? 'H' : 'A') + ' <span class="n">' + g.sc + '</span>' + (g.done ? '' : ' <span class="live-c n">' + g.min + '′</span>') + '</span>';
    else opp = oppChip(p.Club, g.f) + (g.dbl ? '<span class="tm-dgw">DGW</span>' : '');
  }
  const pn = UI.plateNum(p);
  pts = '<span class="tm-lpts n ' + pn.st + '" title="' + (pn.st === 'bk' ? 'Points' : pn.st === 'live' ? 'Live points' : 'Projected points') + '">' + pn.txt + '</span>';
  const mk = L.marks[p.Code] || '';
  const tag = mk.startsWith('in') ? '<span class="chip ' + (mk.endsWith('l') ? 'doubt' : 'sub') + '">' + (mk.endsWith('l') ? 'LIKELY' : 'SUB') + '</span>' : mk.startsWith('out') ? '<span class="chip mute">OFF</span>' : '';
  return '<div class="row tap tm-lr' + (off ? ' off' : '') + '" data-open="player:' + esc(p.Code) + '" role="button" tabindex="0">'
    + (lab ? '<span class="tm-lslot n">' + esc(off ? 'Off' : lab) + '</span>' : '')
    + UI.face(p, 36, p.Status === 'd' ? { ring: 'var(--doubt)' } : flaggedOut(p) ? { ring: 'var(--loss)' } : {})
    + '<span class="tm-lm"><b class="ell">' + esc(p.Player) + '</b><span class="sub tm-lmeta">' + POSN[p.Pos] + ' · ' + esc(p.Club) + tag + UI.statusChip(p) + '</span></span>'
    + '<span class="tm-lopp">' + opp + '</span>' + pts + '</div>';
}

export function lineupPage(team) {
  const L = lineupData(team);
  if (!L.xi.length) return UI.empty('No lineup yet', 'Your squad shows here once the draft is in.');
  const asList = VIEW.lineup === 'list';
  const live = L.st && (L.st.st === 'live' || L.st.st === 'prov' || L.st.st === 'ft');
  let note;
  if (asList) note = '';
  else note = live ? 'The number on each card: live points in green, banked points once a match ends, and the projection for players still to play.' : 'The number on each card is his projected points. Tap a card for the player sheet.';
  const likely = !lineupsLocked() && !D.dlPassed ? '<p class="sub tm-pnote">Likely lineup until the deadline' + (UI.week().dl ? ' (' + esc(UI.dayHm(UI.week().dl)) + ')' : '') + ': FPL publishes picks then, and last week’s lineup carries forward until it does.</p>' : '';
  const body = asList
    ? '<div class="card tm-list">' + L.xi.map(p => listRow(p, L)).join('') + '</div>'
    : pitch(team, L);
  const call = safe(() => jiveCall(team), null);
  const callHtml = call ? safe(() => mediaHTML(call, false), '') : '';
  return toolbar(team, L) + body
    + (note ? '<p class="sub tm-pnote">' + note + '</p>' : '') + likely
    + benchBlock(L, asList)
    + (callHtml ? UI.sh('From Jive', { more: 'Messages', href: '#/feed/messages' }) + '<div class="tm-post">' + callHtml + '</div>' : '');
}
