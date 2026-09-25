// The table card that slides up from the bottom of the screen.
import { map } from './map.js';
import { state, favorites, toggleFavorite as toggleSavedFavorite } from './state.js';
import { highlightMarker, redrawMarker } from './markers.js';
import { onLangChange } from './i18n.js';
import { preloadImage } from './preload.js';
import { $ } from './utils.js';
import { typeHtml, typeColor, statsHtml, notesHtml } from './cardContent.js';
import { CardCarousel } from './CardCarousel.js';

const DISMISS_DISTANCE = 80; // px dragged down to close
const DISMISS_VELOCITY = 0.5; // px/ms

class BottomSheet {
  constructor() {
    this.el = $('bottomSheet');
    this.photo = $('sheetPhoto');
    this.type = $('sheetType');
    this.name = $('sheetName');
    this.stats = $('sheetStats');
    this.notes = $('sheetNote');
    this.heartBtn = $('btnHeart');
    this.heartIcon = $('heartIcon');
    this.mapsOverlay = $('mapsOverlay');
    this.mapsModal = $('mapsModal');
    this.nearby = $('nearbyContainer');
    this.fabStack = document.querySelector('.fab-stack');
    this.returnTo = null; // called after closing with X, e.g. to reopen Favourites
    this.pendingOpen = null;

    // Registered before the carousel so vertical drags are handled first,
    // matching how the two gestures hand over to each other.
    this.bindDragToClose();
    this.carousel = new CardCarousel(this);

    map.on('click', () => this.close());
    onLangChange(() => this.carousel.updateNav());
  }

  get isOpen() {
    return this.el.classList.contains('open');
  }

  open(idx, { fromCarousel = false, returnTo = null } = {}) {
    const table = state.tables[idx];
    if (!fromCarousel) this.carousel.rebuild(idx);
    if (returnTo) this.returnTo = returnTo;
    state.selectedIdx = idx;
    this.closeMapsPicker();
    try {
      history.replaceState(null, '', `${location.pathname}?bord=${encodeURIComponent(table.navn)}`);
    } catch { /* not allowed in some embedded browsers */ }

    if (table.bilde_url) {
      this.photo.src = table.bilde_url;
      this.photo.className = 'sheet-photo visible';
      this.photo.onerror = () => { this.photo.className = 'sheet-photo'; };
    } else {
      this.photo.src = '';
      this.photo.className = 'sheet-photo';
    }
    this.type.innerHTML = typeHtml(table);
    this.type.style.color = typeColor(table);
    this.name.textContent = table.navn || 'Ukjent bord';
    this.stats.innerHTML = statsHtml(table);
    this.notes.innerHTML = notesHtml(table);

    const wasOpen = this.isOpen;
    this.el.classList.add('open');
    this.nearby.classList.add('sheet-open');
    this.fabStack.classList.add('sheet-open');
    highlightMarker(idx);

    if (this.carousel.animating) {
      setTimeout(() => map.panTo([table.lat, table.lng], { animate: true, duration: 0.35 }), 410);
    } else {
      map.panTo([table.lat, table.lng], { animate: true, duration: wasOpen ? 0.2 : 0.35 });
    }
    this.updateHeart();
    this.carousel.updateNav();

    // Warm the photos a swipe would show next
    for (const dir of [-1, 1]) {
      const next = this.carousel.neighbour(idx, dir);
      if (next !== -1) preloadImage(state.tables[next].bilde_url);
    }
  }

  // Fly to a table first; opening mid-flight would cancel the zoom.
  flyToAndOpen(idx) {
    clearTimeout(this.pendingOpen);
    const { lat, lng } = state.tables[idx];
    map.flyTo([lat, lng], 16, { duration: 0.8 });
    this.pendingOpen = setTimeout(() => this.open(idx), 850);
  }

  close() {
    if (state.selectedIdx === null && !this.isOpen) return;
    this.returnTo = null;
    this.carousel.reset();
    this.el.style.transition = '';
    this.el.style.transform = '';
    const card = $('sheetCard');
    card.style.transition = '';
    card.style.transform = '';
    this.hide();
  }

  // Close button: go back to where the card was opened from, if anywhere.
  closeWithButton() {
    const back = this.returnTo;
    this.close();
    if (back) setTimeout(back, 380);
  }

  hide() {
    this.el.classList.remove('open');
    this.nearby.classList.remove('sheet-open');
    this.fabStack.classList.remove('sheet-open');
    this.closeMapsPicker();
    highlightMarker(null);
    state.selectedIdx = null;
    try { history.replaceState(null, '', location.pathname); } catch { /* ignore */ }
  }

  toggleFavorite() {
    const table = state.tables[state.selectedIdx];
    if (!table) return;
    toggleSavedFavorite(table.navn);
    this.updateHeart();
    redrawMarker(state.selectedIdx);
  }

  updateHeart() {
    const table = state.tables[state.selectedIdx];
    if (!table) return;
    const faved = favorites.has(table.navn);
    this.heartBtn.classList.toggle('faved', faved);
    this.heartIcon.setAttribute('fill', faved ? '#ff3b30' : 'none');
    this.heartIcon.setAttribute('stroke', '#ff3b30');
  }

  openMapsPicker() {
    this.mapsOverlay.classList.add('open');
    this.mapsModal.classList.add('open');
  }

  closeMapsPicker() {
    this.mapsOverlay.classList.remove('open');
    this.mapsModal.classList.remove('open');
  }

  directions(app) {
    const table = state.tables[state.selectedIdx];
    if (!table) return;
    const { lat, lng } = table;
    window.open(app === 'apple'
      ? `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=w`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`);
  }

  share() {
    const table = state.tables[state.selectedIdx];
    if (!table) return;
    const url = `${location.origin}${location.pathname}?bord=${encodeURIComponent(table.navn)}`;
    if (navigator.share) {
      navigator.share({ title: table.navn, text: `Sjekk ut dette bordtennisbordet: ${table.navn}`, url }).catch(() => {});
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        const btn = document.querySelector('.btn-share');
        const original = btn.innerHTML;
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(() => { btn.innerHTML = original; }, 1800);
      }).catch(() => window.prompt('Kopier lenken:', url));
    } else {
      window.prompt('Kopier lenken:', url);
    }
  }

  bindDragToClose() {
    let startY = 0, dy = 0, startTime = 0, dragging = false;

    this.el.addEventListener('touchstart', e => {
      if (!this.isOpen) return;
      // Let the card body scroll instead when it isn't at the top
      const body = e.target.closest?.('.sheet-body');
      if (body && body.scrollTop > 0) { dragging = false; return; }
      startY = e.touches[0].clientY;
      startTime = Date.now();
      dy = 0;
      dragging = true;
      this.el.style.transition = 'none';
    }, { passive: true });

    this.el.addEventListener('touchmove', e => {
      if (!dragging || this.carousel.isSwiping) return;
      const move = e.touches[0].clientY - startY;
      if (move <= 0) { this.el.style.transform = 'translate(-50%, 0)'; return; }
      dy = move;
      this.el.style.transform = `translate(-50%, ${dy}px)`;
    }, { passive: true });

    this.el.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      this.el.style.transition = '';
      if (this.carousel.isSwiping) { this.el.style.transform = ''; return; }

      const velocity = dy / Math.max(1, Date.now() - startTime);
      if (dy > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) {
        this.el.style.transition = 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)';
        this.el.style.transform = 'translate(-50%, calc(100% + 40px))';
        setTimeout(() => {
          this.el.style.transition = '';
          this.el.style.transform = '';
          this.returnTo = null;
          this.hide();
        }, 320);
      } else {
        this.el.style.transform = '';
      }
    });
  }
}

export const sheet = new BottomSheet();
