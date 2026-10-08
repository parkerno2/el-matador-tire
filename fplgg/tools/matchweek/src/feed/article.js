/* feed/article.js — the native article reader, #/feed/articles/<id>.
   The words come from the article (written with AI in the cloud, read by the commissioner before anyone else); every
   number in the score headers, star strips and chips is drawn from this app's own data at view time: the real H2H result
   and the XI's points for a recap, the projection engine's predicted score for a preview, xP, bonus, flags and the series.
   The commissioner sees drafts here too, with approve / ask for a rewrite / drop. */
import * as UI from '../ui.js';
import { esc, dt, relTime, short } from './util.js';
import { memo } from './facts.js';
import { sideAt, seriesThrough, predictedAt, projAt, flaggedIn } from './showfacts.js';
import { body, mod, retry, KIND, commishFirst, isCommish, maxRedos } from './articles.js';

const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
const DASH = '<i class="arm-d">–</i>';
const EXT = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
/* the review panel's own state: which step is open, the note being typed, busy, the last error */
export const REV = { id: null, step: '', note: '', busy: false, err: '', focus: false, caret: 0 };
/* after any redraw (Feed mount): the note box gets its focus and caret back if it had them */
export function restoreNote() {
  if (!REV.focus || REV.step !== 'redo') return;
  const t = document.getElementById('ar-note'); if (!t || document.activeElement === t) return;
  t.focus({ preventScroll: true }); const n = Math.min(REV.caret || t.value.length, t.value.length); try { t.setSelectionRange(n, n); } catch (e) { }
}

/* ---------- the app's numbers for one matchup ---------- */
const fxOf = (g, a, b) => (D.fx || []).find(f => num(f.GW) === g && ((f.Home === a && f.Away === b) || (f.Home === b && f.Away === a))) || null;
function scoreFor(f, team) { if (!f) return null; const s = mscore(f); return f.Home === team ? s.hs : s.as2; }
const side = (team, g, score) => memo('art-side|' + team + '|' + g + '|' + score, () => { try { return sideAt(team, g, score); } catch (e) { console.error(e); return null; } });
function playerOf(code, g, sides) {
  for (const s of sides) { if (!s) continue; const x = s.xi.concat(s.bench).find(p => p.code === String(code)); if (x) return { ...x, team: s.team }; }
  const p = UI.player(code); if (p) return { code: String(code), name: p.Player, pos: p.Pos, club: p.Club, team: p.Team || '' };
  const r = (D.gl || []).find(x => String(x.Code) === String(code)); return r ? { code: String(code), name: r.Player, pos: r.Pos, club: r.Club, team: r.Team } : null;
}
/* "4–3" with the leader's first name, or level */
function seriesChip(home, away, g) {
  const r = seriesThrough(home, away, g); if (!r) return null;
  if (!r.home && !r.away && !r.d) return { v: '0–0', who: 'First meeting' };
  const lead = r.home > r.away ? home : r.away > r.home ? away : null, hi = Math.max(r.home, r.away), lo = Math.min(r.home, r.away);
  return { v: hi + '–' + lo, who: (lead ? FIRSTOF(lead) : 'Level') + (r.d ? ' · ' + r.d + ' drawn' : '') };
}

/* ---------- pieces ---------- */
function scoreHead(m, g, rec, f) {
  const H = m.home, A = m.away;
  let l, r, tag, dec = false;
  if (rec) { l = scoreFor(f, H); r = scoreFor(f, A); tag = f && fin(f.Finished) ? 'Full time' : 'Result'; }
  else { const a = predictedAt(H, g), b = predictedAt(A, g); l = a == null ? null : f1(a); r = b == null ? null : f1(b); tag = 'Predicted'; dec = true; }
  const sideHTML = (t, right) => '<div class="arm-s' + (right ? ' r' : '') + '"' + (TEAMS[t] ? ' data-open="manager:' + esc(t) + '" role="button" tabindex="0" aria-label="' + esc(t) + ', manager sheet"' : '') + '>'
    + UI.crest(t, 40) + '<b>' + esc(t) + '</b><span class="sub">' + esc(TEAMS[t] ? FIRSTOF(t) : '') + '</span></div>';
  const big = l == null || r == null ? '<span class="arm-v n">v</span>' : '<span class="arm-big n' + (dec ? ' dec' : '') + '">' + l + DASH + r + '</span>';
  return '<div class="arm-sb">' + (TEAMS[H] ? UI.glow(H, 'left', .42, 200) : '') + (TEAMS[A] ? UI.glow(A, 'right', .3, 200) : '')
    + '<div class="arm-sbk"><span class="wide">' + esc(m.kicker || derbyName(H, A) || 'GW' + g) + '</span><span class="arm-tag' + (rec ? '' : ' pred') + '">' + tag + '</span></div>'
    + '<div class="arm-sbv">' + sideHTML(H) + '<div class="arm-c">' + big + '</div>' + sideHTML(A, true) + '</div></div>';
}
function starStrip(m, g, rec, sides) {
  const st = m.star || {}; if (!st.code) return '';
  const p = playerOf(st.code, g, sides); if (!p) return '';
  let v = null, unit = '';
  if (rec) { v = p.pts != null ? p.pts : (((D.gwsByGw || {})[g] || {})[String(st.code)] || {}).Pts; unit = v === 1 ? 'PT' : 'PTS'; }
  else { const e = projAt(st.code, g); v = e == null ? null : f1(e); unit = 'PROJ'; }
  const meta = [p.pos, p.club, p.team && TEAMS[p.team] ? FIRSTOF(p.team) : ''].filter(Boolean).join(' · ');
  const zero = /zero/i.test(st.label || ''), limbo = /limbo/i.test(st.label || '');
  return '<button class="arm-star' + (zero ? ' zero' : limbo ? ' limbo' : '') + '" data-open="player:' + esc(p.code) + '">' + UI.face(p.code, 56, { bg: 'var(--top)' })
    + '<span class="arm-st"><em>' + esc(st.label || (rec ? 'Star of the match' : 'Player to watch')) + '</em><b>' + esc(p.name) + '</b><span>' + esc(meta) + '</span></span>'
    + (v == null ? '' : '<span class="arm-sp"><b class="n">' + v + '</b><em>' + unit + '</em></span>') + '</button>';
}
function chips(m, g, rec, sides, f) {
  const H = m.home, A = m.away, out = [];
  const chip = (k, v, who) => '<div class="arm-ch"><span class="k">' + k + '</span><b class="n">' + v + '</b>' + (who ? '<span class="arm-who">' + esc(who) + '</span>' : '') + '</div>';
  if (rec) {
    const [h, a] = sides;
    if (h && a && h.xp != null && a.xp != null) out.push(chip('xP', f1(h.xp) + DASH + f1(a.xp)));
    if (h && a) out.push(chip('Bonus', h.bonus + DASH + a.bonus));
    const s = seriesChip(H, A, g); if (s) out.push(chip('Series', s.v, s.who));
  } else {
    const a = predictedAt(H, g), b = predictedAt(A, g);
    if (a != null && b != null) { const d = a - b; out.push(chip('Predicted', Math.abs(d) < .05 ? 'Level' : '+' + f1(Math.abs(d)), Math.abs(d) < .05 ? '' : FIRSTOF(d > 0 ? H : A))); }
    if (g === D.gw && TEAMS[H] && TEAMS[A]) out.push(chip('Flags', flaggedIn(xiOf(H)).length + DASH + flaggedIn(xiOf(A)).length, 'in the XI'));
    const s = seriesChip(H, A, g - 1); if (s) out.push(chip('Series', s.v, s.who));
  }
  return out.length ? '<div class="arm-chs n' + out.length + '">' + out.join('') + '</div>' : '';
}
function matchup(m, g, rec) {
  const f = fxOf(g, m.home, m.away);
  const sides = rec && f ? [side(m.home, g, scoreFor(f, m.home)), side(m.away, g, scoreFor(f, m.away))] : [];
  const bl = (m.bullets || []).filter(Boolean);
  return '<article class="arm">' + scoreHead(m, g, rec, f)
    + starStrip(m, g, rec, sides)
    + '<div class="arm-body">'
    + (m.story ? '<p class="arm-story">' + esc(m.story) + '</p>' : '')
    + (bl.length ? '<ul class="arm-bl">' + bl.map(b => '<li>' + esc(b) + '</li>').join('') + '</ul>' : '')
    + chips(m, g, rec, sides, f)
    + (m.number && m.number.value != null && String(m.number.value) !== '' ? '<div class="arm-num"><b class="n">' + esc(m.number.value) + '</b><span><em>Number of the match</em>' + esc(m.number.caption || '') + '</span></div>' : '')
    + '</div></article>';
}
function around(list) {
  const S = (list || []).filter(s => s && (s.body || (s.bullets || []).length));
  if (!S.length) return '';
  return '<div class="card ar-around">' + S.map(s => '<section class="ar-sec"><h3>' + esc(s.h || '') + '</h3>' + (s.body ? '<p>' + esc(s.body) + '</p>' : '')
    + ((s.bullets || []).filter(Boolean).length ? '<ul class="arm-bl">' + s.bullets.filter(Boolean).map(b => '<li>' + esc(b) + '</li>').join('') + '</ul>' : '') + '</section>').join('') + '</div>';
}
function sources(list) {
  const S = (list || []).filter(s => s && s.name && /^https?:\/\//i.test(String(s.url || '')));
  if (!S.length) return '';
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  return UI.sh('Sources', { aside: S.length + (S.length === 1 ? ' report' : ' reports') }) + '<div class="card ar-src">' + S.map(s => '<a class="row tap ar-srow" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer"><span class="ar-srt"><b>' + esc(s.name) + '</b><span class="sub">' + esc(host(s.url)) + '</span></span>' + EXT + '<span class="sr">, opens in a new tab</span></a>').join('') + '</div>';
}

/* ---------- the commissioner's read ---------- */
function reviewPanel(b) {
  const g = +b.gw, kind = KIND(b.kind).toLowerCase(), left = Math.max(0, maxRedos - (+b.redos || 0));
  const R = REV.id === b.id ? REV : { step: '', note: '', busy: false, err: '' };
  const meta = [b.written ? 'Written ' + (r => /^\d+[mh]$/.test(r) ? r + ' ago' : r)(relTime(dt(b.written))) : '', b.model ? esc(b.model) : '', b.redos ? b.redos + (b.redos === 1 ? ' rewrite' : ' rewrites') + ' so far' : ''].filter(Boolean).join(' · ');
  let inner;
  if (R.step === 'redo') {
    inner = '<label class="ar-rl" for="ar-note">What should change?</label><div class="ar-nw"><textarea id="ar-note" data-am-note maxlength="400" rows="4" placeholder="For example: shorter on the derby, lead with the red card">' + esc(R.note) + '</textarea><span class="ar-nn n">' + (400 - R.note.length) + '</span></div>'
      + '<div class="ar-acts two"><button class="btn" data-am="redo-send"' + (R.busy ? ' disabled' : '') + '>' + (R.busy ? 'Sending…' : 'Send') + '</button><button class="btn ghost" data-am="cancel"' + (R.busy ? ' disabled' : '') + '>Cancel</button></div>'
      + '<p class="ar-rn">Only the writing is redone, from the same research. ' + (left === 1 ? 'This is the last rewrite.' : left + ' rewrites left.') + '</p>';
  } else if (R.step === 'drop') {
    inner = '<p class="ar-rq"><b>Drop the GW' + g + ' ' + kind + '?</b> Nobody sees it, and it isn’t written again automatically.</p>'
      + '<div class="ar-acts two"><button class="btn danger" data-am="drop-yes"' + (R.busy ? ' disabled' : '') + '>' + (R.busy ? 'Dropping…' : 'Yes, drop it') + '</button><button class="btn ghost" data-am="cancel"' + (R.busy ? ' disabled' : '') + '>Keep it</button></div>';
  } else {
    inner = '<div class="ar-acts"><button class="btn block" data-am="approve"' + (R.busy ? ' disabled' : '') + '>' + (R.busy ? 'Publishing…' : 'Approve and publish') + '</button>'
      + '<div class="ar-acts two"><button class="btn ghost" data-am="redo-open"' + (left ? '' : ' disabled') + '>Ask for a rewrite</button><button class="btn line" data-am="drop-ask">Drop it</button></div></div>'
      + (left ? '' : '<p class="ar-rn">No rewrites left on this one.</p>');
  }
  return '<div class="card ar-rev" id="ar-rev"><div class="ar-revh"><b>Your read</b>' + (meta ? '<span class="sub">' + meta + '</span>' : '') + '</div>'
    + (b.note ? '<p class="ar-rn">Your last note: “' + esc(b.note) + '”</p>' : '') + inner + (R.err ? '<p class="pq-err">' + esc(R.err) + '</p>' : '') + '</div>';
}

/* ---------- the page ---------- */
export function readerHead() {
  return UI.pageHead('Feed', { body: '<div class="ttl arr-ttl"><a class="arr-back" href="#/feed/articles" aria-label="Back to articles">' + UI.icon('back', 18, 'var(--b300)', 2.4) + '<span>Articles</span></a></div>' });
}
export function reader(id) {
  const b = body(id);
  if (!b.ok) {
    if (b.loading) return '<div class="arr arr-wait"><div class="skel"></div><div class="skel s"></div><div class="skel"></div></div>';
    const off = b.missing === 'net';
    return '<div class="arr"><div style="height:14px"></div>' + UI.empty(off ? 'Couldn’t load this article' : 'This article isn’t available', off ? 'Check your connection and try again.' : 'It may not be published yet. Every published preview and recap is in Articles.')
      + '<div class="arr-mt">' + (off ? '<button class="btn ghost" data-am="retry" data-id="' + esc(id) + '">Try again</button>' : '<a class="btn ghost" href="#/feed/articles">All articles</a>') + '</div></div>';
  }
  const A = b.a, rec = KIND(b.kind || (A && A.kind)) === 'Recap', g = +(b.gw || (A && A.gw)) || 0, kind = rec ? 'Recap' : 'Preview';
  const draft = !!b.draft, failed = draft && b.status === 'failed';
  if (!A) {
    const back = '<div class="arr-mt"><a class="btn ghost" href="#/feed/articles">' + (failed ? 'Back to Articles to try again' : 'All articles') + '</a></div>';
    return '<div class="arr"><div class="ar-hero"><div class="ar-kick"><span class="ar-gw n">GW' + g + '</span><span class="ar-kd">' + kind + '</span></div><h1 class="ar-h1">The GW' + g + ' ' + kind.toLowerCase() + (failed ? ' couldn’t be written' : ' is being written') + '</h1>'
      + '<p class="ar-sub">' + (failed ? (b.error ? esc(String(b.error).slice(0, 300)) : 'It stopped after three tries.') : (b.note ? 'Rewriting with your note. ' : '') + 'It comes back here for your read when it’s done, usually within the hour.') + '</p></div>' + back + '</div>';
  }
  const writing = draft && !failed && b.status !== 'draft';
  const when = b.approved ? dt(b.approved) : b.written ? dt(b.written) : null;
  const hero = '<header class="ar-hero"><div class="ar-kick"><span class="ar-gw n">GW' + g + '</span><span class="ar-kd">' + kind + '</span>' + (when ? '<span class="ar-when">' + esc(UI.day(when)) + '</span>' : '') + '</div>'
    + '<h1 class="ar-h1">' + esc(A.title || '') + '</h1>' + (A.sub ? '<p class="ar-sub">' + esc(A.sub) + '</p>' : '') + (A.lede ? '<p class="ar-lede">' + esc(A.lede) + '</p>' : '') + '</header>';
  const banner = !draft ? '' : failed
    ? '<div class="ar-draft bad"><span class="ar-dot"></span><span><b>The rewrite failed.</b> This is the previous version, and nobody else can see it. Articles has the reason and a retry.</span></div>'
    : '<div class="ar-draft' + (writing ? ' wip' : '') + '"><span class="ar-dot"></span><span><b>' + (writing ? 'Rewriting.' : 'Draft.') + '</b> ' + (writing ? 'This is the previous version. The new one replaces it here when it’s done.' : 'Only you can see this until you approve it.') + '</span>' + (writing ? '' : '<button class="ar-jump" data-am="jump">Review</button>') + '</div>';
  const credit = '<p class="ar-credit">' + UI.icon('info', 14, 'var(--tx4)') + '<span>Written with AI from league data and match reports. ' + (draft ? 'Not approved yet.' : 'Approved by ' + esc(commishFirst()) + '.') + '</span></p>';
  return '<div class="arr' + (draft ? ' is-draft' : '') + '" data-art="' + esc(id) + '">' + banner + hero
    + '<div class="arms">' + (A.matchups || []).map(m => matchup(m, g, rec)).join('') + '</div>'
    + around(A.around) + sources(A.sources)
    + (A.foot ? '<p class="ar-foot">' + esc(A.foot) + '</p>' : '') + credit
    + (draft && !writing && !failed && isCommish() ? reviewPanel(b) : '')
    + '<div class="arr-end"><a class="btn ghost" href="#/feed/articles">' + UI.icon('back', 16, 'var(--tx)', 2.2) + 'All articles</a></div>'
    + '</div>';
}

/* ---------- taps ---------- */
function rerender() { if (window.MW) window.MW.render({ keepScroll: true }); }
function act(id, op) {
  const R = REV; if (R.busy) return;
  if (op === 'redo' && R.note.replace(/\s+/g, ' ').trim().length < 4) { R.err = 'Say what should change first.'; rerender(); return; }
  R.busy = true; R.err = ''; rerender();
  const b = body(id), label = 'GW' + (b.gw || '') + ' ' + KIND(b.kind).toLowerCase();
  mod(id, op, R.note).then(r => {
    R.busy = false;
    if (!r || !r.ok) { R.err = r && r.error ? errText(r.error) : 'That didn’t go through. Try again.'; rerender(); return; }
    REV.step = ''; REV.note = ''; REV.id = null;
    if (op === 'approve') { UI.toast('Published. Everyone can read the ' + label + ' now.'); rerender(); scrollTo(0, 0); }
    else { UI.toast(op === 'redo' ? 'Sent. The rewrite comes back here for your read.' : 'Dropped. The ' + label + ' won’t be published.'); location.hash = '#/feed/articles'; }
  });
}
/* a failed article, from the queue: write it again from the stored research (one of its three rewrites) */
function again(id) {
  if (REV.busy) return;
  REV.busy = true; REV.err = ''; rerender();
  const b = body(id), label = 'GW' + (b.gw || '') + ' ' + KIND(b.kind).toLowerCase();
  mod(id, 'redo', '').then(r => {
    REV.busy = false;
    if (r && r.ok) UI.toast('Sent. The ' + label + ' is being written again.');
    else UI.toast(r && r.error ? errText(r.error) : 'That didn’t go through. Try again.');
    rerender();
  });
}
const errText = e => ({
  auth: 'Your sign-in has expired. Sign in again from the menu.', commish: 'Only the commissioner can do this.', notcommish: 'Only the commissioner can do this.',
  redos: 'No rewrites left on this one.', notfound: 'This draft has moved on. Go back to Articles for the latest.', notdraft: 'This draft has already been dealt with.',
  live: 'This one is already published.', busy: 'It’s already being rewritten.', noarticle: 'There’s no article in this draft yet.',
}[e] || (/\s/.test(e) ? e : 'That didn’t go through (' + e + '). Try again.'));
if (typeof document !== 'undefined' && !window.__artTaps) {
  window.__artTaps = 1;
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-am]'); if (!el || el.disabled) return;
    const root = el.closest('[data-art]'), id = root ? root.getAttribute('data-art') : el.getAttribute('data-id');
    const k = el.getAttribute('data-am');
    e.preventDefault();
    if (k === 'retry') { retry(el.getAttribute('data-id')); return; }
    if (!id) return;
    if (REV.id !== id) { REV.id = id; REV.step = ''; REV.note = ''; REV.err = ''; REV.busy = false; }
    if (k === 'jump') { const p = document.getElementById('ar-rev'); if (p) p.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (k === 'approve') { act(id, 'approve'); return; }
    if (k === 'redo-open') { REV.step = 'redo'; REV.err = ''; rerender(); setTimeout(() => { const t = document.getElementById('ar-note'); if (t) { t.focus({ preventScroll: true }); t.scrollIntoView({ block: 'center' }); } }, 30); return; }
    if (k === 'redo-send') { act(id, 'redo'); return; }
    if (k === 'drop-ask') { REV.step = 'drop'; REV.err = ''; rerender(); return; }
    if (k === 'drop-yes') { act(id, 'drop'); return; }
    if (k === 'cancel') { REV.step = ''; REV.err = ''; rerender(); return; }
    if (k === 'again') { again(id); return; }
  });
  document.addEventListener('focusin', e => { if (e.target && e.target.id === 'ar-note') REV.focus = true; });
  /* a data refresh redraws the page under the box: keep the flag (the box is gone, not left) so the mount puts the caret back */
  document.addEventListener('focusout', e => { const t = e.target; if (!t || t.id !== 'ar-note') return; queueMicrotask(() => { if (t.isConnected) REV.focus = false; }); });
  document.addEventListener('input', e => {
    const t = e.target; if (!t || !t.matches || !t.matches('textarea[data-am-note]')) return;
    REV.note = t.value.slice(0, 400); REV.err = ''; REV.caret = t.selectionStart;
    const n = t.parentElement && t.parentElement.querySelector('.ar-nn'); if (n) n.textContent = String(400 - t.value.length);
  });
}
export { short };
