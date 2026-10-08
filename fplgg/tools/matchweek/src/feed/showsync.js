/* feed/showsync.js — the Gameweek Show's audio contract with Code.gs (v3.23) and the caption clock, with no DOM in it so
   tests/app-show.js can run it in Node.
   · ?show=<gw> answers only the clips rendered from the script's lines as they are now (the server compares each stored
     take's hash with the current line); an older take is listed in stale and never sent, a line not yet voiced in
     missing. Whatever is not in clips plays as a timed caption, so the wrong audio is never heard.
   · A clip may carry w, its word start times in seconds (ElevenLabs' character alignment, one number per word of the
     line as split on whitespace); the caption then reveals each word at its time. Without w the share of the clip played
     drives the captions, as before. */

/* the server's answer → { clips: { key: { b64, secs, w|null } }, complete, stale, missing }, or null when it holds nothing */
export function parseShow(r) {
  if (!r || !r.ok || !r.clips || typeof r.clips !== 'object') return null;
  const clips = {};
  Object.keys(r.clips).forEach(k => {
    const c = r.clips[k]; if (!c || typeof c.b64 !== 'string' || !c.b64) return;
    const w = Array.isArray(c.w) && c.w.length && c.w.every(x => typeof x === 'number' && isFinite(x) && x >= 0) ? c.w.slice() : null;
    clips[k] = { b64: c.b64, secs: +c.secs > 0 ? +c.secs : 0, w };
  });
  if (!Object.keys(clips).length) return null;
  return { clips, complete: r.complete === true, stale: Array.isArray(r.stale) ? r.stale.slice() : [], missing: Array.isArray(r.missing) ? r.missing.slice() : [] };
}

/* an audio tag (Code.gs v3.26: [laughing], [whispering], a direction for ElevenLabs v4 in square brackets before the words
   it shapes) is voiced, never shown: the caption text is the line without its tags, spaces tidied. */
export const TAG_RE = /\[[^\[\]]*\]/g;
export function stripTags(t) { return String(t == null ? '' : t).replace(TAG_RE, ' ').replace(/\s+/g, ' ').trim(); }

/* the caption clock. LEAD: a word lights a touch before the voice reaches it, so the eye is never behind. */
export const LEAD = 0.12;
/* how many of n words are on screen at t seconds into the clip, from the word start times (null or a wrong count
   falls back to the share of the clip played, frac) */
export function wordsOn(w, n, t, frac) {
  if (!(n > 0)) return 0;
  if (w && w.length === n) { let k = 0; while (k < n && w[k] <= t + LEAD) k++; return k; }
  return wordsByShare(frac, n);
}
/* the estimate: the share played, run a little ahead (the old clock) */
export function wordsByShare(frac, n) {
  if (!(n > 0)) return 0;
  const f = Math.min(1, Math.max(0, +frac || 0));
  return Math.min(n, Math.ceil(f * n * 1.08));
}

/* where this gameweek's show sits on Matchday and in the Feed (Parker, 8 Oct 2026: it was hard to find):
   'card' from the moment the script exists until the deadline, 'replay' from the deadline until the gameweek is
   over, null otherwise (an older gameweek's show stays in Feed → Articles) */
export function showSlot(s, D) {
  if (!s || !D || !D.gw || s.gw !== D.gw || D.provOver) return null;
  return D.dlPassed ? 'replay' : 'card';
}
