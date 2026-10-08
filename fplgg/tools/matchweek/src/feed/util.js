/* feed/util.js — small helpers the Feed modules share. Engine globals (D, TEAMS, num, fin, …) come from core.js. */
import * as UI from '../ui.js';

export const esc = UI.esc;

/* ---------- local storage (every read and write guarded) ---------- */
export function lsGet(k, dflt) { try { const v = localStorage.getItem(k); return v == null ? dflt : JSON.parse(v); } catch (e) { return dflt; } }
export function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }

/* local feed state changes (a poll pick, a press-conference line, a dismissed call) bump this so memos rebuild */
let VER = 0;
export const ver = () => VER;
export const bump = () => { VER++; };

/* ---------- words ---------- */
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export function words(n) {
  n = Math.round(n);
  if (n < 0) return 'minus ' + words(-n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  return String(n);
}
export const Words = n => { const w = words(n); return w.charAt(0).toUpperCase() + w.slice(1); };
export const WORDS = n => words(n).toUpperCase();
export function list(a) { a = a.filter(Boolean); if (a.length < 2) return a.join(''); return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
export const poss = s => s + '’s';
/* team names read as plurals: Cold Palmers’, Devils U21s’, Team Jacob’s */
export const possT = t => /s$/i.test(t) ? t + '’' : t + '’s';
export const plural = (n, one, many) => n === 1 ? one : (many || one + 's');
export const ord = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
export const ROUND_WORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth'];
export const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
export const pc = v => Math.round(v * 100) + '%';
/* a title-odds percentage (0–100 scale) as the League page prints it */
export const oddsTxt = v => v < 1 ? '<1%' : v > 99 ? '>99%' : Math.round(v) + '%';
export const hash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/* ---------- deterministic wording: one of a kind's 3–6 phrasings, the same on every phone and every reload ----------
   pickIndex(kind, gw, n, slot) = (hash(kind) mod n + gw + slot) mod n.
   · The start point is a stable hash of the kind, so kinds don't all rotate in step.
   · It moves one place per gameweek, so a kind never repeats a phrasing in consecutive gameweeks (any n ≥ 2;
     with n = 2 it simply alternates). For kinds that happen once per period rather than per gameweek, pass the
     period's index as gw so consecutive periods still differ.
   · slot (0, 1, 2…) is a post's stable position among same-kind posts of that gameweek (the four full-time cards
     use their fixture's index), so those get different phrasings while there are enough to go round.
   Nothing here reads the viewer, the clock or storage: same data in, same words out. */
export function pickIndex(kind, gw, n, slot = 0) {
  if (!(n > 0)) return -1;
  const g = Math.max(0, Math.round(+gw) || 0), s = Math.max(0, Math.round(+slot) || 0);
  return (hash(kind) % n + g + s) % n;
}
export function pick(kind, gw, variants, slot = 0) {
  const v = variants[pickIndex(kind, gw, variants.length, slot)];
  return typeof v === 'function' ? v() : (v || '');
}
/* pickAvoid: pick, then step forward past any phrasing in `avoid` (the indices its neighbours used). For kinds with many
   posts a season (deals): callers walk the posts oldest first, so a new post never changes the words of an older one. */
export function pickAvoid(kind, gw, variants, slot, avoid) {
  const n = variants.length; let i = pickIndex(kind, gw, n, slot);
  for (let k = 0; k < n && avoid && avoid.has(i); k++) i = (i + 1) % n;
  const v = variants[i];
  return { i, text: typeof v === 'function' ? v() : (v || '') };
}
/* an escaped, upper-case run of text for a caps tag */
export const caps = s => UI.esc(String(s).toUpperCase());
export const posWord = p => ({ GKP: 'goalkeeper', DEF: 'defender', MID: 'midfielder', FWD: 'forward' }[p] || 'player');

/* ---------- teams and people ---------- */
export const short = t => (typeof SHORTOF !== 'undefined' && SHORTOF[t]) || t;
export const firstOf = t => (typeof FIRSTOF === 'function' ? FIRSTOF(t) : t);
export const mgrOf = t => (PROFILE && PROFILE[t] && PROFILE[t].manager) || (TEAMS[t] && TEAMS[t].mgr) || '';

/* ---------- time: only from data ---------- */
export const dt = s => { if (!s) return null; const d = new Date(String(s).replace(/^'/, '')); return isNaN(d) ? null : d; };
let LT = { k: -1, m: {} };
export function logTime(g) {
  if (LT.k !== LOADED_AT) {
    const m = {};
    (D.gl || []).forEach(r => { const d = dt(r['Logged (UTC)']); if (!d) return; const gg = num(r.GW); if (!m[gg] || d > m[gg]) m[gg] = d; });
    LT = { k: LOADED_AT, m };
  }
  return LT.m[g] || null;
}
export const kickoffs = g => (D.cf || []).filter(x => num(x.GW) === g).map(x => dt(x['Kickoff (UTC)'])).filter(Boolean).sort((a, b) => a - b);
/* when a finished gameweek became fact: the GW Log time, else its last kick-off */
export function gwDoneTime(g) { const l = logTime(g); if (l) return l; const k = kickoffs(g); return k.length ? k[k.length - 1] : (gwDeadline(g) || new Date(0)); }
/* the moment a gameweek's build-up starts: the previous one's log, else its own deadline minus a week */
export function buildUpTime(g) { const l = g > 1 ? gwDoneTime(g - 1) : null; if (l) return l; const d = gwDeadline(g); return d ? new Date(d.getTime() - 7 * 864e5) : new Date(0); }
export function relTime(d) {
  if (!d) return '';
  const ms = Date.now() - d.getTime();
  if (ms >= 0 && ms < 3600e3) return Math.max(1, Math.round(ms / 60e3)) + 'm';
  if (ms >= 0 && ms < 864e5) return Math.round(ms / 3600e3) + 'h';
  if (ms >= 0 && ms < 6 * 864e5) return UI.dayHm(d);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
export const dayMonth = d => d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
export const weekday = d => d ? d.toLocaleDateString(undefined, { weekday: 'long' }) : '';
export const clock = d => UI.hm(d);

/* ---------- players ---------- */
export const P = code => UI.player(code);
/* a transaction name (web name) → the player, using the team that moved him to settle namesakes */
export function byName(name, team, gw) {
  const c = (D.plr || []).filter(p => p.Player === name);
  if (c.length === 1) return c[0];
  if (!c.length) return (D.ro || []).find(r => r.Player === name) || null;
  const own = c.find(p => p.Owner === team); if (own) return own;
  const hist = c.filter(p => Object.keys(D.gwsByGw || {}).some(g => (!gw || num(g) <= gw) && ((D.gwsByGw[g] || {})[String(p.Code)] || {}).Owner === team));
  return hist.length === 1 ? hist[0] : null;
}
export const lastName = p => String(p && p.Player || '');
/* injury text from FPL news: "Muscular injury - 75% chance of playing" → "Muscular injury" */
export function newsLabel(p) {
  const n = String(p && p.News || '').trim(); if (!n) return '';
  const a = n.split(/\s+-\s+/)[0];
  return a.replace(/\s+injury$/i, '').replace(/^Unspecified$/i, 'Injury') || a;
}
export function newsWhen(p) { const n = String(p && p.News || ''); const m = n.match(/(?:Expected back|back|until)\s+(\d{1,2}\s+[A-Za-z]{3})/i); return m ? m[1] : ''; }
export function chanceOf(p) { return UI.chance(p); }
export function statusWord(p) {
  const s = p && p.Status;
  if (s === 'd') { const c = chanceOf(p); return c + '%'; }
  if (s === 'i') return 'Out'; if (s === 's') return 'Suspended'; if (s === 'u') return 'Unavailable'; if (s === 'n') return 'Not eligible';
  return '';
}
/* season points over a window of gameweeks, from GW Stats */
export function ptsOver(code, gws) { return gws.reduce((s, g) => s + (((D.gwsByGw[g] || {})[String(code)] || {}).Pts || 0), 0); }
export function minsOver(code, gws) { return gws.reduce((s, g) => s + (((D.gwsByGw[g] || {})[String(code)] || {}).Mins || 0), 0); }
export function startsOver(code, gws) { return gws.reduce((s, g) => s + (((D.gwsByGw[g] || {})[String(code)] || {}).Starts || 0), 0); }
export function finishedGws(n) { const all = Object.keys(D.gwsByGw || {}).map(Number).filter(g => g <= D.gwsDone).sort((a, b) => a - b); return n ? all.slice(-n) : all; }

/* ---------- fixtures ---------- */
export const fxOf = g => (D.fx || []).filter(f => num(f.GW) === g);
export const fxFor = (team, g) => (D.fx || []).find(f => num(f.GW) === g && (f.Home === team || f.Away === team)) || null;
export const oppOf = (f, team) => f.Home === team ? f.Away : f.Home;

/* the club fixture a player's club plays in a gameweek */
export const clubFx = (club, g) => (D.cf || []).filter(x => num(x.GW) === g && (x.Home === club || x.Away === club));
