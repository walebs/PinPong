import { SEED_TABLES } from './places.js';

const EMPTY_DETAILS = {
  verifisert: null, antall: null, materiale: null, tilstand: null,
  under_tak: null, belysning: null, vibe: null, notater: '', bilde_url: '',
};

export const state = {
  tables: SEED_TABLES.map(s => ({ ...EMPTY_DETAILS, ...s, label: s.label || null })),
  selectedIdx: null,
  user: null, // { lat, lng } once we have a GPS fix
  filters: {
    outdoor: true,
    bar: true,
    fav: false,
    verified: false,
    roof: false,
    light: false,
  },
};

export function passesFilters(t) {
  const f = state.filters;
  // With both type filters off, show every type rather than nothing.
  if ((f.outdoor || f.bar) && !(t.type === 'outdoor' ? f.outdoor : f.bar)) return false;
  if (f.fav && !favorites.has(t.navn)) return false;
  if (f.verified && t.verifisert !== 'ja') return false;
  if (f.roof && t.type !== 'bar' && !/ja/i.test(t.under_tak || '')) return false;
  if (f.light && !/ja/i.test(t.belysning || '')) return false;
  return true;
}

// Favourites are stored by table name, which stays stable when the sheet is reordered.
const FAV_KEY = 'pinpong-favs';

function loadFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    // Early versions stored indices into the seed list.
    if (saved.length && typeof saved[0] === 'number') {
      return saved.map(i => SEED_TABLES[i]?.navn).filter(Boolean);
    }
    return saved;
  } catch {
    return [];
  }
}

export const favorites = new Set(loadFavorites());

export function toggleFavorite(name) {
  if (favorites.has(name)) favorites.delete(name);
  else favorites.add(name);
  localStorage.setItem(FAV_KEY, JSON.stringify([...favorites]));
}
