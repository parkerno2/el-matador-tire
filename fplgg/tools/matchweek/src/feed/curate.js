/* feed/curate.js: the Feed's small, pure rules: Manager of the Month (Parker, 8 Oct 2026: "the feed leaves a bad first
   impression because it's sort of just talking about my manager of the month thing way too much") and how long an article
   leads (Parker, 8 Oct 2026, Q3: "When will it go away and not be the first thing?"). No globals. */

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

/* an article leads only while it is fresh (Parker, 8 Oct 2026): for its first ART_LEAD_H hours after it went live the
   preview or recap card goes first on the Matchday rail and sits in For you's article slot; after that it follows the
   newest voice posts (still on the rail until the deadline for a preview, until the next gameweek for a recap) and the
   Feed keeps it in its place by time, never pinned. An article without a publish time (a built-in page) never leads. */
export const ART_LEAD_H = 24;
export function artLeads(a, now, hours = ART_LEAD_H) {
  const t = a && a.approved ? Date.parse(a.approved) : NaN;
  return isFinite(t) && now - t < hours * 3600e3;
}
/* the rail's cards in order: the article first while it leads, else after the posts; no article, the posts alone */
export function railOrder(art, posts, lead) {
  const ps = (posts || []).slice();
  if (!art) return ps;
  return lead ? [art].concat(ps) : ps.concat([art]);
}
