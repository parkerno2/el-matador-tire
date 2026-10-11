/* swap.js — redraw a container without throwing its pictures away (Parker, 11 Oct 2026, on his iPhone during a live
   gameweek: "The images are still disappearing sporadically when I click into someone and when I scroll").
   While a match is on, the app reloads the data every 90 seconds and redraws the page and the open sheet with innerHTML.
   That destroyed every <img> on screen, so the phone fetched and decoded every player photo, badge and flag again:
   photos blanked for a moment on each refresh, and on iOS some stayed blank until the next scroll.
   swapHTML(el, html) puts the new markup in, then moves each picture that had finished loading in the old markup into
   the matching slot of the new one (same src), carrying the new element's attributes over, so a refresh reloads and
   re-decodes nothing. A picture that had not loaded, or failed, is simply drawn anew. */
export function swapHTML(el, html) {
  const keep = new Map();
  el.querySelectorAll('img').forEach(i => {
    if (!i.complete || !i.naturalWidth) return;
    const k = i.getAttribute('src'); if (!k) return;
    if (!keep.has(k)) keep.set(k, []);
    keep.get(k).push(i);
  });
  el.innerHTML = html;
  if (!keep.size) return 0;
  let kept = 0;
  el.querySelectorAll('img').forEach(n => {
    const list = keep.get(n.getAttribute('src'));
    if (!list || !list.length) return;
    const o = list.shift();
    /* the new element's attributes win (class, style, alt, the fallback chain); src is equal, so it is never set again,
       which is what would make the browser fetch it once more */
    [...o.attributes].forEach(a => { if (!n.hasAttribute(a.name)) o.removeAttribute(a.name); });
    [...n.attributes].forEach(a => { if (o.getAttribute(a.name) !== a.value) o.setAttribute(a.name, a.value); });
    n.replaceWith(o);
    kept++;
  });
  return kept;
}
