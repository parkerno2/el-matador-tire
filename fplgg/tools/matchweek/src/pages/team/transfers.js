/* My team · Transfers: free agents (search, position, sort) and league activity. Claims are made in FPL Draft. */
import * as UI from '../../ui.js';
import { esc, memo, f1, chips, ppg, apps, lastSum, oppChip, POSN, chev, mgrName } from './bits.js';

const DRAFT = 'https://draft.premierleague.com/';
export const FA = { q: '', pos: 'ALL', sort: 'tot', n: 20, tx: 'all', txAll: false, focus: false };
try { const v = JSON.parse(localStorage.getItem('emt-tm-fa') || '{}'); if (['ALL', 'GKP', 'DEF', 'MID', 'FWD'].includes(v.pos)) FA.pos = v.pos; if (['tot', 'avg', 'form'].includes(v.sort)) FA.sort = v.sort; } catch (e) { }
export function saveFA() { try { localStorage.setItem('emt-tm-fa', JSON.stringify({ pos: FA.pos, sort: FA.sort })); } catch (e) { } }

/* free agents carry their true status; a doubt keeps its percentage (plrPseudo flattens it, so read the Players row directly) */
function pool() { return memo('fa', () => (D.plr || []).filter(p => p.Owner === 'FREE')); }
function nextFx(club) { return (D.cf || []).filter(x => !fin(x.Started) && !fin(x.Finished) && (x.Home === club || x.Away === club)).sort((a, b) => num(a.GW) - num(b.GW) || String(a['Kickoff (UTC)']).localeCompare(String(b['Kickoff (UTC)'])))[0]; }

export function faRows() {
  let rows = pool();
  const q = FA.q.trim();
  /* word starts first (as the search sheet does); a glued query ("vandijk") only within one name, never across the two */
  const glued = p => { const c = normN(q); return c.length > 2 && [p.Player, p['Full name']].some(x => normN(String(x || '')).includes(c)); };
  if (q) { const hit = rows.filter(p => nameRank(p, q) < Infinity); rows = hit.length ? hit : rows.filter(glued); }
  if (FA.pos !== 'ALL') rows = rows.filter(p => p.Pos === FA.pos);
  /* per game ranks players with two or more games first, so a single cameo can't top the list */
  const key = FA.sort === 'avg' ? (p => (apps(p.Code) >= 2 ? 1000 : 0) + ppg(p)) : FA.sort === 'form' ? lastSum : (p => num(p['Season pts']));
  return rows.slice().sort((a, b) => key(b) - key(a) || num(b['Season pts']) - num(a['Season pts']) || String(a.Player).localeCompare(String(b.Player)));
}
function faRow(p) {
  const nf = nextFx(p.Club);
  const a = ppg(p);
  const val = FA.sort === 'avg' ? '<b class="n">' + (a ? f1(a) : '–') + '</b><span class="sub">a game</span>' : FA.sort === 'form' ? '<b class="n">' + lastSum(p) + '</b><span class="sub">last 5</span>' : '<b class="n">' + num(p['Season pts']) + '</b><span class="sub">pts</span>';
  return '<div class="row tap tm-far" data-open="player:' + esc(p.Code) + '" role="button" tabindex="0">'
    + UI.face(p, 40, p.Status === 'd' ? { ring: 'var(--doubt)' } : 'isun'.includes(p.Status || 'a') ? { ring: 'var(--loss)' } : {})
    + '<div class="tm-sm"><div class="tm-sn"><b class="ell">' + esc(p.Player) + '</b>' + UI.statusChip(p) + '</div>'
    + '<span class="sub">' + POSN[p.Pos] + ' · ' + esc(clubName(p.Club)) + (FA.sort !== 'tot' ? ' · <span class="n">' + num(p['Season pts']) + '</span> pts' : '') + (FA.sort !== 'avg' && a ? ' · <span class="n">' + f1(a) + '</span> a game' : '') + '</span>'
    + '<div class="tm-sc">' + chips(p, 5, 1) + (nf ? '<span class="tm-nf"><span class="sub n">GW' + num(nf.GW) + '</span>' + oppChip(p.Club, nf) + '</span>' : '') + '</div></div>'
    + '<div class="tm-spt">' + val + '</div></div>';
}
export function faListHTML() {
  const rows = faRows(), show = rows.slice(0, FA.n);
  const q = FA.q.trim();
  if (!rows.length) return '<div class="tm-fal">' + UI.empty(q ? 'No free agent matches “' + q + '”' : 'No free agents here', q ? 'Check the spelling, or he may be on a roster: search any player from the top bar.' : 'Every player in this position is on a roster.') + '</div>';
  return '<div class="tm-fal"><div class="tm-fac sub">' + rows.length + ' free agent' + (rows.length === 1 ? '' : 's') + (rows.length > show.length ? ' · top ' + show.length : '') + (FA.sort === 'avg' ? ' · two games or more first' : '') + '</div>'
    + '<div class="card tm-sq">' + show.map(faRow).join('') + '</div>'
    + (rows.length > show.length ? '<button class="btn ghost tm-more" data-famore="1">Show ' + Math.min(20, rows.length - show.length) + ' more</button>' : '') + '</div>';
}

/* ---------- league activity (D.tx): raw API codes never reach the screen ---------- */
function txResult(r) {
  r = String(r || '').trim();
  if (/^[a-z]{1,3}$/.test(r)) r = 'Denied';
  r = r.replace(/\s*[—–]\s*/g, ', ');
  const ok = /accept/i.test(r), pend = /pend/i.test(r);
  const m = /^([^(]+)\(([^)]+)\)/.exec(r);
  return { ok, pend, main: (m ? m[1] : r).trim(), why: m ? m[2].trim() : '' };
}
function txRow(t, mine) {
  const R = txResult(t.Result);
  const tm = TEAMS[t.Team] ? t.Team : null;
  return '<div class="row tm-tx' + (mine ? ' mine' : '') + (R.ok || R.pend ? '' : ' no') + '"' + (tm ? ' data-open="manager:' + esc(tm) + '"' : '') + '>'
    + (tm ? UI.crest(tm, 24) : '<span class="tm-txc"></span>')
    + '<div class="tm-txm"><b class="ell">' + esc(tm ? UI.short(tm) : t.Team || '') + (mine ? ' <span class="chip free">YOU</span>' : '') + '</b>'
    + '<span class="sub">' + esc(t.Type || 'Move') + ' · <span class="' + (R.ok ? 'win-c' : R.pend ? 'doubt-c' : 'loss-c') + '">' + esc(R.main) + '</span>' + (R.why ? ' (' + esc(R.why) + ')' : '') + '</span></div>'
    + '<div class="tm-txio"><span class="in"><i aria-label="In">IN</i>' + esc(t.In || '–') + '</span><span class="out"><i aria-label="Out">OUT</i>' + esc(t.Out || '–') + '</span></div>'
    + '</div>';
}
function activity(team) {
  const tx = (D.tx || []).slice().sort((a, b) => num(b.GW) - num(a.GW) || String(b['When (UTC)'] || '').localeCompare(String(a['When (UTC)'] || '')));
  if (!tx.length) return UI.sh('League activity') + UI.empty('No moves yet', 'Every waiver, free-agent pickup and trade lands here, accepted or denied.');
  const mineN = tx.filter(t => t.Team === team).length;
  const seg = '<div class="tm-ctl"><span class="seg" role="tablist" aria-label="Whose moves"><button data-tx="all" role="tab" aria-selected="' + (FA.tx === 'all') + '"' + (FA.tx === 'all' ? ' class="on"' : '') + '>Everyone</button><button data-tx="mine" role="tab" aria-selected="' + (FA.tx === 'mine') + '"' + (FA.tx === 'mine' ? ' class="on"' : '') + '>Yours · ' + mineN + '</button></span></div>';
  const rows = FA.tx === 'mine' ? tx.filter(t => t.Team === team) : tx;
  const lim = FA.txAll ? rows.length : 12, show = rows.slice(0, lim);
  let html = '', g = null;
  show.forEach(t => {
    if (t.GW !== g) { if (g !== null) html += '</div>'; g = t.GW; html += '<div class="tm-sgh k">Gameweek ' + esc(t.GW) + '</div><div class="card tm-txl">'; }
    html += txRow(t, t.Team === team);
  });
  if (g !== null) html += '</div>';
  if (!show.length) html = UI.empty('No moves from you yet', 'Your waivers and pickups show here, highlighted.');
  return UI.sh('League activity', { aside: tx.length + ' move' + (tx.length === 1 ? '' : 's') }) + seg + html
    + (rows.length > lim ? '<button class="btn ghost tm-more" data-txall="1">Show all ' + rows.length + '</button>' : '');
}

export function transfersPage(team) {
  const seg = (attr, cur, items, lab) => '<span class="seg" role="tablist" aria-label="' + lab + '">' + items.map(([k, l]) => '<button data-' + attr + '="' + k + '" role="tab" aria-selected="' + (cur === k) + '"' + (cur === k ? ' class="on"' : '') + '>' + l + '</button>').join('') + '</span>';
  return '<a class="card tm-claim" href="' + DRAFT + '" target="_blank" rel="noopener">'
    + '<span class="tm-claimi" aria-hidden="true">' + UI.icon('info', 18, 'var(--b300)', 2) + '</span>'
    + '<span><b>Claims are made in FPL Draft</b><span class="sub">Waivers and free-agent pickups go through the FPL Draft app or site. This page helps you choose.</span></span>'
    + '<span class="tm-claimgo">Open ' + chev + '</span></a>'
    + UI.sh('Free agents')
    + '<div class="tm-fa"><label class="tm-search">' + UI.icon('search', 16, 'var(--tx3)', 2.2) + '<input type="search" id="tm-faq" placeholder="Search free agents" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(FA.q) + '" aria-label="Search free agents"></label>'
    + '<div class="tm-ctl">' + seg('fapos', FA.pos, [['ALL', 'All'], ['GKP', 'GK'], ['DEF', 'DEF'], ['MID', 'MID'], ['FWD', 'FWD']], 'Position') + '</div>'
    + '<div class="tm-ctl"><span class="sub">Sort</span>' + seg('fasort', FA.sort, [['tot', 'Total'], ['avg', 'Per game'], ['form', 'Last 5']], 'Sort free agents') + '</div>'
    + '<div id="tm-fal">' + faListHTML() + '</div></div>'
    + activity(team);
}
