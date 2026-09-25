// GPS position, the blue "you are here" dot and the compass beam.
import { map } from './map.js';
import { state } from './state.js';
import { haversine } from './utils.js';
import { showNearby } from './nearby.js';
import { showToast, closeToast } from './toast.js';

const L = window.L;
const GEO_OPTIONS = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
const NEARBY_REFRESH_METRES = 50;

let watchId = null;
let denied = false;
let userMarker = null;
let lastNearbyAt = null;

const USER_ICON = L.divIcon({
  html: `<div class="user-dot">
    <div class="user-dot-beam" id="userBeam"></div>
    <div class="user-dot-ring"></div>
    <div class="user-dot-ring"></div>
    <div class="user-dot-core"></div>
  </div>`,
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// Glide the dot between GPS fixes instead of jumping.
function glideTo(marker, lat, lng) {
  cancelAnimationFrame(marker.glideFrame);
  const from = marker.getLatLng();
  if (haversine(from.lat, from.lng, lat, lng) > 150) { // GPS correction: snap
    marker.setLatLng([lat, lng]);
    return;
  }
  const duration = 1200; // roughly the GPS update interval
  const start = performance.now();
  const frame = now => {
    const p = Math.min((now - start) / duration, 1);
    const e = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p; // ease in-out
    marker.setLatLng([from.lat + (lat - from.lat) * e, from.lng + (lng - from.lng) * e]);
    if (p < 1) marker.glideFrame = requestAnimationFrame(frame);
  };
  marker.glideFrame = requestAnimationFrame(frame);
}

function onPosition(pos) {
  const { latitude: lat, longitude: lng } = pos.coords;
  const firstFix = !state.user;
  state.user = { lat, lng };

  if (userMarker) glideTo(userMarker, lat, lng);
  else userMarker = L.marker([lat, lng], { icon: USER_ICON, zIndexOffset: 1000 }).addTo(map);

  if (firstFix) map.flyTo([lat, lng], 14, { duration: 1.2 });
  // Only refresh the nearby strip after real movement
  if (firstFix || haversine(lat, lng, lastNearbyAt.lat, lastNearbyAt.lng) > NEARBY_REFRESH_METRES) {
    lastNearbyAt = { lat, lng };
    showNearby();
  }
}

function showDeniedHelp() {
  const ua = navigator.userAgent;
  let body;
  if (/iphone|ipad|ipod/i.test(ua)) {
    body = 'Gå til <b>Innstillinger → Personvern → Lokalisering → Safari</b> og velg <b>«Mens appen brukes»</b>. Kom tilbake hit etterpå.';
  } else if (/android/i.test(ua)) {
    body = 'Trykk på 🔒 i adressefeltet i nettleseren → <b>Tillatelser → Posisjon → Tillat</b>. Last så inn siden på nytt.';
  } else {
    body = 'Trykk på 🔒 eller ⓘ i adressefeltet → <b>Stedstjenester</b> → sett til <b>Tillat</b>. Last så inn siden på nytt.';
  }
  showToast('Posisjon blokkert', body);
}

export function startLocationWatch() {
  if (!navigator.geolocation || denied) return;
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = navigator.geolocation.watchPosition(onPosition, err => {
    if (err.code === err.PERMISSION_DENIED) {
      denied = true;
      showDeniedHelp();
    }
  }, GEO_OPTIONS);
}

// Runs `onAllowed` unless the browser reports that location is blocked.
function whenNotDenied(onAllowed) {
  if (!navigator.permissions) return onAllowed();
  navigator.permissions.query({ name: 'geolocation' }).then(result => {
    if (result.state === 'denied') {
      denied = true;
      showDeniedHelp();
    } else {
      onAllowed();
    }
  });
}

// "Locate me" button
export function locateMe() {
  if (!navigator.geolocation) {
    showToast('Ikke støttet', 'Nettleseren din støtter ikke stedstjenester.');
    return;
  }
  denied = false; // an explicit tap may retry after a denial
  whenNotDenied(() => {
    startLocationWatch();
    startCompass();
    if (state.user) {
      map.flyTo([state.user.lat, state.user.lng], 15, { duration: 1 });
      showNearby();
    }
  });
}

// "Try again" in the location toast
export function retryLocation() {
  closeToast();
  whenNotDenied(() => {
    startLocationWatch();
    if (state.user) map.flyTo([state.user.lat, state.user.lng], 15, { duration: 1 });
  });
}

let heading = null;

function onOrientation(e) {
  const h = typeof e.webkitCompassHeading === 'number'
    ? e.webkitCompassHeading
    : e.alpha != null ? (360 - e.alpha) % 360 : null;
  if (h === null || (heading !== null && Math.abs(h - heading) < 1.5)) return;
  heading = h;
  const beam = document.getElementById('userBeam');
  if (beam) {
    beam.classList.add('active');
    beam.style.transform = `rotate(${h}deg)`;
  }
}

// iOS requires a user gesture to grant compass access.
const needsCompassPermission = typeof DeviceOrientationEvent !== 'undefined'
  && typeof DeviceOrientationEvent.requestPermission === 'function';

async function startCompass() {
  if (needsCompassPermission) {
    try {
      if (await DeviceOrientationEvent.requestPermission() !== 'granted') return;
    } catch {
      return;
    }
  }
  window.addEventListener('deviceorientation', onOrientation, true);
}

if (!needsCompassPermission) window.addEventListener('deviceorientation', onOrientation, true);
