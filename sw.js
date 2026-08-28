/* Agent 360 service worker.
   Shell is network-first so a new deploy lands on the next load, with the cache
   as the offline fallback; Google Fonts are cached stale-while-revalidate so the
   installed app keeps its faces with no network. Bump CACHE on every release —
   activate() deletes the old one, and verify.js fails if this drifts from the
   VERSION constant in index.html. */
const CACHE = 'agent360-v1.10';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'
];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Chakra+Petch:wght@400;600;700&display=swap';

/* Only a good response is worth keeping: caching a 404 or an opaque 5xx would
   serve the failure forever once the network went away. */
const putOk = (c, req, r) => { if (r && r.ok) c.put(req, r.clone()); return r; };

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(SHELL);
    /* Best-effort font precache: fetch the CSS, then the woff2 files it names,
       so the HUD face survives offline even if the first play session never
       touched a glyph the browser had to fetch. Any failure here is fine — the
       fetch handler below keeps filling the cache as fonts are used. */
    try {
      const css = await fetch(FONT_CSS);
      if (css.ok){
        const text = await css.clone().text();
        await c.put(FONT_CSS, css);
        const urls = [...new Set(text.match(/https:\/\/fonts\.gstatic\.com\/[^)\s'"]+\.woff2/g) || [])];
        await Promise.all(urls.map(u =>
          fetch(u).then(r => putOk(c, u, r)).catch(() => {})));
      }
    } catch (_) {}
  }).then(() => self.skipWaiting()));
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
          if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
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
            if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
            return r;
          })
          .catch(() => m);
        return m || net;
      })
    );
  }
});
