/* Our Home Folder service worker — deliberately conservative.
 *
 * Job one is installability (Home Screen on iOS/Android, install prompt in
 * Chrome) and a decent offline experience; job two is to never, ever serve a
 * stale app after a deploy. So:
 *   - navigations are network-first (fresh HTML wins), falling back to a
 *     cached copy of that page, then to /offline;
 *   - hashed immutable assets (/_next/static) are cache-first — a changed
 *     file gets a new hash, so this can never go stale;
 *   - everything else (Supabase API calls are cross-origin and never touched)
 *     goes straight to the network.
 * Bump VERSION to invalidate every runtime cache on the next visit.
 */

const VERSION = 'ohf-v1';
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

  // Page navigations: the network is the source of truth; the cache is the
  // memory of the last good visit; /offline is the floor.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
  }
});
