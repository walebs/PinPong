import { SEED_TABLES } from './places.js';

const TABLES_URL = '/api/tables';

// RFC 4180: quoted cells may contain commas, "" escapes and line breaks.
function parseCSVRows(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cell.trim()); cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim()); rows.push(row);
      row = []; cell = '';
    } else {
      cell += c;
    }
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows.filter(r => r.some(v => v !== ''));
}

export function parseCSV(text) {
  const [header, ...rows] = parseCSVRows(text.trim());
  if (!header) return [];
  const keys = header.map(h => h.toLowerCase());
  return rows.map(values => Object.fromEntries(keys.map((k, i) => [k, values[i] || ''])));
}

// Accepts an Imgur page link, a full URL, or a bare filename in images/bord/.
function resolveImage(url) {
  if (!url) return '';
  url = url.trim();
  if (url.includes('imgur.com')) {
    const id = url.match(/([a-zA-Z0-9]+)(?:\?.*)?$/);
    if (id) return `https://i.imgur.com/${id[1]}.jpg`;
  }
  if (url.startsWith('http')) return url;
  const filename = url.split('/').pop().toLowerCase().replace(/\s+/g, '-').normalize('NFC');
  return `images/bord/${encodeURIComponent(filename)}`;
}

const stripAccents = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function findSeed(name, lat, lng) {
  const lower = name.toLowerCase();
  return SEED_TABLES.find(t => t.navn.toLowerCase().normalize('NFC') === lower)
    || SEED_TABLES.find(t => stripAccents(t.navn) === stripAccents(name))
    || (lat && lng && SEED_TABLES.find(t => Math.abs(t.lat - lat) + Math.abs(t.lng - lng) < 0.001));
}

function rowToTable(row) {
  const navn = (row.navn || '').trim().normalize('NFC');
  if (!navn) return null;
  const lat = parseFloat((row.lat || '').replace(',', '.'));
  const lng = parseFloat((row.lng || '').replace(',', '.'));
  const image = row.images || row.url || row.bilde_url || row['bilde url'] || row.bilde
    || row.image || row.img || row.foto || row.photo || '';

  const details = {
    verifisert: row.verifisert ? row.verifisert.toLowerCase() : null,
    label: row.label || null,
    antall: row.antall || null,
    materiale: row.materiale || null,
    tilstand: row.tilstand || null,
    under_tak: row.under_tak || null,
    belysning: row.belysning || null,
    vibe: row.vibe ? parseFloat(row.vibe) : null,
    notater: row.notater || '',
    bilde_url: resolveImage(image),
  };

  const seed = findSeed(navn, lat, lng);
  if (seed) return { ...seed, navn, ...details };
  if (!lat || !lng) return null;

  const rawType = (row.type || 'utendørs').toLowerCase();
  const type = rawType === 'utendørs' ? 'outdoor' : rawType === 'innendørs' ? 'bar' : rawType;
  return { navn, lat, lng, type, ...details };
}

async function fetchWithRetry(url, attempts) {
  let delay = 1200;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (res.ok) return res;
    } catch {
      // timeout or network error: retry
    } finally {
      clearTimeout(timer);
    }
    if (i < attempts - 1) await new Promise(r => setTimeout(r, delay));
    delay = Math.min(delay * 2, 8000);
  }
  return null;
}

// Returns the tables from the sheet, or null if it couldn't be loaded.
export async function fetchTables() {
  const res = await fetchWithRetry(TABLES_URL, 3);
  if (!res) return null;
  const tables = parseCSV(await res.text()).map(rowToTable).filter(Boolean);
  return tables.length ? tables : null;
}
