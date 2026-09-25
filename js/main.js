import { map } from './map.js';
import { state } from './state.js';
import { fetchTables } from './data.js';
import { renderMarkers, onMarkerClick } from './markers.js';
import { sheet } from './BottomSheet.js';
import { showNearby } from './nearby.js';
import { startLocationWatch, locateMe, retryLocation } from './location.js';
import { togglePanel, toggleFilter, updateVerifiedCount, updateFilterDots, isPanelOpen, closePanel } from './filters.js';
import { expandSearch, collapseSearch, isSearchOpen, selectTable, selectArea } from './search.js';
import { openPage, closePage, topOpenPage, openProfile, openSettings, openFavorites, openFavorite } from './pages.js';
import { openTipForm, submitTip, pickSegment, openIssueForm, submitIssue, resetSubmitButtons } from './forms.js';
import { initTheme, setTheme, toggleTheme } from './theme.js';
import { applyLang, setLang } from './i18n.js';
import { onVippsLink, closeVippsModal, isVippsModalOpen, dismissNudge, isNudgeOpen, maybeShowNudge } from './donate.js';
import { showToast, closeToast } from './toast.js';
import { preloadNearestImages } from './preload.js';

// Every clickable element declares what it does with data-action="…".
const actions = {
  'toggle-filters': () => togglePanel(),
  'toggle-filter': el => toggleFilter(el.dataset.filter),
  'expand-search': () => expandSearch(),
  'collapse-search': () => collapseSearch(),
  'search-table': el => selectTable(+el.dataset.idx),
  'search-area': el => selectArea(+el.dataset.idx),
  'open-table': el => sheet.flyToAndOpen(+el.dataset.idx),
  'zoom-in': () => map.zoomIn(1),
  'zoom-out': () => map.zoomOut(1),
  'toggle-theme': () => toggleTheme(),
  'set-theme': el => setTheme(el.dataset.theme === 'light'),
  'set-lang': el => setLang(el.dataset.lang),
  'locate': () => locateMe(),
  'retry-location': () => retryLocation(),
  'close-toast': () => closeToast(),

  'close-sheet': () => sheet.closeWithButton(),
  'toggle-favorite': () => sheet.toggleFavorite(),
  'share': () => sheet.share(),
  'sheet-prev': () => sheet.carousel.step(-1),
  'sheet-next': () => sheet.carousel.step(1),
  'open-maps-picker': () => sheet.openMapsPicker(),
  'close-maps-picker': () => sheet.closeMapsPicker(),
  'directions': el => sheet.directions(el.dataset.app),

  'open-profile': () => openProfile(),
  'open-page': el => openPage(el.dataset.page),
  'close-page': el => closePage(el.closest('.profile-page').id),
  'open-settings': () => openSettings(),
  'open-favorites': () => openFavorites(),
  'open-favorite': el => openFavorite(+el.dataset.idx),
  'open-tip-form': () => openTipForm(),
  'open-issue-form': () => openIssueForm(),
  'pick-segment': el => pickSegment(el),
  'pick-photo': (el, e) => {
    // The file input sits inside this element, so its own click bubbles back here
    if (e.target.matches('input[type=file]')) return;
    el.querySelector('input[type=file]').click();
  },
  'submit-tip': () => submitTip(),
  'submit-issue': () => submitIssue(),

  'vipps': (el, e) => {
    if (el.closest('#donateNudge')) dismissNudge();
    onVippsLink(e);
  },
  'close-vipps': (el, e) => {
    // Backdrop closes only when the click lands on the backdrop itself
    if (el.id !== 'vippsModalBg' || e.target === el) closeVippsModal();
  },
  'dismiss-nudge': () => dismissNudge(),
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (el) actions[el.dataset.action]?.(el, e);
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const page = topOpenPage();
  if (isVippsModalOpen()) closeVippsModal();
  else if (isNudgeOpen()) dismissNudge();
  else if (page) closePage(page);
  else if (document.getElementById('mapsModal').classList.contains('open')) sheet.closeMapsPicker();
  else if (isSearchOpen()) collapseSearch();
  else if (isPanelOpen()) closePanel();
  else if (sheet.isOpen) sheet.close();
});

// Data

let lastFetch = 0;

async function loadTables() {
  const tables = await fetchTables();
  if (tables) {
    lastFetch = Date.now();
    state.tables = tables;
    renderMarkers();
    showNearby();
  }
  updateVerifiedCount();
}

// Shared links look like ?bord=Sofienbergparken
function openLinkedTable() {
  const name = new URLSearchParams(location.search).get('bord');
  if (!name) return;
  const idx = state.tables.findIndex(t => t.navn.toLowerCase() === name.toLowerCase());
  if (idx === -1) return;
  map.setView([state.tables[idx].lat, state.tables[idx].lng], 15, { animate: false });
  setTimeout(() => sheet.open(idx), 400);
}

// Returning to the app (tab switch, unlock, back/forward cache)
function onAppVisible() {
  startLocationWatch(); // iOS pauses GPS in the background
  sheet.carousel.reset();
  map.invalidateSize();
  resetSubmitButtons();
  if (Date.now() - lastFetch > 30 * 60 * 1000) loadTables();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') onAppVisible();
});
window.addEventListener('pageshow', e => {
  if (e.persisted) onAppVisible();
});

// Start

onMarkerClick(idx => sheet.open(idx));
applyLang();
initTheme();
renderMarkers();
updateFilterDots();
startLocationWatch();
maybeShowNudge();

loadTables().then(() => {
  openLinkedTable();
  setTimeout(preloadNearestImages, 1500); // after the first map tiles
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    const notifyIfWaiting = () => {
      if (reg.waiting) showToast('Ny versjon tilgjengelig', 'Last inn siden på nytt for å oppdatere appen.');
    };
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) notifyIfWaiting();
      });
    });
    notifyIfWaiting();
  }).catch(() => {});
}
