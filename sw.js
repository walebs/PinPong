const TILE_CACHE = 'pinpong-tiles-v3';

// ── Oslo + Lillestrøm bounding box ───────────────────────
const BOUNDS = { minLat: 59.82, maxLat: 60.02, minLng: 10.55, maxLng: 11.15 };
// Pre-cache zoom 11–13 (plain + @2x). ~420 tiles, ~6 MB.
// Zoom 14+ is cached on demand by the fetch handler below.
const PRECACHE_ZOOMS = [11, 12, 13];
const SUBS = ['a', 'b', 'c', 'd'];

function tileXY(lat, lng, z) {
  const n = 1 << z;
  const r = Math.PI / 180;
  const x = Math.floor((lng + 180) / 360 * n);
  const y = Math.floor(
    (1 - Math.log(Math.tan(lat * r) + 1 / Math.cos(lat * r)) / Math.PI) / 2 * n
  );
  return { x, y };
}

function buildTileUrls() {
  const urls = [];
  for (const z of PRECACHE_ZOOMS) {
    const { x: x0, y: y0 } = tileXY(BOUNDS.maxLat, BOUNDS.minLng, z); // NW corner
    const { x: x1, y: y1 } = tileXY(BOUNDS.minLat, BOUNDS.maxLng, z); // SE corner
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const s = SUBS[(x + y) & 3];
        const base = `https://${s}.basemaps.cartocdn.com/dark_matter/${z}/${x}/${y}`;
        urls.push(base + '.png');
        urls.push(base + '@2x.png');
      }
    }
  }
  return urls;
}

async function preCacheTiles(cache) {
  const urls = buildTileUrls();
  const BATCH = 6; // gentle on the network
  for (let i = 0; i < urls.length; i += BATCH) {
    await Promise.allSettled(
      urls.slice(i, i + BATCH).map(url =>
        cache.match(url).then(hit => {
          if (hit) return; // already cached, skip
          return fetch(url)
            .then(r => { if (r.ok) cache.put(url, r); })
            .catch(() => {});
        })
      )
    );
  }
}

// ── Lifecycle ────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  // Delete stale tile caches
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('pinpong-tiles-') && k !== TILE_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
  // Pre-cache Oslo tiles in the background (non-blocking for the user)
  caches.open(TILE_CACHE).then(preCacheTiles);
});

// ── Fetch: serve from cache, fall back to network ────────
self.addEventListener('fetch', event => {
  if (!event.request.url.includes('cartocdn.com')) return;
  event.respondWith(
    caches.open(TILE_CACHE).then(async cache => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      } catch {
        return new Response('', { status: 503 });
      }
    })
  );
});
