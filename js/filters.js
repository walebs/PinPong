// Filter panel (top left) and the verified-count badge under it.
import { map } from './map.js';
import { state } from './state.js';
import { renderMarkers, isOnMap } from './markers.js';
import { sheet } from './BottomSheet.js';
import { showNearby } from './nearby.js';
import { $ } from './utils.js';

const panel = $('filterFab');

// Shown as small dots on the closed filter button, one per active filter.
const DOT_COLORS = {
  outdoor: 'var(--orange)',
  bar: 'var(--purple)',
  fav: '#ff3b30',
  verified: 'var(--green)',
  roof: '#64a0ff',
  light: '#FFD600',
};

export const togglePanel = () => panel.classList.toggle('open');
export const closePanel = () => panel.classList.remove('open');
export const isPanelOpen = () => panel.classList.contains('open');

export function toggleFilter(name) {
  state.filters[name] = !state.filters[name];
  $(`pill-${name}`).classList.toggle('active', state.filters[name]);

  renderMarkers();
  // Keep the card open if its table is still visible
  if (state.selectedIdx !== null && isOnMap(state.selectedIdx)) {
    sheet.carousel.rebuild(state.selectedIdx);
    sheet.carousel.updateNav();
  } else {
    sheet.close();
  }
  showNearby();
  updateFilterDots();
}

export function updateFilterDots() {
  const f = state.filters;
  // The type filters are on by default, so they count as active when switched off.
  const active = Object.keys(DOT_COLORS).filter(name =>
    name === 'outdoor' || name === 'bar' ? !f[name] : f[name]);
  const wrap = $('filterDotWrap');
  wrap.innerHTML = active
    .map(name => `<span class="filter-dot-mini" style="background:${DOT_COLORS[name]}"></span>`)
    .join('');
  wrap.classList.toggle('visible', active.length > 0);
}

export function updateVerifiedCount() {
  const total = state.tables.length;
  const verified = state.tables.filter(t => t.verifisert === 'ja').length;
  const circumference = 2 * Math.PI * 10; // r = 10 in the SVG
  $('progressArc').setAttribute('stroke-dasharray', `${(verified / (total || 1)) * circumference} ${circumference}`);
  $('progressFraction').textContent = `${verified}/${total}`;
  $('omTableCount').textContent = total;
  updateFilterDots();
}

// Close the panel when tapping elsewhere or starting to pan the map
document.addEventListener('click', e => {
  if (isPanelOpen() && !e.target.closest('.filter-fab')) closePanel();
});
map.on('dragstart', closePanel);
