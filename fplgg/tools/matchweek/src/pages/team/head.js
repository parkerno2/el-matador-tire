/* My team: the club header (Overview) and the compact club-coloured header (sub-pages). */
import * as UI from '../../ui.js';
import { esc, frame, record, stRow, results, mgrName, simCached, ord, rgba } from './bits.js';

/* this season's finished results only (formOf pads early weeks with last season's tail) */
/* at full time (FPL not yet closed) the provisional result joins the run, marked as such */
export function formRun(team) {
  return results(team).filter(r => !r.live || D.provOver).slice(-5);
}
function lastLine(r) {
  if (!r) return '';
  const v = r.res === 'W' ? 'Won' : r.res === 'L' ? 'Lost' : 'Drew';
  return v + ' ' + r.my + '\u2013' + r.their + ' ' + (r.home ? 'v' : 'at') + ' ' + r.opp + (r.live ? ', provisional' : '');
}

export function titleCell(team) {
  const s = simCached();
  const v = s && s.title ? pctTxt(s.title[team] || 0) : '';
  return '<b class="n" data-sim="' + esc(team) + '">' + (v || UI.waitN()) + '</b>';
}

export function clubHead(team) {
  const F = frame(team), rec = record(team), st = stRow(team), form = formRun(team), last = form[form.length - 1];
  const under = '<i class="tm-sheen" aria-hidden="true" style="background:linear-gradient(115deg,rgba(255,255,255,0) 40%,' + rgba(F.c.light, .1) + ' 55%,rgba(255,255,255,0) 70%)"></i>'
    + '<span class="tm-wm" aria-hidden="true">' + UI.crest(team, 260) + '</span>';
  const name = String(team), long = name.length > 13;
  const body = '<div class="tm-id">'
    + '<span class="tm-crest">' + UI.crest(team, 86) + '</span>'
    + '<div class="tm-idt">'
    + '<div class="tm-kick"><span class="k">My team</span>'
    + '<button class="tm-clubbtn" data-open="identity" aria-label="Edit club identity">' + UI.icon('edit', 13, '#fff', 2.2) + 'Club</button></div>'
    + '<h1 class="wide' + (long ? ' long' : '') + '">' + esc(name) + '</h1>'
    + '<span class="tm-mgr">' + esc(mgrName(team)) + '</span>'
    + '</div></div>'
    + '<a class="tm-glass" href="#/league/overview" aria-label="League table">'
    + '<span class="tm-stt"><b class="n">' + (rec.pos && D.started ? ord(rec.pos) : '–') + '</b><span>in the table</span></span>'
    + '<span class="tm-stt"><b class="n">' + num(st['League Pts']) + '</b><span>points</span></span>'
    + '<span class="tm-stt"><b class="n">' + rec.w + '–' + rec.d + '–' + rec.l + '</b><span>W–D–L</span></span>'
    + '<span class="tm-stt">' + titleCell(team) + '<span>title chance</span></span>'
    + '</a>'
    + '<div class="tm-formrow"><span class="k">Form</span>'
    + (form.length
      ? '<span class="tm-fms">' + form.map((r, i) => '<span class="fm ' + r.res.toLowerCase() + (i === form.length - 1 ? ' last' : '') + (r.live ? ' prov' : '') + '" title="GW' + r.g + ': ' + esc(lastLine(r)) + '">' + r.res + '</span>').join('') + '</span>'
        + '<span class="tm-lastres">' + esc(lastLine(last)) + '</span>'
      : '<span class="tm-lastres first">No results yet. GW' + D.gw + ' is the first.</span>')
    + '</div>';
  return '<div class="tm-head" style="' + F.vars + '">' + UI.pageHead('', { bg: F.head, under, body }) + '</div>';
}

export function compactHead(team) {
  const F = frame(team);
  const body = '<div class="ttl tm-ttl">' + UI.crest(team, 34) + '<h1>My team</h1></div>';
  return '<div class="tm-head tm-head-s" style="' + F.vars + '">' + UI.pageHead('My team', { bg: F.headS, body }) + '</div>';
}
