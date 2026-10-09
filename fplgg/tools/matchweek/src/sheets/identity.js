/* Club identity: data-open="identity".
   Not signed in → claim or sign in with a 4-digit PIN (authPost claim|login → {ok, token}, stored as emt-auth).
   Signed in → the editor: live preview, 12 presets + Mono + Custom (hue, vividness, hex), a clash check that only
   ever suggests, crest shape, emblem, pattern, name and photo. Save → authPost save; whatever the server says, the
   identity applies on this phone at once (PROFILE + localStorage emt-identity) until the league sheet carries it. */
import * as UI from '../ui.js';
import * as K from './kit.js';
import { DEMO } from '../data/tabs.js';   /* the demo league (Q2) has nothing to sign in to */

const esc = UI.esc;
const LS_KEY = 'emt-identity';
const FIELDS = ['color', 'shape', 'emblem', 'pattern', 'manager', 'photo'];
const PRESET_ORDER = ['steel', 'teal', 'olive', 'gold', 'orange', 'red', 'magenta', 'orchid', 'sky', 'lime', 'cream', 'rose', 'mono'];
const SHAPE_ORDER = [['shield', 'Shield'], ['heater', 'Heater'], ['roundel', 'Roundel'], ['pennant', 'Pennant'], ['hex', 'Hexagon']];
const CLASH = 15;   /* OKLab ΔE×100 between accents: below 15 two colours are hard to tell apart in charts */
const APP_CLASH = 10;  /* the app's own purple and you-blue: only a near match is worth a word */
const APP = [{ id: 'app-purple', c: '#7B52D3', label: 'the app’s own purple', lim: APP_CLASH, app: true }, { id: 'app-blue', c: '#7A95FF', label: 'the app’s “you” blue', lim: APP_CLASH, app: true }];

/* ---------- the local override: applied on this phone until the league sheet carries the same values ---------- */
function readLS() { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; } }
function writeLS(o) { try { if (o && o.f && Object.keys(o.f).length) localStorage.setItem(LS_KEY, JSON.stringify(o)); else localStorage.removeItem(LS_KEY); } catch (e) { } }
function serverOf(team) {
  const p = PROFILE[team];
  if (p && p.__srv) return p.__srv;
  const s = {}; FIELDS.forEach(f => s[f] = String((p && p[f]) || ''));
  return s;
}
function ensure(team) {
  if (!PROFILE[team]) PROFILE[team] = {};
  const p = PROFILE[team];
  if (!p.__srv) Object.defineProperty(p, '__srv', { value: serverOf(team), enumerable: false, configurable: true });
  return p;
}
export function applyLocal() {
  const o = readLS(); if (!o || !o.team || !TEAMS[o.team] || !o.f) return;
  const p = ensure(o.team), srv = p.__srv, base = o.base || {};
  Object.keys(o.f).forEach(f => {
    const s = srv[f] || '', mine = o.f[f], was = base[f] || '';
    if (s === mine || s !== was) { delete o.f[f]; delete base[f]; return; }   /* the sheet caught up, or someone changed it there since: the sheet wins */
    p[f] = mine;
  });
  o.base = base; writeLS(o);
}
/* a phone-only identity is offered to the league sheet again in the background (once a session, at most every 6 h),
   so it reaches everyone as soon as the sheet accepts it, without the manager saving again */
let RESYNCED = false;
function resync() {
  const o = readLS(), a = authRead();
  if (RESYNCED || !o || !o.f || !Object.keys(o.f).length || !a || a.team !== o.team || !a.token || !D.api) return;
  if (o.tried && Date.now() - o.tried < 6 * 3600e3) return;
  RESYNCED = true; o.tried = Date.now(); writeLS(o);
  const p = PROFILE[o.team] || {};
  authPost(authBuildReq('save', { team: o.team, token: a.token, color: p.color || '', shape: p.shape || '', photo: p.photo || '', manager: p.manager || '', emblem: p.emblem || '', pattern: p.pattern || '' })).catch(() => { });
}
/* re-apply after every data load (loadProfilesData rebuilds PROFILE from the sheet each time) */
(function wrapLoad() {
  if (typeof window === 'undefined' || typeof window.loadData !== 'function' || window.loadData.__idw) return;
  const ld = window.loadData;
  const w = function () { return ld.apply(this, arguments).then(d => { try { applyLocal(); setTimeout(resync, 4000); } catch (e) { console.error(e); } return d; }); };
  w.__idw = 1; window.loadData = w;
})();

/* ---------- colour maths ---------- */
const labOf = hex => { const { L, C, H } = UI.hexToOklch(hex); return [L, C * Math.cos(H * Math.PI / 180), C * Math.sin(H * Math.PI / 180)]; };
const dE = (a, b) => { const x = labOf(a), y = labOf(b); return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
function hueName(hex) {
  const { L, C, H } = UI.hexToOklch(hex);
  if (C < .035) return L > .9 ? 'white' : 'grey';
  if (H < 15 || H >= 352) return 'pink';
  if (H < 40) return 'red'; if (H < 62) return 'orange'; if (H < 92) return 'gold'; if (H < 118) return 'lime';
  if (H < 160) return 'green'; if (H < 200) return 'teal'; if (H < 235) return 'sky blue'; if (H < 275) return 'blue';
  if (H < 312) return 'purple'; return 'magenta';
}
function colourWord(team) { const c = UI.teamColors(team); return c.key === 'custom' ? hueName(c.accent) : (UI.PRESETS[c.key] || {}).name.toLowerCase(); }
function accentFor(color, team) { return withProfile(team, { color }, () => UI.teamColors(team).accent); }
function others(team) {
  return Object.keys(TEAMS).filter(t => t !== team).map(t => ({ id: t, c: UI.teamColors(t).accent, label: possessive(t) + ' ' + colourWord(t), team: t })).concat(APP);
}
const possessive = t => t + (/s$/.test(t) ? '’' : '’s');
/* the worst clash first (how far under its limit), else the closest colour */
function nearest(team, accent) {
  const all = others(team).map(o => Object.assign({ d: dE(accent, o.c), lim: o.lim || CLASH }, o));
  const hits = all.filter(o => o.d < o.lim).sort((a, b) => (a.d - a.lim) - (b.d - b.lim));
  return hits[0] || all.filter(o => !o.app).sort((a, b) => a.d - b.d)[0];
}
const clampC = c => Math.max(.06, Math.min(c, .16));
const accentOf = (C, H) => UI.oklchToHex(.62, Math.min(clampC(C) * 1.1, .17), H);
/* the most distinct shade near the pick: same family (hue ±40°), any vividness; score = distance to the closest other colour */
function suggest(team, accent) {
  const { C, H } = UI.hexToOklch(accent), os = others(team);
  let best = null;
  for (let d = -40; d <= 40; d += 2) for (let c = .07; c <= .1601; c += .01) {
    const h = (H + d + 360) % 360, a = accentOf(c, h);
    const score = Math.min(...os.map(o => dE(a, o.c) - (o.lim ? o.lim - CLASH : 0)));
    if (!best || score > best.score + .3 || (Math.abs(score - best.score) <= .3 && Math.abs(d) < Math.abs(best.d))) best = { score, d, c, h, a };
  }
  if (!best) return null;
  const hex = UI.oklchToHex(.62, best.c, best.h), real = UI.stepsFromHex(hex).accent;
  return { hex, accent: real, score: Math.min(...os.map(o => dE(real, o.c) - (o.lim ? o.lim - CLASH : 0))) };
}

/* ---------- draft state (survives a data refresh while the sheet is open) ---------- */
let DR = null, CL = { sel: null, err: '', note: '', busy: false, lock: {} }, MSG = null, STATUS_ASKED = false;
function swapProfile(team, fields) {
  const orig = PROFILE[team];
  PROFILE[team] = Object.assign({}, orig || {}, fields);
  return () => { if (orig === undefined) delete PROFILE[team]; else PROFILE[team] = orig; };
}
function withProfile(team, fields, fn) { const undo = swapProfile(team, fields); try { return fn(); } finally { undo(); } }
function draftFor(team) {
  if (DR && DR.team === team) return DR;
  const p = PROFILE[team] || {}, raw = String(p.color || '').trim();
  const eff = UI.teamColors(team);
  const color = /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : UI.PRESETS[raw] ? raw : eff.key === 'custom' ? eff.custom : eff.key;
  const seed = /^#/.test(color) ? color : UI.PRESETS[color].accent, o = UI.hexToOklch(seed);
  DR = { team, color, shape: UI.teamShape(team), emblem: p.emblem === 'initials' ? 'initials' : '', pattern: K.PATTERNS.some(x => x[0] === p.pattern) ? p.pattern : 'plain',
    manager: String(p.manager || '').trim() || (TEAMS[team].mgr || ''), photo: String(p.photo || ''), hue: Math.round(o.H), viv: Math.round(clampC(o.C) * 100), keep: null };
  return DR;
}
const isCustom = d => /^#/.test(d.color);
const profFields = d => ({ color: d.color, shape: d.shape, emblem: d.emblem, pattern: d.pattern === 'plain' ? '' : d.pattern, manager: d.manager, photo: d.photo });

/* ---------- claim / sign in ---------- */
function isClaimed(team) { const l = authClaimedList(); return l ? l.indexOf(team) > -1 : !!(PROFILE[team] && (PROFILE[team].__srv ? Object.values(PROFILE[team].__srv).some(Boolean) : Object.values(PROFILE[team]).some(Boolean))); }
function claimView() {
  const off = !D.api;
  if (CL.sel === null) CL.sel = UI.you();
  const sel = CL.sel, mode = sel && isClaimed(sel) ? 'login' : 'claim';
  const lockMs = sel && CL.lock[sel] ? CL.lock[sel] - Date.now() : 0;
  const teams = authTeams();
  const err = CL.err || (lockMs > 0 ? 'Too many tries. Locked for ' + Math.ceil(lockMs / 60000) + ' min.' : '');
  return '<div class="id-wrap"><div class="id-top"><span class="k">Your club</span><h2>' + (off ? 'Pick your team' : mode === 'login' ? 'Sign in' : 'Claim your team') + '</h2>'
    + '<p class="sub id-lead" data-r="lead">' + (off ? (DEMO ? 'This is the demo league, so there is nothing to sign in to. You can still pick the team you follow.' : 'Logins aren’t switched on yet, so club identity can’t be saved. You can still pick the team you follow.')
      : mode === 'login' ? 'This team is claimed. Enter its PIN to sign in on this phone.' : 'Pick your team and set a 4-digit PIN. Nobody else can claim it after that.') + '</p></div>'
    + (MSG ? '<div class="id-msg ' + MSG.kind + '" role="status">' + MSG.html + '</div>' : '')
    + '<div class="id-teams" role="radiogroup" aria-label="Team">' + teams.map(t => '<button type="button" role="radio" aria-checked="' + (t === sel) + '" class="id-tm' + (t === sel ? ' on' : '') + '" data-tm="' + esc(t) + '">'
      + UI.crest(t, 36) + '<span><b>' + esc(t) + '</b><i>' + esc(UI.first(t)) + (isClaimed(t) ? ' · claimed' : '') + '</i></span></button>').join('') + '</div>'
    + (off ? '' : '<label class="id-pinl" for="id-pin">PIN</label><input id="id-pin" class="id-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="4 digits" aria-describedby="id-err">'
      + '<div class="id-err" id="id-err" role="alert"' + (err ? '' : ' hidden') + '>' + esc(err) + '</div>'
      + '<button type="button" class="btn block id-go"' + (lockMs > 0 || CL.busy ? ' disabled' : '') + '>' + (CL.busy ? (mode === 'login' ? 'Signing in…' : 'Claiming…') : lockMs > 0 ? 'Locked for ' + Math.ceil(lockMs / 60000) + ' min' : mode === 'login' ? 'Sign in' : 'Claim team') + '</button>')
    + '<button type="button" class="id-link" data-browse>' + (off ? 'Follow this team' : 'Just browsing? Follow this team without a PIN') + '</button></div>';
}
function afterSignIn(el, team, token) {
  try { localStorage.setItem('emt-auth', JSON.stringify({ team, token })); } catch (e) { }
  authMarkClaimed(team); UI.setYou(team);
  CL = { sel: null, err: '', note: '', busy: false, lock: CL.lock }; MSG = null; DR = null;
  window.MW.render({ keepScroll: true }); redraw(el); el.scrollTop = 0;
  UI.toast('Signed in as ' + team);
}
/* swap only this sheet's own content, never another sheet stacked on top */
function view() { applyLocal(); const a = authRead(); return a && TEAMS[a.team] && D.api ? editorView(a.team) : claimView(); }
function mountAny(el) { const a = authRead(); if (a && TEAMS[a.team] && D.api) mountEditor(el, a.team); else mountClaim(el); }
function redraw(el) { const w = el.querySelector('.id-wrap'); if (!w || !el.isConnected) return; w.outerHTML = view(); mountAny(el); }
function mountClaim(el) {
  const off = !D.api, root = el.querySelector('.id-wrap'), $ = s => el.querySelector(s);
  if (!root) return;
  const redrawC = () => { redraw(el); };
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-tm]');
    if (t) { CL.sel = t.dataset.tm; CL.err = ''; MSG = null; redrawC(); const p = el.querySelector('#id-pin'); p && p.focus({ preventScroll: true }); return; }
    if (e.target.closest('[data-browse]')) {
      if (!CL.sel) { CL.err = 'Pick a team first.'; redrawC(); return; }
      UI.setYou(CL.sel); window.MW.render({ keepScroll: true }); UI.toast('Following ' + CL.sel); window.MW.closeSheet(); return;
    }
    if (e.target.closest('.id-go')) submit();
  });
  const pin = $('#id-pin');
  if (pin) {
    pin.addEventListener('input', () => { pin.value = pin.value.replace(/\D/g, '').slice(0, 4); const er = $('#id-err'); if (er && CL.err) { CL.err = ''; er.hidden = true; } });
    pin.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  }
  function submit() {
    const sel = CL.sel, v = pin ? pin.value : '';
    if (!sel) { CL.err = 'Pick your team first.'; redrawC(); return; }
    if (!authPinOk(v)) { CL.err = 'PIN must be exactly 4 digits.'; redrawC(); return; }
    if (CL.lock[sel] && CL.lock[sel] > Date.now()) return;
    const mode = isClaimed(sel) ? 'login' : 'claim';
    CL.busy = true; CL.err = ''; redrawC();
    authPost(authBuildReq(mode, { team: sel, pin: v })).then(r => {
      CL.busy = false;
      if (r && r.ok && r.token) { afterSignIn(el, sel, r.token); return; }
      const code = (r && r.error) || '';
      if (code === 'wrong') CL.err = 'Wrong PIN. Try again.';
      else if (code === 'locked') { const m = num(r.retryMin) || 10; CL.lock[sel] = Date.now() + m * 60000; CL.err = 'Too many tries. Locked for ' + m + ' min.'; }
      else if (code === 'claimed') { authMarkClaimed(sel); CL.err = 'Already claimed. Sign in with its PIN, or ask the commissioner to reset it.'; }
      else if (code === 'unclaimed') { if (Array.isArray(D.claimed)) D.claimed = D.claimed.filter(t => t !== sel); else D.claimed = []; CL.err = 'Not claimed yet. Set a new PIN to claim it.'; }
      else if (code === 'badpin') CL.err = 'PIN must be exactly 4 digits.';
      else CL.err = code ? 'The server said: ' + code + '.' : 'Something went wrong. Try again.';
      redrawC();
    }).catch(e => { CL.busy = false; CL.err = authErrText(e); redrawC(); });
  }
  if (!off && !authClaimedList() && !STATUS_ASKED) {
    STATUS_ASKED = true;
    authPost(authBuildReq('status')).then(r => {
      if (!(r && r.ok && Array.isArray(r.claimed))) return;
      D.claimed = r.claimed;
      const pi = el.querySelector('#id-pin'), v = pi ? pi.value : '', f = pi && document.activeElement === pi;
      redrawC();
      const np = el.querySelector('#id-pin'); if (np && v) { np.value = v; if (f) np.focus({ preventScroll: true }); }
    }).catch(() => { });
  }
}

/* ---------- editor ---------- */
function crestSVGFor(team, shape, px, d, patt) {
  /* a shape chip thumbnail: the shape in the deep step, keyline light, optional pattern band in the accent */
  const col = UI.teamColors(team), path = UI.SHAPES[shape];
  const id = 'idc' + shape + (patt || '') + px;
  let fill = '<path d="' + path + '" fill="' + col.deep + '"/>';
  if (patt && patt !== 'plain') {
    const a = col.accent, P = { stripes: '<rect x="26" width="12" height="108" fill="' + a + '"/><rect x="50" width="12" height="108" fill="' + a + '"/><rect x="74" width="12" height="108" fill="' + a + '"/>',
      hoops: '<rect y="26" width="100" height="14" fill="' + a + '"/><rect y="56" width="100" height="14" fill="' + a + '"/><rect y="86" width="100" height="14" fill="' + a + '"/>',
      halves: '<rect x="50" width="50" height="108" fill="' + a + '"/>', sash: '<path d="M0 20 L20 0 L100 80 L80 100 Z" fill="' + a + '"/>' }[patt] || '';
    fill = '<clipPath id="' + id + '"><path d="' + path + '"/></clipPath><g clip-path="url(#' + id + ')"><rect width="100" height="108" fill="' + col.deep + '"/>' + P + '</g>';
  }
  return '<svg width="' + px + '" height="' + Math.round(px * 1.08) + '" viewBox="0 0 100 108" aria-hidden="true">' + fill + '<path d="' + path + '" fill="none" stroke="' + col.light + '" stroke-width="5"/></svg>';
}
function previewHTML(team, d) {
  return withProfile(team, profFields(d), () => {
    const col = UI.teamColors(team), pat = K.patternBg(d.pattern, col.accent, .16), st = K.standOf(team);
    const band = 'linear-gradient(180deg,' + col.deep + ' 0%,color-mix(in oklab,' + col.deep + ' 50%,var(--base)) 100%)';
    const ph = d.photo ? '<span class="sk-av" style="width:20px;height:20px"><img src="' + esc(d.photo) + '" alt=""></span>' : '';
    const cur = (D.fx || []).find(f => num(f.GW) === D.gw && (f.Home === team || f.Away === team));
    const proj = cur ? (mscore(cur).liveNow || mscore(cur).done ? (cur.Home === team ? mscore(cur).hs : mscore(cur).as2) : D.hasEP ? K.f1(teamProj(team)) : '–') : '–';
    return '<div class="id-pv">'
      + '<div class="id-hd" style="background:' + band + '"><i class="ms-band" style="background:' + col.accent + '"></i>' + (pat ? '<i class="ms-pat" style="background:' + pat + '"></i>' : '')
      + '<span class="ms-cr">' + UI.glow(team, 'left', .5, 150) + UI.crest(team, 64) + '</span><div class="id-hn"><b class="wide">' + esc(team) + '</b><span>' + ph + esc(d.manager || TEAMS[team].mgr) + '</span><em>Live preview</em></div></div>'
      + '<div class="id-sizes"><span>' + UI.crest(team, 64) + '<i>64</i></span><span>' + UI.crest(team, 32) + '<i>32</i></span><span>' + UI.crest(team, 20) + '<i>20</i></span>'
      + '<p>Under 32 px the crest turns into a simple shape in your accent, so it still reads in a list.</p></div>'
      + '<div class="id-rows"><div class="id-trow" style="background:' + K.rgbaOf(col.accent, .12) + '"><b class="n">' + (st.has ? st.pos : '–') + '</b>' + UI.crest(team, 20) + '<span class="ell">' + esc(team) + '</span><b class="n">' + (st.has ? st.pts : '–') + '</b></div>'
      + '<div class="id-mchip">' + UI.crest(team, 22) + '<b class="ell">' + esc(UI.short(team).toUpperCase()) + '</b><b class="n you-c">' + proj + '</b></div></div>'
      + '<p class="id-cap">Your header, a table row and a matchup chip, as the league will see them. In matchups you are always blue.</p></div>';
  });
}
function shadesHTML(team, d) {
  return withProfile(team, { color: d.color }, () => {
    const c = UI.teamColors(team), s = (bg, l, hex) => '<div class="id-st"><i style="background:' + bg + '"></i><span>' + l + '</span><em>' + hex + '</em></div>';
    return '<span class="id-k">Your three shades, worked out for the dark app</span><div class="id-sts">' + s(c.deep, 'Crest, band', c.deep) + s(c.accent, 'Lines, marks', c.accent) + s(c.light, 'Keyline', c.light) + '</div>';
  });
}
function clashHTML(team, d) {
  const acc = accentFor(d.color, team), n = nearest(team, acc);
  if (!n) return '';
  if (n.d >= (n.lim || CLASH)) return '<div class="id-ok"><span class="id-i">i</span><span>No clashes. Closest is ' + esc(n.label) + ', easy to tell apart.</span></div>';
  if (d.keep === d.color) return '<div class="id-ok warn"><span class="id-i">i</span><span>Kept. Close to ' + esc(n.label) + ', but your crest and name always travel with your colour.</span></div>';
  if (d.sugg === d.color) return '<div class="id-ok warn"><span class="id-i">i</span><span>The most distinct shade near your pick. It still sits close to ' + esc(n.label) + ', and your crest and name always travel with your colour.</span></div>';
  const sg = suggest(team, acc), better = sg && sg.score > n.d - (n.lim ? n.lim - CLASH : 0) + 2;
  return '<div class="id-cl"><div class="id-clr"><i style="background:' + acc + '"></i><span><b>Close to ' + esc(n.label) + '.</b> Both would be hard to tell apart in charts.</span></div>'
    + (better ? '<div class="id-clr"><i class="sg" style="background:' + sg.accent + '"></i><span>Try this shade instead: the most distinct ' + esc(hueName(acc)) + ' left in your league.</span></div>'
      + '<div class="id-clb"><button type="button" class="btn" data-use="' + sg.hex + '">Use this shade</button><button type="button" class="btn line" data-keep>Keep mine</button></div>'
      : '<div class="id-clr"><span>No shade nearby is clearly more distinct. Try another colour, or keep this one.</span></div><div class="id-clb"><button type="button" class="btn line" data-keep>Keep mine</button></div>')
    + '<span class="sub">Never blocked. Your crest and name always travel with your colour.</span></div>';
}
function chipsHTML(team, d, which) {
  return withProfile(team, profFields(d), () => {
    if (which === 'shapes') return SHAPE_ORDER.map(([id, l]) => '<button type="button" class="id-ch' + (d.shape === id ? ' on' : '') + '" data-shape="' + id + '" aria-pressed="' + (d.shape === id) + '">' + crestSVGFor(team, id, 34) + '<span>' + l + '</span></button>').join('');
    if (which === 'emblems') return [['', 'Team art'], ['initials', 'Initials']].map(([id, l]) => '<button type="button" class="id-ch' + (d.emblem === id ? ' on' : '') + '" data-emblem="' + id + '" aria-pressed="' + (d.emblem === id) + '">'
      + withProfile(team, { emblem: id }, () => UI.crest(team, 40)) + '<span>' + l + '</span></button>').join('');
    return K.PATTERNS.map(([id, l]) => '<button type="button" class="id-ch' + (d.pattern === id ? ' on' : '') + '" data-pattern="' + id + '" aria-pressed="' + (d.pattern === id) + '">' + crestSVGFor(team, d.shape, 34, d, id) + '<span>' + l + '</span></button>').join('');
  });
}
const vivWord = v => v < 9 ? 'soft' : v < 13 ? 'medium' : 'vivid';
const customHex = d => UI.oklchToHex(.62, d.viv / 100, d.hue);
function editorView(team) {
  const d = draftFor(team), cust = isCustom(d);
  const dots = PRESET_ORDER.map(k => { const p = UI.PRESETS[k]; return '<button type="button" class="id-dot' + (d.color === k ? ' on' : '') + '" data-color="' + k + '" aria-pressed="' + (d.color === k) + '" aria-label="' + p.name + '"><i style="background:' + p.accent + '"></i><span>' + p.name + '</span></button>'; }).join('')
    + '<button type="button" class="id-dot cu' + (cust ? ' on' : '') + '" data-color="custom" aria-pressed="' + cust + '" aria-label="Custom colour"><i></i><span>Custom</span></button>';
  const hexNow = cust ? d.color : UI.PRESETS[d.color] ? UI.PRESETS[d.color].accent : customHex(d);
  return '<div class="id-wrap ed"><div class="id-top"><span class="k">' + esc(team) + '</span><h2>Club identity</h2></div>'
    + (MSG ? '<div class="id-msg ' + MSG.kind + '" role="status">' + MSG.html + '</div>' : '')
    + '<div data-r="preview">' + previewHTML(team, d) + '</div>'
    + UI.sh('Colour', { aside: 'presets, or any colour' }) + '<div class="card id-col"><div class="id-dots">' + dots + '</div>'
    + '<div class="id-cu"' + (cust ? '' : ' hidden') + '>'
    + '<label class="id-sl"><span>Hue <em data-v="hue">' + d.hue + '°</em></span><input type="range" min="0" max="359" step="1" value="' + d.hue + '" data-in="hue" class="hue" aria-label="Hue"></label>'
    + '<label class="id-sl"><span>Vividness <em data-v="viv">' + vivWord(d.viv) + '</em></span><input type="range" min="6" max="16" step="1" value="' + d.viv + '" data-in="viv" class="viv" style="--h:' + d.hue + '" aria-label="Vividness"></label>'
    + '<label class="id-hex"><span>Hex</span><input type="text" value="' + esc(hexNow.toUpperCase()) + '" maxlength="7" spellcheck="false" autocapitalize="off" autocomplete="off" data-in="hex" aria-label="Hex colour"><i data-v="sw" style="background:' + hexNow + '"></i></label></div>'
    + '<div class="id-sh" data-r="shades">' + shadesHTML(team, d) + '</div><div class="id-clw" data-r="clash">' + clashHTML(team, d) + '</div></div>'
    + UI.sh('Crest') + '<div class="card id-grid5" data-r="shapes">' + chipsHTML(team, d, 'shapes') + '</div>'
    + UI.sh('Emblem') + '<div class="card id-grid2" data-r="emblems">' + chipsHTML(team, d, 'emblems') + '</div>'
    + UI.sh('Pattern', { aside: 'shows in your header' }) + '<div class="card id-grid5" data-r="patterns">' + chipsHTML(team, d, 'patterns') + '</div>'
    + UI.sh('Manager') + '<div class="card id-mg"><label class="id-nm"><span>Display name</span><input type="text" maxlength="40" autocomplete="off" data-in="manager" value="' + esc(d.manager) + '" placeholder="' + esc(TEAMS[team].mgr || '') + '"></label>'
    + '<div class="id-ph"><span class="id-phi" data-r="photo">' + photoHTML(team, d) + '</span><div><b>Photo</b><span class="sub">Shows beside your name on your club’s page.</span><div class="id-phb"><button type="button" class="btn ghost" data-pick>Choose photo</button>'
    + '<button type="button" class="id-link sm" data-rmphoto' + (d.photo ? '' : ' hidden') + '>Remove</button></div></div><input type="file" accept="image/*" data-file hidden></div></div>'
    + '<div class="id-save"><div class="id-stat" data-r="status" role="status"></div><button type="button" class="btn block" data-save>Save club identity</button></div>'
    + '<p class="id-foot">Everyone in the league sees it on their next refresh. Change it whenever you like.</p>'
    + '<div class="id-out"><span class="sub">Signed in on this phone as ' + esc(team) + '.</span><button type="button" class="id-link" data-signout>Sign out</button></div></div>';
}
function photoHTML(team, d) { return d.photo ? '<span class="sk-av" style="width:52px;height:52px"><img src="' + esc(d.photo) + '" alt=""></span>' : withProfile(team, profFields(d), () => UI.crest(team, 48)); }

/* photo: cover-crop to 256 px, JPEG, quality down until the data URL fits the sheet cell (AUTH_PHOTO_MAX) */
function resizePhoto(file) {
  const size = typeof AUTH_PHOTO_PX === 'number' ? AUTH_PHOTO_PX : 256, max = typeof AUTH_PHOTO_MAX === 'number' ? AUTH_PHOTO_MAX : 45000;
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const c = document.createElement('canvas'); c.width = c.height = size;
        const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, s = Math.min(w, h);
        c.getContext('2d').drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size);
        let q = .82, out = c.toDataURL('image/jpeg', q);
        while (out.length > max && q - .08 >= .2) { q = Math.round((q - .08) * 100) / 100; out = c.toDataURL('image/jpeg', q); }
        out.length <= max ? res(out) : rej(new Error('too big'));
      } catch (e) { rej(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
    img.src = url;
  });
}

function mountEditor(el, team) {
  const d = draftFor(team), q = s => el.querySelector(s), root = el.querySelector('.id-wrap');
  if (!root) return;
  const paint = (all) => {
    const set = (k, html) => { const r = q('[data-r="' + k + '"]'); if (r) r.innerHTML = html; };
    set('preview', previewHTML(team, d)); set('shades', shadesHTML(team, d)); set('clash', clashHTML(team, d));
    set('shapes', chipsHTML(team, d, 'shapes')); set('emblems', chipsHTML(team, d, 'emblems')); set('patterns', chipsHTML(team, d, 'patterns')); set('photo', photoHTML(team, d));
    el.querySelectorAll('.id-dot').forEach(b => { const on = b.dataset.color === d.color || (b.dataset.color === 'custom' && isCustom(d)); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    const cu = q('.id-cu'); if (cu) cu.hidden = !isCustom(d);
    const rm = q('[data-rmphoto]'); if (rm) rm.hidden = !d.photo;
    if (all) syncInputs();
  };
  const syncInputs = (skipHex) => {
    const h = q('[data-in="hue"]'), v = q('[data-in="viv"]'), x = q('[data-in="hex"]');
    if (h) h.value = d.hue; if (v) { v.value = d.viv; v.style.setProperty('--h', d.hue); }
    const hv = q('[data-v="hue"]'), vv = q('[data-v="viv"]'); if (hv) hv.textContent = d.hue + '°'; if (vv) vv.textContent = vivWord(d.viv);
    const hex = isCustom(d) ? d.color : UI.PRESETS[d.color] ? UI.PRESETS[d.color].accent : customHex(d);
    if (x && !skipHex) x.value = hex.toUpperCase();
    const sw = q('[data-v="sw"]'); if (sw) sw.style.background = hex;
  };
  const status = (kind, html) => { const s = q('[data-r="status"]'); if (s) { s.className = 'id-stat ' + (kind || ''); s.innerHTML = html || ''; } };
  root.addEventListener('click', e => {
    const c = e.target.closest('[data-color]');
    if (c) {
      const k = c.dataset.color;
      if (k === 'custom') { if (!isCustom(d)) { const seed = UI.PRESETS[d.color] ? UI.PRESETS[d.color].accent : customHex(d), o = UI.hexToOklch(seed); d.hue = Math.round(o.H); d.viv = Math.round(clampC(o.C) * 100); d.color = customHex(d); } }
      else { d.color = k; const o = UI.hexToOklch(UI.PRESETS[k].accent); d.hue = Math.round(o.H); d.viv = Math.round(clampC(o.C) * 100); }
      d.keep = null; status(); paint(true); return;
    }
    const s = e.target.closest('[data-shape]'); if (s) { d.shape = s.dataset.shape; paint(); return; }
    const m = e.target.closest('[data-emblem]'); if (m) { d.emblem = m.dataset.emblem; paint(); return; }
    const p = e.target.closest('[data-pattern]'); if (p) { d.pattern = p.dataset.pattern; paint(); return; }
    const u = e.target.closest('[data-use]'); if (u) { d.color = u.dataset.use.toLowerCase(); d.sugg = d.color; const o = UI.hexToOklch(d.color); d.hue = Math.round(o.H); d.viv = Math.round(clampC(o.C) * 100); d.keep = null; paint(true); return; }
    if (e.target.closest('[data-keep]')) { d.keep = d.color; paint(); return; }
    if (e.target.closest('[data-pick]')) { const f = q('[data-file]'); f && f.click(); return; }
    if (e.target.closest('[data-rmphoto]')) { d.photo = ''; paint(); return; }
    if (e.target.closest('[data-save]')) { save(); return; }
    if (e.target.closest('[data-signout]')) {
      AUTH.logout(); DR = null; MSG = null; CL.sel = team;
      window.MW.render({ keepScroll: true }); redraw(el); el.scrollTop = 0; UI.toast('Signed out. This phone still follows ' + team + '.'); return;
    }
  });
  root.addEventListener('input', e => {
    const t = e.target.closest('[data-in]'); if (!t) return;
    const k = t.dataset.in;
    if (k === 'hue' || k === 'viv') { d[k] = +t.value; d.color = customHex(d); d.keep = null; syncInputs(); paint(); }
    else if (k === 'hex') {
      let v = t.value.trim(); if (v && v[0] !== '#') v = '#' + v;
      if (/^#[0-9a-f]{6}$/i.test(v)) { d.color = v.toLowerCase(); const o = UI.hexToOklch(d.color); d.hue = Math.round(o.H); d.viv = Math.round(clampC(o.C) * 100); d.keep = null; syncInputs(true); paint(); }
    } else if (k === 'manager') { d.manager = t.value.replace(/\s+/g, ' ').slice(0, 40); const r = q('[data-r="preview"]'); if (r) r.innerHTML = previewHTML(team, d); }
  });
  const f = q('[data-file]');
  if (f) f.addEventListener('change', () => {
    const file = f.files && f.files[0]; if (!file) return;
    resizePhoto(file).then(u => { d.photo = u; paint(); }).catch(er => status('bad', er.message === 'too big' ? 'That photo won’t shrink enough. Try a simpler one.' : 'Couldn’t read that image.'));
    f.value = '';
  });

  function save() {
    const a = authRead(); if (!a || a.team !== team) { MSG = { kind: 'bad', html: 'You’re signed out. Sign in again to save.' }; redraw(el); return; }
    d.manager = (d.manager || '').trim() || TEAMS[team].mgr || '';
    const fields = profFields(d), p = ensure(team), srv = p.__srv;
    const changed = FIELDS.filter(k => String(fields[k] || '') !== String(srv[k] || ''));
    /* this phone first: the identity applies at once and stays until the league sheet carries it */
    const o = { team, f: {}, base: {}, at: Date.now() };
    changed.forEach(k => { o.f[k] = String(fields[k] || ''); o.base[k] = String(srv[k] || ''); });
    FIELDS.forEach(k => { p[k] = String(fields[k] || ''); });
    writeLS(o);
    window.MW.render({ keepScroll: true });
    const btn = q('[data-save]'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    status('', '');
    const req = { team, token: a.token, color: fields.color, shape: fields.shape, photo: fields.photo, manager: fields.manager, emblem: fields.emblem, pattern: fields.pattern };
    const done = (kind, html) => { if (btn) { btn.disabled = false; btn.textContent = 'Save club identity'; } status(kind, html); };
    const LOCAL = 'Your new look shows on this phone now.';
    authPost(authBuildReq('save', req)).then(r => {
      if (r && r.ok) {
        const extra = changed.includes('pattern') ? ' If the pattern doesn’t show for others yet, it arrives with the league sheet update.' : '';
        done('ok', '<b>Saved.</b> Everyone in the league sees it on their next refresh.' + extra); return;
      }
      const code = (r && r.error) || '';
      if (code === 'auth') { AUTH.logout(); DR = null; MSG = { kind: 'warn', html: '<b>Your sign-in expired.</b> ' + LOCAL + ' Sign in again to save it for the league.' }; window.MW.render({ keepScroll: true }); redraw(el); el.scrollTop = 0; return; }
      if (code === 'badphoto') { done('bad', 'That photo is too large for the league sheet. Choose another. ' + LOCAL); return; }
      if (code === 'badcolor') {
        const rest = changed.filter(k => k !== 'color' && k !== 'pattern');
        if (!rest.length) { done('warn', '<b>Saved on this phone.</b> Your new colour reaches the rest of the league once the league sheet update is in.'); return; }
        return authPost(authBuildReq('save', Object.assign({}, req, { color: srv.color || '' }))).then(r2 => {
          const what = changed.includes('pattern') ? 'colour and pattern' : 'colour';
          done('warn', r2 && r2.ok ? '<b>Saved for the league, apart from the new ' + what + '.</b> Those show on this phone now and reach everyone once the league sheet update is in.'
            : '<b>Saved on this phone.</b> It reaches the rest of the league once the league sheet update is in.');
        }).catch(() => done('warn', '<b>Saved on this phone.</b> It reaches the rest of the league once the league sheet update is in.'));
      }
      done('warn', '<b>Saved on this phone.</b> The league sheet said “' + esc(code || 'no') + '”, so others don’t see it yet. Try again later.');
    }).catch(e => done('warn', '<b>Saved on this phone.</b> ' + esc(authErrText(e)) + ' Others see it once a save gets through.'));
  }
}

export default {
  cls: 'sk-identity',
  render() { return view(); },
  mount(el) { mountAny(el); },
  unmount() { DR = null; MSG = null; CL.err = ''; CL.busy = false; CL.sel = null; },
};
