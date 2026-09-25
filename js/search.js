// Search box: matches table names and neighbourhoods.
import { map } from './map.js';
import { state } from './state.js';
import { AREAS } from './places.js';
import { sheet } from './BottomSheet.js';
import { closePanel } from './filters.js';
import { esc, fuzzyScore, $ } from './utils.js';

const wrap = $('searchWrap');
const input = $('searchInput');
const results = $('searchResults');
let debounce = null;

export function expandSearch() {
  wrap.classList.add('expanded');
  closePanel();
  input.focus();
}

export function collapseSearch() {
  results.style.display = 'none';
  input.value = '';
  wrap.classList.remove('expanded');
  input.blur();
}

export const isSearchOpen = () => wrap.classList.contains('expanded');

function bestMatches(items, query, limit) {
  return items
    .map((item, i) => ({ item, i, score: fuzzyScore(item.navn, query) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function runSearch() {
  const query = input.value.toLowerCase().trim();
  if (!query) { results.style.display = 'none'; return; }

  const tables = bestMatches(state.tables, query, 3).map(({ item, i }) =>
    `<div class="search-result-item" data-action="search-table" data-idx="${i}">`
    + `<span style="font-size:10px;color:${item.type === 'outdoor' ? 'var(--orange)' : 'var(--purple)'}">●</span>`
    + `<span>${esc(item.navn)}</span></div>`);
  const areas = bestMatches(AREAS, query, 2).map(({ item, i }) =>
    `<div class="search-result-item" data-action="search-area" data-idx="${i}"><span>${esc(item.navn)}</span></div>`);

  const html = [...tables, ...areas].slice(0, 5);
  if (!html.length) { results.style.display = 'none'; return; }
  results.innerHTML = html.join('');
  results.style.display = 'block';
}

export function selectTable(idx) {
  collapseSearch();
  sheet.flyToAndOpen(idx);
}

export function selectArea(idx) {
  collapseSearch();
  map.flyTo([AREAS[idx].lat, AREAS[idx].lng], 14, { duration: 0.7 });
}

input.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(runSearch, 120);
});

// Enter / the keyboard's search key picks the top result
input.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  clearTimeout(debounce);
  runSearch();
  results.querySelector('.search-result-item')?.click();
});

input.addEventListener('blur', () => {
  setTimeout(() => { if (!input.value.trim()) collapseSearch(); }, 150);
});

document.addEventListener('click', e => {
  if (isSearchOpen() && !e.target.closest('.search-wrap') && !e.target.closest('.search-results')) {
    collapseSearch();
  }
});
