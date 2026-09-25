import { map } from './map.js';
import { state, favorites, passesFilters } from './state.js';

const L = window.L;
const COLORS = { outdoor: '#FF9500', bar: '#8B5CF6' };
const colorFor = t => (t.type === 'outdoor' ? COLORS.outdoor : COLORS.bar);

const PADDLE_SVG = size => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><ellipse cx="10" cy="10" rx="8" ry="8" fill="white" opacity="0.92"/><rect x="15" y="14" width="3" height="7" rx="1.5" fill="white" opacity="0.92" transform="rotate(-40 15 14)"/></svg>`;
const HOUSE_SVG = size => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.92" xmlns="http://www.w3.org/2000/svg"><polyline points="3,14 12,4 21,14"/><line x1="6" y1="11" x2="6" y2="20"/><line x1="18" y1="11" x2="18" y2="20"/><line x1="6" y1="20" x2="18" y2="20"/></svg>`;
const CHECK_SVG = size => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const HEART_SVG = size => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

function makeIcon(t, highlighted = false) {
  const color = colorFor(t);
  const size = highlighted ? 36 : 28;
  const isLight = document.body.classList.contains('light');
  const border = isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.15)';
  const shadow = isLight ? `0 3px 10px ${color}88, 0 1px 3px rgba(0,0,0,0.2)` : `0 3px 12px ${color}55`;
  const glow = highlighted ? `filter:drop-shadow(0 0 8px ${color}99);` : '';
  const opacity = t.verifisert === 'nei' ? 0.35 : 1;

  const icon = t.type === 'outdoor' ? PADDLE_SVG(Math.round(size * 0.42)) : HOUSE_SVG(Math.round(size * 0.46));
  const pulse = highlighted
    ? `<div style="position:absolute;top:50%;left:50%;width:${size}px;height:${size}px;margin:-${size / 2}px 0 0 -${size / 2}px;border-radius:50%;background:${color};opacity:0.35;animation:pulse 1.3s ease-out infinite;pointer-events:none;"></div>`
    : '';

  // Small badges in the corners: verified (top right) and favourite (bottom left)
  const badgeSize = Math.max(12, Math.round(size * 0.48));
  const offset = -Math.round(badgeSize * 0.45);
  const glyph = Math.round(badgeSize * 0.52);
  const verified = t.verifisert === 'ja'
    ? `<div style="position:absolute;top:${offset}px;right:${offset}px;width:${badgeSize}px;height:${badgeSize}px;background:#34C759;border:2.5px solid #0c0c0f;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.5);">${CHECK_SVG(glyph)}</div>`
    : '';
  const favorite = favorites.has(t.navn)
    ? `<div style="position:absolute;bottom:${offset}px;left:${offset}px;width:${badgeSize}px;height:${badgeSize}px;background:#ff3b30;border:2px solid #0c0c0f;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(255,59,48,0.5);">${HEART_SVG(glyph)}</div>`
    : '';

  const html = `<div style="position:relative;display:flex;flex-direction:column;align-items:center;${glow}opacity:${opacity}">${pulse}<div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid ${border};box-shadow:${shadow};display:flex;align-items:center;justify-content:center;">${icon}${verified}${favorite}</div><div style="width:2px;height:6px;background:${color};opacity:0.8;margin-top:-1px;border-radius:0 0 2px 2px;"></div></div>`;
  return L.divIcon({ html, className: '', iconSize: [size, size + 7], iconAnchor: [size / 2, size + 7] });
}

const CLUSTER_CHECK = '<div style="position:absolute;top:-5px;right:-5px;width:14px;height:14px;background:#34C759;border:2px solid #0c0c0f;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.5);"><svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>';

function makeClusterGroup(color) {
  const group = L.markerClusterGroup({
    iconCreateFunction: cluster => {
      const children = cluster.getAllChildMarkers();
      const allVerified = children.length > 0
        && children.every(m => state.tables[m.tableIdx]?.verifisert === 'ja');
      return L.divIcon({
        html: `<div class="cluster-icon" style="background:${color};box-shadow:0 3px 14px ${color}80">${cluster.getChildCount()}${allVerified ? CLUSTER_CHECK : ''}</div>`,
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
    },
    maxClusterRadius: 42,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: false,
    disableClusteringAtZoom: 15,
    animate: true,
    spiderfyOnMaxZoom: false,
    removeOutsideVisibleBounds: false,
  });

  group.on('clusterclick', e => {
    const bounds = e.layer.getBounds().pad(0.3);
    const targetZoom = Math.min(16, map.getBoundsZoom(bounds));
    if (map.getZoom() >= targetZoom) {
      map.flyTo(bounds.getCenter(), map.getZoom(), { duration: 0.28, easeLinearity: 0.6 });
    } else {
      map.flyTo(bounds.getCenter(), targetZoom, { duration: 0.38, easeLinearity: 0.55 });
    }
  });
  return group;
}

let groups = [];
let markerByIdx = new Map();
let highlightedIdx = null;
let clickHandler = () => {};

export const onMarkerClick = fn => { clickHandler = fn; };
export const isOnMap = idx => markerByIdx.has(idx);

export function renderMarkers() {
  groups.forEach(g => map.removeLayer(g));
  const outdoor = makeClusterGroup(COLORS.outdoor);
  const indoor = makeClusterGroup(COLORS.bar);
  groups = [outdoor, indoor];
  markerByIdx = new Map();
  highlightedIdx = null;

  state.tables.forEach((t, i) => {
    if (!passesFilters(t)) return;
    const selected = i === state.selectedIdx;
    const marker = L.marker([t.lat, t.lng], { icon: makeIcon(t, selected) });
    marker.tableIdx = i;
    marker.on('click', e => {
      L.DomEvent.stopPropagation(e);
      clickHandler(i);
    });
    markerByIdx.set(i, marker);
    if (selected) highlightedIdx = i;
    (t.type === 'outdoor' ? outdoor : indoor).addLayer(marker);
  });

  groups.forEach(g => map.addLayer(g));
}

// Moves the highlight to `idx` (or clears it). Only the two affected markers are redrawn.
export function highlightMarker(idx) {
  if (idx === highlightedIdx) return;
  redrawMarker(highlightedIdx, false);
  redrawMarker(idx, true);
  highlightedIdx = idx;
}

export function redrawMarker(idx, highlighted = idx === highlightedIdx) {
  const marker = markerByIdx.get(idx);
  if (marker) marker.setIcon(makeIcon(state.tables[idx], highlighted));
}

export function redrawAllMarkers() {
  markerByIdx.forEach((marker, idx) => marker.setIcon(makeIcon(state.tables[idx], idx === state.selectedIdx)));
  highlightedIdx = state.selectedIdx;
}

// Let clusters split and merge continuously during a pinch, not only when it ends.
let lastClusterZoom = map.getZoom();
let clusterFrame = null;
map.on('zoom', () => {
  const z = Math.round(map.getZoom());
  if (z === lastClusterZoom || !groups.length) return;
  lastClusterZoom = z;
  cancelAnimationFrame(clusterFrame);
  clusterFrame = requestAnimationFrame(() => requestAnimationFrame(() => {
    groups.forEach(g => { try { g._zoomEnd(); } catch { /* group not on map */ } });
  }));
});
