/* Search: data-open="search" — every player (D.plr + D.ro) and the eight teams, instant, with recent searches. */
import * as UI from '../ui.js';
import * as K from './kit.js';

const esc = UI.esc;
const LS = 'emt-recent';
let Q = '';

function recent() { try { const a = JSON.parse(localStorage.getItem(LS) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function remember(kind, v) {
  try { const a = recent().filter(x => !(x.k === kind && x.v === v)); a.unshift({ k: kind, v }); localStorage.setItem(LS, JSON.stringify(a.slice(0, 8))); } catch (e) { }
}
function pool() {
  return K.memo('srpool', () => {
    const seen = new Set(), out = [];
    (D.plr || []).forEach(p => { seen.add(String(p.Code)); out.push(p); });
    (D.ro || []).forEach(p => { if (!seen.has(String(p.Code))) out.push(p); });
    return out;
  });
}
const ownerOf = p => {
  const ro = (D.ro || []).find(r => String(r.Code) === String(p.Code));
  if (ro && TEAMS[ro.Team]) return ro.Team;
  return p.Owner && TEAMS[p.Owner] ? p.Owner : null;
};
function findPlayers(q, n) {
  const list = pool();
  let rk = list.map(p => ({ p, r: nameRank(p, q) })).filter(o => o.r < Infinity);
  if (!rk.length) rk = list.filter(p => nameMatch(p, q)).map(p => ({ p, r: 5 }));
  if (!rk.length) { const cq = normN(q); if (cq.length > 2) rk = list.filter(p => normN(String(p.Player) + ' ' + String(p['Full name'] || '')).includes(cq)).map(p => ({ p, r: 6 })); }
  return rk.sort((a, b) => a.r - b.r || num(b.p['Season pts']) - num(a.p['Season pts'])).slice(0, n).map(o => o.p);
}
function findTeams(q) {
  const w = normW(q); if (!w) return [];
  return Object.keys(TEAMS).filter(t => { const hay = normW(t + ' ' + UI.short(t) + ' ' + (TEAMS[t].mgr || '') + ' ' + K.nameOf(t)); return w.split(' ').every(x => hay.split(' ').some(h => h.startsWith(x))); });
}
function findClub(q) {
  const w = normW(q); if (w.length < 3) return null;
  return Object.keys(typeof CLUBNAME !== 'undefined' ? CLUBNAME : {}).find(c => c.toLowerCase() === w || normW(CLUBNAME[c]).startsWith(w)) || null;
}

function playerRow(p) {
  const own = ownerOf(p), status = (D.plr || []).find(x => String(x.Code) === String(p.Code)) || p;
  return '<button type="button" class="row tap sr-r" data-open="player:' + esc(p.Code) + '" data-rk="p" data-rv="' + esc(p.Code) + '">' + UI.face(p, 40)
    + '<span class="sr-m"><b class="ell">' + esc(p.Player) + '</b><span class="sub ell">' + esc(p.Pos) + ' · ' + esc(K.clubName(p.Club)) + '</span></span>'
    + UI.statusChip(status)
    + (own ? '<span class="sr-o" title="' + esc(own) + '">' + UI.crest(own, 20) + '<i>' + esc(UI.short(own)) + '</i></span>' : '<span class="chip free">FREE</span>')
    + '<span class="sr-p"><b class="n">' + Math.round(num(p['Season pts'])) + '</b><i>pts</i></span></button>';
}
function teamRow(t) {
  const s = K.standOf(t);
  return '<button type="button" class="row tap sr-r" data-open="manager:' + esc(t) + '" data-rk="t" data-rv="' + esc(t) + '">' + UI.crest(t, 34)
    + '<span class="sr-m"><b class="ell">' + esc(t) + '</b><span class="sub ell">' + esc(K.nameOf(t)) + (s.has ? ' · ' + K.ord(s.pos) + ' · ' + K.recL(s) : '') + '</span></span>'
    + '<span class="sr-ch">' + UI.icon('chev', 16, 'var(--tx3)') + '</span></button>';
}
function results(q) {
  q = (q || '').trim();
  if (!q) {
    const rec = recent().map(x => x.k === 't' ? (TEAMS[x.v] ? teamRow(x.v) : '') : (UI.player(x.v) ? playerRow(UI.player(x.v)) : '')).filter(Boolean);
    return (rec.length ? UI.sh('Recent', { aside: '<button type="button" class="sr-clr" data-clear-recent>Clear</button>' }) + '<div class="card">' + rec.join('') + '</div>' : '')
      + UI.sh('Teams') + '<div class="sr-teams">' + Object.keys(TEAMS).map(t => '<button type="button" data-open="manager:' + esc(t) + '" data-rk="t" data-rv="' + esc(t) + '">' + UI.crest(t, 36) + '<span>' + esc(UI.short(t)) + '</span></button>').join('') + '</div>'
      + (rec.length ? '' : '<p class="sr-hint">Search any Premier League player by name, a club like “Brighton”, or a manager.</p>');
  }
  const ts = findTeams(q), ps = findPlayers(q, 30), club = !ps.length || ps.length < 3 ? findClub(q) : null;
  let html = '';
  if (ts.length) html += UI.sh('Teams') + '<div class="card">' + ts.map(teamRow).join('') + '</div>';
  if (ps.length) html += UI.sh('Players', { aside: ps.length === 30 ? 'top 30' : ps.length + '' }) + '<div class="card">' + ps.map(playerRow).join('') + '</div>';
  if (club) {
    const cp = pool().filter(p => p.Club === club).sort((a, b) => num(b['Season pts']) - num(a['Season pts'])).slice(0, 12);
    if (cp.length) html += UI.sh(K.clubName(club), { aside: 'top ' + cp.length + ' by points' }) + '<div class="card">' + cp.map(playerRow).join('') + '</div>';
  }
  return html || '<div style="height:16px"></div>' + UI.empty('No one matches “' + q + '”', 'Try a surname, a shorter spelling, or a club name.');
}

export default {
  cls: 'sk-search',
  render() {
    return '<div class="sr-wrap"><div class="sr-bar"><label class="sr-in">' + UI.icon('search', 18, 'var(--tx3)', 2.2)
      + '<input type="search" enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Players and teams" aria-label="Search players and teams" value="' + esc(Q) + '">'
      + '<button type="button" class="sr-x"' + (Q ? '' : ' hidden') + ' aria-label="Clear search">' + UI.icon('close', 14, 'var(--tx2)', 2.4) + '</button></label></div>'
      + '<div class="sr-res" data-r="res" aria-live="polite">' + results(Q) + '</div></div>';
  },
  mount(el) {
    const root = el.querySelector('.sr-wrap'); if (!root) return;
    const inp = root.querySelector('input'), res = root.querySelector('[data-r="res"]'), clr = root.querySelector('.sr-x');
    const upd = () => { Q = inp.value; res.innerHTML = results(Q); clr.hidden = !Q; };
    inp.addEventListener('input', upd);
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { const f = res.querySelector('[data-open]'); if (f) { e.preventDefault(); inp.blur(); f.click(); } }
    });
    clr.addEventListener('click', e => { e.preventDefault(); inp.value = ''; upd(); inp.focus(); });
    root.addEventListener('click', e => {
      if (e.target.closest('[data-clear-recent]')) { try { localStorage.removeItem(LS); } catch (er) { } upd(); return; }
      const r = e.target.closest('[data-rk]'); if (r) remember(r.dataset.rk, r.dataset.rv);
    });
    if (!el.dataset.srOpen) { el.dataset.srOpen = '1'; try { inp.focus({ preventScroll: true }); const n = inp.value.length; inp.setSelectionRange(n, n); } catch (e) { } }
  },
  unmount() { Q = ''; },
};
