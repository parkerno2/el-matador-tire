/* pages/avail.js: the one reader of a player's availability (M2 check 3). Matchday's doubts, the Lineup chip, notes and pitch
   flags, the My team overview, the Squad and the flag helpers all ask here, and nothing else in these pages reads Status for a
   doubt, so one player in one fixture reads the same state, chance and words on every screen.
   The state comes from the engine's own flaggedOut() (injured, suspended, unavailable, or a doubt FPL puts at 25% or less is
   out; any other doubt is a doubt), so the flags and the auto-sub engine never disagree.
     availOf(p)      { state: 'fit' | 'doubt' | 'out', chance, news, matters, label, text, kind }
                       chance: FPL's stated chance of playing, or null when the news gives none
                       matters: false once his club's match has started (a flag stops mattering then)
                       label: the chip words (75%, DOUBT, OUT, SUSPENDED, UNAVAILABLE); text: the words in a sentence (a doubt the engine counts as out, 25% or less, reads "25%, out")
     availSummary(l) { n: {fit, doubt, out} (a started player counts as fit), doubts, outs (those that matter), flagged }
   Engine globals (flaggedOut, fxStarted) come from core.js. */
import * as UI from '../ui.js';

const esc = UI.esc;
const player = p => (p && typeof p === 'object') ? p : (p ? UI.player(p) : null);

export function availOf(p0) {
  const p = player(p0);
  if (!p) return { state: 'fit', chance: null, news: '', matters: false, label: '', text: '', kind: '' };
  const status = String(p.Status || 'a'), news = String(p.News || '');
  const m = /(\d+)\s*%/.exec(news), chance = m ? +m[1] : null;
  const out = flaggedOut(p), doubt = !out && status === 'd';
  const state = out ? 'out' : doubt ? 'doubt' : 'fit';
  const kind = status === 'd' ? 'doubtful' : status === 's' ? 'suspended' : status === 'u' ? 'unavailable' : out ? 'injured' : '';
  const label = state === 'fit' ? ''
    : status === 'd' ? (chance === null ? 'DOUBT' : chance + '%')
      : status === 's' ? 'SUSPENDED' : status === 'u' ? 'UNAVAILABLE' : 'OUT';
  const text = state === 'fit' ? '' : status === 'd' ? (chance === null ? 'doubtful' : chance + (out ? '%, out' : '%')) : status === 's' ? 'suspended' : status === 'u' ? 'unavailable' : 'out';
  return { state, chance, news, matters: !fxStarted(p.Club), label, text, kind };
}
export const isOut = p => availOf(p).state === 'out';
/* the state a screen shows: a flag whose match has started is no longer one */
export const shownState = p => { const a = availOf(p); return a.matters ? a.state : 'fit'; };

export function availSummary(players) {
  const rows = (players || []).map(p => ({ p, a: availOf(p) }));
  const n = { fit: 0, doubt: 0, out: 0 };
  rows.forEach(r => { n[r.a.matters ? r.a.state : 'fit']++; });
  const pick = s => rows.filter(r => r.a.matters && r.a.state === s);
  return { n, doubts: pick('doubt'), outs: pick('out'), flagged: rows.filter(r => r.a.matters && r.a.state !== 'fit') };
}

/* the chip beside a name: amber for a doubt, red for out; nothing for a fit player or one whose match has started */
export function availChip(p, extra) {
  const a = availOf(p);
  if (!a.matters || a.state === 'fit') return '';
  return '<span class="chip ' + (a.state === 'out' ? 'out' : 'doubt') + (extra ? ' ' + extra : '') + '" title="' + esc(a.news || a.text) + '">' + esc(a.label) + '</span>';
}
/* the ring round a face: amber doubt, red out */
export function availRing(p) {
  const s = shownState(p);
  return s === 'doubt' ? { ring: 'var(--doubt)' } : s === 'out' ? { ring: 'var(--loss)' } : {};
}
/* the player as the Plate should read him: the Plate badge colours a doubt amber and an injury red by Status alone, so a
   doubt the engine counts as out (25% or less) is handed over as out and the pitch agrees with the chip */
export function plateOf(p) {
  const a = availOf(p);
  return a.state === 'out' && String(p.Status || '') === 'd' ? Object.assign({}, p, { Status: 'i' }) : p;
}
