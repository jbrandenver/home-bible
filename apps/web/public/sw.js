/* Our Home Folder service worker — deliberately conservative.
 *
 * Job one is installability (Home Screen on iOS/Android, install prompt in
 * Chrome) and a decent offline experience; job two is to never, ever serve a
 * stale app after a deploy. So:
 *   - navigations always hit the network, falling back only to /offline —
 *     page HTML is never cached (a stale snapshot is worse than a reload);
 *   - hashed immutable assets (/_next/static) are cache-first — a changed
 *     file gets a new hash, so this can never go stale;
 *   - everything else (Supabase API calls are cross-origin and never touched)
 *     goes straight to the network.
 * Bump VERSION to invalidate every runtime cache on the next visit.
 */

const VERSION = 'ohf-v2';
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/icon-192.png', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Hashed chunks and fonts: immutable by construction, cache-first.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(VERSION).then((cache) =>
        cache.match(request).then(
          (cached) =>
            cached ||
            fetch(request).then((response) => {
              if (response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            })
        )
      )
    );
    return;
  }

  // Page navigations: the network only, with /offline as the floor. v1 also
  // cached a copy of every visited page and could in principle serve a stale
  // snapshot; launch QA saw flashes of earlier content, so page HTML is now
  // never cached — stability beats offline page revisits.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
