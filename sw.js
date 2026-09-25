const TILE_CACHE  = 'pinpong-tiles-v4';
const IMAGE_CACHE = 'pinpong-images-v1';

// Map tiles and table photos are cached as they are viewed (cache-first),
// so revisiting an area or a card is instant.
const TILE_MAX  = 1500; // roughly 15–25 MB
const IMAGE_MAX = 120;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  // Remove caches from older versions
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

// cache.keys() is in insertion order, so dropping from the front removes the oldest.
// Tiles are pruned every 100 writes since listing a large cache is slow.
async function prune(cache, max) {
  const keys = await cache.keys();
  if (keys.length > max) {
    await Promise.all(keys.slice(0, keys.length - max).map(k => cache.delete(k)));
  }
}
let tileWrites = 0;
function putTile(cache, request, response) {
  return cache.put(request, response).then(() => {
    if (++tileWrites % 100 === 0) return prune(cache, TILE_MAX);
  });
}

function isImage(url) {
  return url.includes('i.imgur.com') || url.includes('/images/bord/');
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;

  // Map tiles
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

  // Table photos. Imgur is cross-origin, so it's fetched no-cors (opaque response).
  if (isImage(url)) {
    const isOpaque = url.includes('i.imgur.com');
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request, isOpaque ? { mode: 'no-cors' } : undefined);
          if (isOpaque ? response.type === 'opaque' : response.ok) {
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
