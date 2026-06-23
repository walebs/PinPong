const TILE_CACHE = 'pinpong-tiles-v1';

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
      } catch (e) {
        return new Response('', { status: 503 });
      }
    })
  );
});
