// Leaflet (+ rotate and markercluster plugins) is loaded as a global from the CDN.
const L = window.L;

export const map = L.map('map', {
  center: [59.926, 10.752],
  zoom: 13,
  zoomControl: false,
  attributionControl: true,
  tap: true,
  preferCanvas: true,
  zoomSnap: 0,
  zoomDelta: 0.25,
  wheelPxPerZoomLevel: 80,
  wheelDebounceTime: 0,
  minZoom: 5,
  maxZoom: 19,
  rotate: true,
  rotateControl: false,
  bearing: 0,
  inertia: true,
  inertiaDeceleration: 500,
  inertiaMaxSpeed: Infinity,
  easeLinearity: 0.2,
});
map.attributionControl.setPrefix(false);

const CARTO_KEY = 'cb1_3lve_1_7d81dabffe145165e306a9a4';
const tileOptions = {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
  maxZoom: 19,
  subdomains: 'abcd',
  updateWhenIdle: false,
  updateWhenZooming: false,
  keepBuffer: 8,
  crossOrigin: true,
  detectRetina: true,
};
const tiles = {
  dark: L.tileLayer(`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`, tileOptions),
  light: L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`, tileOptions),
};

// Add only the layer for the saved theme so the other set is never downloaded.
tiles[localStorage.getItem('pinpong-theme') === 'dark' ? 'dark' : 'light'].addTo(map);

export function setMapTheme(light) {
  const show = light ? tiles.light : tiles.dark;
  const hide = light ? tiles.dark : tiles.light;
  if (!map.hasLayer(show)) map.addLayer(show);
  if (map.hasLayer(hide)) map.removeLayer(hide);
}

// Trackpad pinch arrives as ctrl+wheel with erratic deltas; smooth it out.
// Plain two-finger scrolling is left to Leaflet.
let pinchFrame = null, pinchPoint = null, pinchZoom = null;
map.getContainer().addEventListener('wheel', e => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  e.stopPropagation();
  const delta = Math.max(-5, Math.min(5, e.deltaY));
  pinchPoint = map.containerPointToLatLng(map.mouseEventToContainerPoint(e));
  pinchZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() - delta * 0.06));
  if (!pinchFrame) {
    pinchFrame = requestAnimationFrame(() => {
      map.setZoomAround(pinchPoint, pinchZoom);
      pinchFrame = null;
    });
  }
}, { passive: false });

// iOS Safari ignores user-scalable=no, so block page-level pinch zoom.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, e => e.preventDefault(), { passive: false });
}
