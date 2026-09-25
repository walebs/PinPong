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

// Smooth trackpad zoom (two-finger scroll and pinch).
//
// A trackpad sends ~60 tiny wheel events per second. Leaflet animates each
// one and ignores new events while an animation runs, so most were dropped
// and the map barely zoomed. Here the deltas are summed and applied once per
// frame without animation. Mouse wheels (few large steps) still use Leaflet.
const SCROLL_ZOOM_PER_PX = 1 / 250; // two-finger scroll
const PINCH_ZOOM_PER_PX = 1 / 50;   // pinch arrives as ctrl + wheel with smaller deltas

// Mouse wheels report wheelDeltaY in steps of 120; trackpads report exactly -3 × deltaY.
function isTrackpad(e) {
  if (e.wheelDeltaY) return e.wheelDeltaY === -3 * e.deltaY;
  return e.deltaMode === WheelEvent.DOM_DELTA_PIXEL;
}

// While the gesture runs, the map is moved the same way Leaflet's own touch
// pinch does it: existing tiles are scaled and new ones load only when the
// gesture ends. Committing a full zoom every frame would swap tile levels
// mid-gesture and flash the background.
const GESTURE_END_MS = 150;

let pendingZoom = 0;
let zoomOrigin = null;
let zoomFrame = null;
let gestureActive = false;
let gestureEndTimer = null;

// Same maths as map.setZoomAround(): keep the point under the cursor fixed.
function centerForZoom(containerPoint, zoom) {
  const half = map.getSize().divideBy(2);
  const offset = containerPoint.subtract(half).multiplyBy(1 - 1 / map.getZoomScale(zoom));
  return map.containerPointToLatLng(half.add(offset));
}

function applyZoom() {
  zoomFrame = null;
  const zoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() + pendingZoom));
  pendingZoom = 0;
  if (zoom === map.getZoom()) return;
  if (!gestureActive) {
    gestureActive = true;
    map._stop();
    map._moveStart(true, false);
  }
  map._move(centerForZoom(zoomOrigin, zoom), zoom, { pinch: true, round: false });
}

function endGesture() {
  if (!gestureActive) return;
  gestureActive = false;
  // A plain zoom event lets the tile layer switch to sharp tiles for the new
  // level; old tiles stay visible until the new ones have loaded.
  map._move(map.getCenter(), map.getZoom());
  map._moveEnd(true);
}

// Capture phase on the document, so this runs before Leaflet's own wheel handler.
document.addEventListener('wheel', e => {
  if (!map.getContainer().contains(e.target)) return;
  if (!e.ctrlKey && !isTrackpad(e)) return;
  e.preventDefault();
  e.stopPropagation();

  const perPx = e.ctrlKey ? PINCH_ZOOM_PER_PX : SCROLL_ZOOM_PER_PX;
  pendingZoom -= Math.max(-50, Math.min(50, e.deltaY)) * perPx;
  zoomOrigin = map.mouseEventToContainerPoint(e); // zoom towards the cursor
  zoomFrame ??= requestAnimationFrame(applyZoom);

  clearTimeout(gestureEndTimer);
  gestureEndTimer = setTimeout(endGesture, GESTURE_END_MS);
}, { capture: true, passive: false });

// iOS Safari ignores user-scalable=no, so block page-level pinch zoom.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, e => e.preventDefault(), { passive: false });
}
