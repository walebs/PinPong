const TILE_CACHE  = 'pinpong-tiles-v4';
const IMAGE_CACHE = 'pinpong-images-v1';

// Tiles are cached on demand as the user browses the map (cache-first).
// (v3 pre-cached ~840 dark tiles on install, but their URLs lacked the ?key=
//  query the app requests with, so they never matched — pure wasted data.)
const TILE_MAX  = 1500; // ~15–25 MB worst case; oldest entries are pruned
const IMAGE_MAX = 120;  // max cached table photos before pruning oldest

// ── Lifecycle ────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  // Delete stale caches (including the unused v3 tile pre-cache)
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k =>
            (k.startsWith('pinpong-tiles-')  && k !== TILE_CACHE) ||
            (k.startsWith('pinpong-images-') && k !== IMAGE_CACHE)
          )
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Cache size limits ────────────────────────────────────
// cache.keys() returns entries in insertion order, so slicing from the
// front drops the oldest. Tile pruning is batched (every 100 puts) because
// listing a large cache on every tile would be expensive.
async function prune(cache, max) {
  const keys = await cache.keys();
  if (keys.length > max) {
    await Promise.all(keys.slice(0, keys.length - max).map(k => cache.delete(k)));
  }
}
let _tilePuts = 0;
function putTile(cache, request, response) {
  return cache.put(request, response).then(() => {
    if (++_tilePuts % 100 === 0) return prune(cache, TILE_MAX);
  });
}

function isImage(url) {
  return url.includes('i.imgur.com') || url.includes('/images/bord/');
}

// ── Fetch: serve from cache, fall back to network ────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;

  // Map tiles — cache-first
  if (url.includes('cartocdn.com')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok) event.waitUntil(putTile(cache, event.request, response.clone()));
          return response;
        } catch {
          return new Response('', { status: 503 });
        }
      })
    );
    return;
  }

  // Table images — cache-first, store on first load.
  // Imgur is cross-origin so we fetch no-cors (opaque response, status 0).
  // Local /images/bord/ is same-origin so response.ok works normally.
  if (isImage(url)) {
    const isOpaque = url.includes('i.imgur.com');
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request, isOpaque ? { mode: 'no-cors' } : undefined);
          // Opaque responses have status 0; same-origin must be ok
          if (isOpaque ? response.type === 'opaque' : response.ok) {
            // Store in the background — don't delay showing the photo
            event.waitUntil(
              cache.put(event.request, response.clone()).then(() => prune(cache, IMAGE_MAX))
            );
          }
          return response;
        } catch {
          return new Response('', { status: 503 });
        }
      })
    );
  }
});
