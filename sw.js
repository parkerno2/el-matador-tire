/* Matchweek · El Matador Tire — service worker (build 20261010164715)
 * The app shell, scripts and styles are network-first so a deploy shows up on the next open;
 * the cache is the offline fallback. Images and fonts live in their own cache that survives deploys:
 * faces and icons are served from it at once and refreshed in the background, club badges, flags,
 * player photos and font files from other sites are kept as they are (they never change). */
const VERSION = 'emt-v21-20261010164715';
const IMG = 'emt-img-v1';
const CORE = ['./', './index.html', './app.js', './app.css', './core.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== IMG).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const fresh = req => fetch(req, { cache: 'no-cache' }).then(r => {
  if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return r; }
  return caches.match(req, { ignoreSearch: true }).then(hit => hit || r);
}).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)));
const keep = (c, req, r) => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()).catch(() => {}); return r; };
/* from the cache when we have it; otherwise the network, then keep it */
const cacheFirst = req => caches.open(IMG).then(c => c.match(req).then(hit => hit || fetch(req).then(r => keep(c, req, r))));
/* from the cache at once, refreshed in the background for next time */
const swr = (e, req) => caches.open(IMG).then(c => c.match(req).then(hit => {
  const net = fetch(req).then(r => keep(c, req, r)).catch(() => hit);
  if (hit) { e.waitUntil(net); return hit; }
  return net;
}));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  /* the preview build (preview/, for Parker's eye): straight to the network, never the cached league shell or scripts */
  if (url.origin === location.origin && url.pathname.indexOf('/preview/') > -1) return;
  if (req.mode === 'navigate') { e.respondWith(fresh(req)); return; }
  if (url.origin !== location.origin) {
    /* badges, flags, player photos, font files: cache-first. Sheet data and everything else: straight to the network */
    if (req.destination === 'image' || req.destination === 'font') e.respondWith(cacheFirst(req));
    return;
  }
  if (/\.(js|css|html|webmanifest|json)$/.test(url.pathname)) { e.respondWith(fresh(req)); return; }
  e.respondWith(swr(e, req));
});
