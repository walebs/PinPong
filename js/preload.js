// Warms the HTTP / service-worker cache so photos show instantly when a card opens.
import { state } from './state.js';
import { map } from './map.js';
import { haversine } from './utils.js';

const requested = new Set();

export function preloadImage(url) {
  if (!url || requested.has(url)) return;
  requested.add(url);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
}

// Photos of the tables closest to the user (or the map centre), a few at a time.
export function preloadNearestImages(count = 12) {
  if (navigator.connection?.saveData) return;
  const from = state.user || map.getCenter();
  const urls = state.tables
    .filter(t => t.bilde_url)
    .map(t => ({ url: t.bilde_url, d: haversine(from.lat, from.lng, t.lat, t.lng) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map(x => x.url);

  let i = 0;
  const nextBatch = () => {
    if (i >= urls.length) return;
    urls.slice(i, i + 3).forEach(preloadImage);
    i += 3;
    setTimeout(nextBatch, 600);
  };
  nextBatch();
}
