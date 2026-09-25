export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Great-circle distance in metres.
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(metres) {
  return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
}

// Substring matches rank highest (earlier = better); otherwise the query's
// letters must appear in order ("sfbrg" → "Sofienberg").
export function fuzzyScore(name, query) {
  name = name.toLowerCase();
  if (name.includes(query)) return 100 + (100 - name.indexOf(query));
  let j = 0;
  for (let i = 0; i < name.length && j < query.length; i++) {
    if (name[i] === query[j]) j++;
  }
  return j === query.length ? j : 0;
}

export const $ = id => document.getElementById(id);
