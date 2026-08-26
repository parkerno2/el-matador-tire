/* FPL Companion — service worker
 * Network-first for the app itself (updates arrive on next open),
 * cache fallback for offline. Bump VERSION to force-refresh caches. */
const VERSION = 'emt-v8';
const CORE = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // app shell: always try the network first so deploys show up immediately
  if (e.request.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('index.html'))) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' }).then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); } // #18: key by path (recap/preview pages must never overwrite the shell); #7: never cache a 404/500
        else if (r.status >= 500 || r.status === 404) { return caches.match(e.request).then(hit => hit || caches.match('./index.html').then(shell => shell || r)); }
        return r;
      }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }
  // same-origin static assets: cache falling back to network
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); } // #7: never cache a 404
        return r;
      }))
    );
  }
  // everything else (sheet data, photos, badges, flags, fonts) goes straight to the network
});
