/* FPL Companion — service worker (Matchweek build 20261007045016)
 * The app shell, scripts and styles are network-first so a deploy shows up on the next open;
 * the cache is the offline fallback. Images and fonts are cache-first. */
const VERSION = 'emt-v20-20261007045016';
const CORE = ['./', './index.html', './app.js', './app.css', './core.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const fresh = req => fetch(req, { cache: 'no-cache' }).then(r => {
  if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return r; }
  return caches.match(req, { ignoreSearch: true }).then(hit => hit || r);
}).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') { e.respondWith(fresh(e.request)); return; }
  if (url.origin !== location.origin) return;               // sheet data, photos, badges, flags, fonts: straight to the network
  if (/\.(js|css|html|webmanifest|json)$/.test(url.pathname)) { e.respondWith(fresh(e.request)); return; }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return r;
  })));
});
