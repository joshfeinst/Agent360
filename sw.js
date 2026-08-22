/* Agent 360 service worker.
   Shell is network-first so a new deploy lands on the next load, with the cache
   as the offline fallback; Google Fonts are cached stale-while-revalidate so the
   installed app keeps its faces with no network. Bump CACHE on every release —
   activate() deletes the old one. */
const CACHE = 'agent360-v1.04';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return r;
        })
        .catch(() =>
          caches.match(e.request, { ignoreSearch: true })
            .then(m => m || caches.match('./index.html')))
    );
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(e.request).then(m => {
        const net = fetch(e.request)
          .then(r => {
            const copy = r.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
            return r;
          })
          .catch(() => m);
        return m || net;
      })
    );
  }
});
