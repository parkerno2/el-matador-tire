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
    clips[k] = { b64: c.b64, secs: +c.secs > 0 ? +c.secs : 0, w, hash: typeof c.hash === 'string' ? c.hash : null };
  });
  if (!Object.keys(clips).length) return null;
  return { clips, complete: r.complete === true, stale: Array.isArray(r.stale) ? r.stale.slice() : [], missing: Array.isArray(r.missing) ? r.missing.slice() : [] };
}

/* ---------- voiced or not (Parker, 9 Oct 2026: "I don't want a non-voice preview to be the first thing they see") ----------
   A gameweek's show appears only when every line has a current voiced take: the same test as ?health=1 show.clips equal
   show.expected. Until then nothing shows for a member (no Feed post, no card, no captions-only player); the commissioner
   sees one quiet line where the show would be. A rewrite makes the old takes stale and the server (v3.24) stops serving
   them, so a show once complete goes back to hidden until the new version is fully voiced; a version whose clips are
   still served stays playable. */
/* the clip keys of a script, in play order */
export function showKeys(j) {
  if (!j || !Array.isArray(j.chapters)) return [];
  return ['open'].concat(...j.chapters.map((c, i) => (c && Array.isArray(c.beats) ? c.beats : []).map((_, b) => 'c' + (i + 1) + 'b' + b)), ['close']);
}
/* the voicing state of a script: from the repo's measured clips (dur per key) or the server's meta answer
   (?show=<gw>&meta=1: clips with secs and hash, complete) → { ready, voiced, expected, hashes } */
export function showVoiced(j, meta, repoDur) {
  const keys = showKeys(j), hashes = {};
  if (!keys.length) return { ready: false, voiced: 0, expected: 0, hashes };
  let voiced = 0;
  if (repoDur && typeof repoDur === 'object') keys.forEach(k => { if (+repoDur[k] > 0) voiced++; });
  else if (meta && meta.ok && meta.clips && typeof meta.clips === 'object') {
    keys.forEach(k => { const c = meta.clips[k]; if (c && typeof c === 'object' && +c.secs > 0) { voiced++; if (typeof c.hash === 'string') hashes[k] = c.hash; } });
    if (meta.complete !== true) return { ready: false, voiced, expected: keys.length, hashes };
  }
  return { ready: voiced === keys.length, voiced, expected: keys.length, hashes };
}
/* the clips seen at load are still the ones served (same key, same hash): a rewrite changes the hashes, so a version
   whose takes went stale is not played with the new audio under its old captions */
export function showServed(hashes, served) {
  const keys = Object.keys(hashes || {});
  if (!keys.length) return true;
  return keys.every(k => served && typeof served[k] === 'string' && served[k] === hashes[k]);
}
/* can the player play this show with the audio it got? repo clips: every key; the sheet: complete and the same takes */
export function showPlayable(s, au) {
  if (!s || !au || !au.urls) return false;
  const keys = s.clips || showKeys(s.j);
  if (!keys.length || keys.some(k => !au.urls[k])) return false;
  if (au.from === 'sheet' && (au.complete !== true || !showServed(s.hashes, au.hashes))) return false;
  return true;
}
/* the commissioner's line where the show would be */
export function showNote(p) { return 'Gameweek ' + p.gw + ' show: being voiced, ' + p.voiced + ' of ' + p.expected + ' lines'; }
export function showNoteHTML(p) { return '<p class="show-note"><i></i>' + showNote(p) + '</p>'; }

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
