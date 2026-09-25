// Light / dark mode. Light is the default.
import { setMapTheme } from './map.js';
import { redrawAllMarkers } from './markers.js';
import { $ } from './utils.js';

const SUN_ICON = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
const MOON_ICON = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';

export const isLight = () => document.body.classList.contains('light');

// The button shows the mode you'd switch to.
function applyTheme(light) {
  document.body.classList.toggle('light', light);
  $('themeIcon').innerHTML = light ? MOON_ICON : SUN_ICON;
  const bg = light ? '#f2f2f7' : '#0c0c0f';
  $('metaThemeColor').content = bg;
  document.documentElement.style.background = bg;
  redrawAllMarkers(); // marker borders depend on the theme
}

export function setTheme(light) {
  localStorage.setItem('pinpong-theme', light ? 'light' : 'dark');
  applyTheme(light);
  setMapTheme(light);
  $('seg-light').classList.toggle('active', light);
  $('seg-dark').classList.toggle('active', !light);
}

export function toggleTheme() {
  setTheme(!isLight());
  const btn = $('themeBtn');
  btn.classList.remove('spin');
  void btn.offsetWidth; // restart the animation
  btn.classList.add('spin');
}

export function initTheme() {
  applyTheme(localStorage.getItem('pinpong-theme') !== 'dark');
}
