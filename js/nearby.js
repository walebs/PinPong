// "Nearest" strip at the bottom of the map.
import { state, passesFilters } from './state.js';
import { esc, haversine, formatDistance, $ } from './utils.js';

const MAX_CARDS = 9;

export function showNearby() {
  if (!state.user) return;
  const { lat, lng } = state.user;
  const nearest = state.tables
    .map((table, i) => ({ table, i, d: haversine(lat, lng, table.lat, table.lng) }))
    .filter(x => passesFilters(x.table))
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_CARDS);

  $('nearbyStrip').innerHTML = nearest.map(({ table, i, d }, rank) => {
    const color = table.type === 'outdoor' ? 'var(--orange)' : 'var(--purple)';
    const check = table.verifisert === 'ja' ? ' <span class="nearby-card-check">✓</span>' : '';
    const glow = rank === 0 ? ' nearest-glow' : '';
    const type = table.type === 'outdoor' ? 'Utendørs' : esc(table.label || 'Innendørs');
    return `<div class="nearby-card" data-action="open-table" data-idx="${i}" style="border-left-color:${color};border-right-color:${color}">
      <div class="nearby-card-dist${glow}" style="color:${color}">${formatDistance(d)}${check}</div>
      <div class="nearby-card-name">${esc(table.navn)}</div>
      <div class="nearby-card-type">${type}</div>
    </div>`;
  }).join('');

  $('nearbyContainer').classList.add('visible');
  document.querySelector('.fab-stack').classList.add('strip-visible');
}
