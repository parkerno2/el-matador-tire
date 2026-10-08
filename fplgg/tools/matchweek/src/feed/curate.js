/* feed/curate.js: the Feed's small, pure rules about Manager of the Month (Parker, 8 Oct 2026: "the feed leaves a bad
   first impression because it's sort of just talking about my manager of the month thing way too much"). No globals. */

/* a post about Manager of the Month: Archizio's own (kind motm) or one built on a manager's Manager of the Month claim
   (topic motm: the quote, Clark's bold call, the receipts, the pile-on) */
export const isMotm = p => !!p && (p.kind === 'motm' || p.topic === 'motm');

/* one Archizio Manager of the Month post at a time. cands: [{ win, per, post }] for every finished period's winner and the
   current race. A period's winner holds the slot until the next gameweek has finished (the race for a one-gameweek period is
   noise); then the current race; else the newest winner. null with no candidates */
export function pickMotm(cands, gwsDone) {
  if (!cands || !cands.length) return null;
  const wins = cands.filter(c => c.win).sort((a, b) => b.per[2] - a.per[2]);
  const just = wins.find(w => w.per[2] >= gwsDone);
  if (just) return just.post;
  const race = cands.filter(c => !c.win).sort((a, b) => b.per[1] - a.per[1])[0];
  if (race) return race.post;
  return wins[0] ? wins[0].post : null;
}

/* at most one voice post on the subject in a list (the newest by ts, which Archizio's single motm post normally is); a
   manager's own quote (kind presser) always stays: every quote goes on Everyone's feed */
export function oneMotm(posts) {
  let kept = false;
  return (posts || []).filter(p => {
    if (!isMotm(p) || p.kind === 'presser') return true;
    if (kept) return false;
    kept = true; return true;
  });
}

/* the posts that match move below the first n (their order kept); for a first visit's first screenful */
export function demote(posts, pred, n) {
  const list = posts || [], head = [], moved = [], tail = [];
  list.forEach((p, i) => { if (i < n && pred(p)) moved.push(p); else if (i < n) head.push(p); else tail.push(p); });
  if (!moved.length) return list;
  /* the head is topped up from the tail so the first screen stays full, then the moved posts, then the rest */
  const fill = tail.filter(p => !pred(p)).slice(0, moved.length), rest = tail.filter(p => !fill.includes(p));
  return head.concat(fill, moved, rest);
}
