/* ui.js — shared helpers for every page. Engine globals (D, TEAMS, num, card, …) come from core.js. */
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const n = v => num(v);
export const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
export const pct = (v, lt = 1) => { const x = v * 100; return x > 0 && x < lt ? '<' + lt + '%' : Math.round(x) + '%'; };
export const TEAM_NAMES = () => Object.keys(TEAMS);
export const short = t => (SHORTOF && SHORTOF[t]) || t;
export const first = t => (FIRSTOF ? FIRSTOF(t) : t);

/* ---------- team identity: presets, custom colours, the badge rule ---------- */
export const PRESETS = {
  steel: { name: 'Steel', deep: '#014b79', accent: '#2274af', light: '#b1dafd' },
  teal: { name: 'Teal', deep: '#01544d', accent: '#31c3b5', light: '#a3e3da' },
  olive: { name: 'Olive', deep: '#3b5000', accent: '#67880f', light: '#c8dea6' },
  gold: { name: 'Gold', deep: '#5f4202', accent: '#cb9317', light: '#efcf9b' },
  orange: { name: 'Orange', deep: '#772e00', accent: '#c4530d', light: '#ffc5ac' },
  red: { name: 'Red', deep: '#8a0013', accent: '#ff7e77', light: '#fec4be' },
  magenta: { name: 'Magenta', deep: '#80005c', accent: '#af3b85', light: '#ffbee1' },
  orchid: { name: 'Orchid', deep: '#711d6d', accent: '#d179ca', light: '#f4c1ee' },
  sky: { name: 'Sky', deep: '#025062', accent: '#4ac9ec', light: '#a4dff2' },
  lime: { name: 'Lime', deep: '#4b4b00', accent: '#c4c642', light: '#d7da9a' },
  cream: { name: 'Cream', deep: '#594414', accent: '#edd5a3', light: '#e0d3b8' },
  rose: { name: 'Rose', deep: '#830f3d', accent: '#ce597a', light: '#ffc1ce' },
  brown: { name: 'Brown', deep: '#633e24', accent: '#b07c58', light: '#eacebc' },
  mono: { name: 'Mono', deep: '#2D2339', accent: '#FFFFFF', light: '#D3CADF' },
};
export const TEAM_DEFAULT = {
  'Cold Palmers': 'steel', 'Devils U21s': 'red', 'The Soaring Gulls': 'teal', 'I Am a Baleba': 'gold',
  'Kobbie Mainoo Fan': 'orange', 'Trophy Hunters': 'orchid', 'Team Jacob': 'brown', 'In It to McGinn It': 'magenta',
};

/* OKLab helpers for custom colours */
const lin = c => { c /= 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
const unlin = c => { const v = c <= .0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - .055; return Math.max(0, Math.min(255, Math.round(v * 255))); };
export function hexToOklch(hex) {
  const v = parseInt(hex.slice(1), 16), r = lin(v >> 16), g = lin((v >> 8) & 255), b = lin(v & 255);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  const L = .2104542553 * l + .7936177850 * m - .0040720468 * s, A = 1.9779984951 * l - 2.4285922050 * m + .4505937099 * s, B = .0259040371 * l + .7827717662 * m - .8086757660 * s;
  return { L, C: Math.hypot(A, B), H: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 };
}
export function oklchToHex(L, C, H) {
  const h = H * Math.PI / 180;
  for (let c = C; c >= 0; c -= .004) {
    const A = c * Math.cos(h), B = c * Math.sin(h);
    const l = (L + .3963377774 * A + .2158037573 * B) ** 3, m = (L - .1055613458 * A - .0638541728 * B) ** 3, s = (L - .0894841775 * A - 1.2914855480 * B) ** 3;
    const r = 4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, b = -.0041960863 * l - .7034186147 * m + 1.7076147010 * s;
    if (r >= -.001 && r <= 1.001 && g >= -.001 && g <= 1.001 && b >= -.001 && b <= 1.001)
      return '#' + [r, g, b].map(x => unlin(Math.max(0, Math.min(1, x))).toString(16).padStart(2, '0')).join('');
  }
  return '#808080';
}
/* any colour → three readable steps (deep for crest fill, accent for small marks, light for keylines) */
export function stepsFromHex(hex) {
  const { C, H } = hexToOklch(hex);
  const c = Math.max(.06, Math.min(C, .16));
  return { deep: oklchToHex(.36, c, H), accent: oklchToHex(.62, Math.min(c * 1.1, .17), H), light: oklchToHex(.86, Math.min(c * .55, .08), H), custom: hex };
}
const PROF = t => (PROFILE && PROFILE[t]) || {};
export function teamColors(team) {
  const pr = PROF(team), c = (pr.color || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return { key: 'custom', ...stepsFromHex(c) };
  const LEGACY = { royal: 'steel', navy: 'steel', aurora: 'steel', sky: 'sky', amethyst: 'orchid', magenta: 'magenta', gold: 'gold', crimson: 'red', tangerine: 'orange', umber: 'brown', forest: 'olive', teal: 'teal' };
  const k0 = PRESETS[c] ? c : LEGACY[c];
  const key = k0 || TEAM_DEFAULT[team] || 'mono';
  return { key, ...PRESETS[key] };
}
export const SHAPES = { shield: 'M50 4 L88 12 C90 46 84 78 50 104 C16 78 10 46 12 12 Z', heater: 'M14 8 H86 V50 C86 80 66 98 50 105 C34 98 14 80 14 50 Z', roundel: 'M50 8 A46 46 0 1 1 49.9 8 Z', pennant: 'M14 8 H86 V60 L50 105 L14 60 Z', hex: 'M50 5 L89 24 V74 L50 105 L11 74 V24 Z' };
const TEAM_SHAPE = { 'Cold Palmers': 'pennant' };
export function teamShape(team) { const s = PROF(team).shape; return SHAPES[s] ? s : (TEAM_SHAPE[team] || 'shield'); }
function emblemOf(team) {
  const t = TEAMS[team]; if (!t) return '';
  const c = CREST && CREST[t.ini]; if (!c) return '';
  if (PROF(team).emblem === 'initials') return '<text x="50" y="66" text-anchor="middle" font-family="Archivo,sans-serif" font-stretch="82%" font-weight="800" font-size="' + (t.ini.length > 2 ? 32 : 40) + '" fill="#FFFFFF">' + esc(t.ini) + '</text>';
  return String(c.emblem || '').replace(/<!--[\s\S]*?-->/g, '').replace(/#[0-9A-Fa-f]{3,6}\b/g, '#FFFFFF');
}
let CID = 0;
/* the badge rule: under 32 px the shape in the accent with a light keyline; 32 px and up deep fill, light keyline, white emblem */
export function crest(team, px = 32, opt = {}) {
  if (!TEAMS[team]) return '';
  const col = teamColors(team), d = SHAPES[teamShape(team)], h = Math.round(px * 1.08);
  const lab = 'aria-label="' + esc(team) + ' crest" role="img"';
  if (px < 32 && !opt.full) {
    return '<span class="cr"><svg width="' + px + '" height="' + h + '" viewBox="0 0 100 108" ' + lab + '><path d="' + d + '" fill="' + col.accent + '"/><path d="' + d + '" fill="none" stroke="' + col.light + '" stroke-width="6" transform="translate(50 54) scale(.86) translate(-50 -54)"/></svg></span>';
  }
  const id = 'cg' + (++CID);
  return '<span class="cr"><svg width="' + px + '" height="' + h + '" viewBox="0 0 100 108" ' + lab + '><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>'
    + '<path d="' + d + '" fill="' + col.deep + '"/><path d="' + d + '" fill="url(#' + id + ')"/>'
    + '<path d="' + d + '" fill="none" stroke="' + col.light + '" stroke-width="3.4" transform="translate(50 54) scale(.88) translate(-50 -54)"/>'
    + '<g transform="translate(0,6)">' + emblemOf(team) + '</g></svg></span>';
}
export function leagueCrest(px = 24) {
  return '<span class="cr"><svg width="' + px + '" height="' + Math.round(px * 32 / 28) + '" viewBox="0 0 28 32" aria-label="El Matador Tire"><path d="M14 1 L26 5 V15 C26 23 20 28 14 31 C8 28 2 23 2 15 V5 Z" fill="#5B2D8E" stroke="#CDBDF0" stroke-width="1.4"/><path d="M9 12 L14 9 L19 12 L19 18 L14 22 L9 18 Z" fill="none" stroke="#CDBDF0" stroke-width="1.3" opacity=".7"/></svg></span>';
}
export const glow = (team, side, alpha = .45, size = 230) => {
  const c = teamColors(team).accent, v = parseInt(c.slice(1), 16);
  return '<i class="glow" aria-hidden="true" style="position:absolute;top:-60px;' + side + ':-70px;width:' + size + 'px;height:' + size + 'px;border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(' + (v >> 16) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + alpha + ') 0%,rgba(0,0,0,0) 65%)"></i>';
};

/* ---------- players ---------- */
const PLR = {};
export function player(code) {
  code = String(code);
  if (PLR[code] && PLR[code].__v === LOADED_AT) return PLR[code];
  const r = (D.ro || []).find(x => String(x.Code) === code) || (D.plr || []).find(x => String(x.Code) === code);
  if (r) { r.__v = LOADED_AT; PLR[code] = r; }
  return r || null;
}
/* Player images (Parker, 8 Oct 2026): the FC cutout already in faces/ when there is one, otherwise FPL's own photo,
   otherwise initials. The chain itself is core's faceUrls (FC_FACES, FPL_PHOTO), shared with the cards. */
export const faceSrcs = code => (typeof faceUrls === 'function' ? faceUrls(code) : []);
/* an FPL photo (Parker, 8 Oct 2026): 220x280, half body with the head in the top part, so it is framed by the head (class fpl,
   object-position at the top and a slight scale); an FC cutout is head and shoulders already. core's isFplPhoto, shared with the cards */
export const fplPhoto = u => (typeof isFplPhoto === 'function' ? isFplPhoto(u) : /premierleague25\/photos\/players/.test(String(u || '')));
/* an <img> that walks its chain on error, then runs `last` (a JS statement, single quotes only); an FPL photo in the
   chain carries class fpl, from the first src and whenever the chain falls through to one */
export function chainImg(urls, attrs, last) {
  if (fplPhoto(urls[0])) attrs = /\bclass="/.test(attrs) ? attrs.replace(/\bclass="/, 'class="fpl ') : 'class="fpl" ' + attrs;
  return '<img ' + attrs + ' src="' + urls[0] + '" data-alt="' + urls.slice(1).join('|') + '" onerror="var a=(this.dataset.alt||\'\').split(\'|\').filter(Boolean);if(a.length){this.src=a.shift();this.dataset.alt=a.join(\'|\');this.classList.toggle(\'fpl\',this.src.indexOf(\'premierleague25/photos\')>-1)}else{this.onerror=null;' + last + '}">';
}
/* a face in a circle: the FC cutout or FPL photo, then initials */
export function face(p, px = 32, opt = {}) {
  if (!p) return '<span class="fc-i" style="width:' + px + 'px;height:' + px + 'px"></span>';
  if (typeof p !== 'object') p = player(p) || { Code: p, Player: '' };
  const code = String(p.Code), ini = esc(initials ? initials(p.Player || '') : '');
  const ring = opt.ring ? ';box-shadow:inset 0 0 0 ' + (opt.ringW || 2) + 'px ' + opt.ring : '';
  const bg = opt.bg ? ';background:' + opt.bg : '';
  const urls = faceSrcs(code);
  return '<span class="fc-i' + (opt.cls ? ' ' + opt.cls : '') + '" style="width:' + px + 'px;height:' + px + 'px' + bg + ring + '">'
    + (urls.length
      ? chainImg(urls, 'loading="lazy" decoding="async" alt="' + esc(p.Player || '') + '" data-c="' + esc(code) + '"', 'this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'ini\',textContent:\'' + ini + '\'}))')
      : '<span class="ini">' + ini + '</span>')
    + '</span>';
}
export function stack(list, px = 26, max = 5) {
  const show = list.slice(0, max), more = list.length - show.length;
  return '<span class="stack">' + show.map(p => face(p, px)).join('') + (more > 0 ? '<span class="more" style="width:' + px + 'px;height:' + px + 'px">+' + more + '</span>' : '') + '</span>';
}
let CARDI = 9000;
/* the locked Plate card, at any width */
export function plate(p, w = 100, opt = {}) {
  if (!p) return '';
  return '<span class="plate" style="width:' + w + 'px" data-open="player:' + esc(p.Code) + '">' + card(p, ++CARDI) + '</span>';
}
/* the number a player wears right now, as the Plate's bubble shows it: his banked points once his match is over (bk),
   his live points while it is on (live), else his projection (proj; a dash when there is none, never a fake 0.0) */
export function plateNum(p) {
  if (!p) return { st: 'proj', txt: '–' };
  if (typeof fxStarted === 'function' && fxStarted(p.Club)) return { st: fxFinished(p.Club) ? 'bk' : 'live', txt: String(Math.round(num(p['GW pts']))) };
  const e = D.hasEP ? epOf(p.Code) : null;
  return { st: 'proj', txt: e === null ? '–' : f1(e) };
}
/* the bubble a Plate wears, as the full card draws it: PROJ (dashed) before his match, LIVE (green ring) while it is on,
   PTS once it is over; XP in the xP view. b: { st: 'proj'|'live'|'bk'|'xp', txt, cls? } (plateNum, or the matchup page's own) */
export function plateBubble(b) {
  const st = b.st === 'pj' ? 'proj' : b.st === 'lv' ? 'live' : b.st;
  const extra = b.cls ? ' ' + b.cls : '';
  if (st === 'proj') return '<span class="pts proj' + extra + '"><b>' + esc(b.txt) + '</b><i>PROJ</i></span>';
  if (st === 'xp') return '<span class="pts' + (b.live ? ' live' : '') + extra + '"><b>' + esc(b.txt) + '</b><i>XP</i></span>';
  return '<span class="pts' + (st === 'live' ? ' live' : '') + extra + '"><b>' + esc(b.txt) + '</b><i>' + (st === 'live' ? 'LIVE' : 'PTS') + '</i></span>';
}
/* the small Plate (Parker, 8 Oct 2026): the same card without the overall rating; the face, the name, club and nation, and
   the bubble top right as always (plateNum, or opt.bubble from the caller). The auto-sub tag and the INJ mark are kept,
   as on the full card: SUBMARK is set by the caller (team/bits.js plateMarked), or opt.mark ('in' | 'inl' | 'out' | 'outl')
   names it. For the Lineup pitch and bench, the matchup screen and the Gameweek Show's XI. opt.noOpen leaves the player
   sheet closed (the show) */
export function plateMini(p, w = 70, opt = {}) {
  if (!p) return '';
  if (!p.Nation && typeof NAT_FIX !== 'undefined' && NAT_FIX[String(p.Code)]) p.Nation = NAT_FIX[String(p.Code)];
  const t = tierOf(p), sm = opt.mark || (typeof SUBMARK !== 'undefined' && SUBMARK[p.Code]) || '';
  const tag = sm === 'in' ? 'SUB' : sm === 'inl' ? 'LIKELY' : sm.startsWith('out') ? 'OUT' : '';
  const smc = sm ? ' sub' + (sm.startsWith('in') ? 'in' : 'out') + (sm.endsWith('l') ? ' likely' : '') : '';
  return '<span class="plate mini" style="width:' + w + 'px"' + (opt.noOpen ? '' : ' data-open="player:' + esc(p.Code) + '"') + '>'
    + '<button class="fc mini ' + t + smc + '" aria-label="' + esc(p.Player) + '">' + cardBg(t)
    + (tag ? '<span class="tag">' + tag + '</span>' : '')
    + ('isud'.indexOf(p.Status) > -1 ? '<span class="inj">INJ</span>' : '')
    + plateBubble(opt.bubble || plateNum(p))
    + '<span class="face">' + faceImgHTML(p) + '</span>'
    + '<span class="nm">' + esc(p.Player) + '</span>'
    + '<span class="meta">' + badgeImg(p.Club, 0) + '<span class="sep"></span>' + flagImg(p.Nation, 0) + '</span>'
    + '</button></span>';
}
export const club = c => clubName ? clubName(c) : c;
export const badge = (c, px = 18) => badgeImg ? badgeImg(c, px) : '';
export const flag = (nat, px = 12) => flagImg ? flagImg(nat, px) : '';
export const statusChip = p => {
  const s = p && p.Status, news = String((p && p.News) || '');
  if (s === 'd') { const m = news.match(/(\d+)% chance/); return '<span class="chip doubt">' + (m ? m[1] + '%' : 'DOUBT') + '</span>'; }
  if (s === 'i') return '<span class="chip out">OUT</span>';
  if (s === 's') return '<span class="chip out">SUSPENDED</span>';
  if (s === 'u') return '<span class="chip out">UNAVAILABLE</span>';
  return '';
};
export const chance = p => { if (!p) return 100; const m = String(p.News || '').match(/(\d+)% chance/); if (p.Status === 'd') return m ? +m[1] : 50; return p.Status && 'isun'.includes(p.Status) ? 0 : 100; };

/* ---------- who am I ---------- */
export function you() {
  try { const a = authRead && authRead(); if (a && TEAMS[a.team]) return a.team; } catch (e) { }
  return myTeam ? myTeam() : null;
}
export function setYou(team) { try { localStorage.setItem('emt-myteam', team); } catch (e) { } }
export const signedIn = () => { try { const a = authRead && authRead(); return !!(a && a.token); } catch (e) { return false; } };

/* ---------- the week ---------- */
/* a ball has been kicked this gameweek (D.liveNow turns true at the deadline, before any match starts) */
export const kicked = () => (D.cf || []).some(x => num(x.GW) === D.gw && (fin(x.Started) || fin(x.Finished))) || (D.fx || []).some(f => num(f.GW) === D.gw && num(f['Home pts']) + num(f['Away pts']) > 0);
export function week() {
  const dl = gwDeadline(D.gw);
  let mode = 'pre';
  if (D.provOver) mode = 'prov'; else if (D.dlPassed && !kicked()) mode = 'locked'; else if (D.liveNow) mode = 'live'; else if (D.dlPassed) mode = 'locked';
  const last = D.gwsDone;
  return { mode, gw: D.gw, dl, last, preDl: !D.dlPassed };
}
/* ---------- waivers (FPL Draft) ----------
   Claims for a gameweek are processed 24 hours before its deadline (FPL's rule; every 2026/27 gameweek matches it, and
   the Matchweeks tab carries FPL's own waivers_time from Code.gs v3.15). After the run, free agency is open until the
   deadline: free agents are instant pickups. From the deadline, new claims wait for the next gameweek's run.
   The lowest team in the table picks first: Standings 'Waiver pick' is FPL's own order (waiver_pick). */
export function waivers() {
  const g = D.dlPassed ? D.gw + 1 : D.gw;
  const row = (D.mw || []).find(x => num(x.GW) === g);
  const dl = row ? dt(row['Deadline (UTC)']) : null;
  if (!dl) return null;
  const wv = dt(row['Waivers (UTC)']) || new Date(dl.getTime() - 24 * 3600e3), now = Date.now();
  const me = you(), srow = me ? (D.stOfficial || D.st || []).find(s => s.Team === me) : null;
  const pick = srow ? num(srow['Waiver pick']) || null : null;
  return { gw: g, dl, wv, phase: now < wv.getTime() ? 'waivers' : now < dl.getTime() ? 'free' : 'closed', pick };
}
/* "Fri 5am" within the week, "Fri, Oct 16, 5am" further out */
export const soonWhen = d => d ? (d.getTime() - Date.now() < 6 * 864e5 ? dayHm(d) : dayFull(d)) : '';
export function untilText(d) {
  if (!d) return '';
  const ms = d.getTime() - Date.now(); if (ms <= 0) return 'now';
  const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3);
  if (h >= 48) return Math.floor(h / 24) + 'D';
  if (h >= 1) return h + 'H' + (h < 10 && m ? ' ' + m + 'M' : '');
  return m + 'M';
}
/* time is written one way everywhere: "3:30pm", "10am" (24-hour locales keep "15:30"); with a day, "Sun 3:30pm";
   with a date, "Sat, Oct 10, 10am" (date order follows the phone's locale) */
let HF = null;
export function hm(d) {
  if (!d) return '';
  if (!HF) HF = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  const p = {}; HF.formatToParts(d).forEach(x => { p[x.type] = x.value; });
  return p.dayPeriod ? p.hour + (p.minute && p.minute !== '00' ? ':' + p.minute : '') + p.dayPeriod.toLowerCase().replace(/[.\s]/g, '') : p.hour + ':' + p.minute;
}
export const wd = d => d ? d.toLocaleDateString(undefined, { weekday: 'short' }) : '';
export const day = d => d ? d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : '';
export const dayHm = d => d ? wd(d) + ' ' + hm(d) : '';
export const dayFull = d => d ? day(d) + ', ' + hm(d) : '';
export const when = (d, o) => d ? (o ? d.toLocaleString(undefined, o) : dayHm(d)) : '';
/* a record, always labelled: "3–0–2 W–D–L" (rec() alone where a W–D–L column head or label sits beside it) */
const J = '\u2060\u2013\u2060'; /* an en dash held to its neighbours, so a record never breaks across lines */
export const rec = (w, d, l) => (typeof w === 'object' && w ? rec(w.w, w.d, w.l) : w + J + d + J + l);
export const recL = (w, d, l) => rec(w, d, l) + '\u00a0W' + J + 'D' + J + 'L';
/* a number still being worked out (title odds land a moment after first paint) */
export const waitN = () => '<span class="wait-n" role="img" aria-label="Working it out"></span>';
export function statePill() {
  const w = week();
  if (w.mode === 'live') return '<span class="state live"><i></i>GW' + w.gw + ' LIVE</span>';
  if (w.mode === 'prov') return '<span class="state ft">GW' + w.gw + ' FULL TIME</span>';
  if (w.mode === 'locked') return '<span class="state">GW' + w.gw + ' LOCKED</span>';
  return '<span class="state dl">DEADLINE ' + untilText(w.dl) + '</span>';
}

/* ---------- icons ---------- */
const IC = {
  matchday: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/><circle cx="12" cy="12" r="2.6"/>',
  team: '<path d="M8 3 L4 6 L5.5 10 L8 9 V21 H16 V9 L18.5 10 L20 6 L16 3 C15 4.6 13.6 5.4 12 5.4 C10.4 5.4 9 4.6 8 3 Z"/>',
  league: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>',
  feed: '<path d="M20 12a7.5 7.5 0 0 1-10.9 6.7L4 20l1.3-4.6A7.5 7.5 0 1 1 20 12z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  play: '<path d="M7 4 L20 12 L7 20 Z" fill="currentColor" stroke="none"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  clip: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12l2 2 4-4"/>',
  reply: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  repost: '<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  volume: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/>',
  pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none"/>',
};
export function icon(name, size = 18, color = 'currentColor', sw = 2) {
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[name] || '') + '</svg>';
}

/* ---------- chrome ---------- */
/* the Matchweek plate: the product's wordmark (from the classic app's top bar), drawn at any height */
let MWI = 0;
export function mwMark(h = 22) {
  const i = ++MWI, w = Math.round(h * 564 / 152);
  return '<svg class="mwm" width="' + w + '" height="' + h + '" viewBox="0 0 564 152" role="img" aria-label="Matchweek"><defs>'
    + '<linearGradient id="mwE' + i + '" x1="0" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="#04F5FF"/><stop offset=".45" stop-color="#2E5BFF"/><stop offset="1" stop-color="#8E44AD"/></linearGradient>'
    + '<linearGradient id="mwI' + i + '" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#101E4E"/><stop offset="1" stop-color="#060B24"/></linearGradient></defs>'
    + '<path d="M16 8 H498 L556 66 V136 L548 144 H16 L8 136 V16 Z" fill="url(#mwI' + i + ')" stroke="url(#mwE' + i + ')" stroke-width="7"/>'
    + '<text x="270" y="99" text-anchor="middle" textLength="440" lengthAdjust="spacingAndGlyphs" style="font:900 62px Archivo,sans-serif;font-stretch:112%"><tspan fill="#FFD23F">MATCH</tspan><tspan fill="#FFFFFF">WEEK</tspan></text></svg>';
}
export function appbar(opt = {}) {
  const me = you();
  const m = week().mode;
  return '<div class="abar' + (m === 'prov' || m === 'locked' ? ' wp' : '') + '">'
    + '<a class="lg" href="#/matchday" aria-label="Matchweek · El Matador Tire">' + mwMark(22) + '<b>El Matador Tire</b></a>'
    + '<span class="sp">' + statePill() + '</span>'
    + '<button class="ib" data-open="search" aria-label="Search players">' + icon('search', 16, 'var(--tx2)', 2.2) + '</button>'
    + '<button class="me" data-open="menu" aria-label="' + (me ? esc(me) + ', settings' : 'Settings') + '">' + (me ? crest(me, 32) : '<span class="ib">' + icon('gear', 16, 'var(--tx2)') + '</span>') + '</button>'
    + '</div>';
}
export function pageHead(title, opt = {}) {
  return '<header class="phead"' + (opt.bg ? ' style="background:' + opt.bg + '"' : '') + '>' + (opt.under || '') + appbar()
    + (opt.body || '<div class="ttl"><h1>' + esc(title) + '</h1>' + (opt.aside ? '<span class="aside">' + opt.aside + '</span>' : '') + '</div>')
    + '</header>';
}
export function pills(items) {
  return '<nav class="pills" aria-label="Sections">' + items.map(i => '<a href="' + i.href + '"' + (i.on ? ' class="on" aria-current="page"' : '') + '>' + esc(i.label) + (i.ct ? '<span class="ct">' + i.ct + '</span>' : '') + '</a>').join('') + '</nav>';
}
export function sh(title, opt = {}) {
  return '<div class="sh"><h2>' + esc(title) + '</h2>' + (opt.more ? '<a class="more" href="' + opt.href + '">' + esc(opt.more) + ' ›</a>' : opt.aside ? '<span class="aside">' + opt.aside + '</span>' : '') + '</div>';
}
export function navBar(active, unread) {
  const items = [['matchday', 'Matchday', '#/matchday'], ['team', 'My team', '#/team'], ['league', 'League', '#/league'], ['feed', 'Feed', '#/feed']];
  return '<nav class="nav" aria-label="Main">' + items.map(([k, l, h]) => '<a href="' + h + '"' + (k === active ? ' class="on" aria-current="page"' : '') + '><em>' + icon(k, 22, k === active ? '#fff' : 'var(--tx3)', 1.8) + '</em>' + l + (k === 'feed' && unread && active !== 'feed' ? '<u></u>' : '') + '</a>').join('') + '</nav>';
}
/* each club's own colour (its accent step), and a pair for side-by-side bars: when two clubs' colours are too alike
   to tell apart, the second one steps to its lighter or darker shade */
export const tc = t => teamColors(t).accent;
const rgbOf = h => { const v = parseInt(String(h).replace('#', ''), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
const cdist = (x, y) => { const p = rgbOf(x), q = rgbOf(y); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
export function pairCols(a, b) {
  if (!TEAMS[a] || !TEAMS[b]) return ['var(--you)', 'var(--opp)'];
  const A = teamColors(a), B = teamColors(b), ca = A.accent;
  let cb = B.accent;
  if (cdist(ca, cb) < 90) cb = cdist(ca, B.light) >= cdist(ca, B.deep) ? B.light : B.deep;
  return [ca, cb];
}
export function wbar(a, d, b, ca = 'var(--you)', cb = 'var(--opp)', thin) {
  return '<div class="wbar' + (thin ? ' thin' : '') + '"><i style="width:' + (a * 100).toFixed(1) + '%;background:' + ca + '"></i><i style="width:' + (d * 100).toFixed(1) + '%;background:var(--line)"></i><i style="width:' + (b * 100).toFixed(1) + '%;background:' + cb + '"></i></div>';
}
/* keep the selected pill of a horizontal switcher in view (sideways only, the page never moves) */
export function showOn(root, sel = '.pills') {
  (root || document).querySelectorAll(sel).forEach(bar => {
    const on = bar.querySelector('.on'); if (!on || bar.scrollWidth <= bar.clientWidth) return;
    const l = on.getBoundingClientRect().left - bar.getBoundingClientRect().left + bar.scrollLeft, r = l + on.offsetWidth, pad = 24;
    if (l - pad < bar.scrollLeft) bar.scrollLeft = Math.max(0, l - pad);
    else if (r + pad > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = r + pad - bar.clientWidth;
  });
}
export const empty = (t, s) => '<div class="empty"><b>' + esc(t) + '</b>' + (s ? esc(s) : '') + '</div>';

/* ---------- toast ---------- */
let TT;
export function toast(msg) {
  let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; requestAnimationFrame(() => t.classList.add('in'));
  clearTimeout(TT); TT = setTimeout(() => t.classList.remove('in'), 2600);
}

/* ---------- title odds: one number on every page ----------
   simulate() (5,000 seasons, ~0.5 s) is a full-time number. Before a ball is kicked and at full time it is simulate()
   itself; while games are live it is simulate() run on this week as not yet played. Cached until a result changes. */
const ODDS = { sig: null, v: null };
function oddsSig() {
  const fx = D.fx.filter(f => fin(f.Finished)).map(f => num(f.GW) + f.Home + num(f['Home pts']) + f.Away + num(f['Away pts'])).join(';');
  const pv = D.provOver ? D.fx.filter(f => num(f.GW) === D.gw).map(f => effPtsOf(f, f.Home) + '-' + effPtsOf(f, f.Away)).join(',') : '';
  return D.gw + '|' + (D.provOver ? 'P' : D.liveNow ? 'L' : 'S') + '|' + fx + '|' + pv + '|' + (D.ro || []).length;
}
export function withFastXi(fn) {
  if (withFastXi.on) return fn();
  const o = { xiOf, benchOf, effXiOf }, m = new Map();
  const wrap = (name, f) => function (team, likely) { const k = name + '|' + team + '|' + (likely ? 1 : 0); if (!m.has(k)) m.set(k, f(team, likely)); return m.get(k); };
  xiOf = wrap('x', o.xiOf); benchOf = wrap('b', o.benchOf); effXiOf = wrap('e', o.effXiOf);
  withFastXi.on = true;
  try { return fn(); } finally { xiOf = o.xiOf; benchOf = o.benchOf; effXiOf = o.effXiOf; withFastXi.on = false; }
}
function frozenSim() {
  const cf0 = D.cf, fx0 = D.fx, gc0 = D.gwsCur, pb0 = D.pbonus, H0 = HPC;
  try {
    D.cf = (cf0 || []).map(x => num(x.GW) === D.gw ? { ...x, Started: 'FALSE', Finished: 'FALSE', Mins: '0', 'Home goals': '', 'Away goals': '' } : x);
    D.fx = fx0.map(f => num(f.GW) === D.gw && !fin(f.Finished) ? { ...f, 'Home pts': '0', 'Away pts': '0' } : f);
    D.gwsCur = {}; D.pbonus = {};
    return simulate();
  } finally { D.cf = cf0; D.fx = fx0; D.gwsCur = gc0; D.pbonus = pb0; HPC = H0; }
}
export function oddsReady() { return !!ODDS.v && ODDS.sig === oddsSig(); }
export function titleOdds() {
  const s = oddsSig();
  if (ODDS.sig !== s || !ODDS.v) {
    let r; try { r = withFastXi(() => D.liveNow ? frozenSim() : simulate()); } catch (e) { console.error(e); r = null; }
    ODDS.sig = s; ODDS.v = r;
  }
  return ODDS.v;
}
/* the same model and seeded stream as simulate(), run in slices so the phone never freezes (byte-identical result) */
function oddsModel() {
  const build = () => ({ mdl: hpSimModel(), seed: hpSeed() });
  if (!D.liveNow) return withFastXi(build);
  const cf0 = D.cf, fx0 = D.fx, gc0 = D.gwsCur, pb0 = D.pbonus, H0 = HPC;
  try {
    D.cf = (cf0 || []).map(x => num(x.GW) === D.gw ? { ...x, Started: 'FALSE', Finished: 'FALSE', Mins: '0', 'Home goals': '', 'Away goals': '' } : x);
    D.fx = fx0.map(f => num(f.GW) === D.gw && !fin(f.Finished) ? { ...f, 'Home pts': '0', 'Away pts': '0' } : f);
    D.gwsCur = {}; D.pbonus = {};
    return withFastXi(build);
  } finally { D.cf = cf0; D.fx = fx0; D.gwsCur = gc0; D.pbonus = pb0; HPC = H0; }
}
let OQ = false;
const WAIT = [];
/* compute the odds after the first paint, in slices, then redraw whatever is on screen */
export function warmOdds(cb) {
  if (oddsReady()) { cb && cb(ODDS.v); return; }
  if (cb) WAIT.push(cb);
  if (OQ) return;
  OQ = true;
  const idle = window.requestIdleCallback || (f => setTimeout(f, 50));
  idle(() => {
    const sig = oddsSig();
    let mdl, seed;
    try { ({ mdl, seed } = oddsModel()); } catch (e) { console.error(e); OQ = false; return; }
    const { names, pts, pf, remain, M } = mdl, rnd = hpRng(seed);
    const N = 5000, title = {}, last = {}; names.forEach(n => { title[n] = 0; last[n] = 0; });
    let s = 0;
    const step = () => {
      const end = Math.min(N, s + 250);
      for (; s < end; s++) {
        const p = { ...pts }, q = { ...pf };
        for (const f of remain) {
          const h = f.Home, a = f.Away, mh = M[h + '|' + num(f.GW)], ma = M[a + '|' + num(f.GW)]; if (!mh || !ma) continue;
          const hs = Math.max(0, Math.round(mh.mean + mh.sd * hpGauss(rnd))), as_ = Math.max(0, Math.round(ma.mean + ma.sd * hpGauss(rnd)));
          q[h] += hs; q[a] += as_; if (hs > as_) p[h] += 3; else if (as_ > hs) p[a] += 3; else { p[h]++; p[a]++; }
        }
        const order = names.slice().sort((x, y) => (p[y] - p[x]) || (q[y] - q[x]));
        title[order[0]]++; last[order[order.length - 1]]++;
      }
      if (s < N) { setTimeout(step, 0); return; }
      names.forEach(n => { title[n] /= N / 100; last[n] /= N / 100; });
      OQ = false;
      if (oddsSig() !== sig) { warmOdds(); return; }          /* data moved underneath: run again */
      ODDS.sig = sig; ODDS.v = { title, last };
      WAIT.splice(0).forEach(f => { try { f(ODDS.v); } catch (e) { console.error(e); } });
      if (window.MW) { window.MW.render({ keepScroll: true }); window.MW.refreshSheet && window.MW.refreshSheet(); }
    };
    step();
  }, { timeout: 1200 });
}
