/* Agent 360 service worker.
   Shell is network-first so a new deploy lands on the next load, with the cache
   as the offline fallback; Google Fonts are cached stale-while-revalidate so the
   installed app keeps its faces with no network. Bump CACHE on every release —
   activate() deletes the old one, and verify.js fails if this drifts from the
   VERSION constant in index.html. */
const CACHE = 'agent360-v1.49';
/* SHELL is what the app cannot boot without, and its precache must succeed.
   ICONS are decoration, and they are precached one at a time, best effort:
   addAll() is all-or-nothing, so a transient 404 on ONE icon used to reject
   the whole install — no service worker registered, an empty bucket, and no
   offline app at all — measured: a missing icon-maskable-512.png left
   registered:false, 0 entries, and an offline reload that never came back. */
const SHELL = [ './', './index.html', './manifest.webmanifest' ];
const ICONS = [ './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png' ];
const NET_MS = 3000;   // how long the shell waits for a stalled network before the cache answers
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Chakra+Petch:wght@400;600;700&display=swap';

/* Only a good response is worth keeping: caching a 404 or an opaque 5xx would
   serve the failure forever once the network went away. */
const putOk = (c, req, r) => (r && r.ok) ? c.put(req, r.clone()).then(() => r) : r;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    /* cache:'reload', or the precache reads through the HTTP cache: Pages
       serves max-age=600, so a reload within ten minutes of a deploy could
       file the PREVIOUS index.html under the new bucket name, and the
       installed app carried the wrong build until its next online visit. */
    await c.addAll(SHELL.map(u => new Request(u, { cache:'reload' })));
    await Promise.allSettled(ICONS.map(u =>
      fetch(new Request(u, { cache:'reload' })).then(r => putOk(c, u, r)).catch(() => {})));
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

/* Our own buckets only. A Cache Storage bucket is per-ORIGIN, not per-app, and
   this game shares joshfeinst.github.io with its sibling project — so deleting
   every key that was not ours threw away another app's offline cache on every
   release of this one. Scope by prefix and leave the neighbours alone. */
const MINE = k => k.startsWith('agent360-');
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => MINE(k) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (url.origin === location.origin) {
    /* Network-first, but not network-hostage: a STALLED connection (a hotel
       wifi, a captive portal, a phone with one bar) is not a failed one, so the
       catch() below never fired and the installed app sat on a blank tab
       waiting for index.html while the whole shell was in the cache —
       measured 25.1s to boot with every request stalling 12s. After NET_MS a
       cached copy is served if there is one; the network is still awaited in
       the background and still refreshes the cache when it finally answers. */
    const net = fetch(e.request);
    const cached = caches.match(e.request, { ignoreSearch: true });
    /* The cache write is registered on the network promise FIRST, so its
       clone is taken synchronously the instant the response exists — before
       the race below can hand that same response to the page and start the
       body draining. (A clone taken inside a later caches.open() continuation
       is the exact bug verify.js guards against: by then the body is in use
       and every put throws.) waitUntil keeps the worker alive for the write
       whichever side of the race the page was served from. */
    e.waitUntil(net.then(r => {
      if (!r.ok) return;
      const copy = r.clone();
      return caches.open(CACHE).then(c => c.put(e.request, copy));
    }).catch(() => {}));
    const late = new Promise(res => setTimeout(() => cached.then(m => res(m || null)), NET_MS));
    e.respondWith(
      Promise.race([ net, late.then(m => m || net) ])   // nothing cached: keep waiting for the network
        .catch(() => cached.then(m => m || caches.match('./index.html')))
    );
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(e.request).then(m => {
        const net = fetch(e.request)
          .then(r => {
            if (r.ok){ const copy = r.clone();
              e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copy))); }
            return r;
          })
          .catch(() => m);
        /* on a hit the revalidation is handed to the event as well, or the
           worker can be killed the instant the stale copy is served and the
           fresh one is never written */
        if (m) e.waitUntil(net.catch(() => {}));
        if (m) return m;
        /* A MISS on a stalled network: the font CSS is a render-blocking
           stylesheet, so the page's scripts wait on it, and with no timeout the
           installed app sat on a blank tab for 12.5s with the whole shell
           cached. After NET_MS an empty stylesheet answers — the fallback face
           draws, the game boots — and the real one lands in the cache when it
           finally arrives, for next time. */
        e.waitUntil(net.catch(() => {}));
        return Promise.race([ net, new Promise(res => setTimeout(() => res(
          new Response('', { headers: { 'Content-Type': 'text/css' } })), NET_MS)) ]);
      })
    );
  }
});
