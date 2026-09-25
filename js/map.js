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

// Trackpads and mouse wheels both send wheel events. Leaflet treats every
// wheel event as zoom, which makes two-finger scrolling on a Mac trackpad
// barely nudge the zoom. Instead:
//   two-finger scroll → pan (like Apple Maps)
//   pinch (arrives as ctrl + wheel) → zoom
//   mouse wheel → left to Leaflet's zoom
// Mouse wheels report wheelDeltaY in steps of 120; trackpads report exactly -3 × deltaY.
function isTrackpad(e) {
  if (e.wheelDeltaY) return e.wheelDeltaY === -3 * e.deltaY;
  return e.deltaMode === WheelEvent.DOM_DELTA_PIXEL;
}

let wheelFrame = null;
let panX = 0, panY = 0;
let pinchPoint = null, pinchZoom = null;

function applyWheel() {
  wheelFrame = null;
  if (pinchZoom !== null) {
    map.setZoomAround(pinchPoint, pinchZoom);
    pinchZoom = null;
  }
  if (panX || panY) {
    map.panBy([panX, panY], { animate: false });
    panX = panY = 0;
  }
}

// Capture phase on the document, so this runs before Leaflet's own wheel handler.
document.addEventListener('wheel', e => {
  if (!map.getContainer().contains(e.target)) return;
  if (!e.ctrlKey && !isTrackpad(e)) return;
  e.preventDefault();
  e.stopPropagation();

  if (e.ctrlKey) {
    const delta = Math.max(-5, Math.min(5, e.deltaY));
    const from = pinchZoom ?? map.getZoom();
    pinchPoint = map.containerPointToLatLng(map.mouseEventToContainerPoint(e));
    pinchZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), from - delta * 0.06));
  } else {
    panX += e.deltaX;
    panY += e.deltaY;
  }
  wheelFrame ??= requestAnimationFrame(applyWheel);
}, { capture: true, passive: false });

// iOS Safari ignores user-scalable=no, so block page-level pinch zoom.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, e => e.preventDefault(), { passive: false });
}
