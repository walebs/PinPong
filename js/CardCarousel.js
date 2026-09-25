// Horizontal navigation between table cards.
//
// Swiping right/left moves to the nearest visible table east/west of the
// current one. While the finger is down, a preview of the next card is
// rendered off-screen and follows the drag, so there is never an empty frame.
import { state, favorites, passesFilters } from './state.js';
import { t } from './i18n.js';
import { haversine } from './utils.js';
import { typeHtml, typeColor, statsHtml, notesHtml } from './cardContent.js';

const LOCK_PX = 7;          // movement before we decide horizontal vs vertical
const COMMIT_FRACTION = 0.28; // share of the card width needed to change card
const EDGE_RESISTANCE = 0.18; // rubber-band factor when there is no next card
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

export class CardCarousel {
  constructor(sheet) {
    this.sheet = sheet;
    this.root = sheet.el;
    this.list = [];          // visible table indices, nearest first (for the "3 / 40" label)
    this.pos = 0;
    this.neighbourCache = new Map();
    this.animating = false;  // a card transition is running
    this.isSwiping = false;  // a horizontal drag is in progress (read by the sheet's drag-to-close)
    this.preview = null;     // off-screen card shown during a drag
    this.previewDir = 0;

    this.navLabel = document.getElementById('sheetNavLabel');
    this.prevBtn = document.getElementById('sheetNavPrev');
    this.nextBtn = document.getElementById('sheetNavNext');

    this.bindTouch();
  }

  get card() {
    return document.getElementById('sheetCard');
  }

  rebuild(fromIdx) {
    const ref = state.user || state.tables[fromIdx];
    this.list = state.tables
      .map((table, i) => ({ i, table, d: haversine(ref.lat, ref.lng, table.lat, table.lng) }))
      .filter(x => passesFilters(x.table))
      .sort((a, b) => a.d - b.d)
      .map(x => x.i);
    this.pos = this.list.indexOf(fromIdx);
    this.neighbourCache.clear();
  }

  // Nearest visible table east (dir > 0) or west (dir < 0) of `fromIdx`, or -1.
  neighbour(fromIdx, dir) {
    const key = `${fromIdx}:${dir}`;
    if (!this.neighbourCache.has(key)) this.neighbourCache.set(key, this.findNeighbour(fromIdx, dir));
    return this.neighbourCache.get(key);
  }

  findNeighbour(fromIdx, dir) {
    const from = state.tables[fromIdx];
    let best = -1, bestDist = Infinity;
    for (const i of this.list) {
      if (i === fromIdx) continue;
      const table = state.tables[i];
      if (dir > 0 ? table.lng <= from.lng : table.lng >= from.lng) continue;
      const d = haversine(from.lat, from.lng, table.lat, table.lng);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  navText(idx) {
    return `${this.list.indexOf(idx) + 1} / ${this.list.length} ${t('nav.bord')}`;
  }

  updateNav() {
    const idx = state.selectedIdx;
    this.navLabel.textContent = `${this.pos + 1} / ${this.list.length} ${t('nav.bord')}`;
    this.prevBtn.disabled = idx === null || this.neighbour(idx, -1) === -1;
    this.nextBtn.disabled = idx === null || this.neighbour(idx, 1) === -1;
  }

  reset() {
    this.animating = false;
    this.isSwiping = false;
  }

  // Arrow buttons
  step(dir) {
    if (state.selectedIdx === null || !this.list.length || this.animating) return;
    const next = this.neighbour(state.selectedIdx, dir);
    if (next === -1) return;
    this.pos = this.list.indexOf(next);
    this.slideTo(next, dir);
  }

  // Animated card change used by the arrow buttons: a snapshot of the current
  // card slides out while the real card, already showing the next table, slides in.
  slideTo(nextIdx, dir) {
    if (this.animating) return;
    this.animating = true;

    const slide = () => {
      const card = this.card;
      const outgoing = card.cloneNode(true);
      outgoing.removeAttribute('id');
      outgoing.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      outgoing.style.cssText = `position:absolute;top:0;left:0;right:0;height:${card.offsetHeight}px;pointer-events:none;z-index:5;will-change:transform;`;
      card.parentNode.insertBefore(outgoing, card);

      card.style.willChange = 'transform';
      card.style.transition = 'none';
      card.style.transform = `translateX(${dir > 0 ? '100%' : '-100%'})`;
      this.sheet.open(nextIdx, { fromCarousel: true });
      void card.offsetWidth; // commit the start position before animating

      const transition = `transform 0.38s ${EASE}`;
      outgoing.style.transition = transition;
      outgoing.style.transform = `translateX(${dir > 0 ? '-100%' : '100%'})`;
      card.style.transition = transition;
      card.style.transform = 'translateX(0)';

      setTimeout(() => {
        outgoing.remove();
        card.style.transition = '';
        card.style.transform = '';
        card.style.willChange = '';
        this.animating = false;
      }, 400);
    };

    // Give the next photo a moment to load so it doesn't pop in mid-slide
    const url = state.tables[nextIdx].bilde_url;
    if (!url) return slide();
    let started = false;
    const start = () => { if (!started) { started = true; slide(); } };
    const img = new Image();
    img.onload = start;
    img.onerror = start;
    img.src = url;
    setTimeout(start, 80);
  }

  buildPreview(nextIdx, dir) {
    this.clearPreview();
    const card = this.card;
    const table = state.tables[nextIdx];
    const width = this.root.offsetWidth;

    const el = card.cloneNode(true);
    el.id = '';
    el.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    el.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;'
      + 'display:flex;flex-direction:column;min-height:0;'
      + 'pointer-events:none;z-index:3;will-change:transform;overflow:hidden;'
      + `transition:none;transform:translateX(${dir > 0 ? width : -width}px);`;

    const photo = el.querySelector('.sheet-photo');
    photo.src = table.bilde_url || '';
    photo.className = table.bilde_url ? 'sheet-photo visible' : 'sheet-photo';

    const type = el.querySelector('.sheet-type');
    type.innerHTML = typeHtml(table);
    type.style.color = typeColor(table);
    el.querySelector('.sheet-name').textContent = table.navn || 'Ukjent bord';
    el.querySelector('.sheet-stats-col').innerHTML = statsHtml(table);
    el.querySelector('.sheet-notes-col').innerHTML = notesHtml(table);

    const faved = favorites.has(table.navn);
    const heart = el.querySelector('.btn-heart-inline');
    heart.classList.toggle('faved', faved);
    heart.querySelector('svg').setAttribute('fill', faved ? '#ff3b30' : 'none');

    const [prev, next] = el.querySelectorAll('.sheet-nav-btn');
    el.querySelector('.sheet-nav-label').textContent = this.navText(nextIdx);
    prev.disabled = this.neighbour(nextIdx, -1) === -1;
    next.disabled = this.neighbour(nextIdx, 1) === -1;

    card.parentNode.insertBefore(el, card.nextSibling);
    this.preview = el;
    this.previewDir = dir;
  }

  clearPreview() {
    this.preview?.remove();
    this.preview = null;
    this.previewDir = 0;
  }

  bindTouch() {
    let startX = 0, startY = 0, dx = 0, axis = null, active = false;

    this.root.addEventListener('touchstart', e => {
      if (!this.root.classList.contains('open') || state.selectedIdx === null) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dx = 0; axis = null; active = true;
      this.clearPreview();
    }, { passive: true });

    this.root.addEventListener('touchmove', e => {
      if (!active) return;
      const moveX = e.touches[0].clientX - startX;
      const moveY = e.touches[0].clientY - startY;

      if (!axis) {
        if (Math.abs(moveX) < LOCK_PX && Math.abs(moveY) < LOCK_PX) return;
        axis = Math.abs(moveX) >= Math.abs(moveY) * 1.1 ? 'h' : 'v';
        if (axis === 'h') {
          const dir = moveX < 0 ? 1 : -1;
          const next = this.neighbour(state.selectedIdx, dir);
          if (next !== -1) this.buildPreview(next, dir);
        }
      }
      if (axis !== 'h') return;

      this.isSwiping = true;
      const card = this.card;
      if (this.animating) return;

      const dir = moveX < 0 ? 1 : -1;
      const next = this.neighbour(state.selectedIdx, dir);
      const atEdge = next === -1;
      dx = atEdge ? moveX * EDGE_RESISTANCE : moveX;

      card.style.transition = 'none';
      card.style.transform = `translateX(${dx}px)`;

      if (atEdge) {
        this.clearPreview();
      } else {
        if (this.preview && this.previewDir !== dir) this.buildPreview(next, dir); // direction reversed
        if (this.preview) {
          const width = this.root.offsetWidth;
          this.preview.style.transform = `translateX(${(dir > 0 ? width : -width) + dx}px)`;
        }
      }
    }, { passive: true });

    this.root.addEventListener('touchcancel', () => {
      if (!active) return;
      active = false; axis = null; dx = 0;
      this.isSwiping = false;
      this.clearPreview();
      this.card.style.transition = '';
      this.card.style.transform = '';
    });

    this.root.addEventListener('touchend', () => {
      if (!active) return;
      active = false;
      if (axis !== 'h') { this.isSwiping = false; dx = 0; return; }

      const card = this.card;
      const width = this.root.offsetWidth;
      const dir = dx < 0 ? 1 : -1;
      const next = this.neighbour(state.selectedIdx, dir);
      const commit = Math.abs(dx) >= width * COMMIT_FRACTION && !this.animating && next !== -1;

      if (commit) this.commitSwipe(card, next, dir, width);
      else this.cancelSwipe(card);
      dx = 0;
    });
  }

  commitSwipe(card, next, dir, width) {
    this.animating = true;
    this.isSwiping = false;
    this.pos = this.list.indexOf(next);
    const outX = `translateX(${dir < 0 ? width : -width}px)`;

    if (this.preview) {
      // Both cards finish the slide together, then the real card takes over
      // underneath the identical preview.
      const transition = `transform 0.26s ${EASE}`;
      card.style.transition = transition;
      card.style.transform = outX;
      this.preview.style.transition = transition;
      this.preview.style.transform = 'translateX(0)';
      setTimeout(() => {
        this.animating = false;
        this.sheet.open(next, { fromCarousel: true });
        card.style.transition = 'none';
        card.style.transform = '';
        this.clearPreview();
      }, 270);
      return;
    }

    // No preview (direction changed at the last moment): slide out, then in.
    card.style.transition = 'transform 0.16s ease-in';
    card.style.transform = outX;
    this.sheet.open(next, { fromCarousel: true });
    setTimeout(() => {
      card.style.transition = 'none';
      card.style.transform = `translateX(${dir < 0 ? -width : width}px)`;
      void card.offsetWidth;
      card.style.transition = `transform 0.3s ${EASE}`;
      card.style.transform = '';
      setTimeout(() => {
        card.style.transition = '';
        this.animating = false;
      }, 320);
    }, 160);
  }

  cancelSwipe(card) {
    const spring = `transform 0.35s ${EASE}`;
    if (this.preview) {
      const preview = this.preview;
      const width = this.root.offsetWidth;
      preview.style.transition = spring;
      preview.style.transform = `translateX(${this.previewDir > 0 ? width : -width}px)`;
      this.preview = null;
      this.previewDir = 0;
      setTimeout(() => preview.remove(), 360);
    }
    card.style.transition = spring;
    card.style.transform = '';
    setTimeout(() => { card.style.transition = ''; }, 360);
    this.isSwiping = false;
  }
}
