// Full-screen pages that slide in from the right (profile, settings, favourites, ...).
import { state, favorites } from './state.js';
import { sheet } from './BottomSheet.js';
import { t, lang } from './i18n.js';
import { esc, haversine, formatDistance, $ } from './utils.js';

const PAGE_IDS = ['profilePage', 'favPage', 'settingsPage', 'rapportPage', 'feilPage', 'omPage', 'personvernPage'];

export function openPage(id) {
  const page = $(id);
  page.style.transition = '';
  page.style.transform = '';
  page.classList.add('open');
}

export function closePage(id) {
  const page = $(id);
  page.style.transition = '';
  page.style.transform = '';
  page.classList.remove('open');
}

// Topmost open page, checked in stacking order (forms sit above the profile page).
export function topOpenPage() {
  return ['feilPage', 'rapportPage', 'settingsPage', 'favPage', 'omPage', 'personvernPage', 'profilePage']
    .find(id => $(id).classList.contains('open'));
}

export function openProfile() {
  sheet.closeMapsPicker();
  $('vippsModalBg').classList.remove('visible');
  openPage('profilePage');
}

export function openSettings() {
  const light = document.body.classList.contains('light');
  $('seg-light').classList.toggle('active', light);
  $('seg-dark').classList.toggle('active', !light);
  $('seg-no').classList.toggle('active', lang === 'no');
  $('seg-en').classList.toggle('active', lang === 'en');
  openPage('settingsPage');
}

export function openFavorites() {
  const list = $('favList');
  const items = [...favorites]
    .map(name => state.tables.findIndex(t => t.navn === name))
    .filter(i => i !== -1)
    .map(i => {
      const table = state.tables[i];
      const d = state.user ? haversine(state.user.lat, state.user.lng, table.lat, table.lng) : null;
      return { i, table, d };
    })
    .sort((a, b) => (a.d !== null ? a.d - b.d : a.table.navn.localeCompare(b.table.navn)));

  if (!items.length) {
    list.innerHTML = '<div class="fav-empty"><div class="fav-empty-icon">🏓</div>Du har ingen favoritter ennå.<br>Trykk ❤ på et bord for å lagre det her.</div>';
  } else {
    list.innerHTML = items.map(({ i, table, d }) => {
      const outdoor = table.type === 'outdoor';
      const image = table.bilde_url
        ? `<img src="${esc(table.bilde_url)}" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover"/>`
        : '🏓';
      return `<div class="fav-card" data-action="open-favorite" data-idx="${i}">
        <div class="fav-card-img">${image}</div>
        <div class="fav-card-info">
          <div class="fav-card-type" style="color:${outdoor ? 'var(--orange)' : 'var(--purple)'}">${outdoor ? t('type.outdoor') : t('type.bar')}</div>
          <div class="fav-card-name">${esc(table.navn)}</div>
          <div class="fav-card-meta">
            ${d !== null ? `<span class="fav-card-dist">${formatDistance(d)}</span>` : ''}
            ${table.verifisert === 'ja' ? '<span style="color:var(--green)">✓ Verifisert</span>' : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  }
  openPage('favPage');
}

// Opens a table from Favourites; its close button returns here.
export function openFavorite(idx) {
  closePage('favPage');
  closePage('profilePage');
  setTimeout(() => sheet.open(idx, { returnTo: openFavorites }), 480);
}

// Drag a page to the right to close it, like iOS navigation.
function addSwipeToClose(page) {
  const EASE = 'transform 0.38s cubic-bezier(0.22,1,0.36,1)';
  let startX = 0, startY = 0, lastX = 0, lastTime = 0, x = 0;
  let horizontal = null, active = false;

  page.addEventListener('touchstart', e => {
    if (!page.classList.contains('open')) return;
    startX = lastX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    lastTime = Date.now();
    x = 0; horizontal = null; active = true;
    page.style.transition = 'none';
  }, { passive: true });

  page.addEventListener('touchmove', e => {
    if (!active) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (horizontal === null) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) horizontal = Math.abs(dx) > Math.abs(dy);
      return;
    }
    if (!horizontal) return;
    x = Math.max(0, dx);
    lastX = e.touches[0].clientX;
    lastTime = Date.now();
    page.style.transform = `translateX(${x}px)`;
    e.preventDefault();
  }, { passive: false });

  const onEnd = e => {
    if (!active) return;
    active = false;
    if (!horizontal) { page.style.transition = ''; return; }

    const velocity = (e.changedTouches[0].clientX - lastX) / Math.max(1, Date.now() - lastTime);
    if (x > window.innerWidth * 0.35 || velocity > 0.55) {
      page.style.transition = EASE;
      page.style.transform = 'translateX(100%)';
      setTimeout(() => closePage(page.id), 380);
    } else {
      page.style.transition = EASE;
      page.style.transform = 'translateX(0)';
      const onSnapBack = ev => {
        if (ev.target !== page) return;
        page.style.transition = '';
        page.removeEventListener('transitionend', onSnapBack);
      };
      page.addEventListener('transitionend', onSnapBack);
    }
  };
  page.addEventListener('touchend', onEnd, { passive: true });
  page.addEventListener('touchcancel', onEnd, { passive: true });
}

PAGE_IDS.forEach(id => addSwipeToClose($(id)));
