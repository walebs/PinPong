// Vipps donations: QR code on desktop, and an occasional gentle reminder.
import { sheet } from './BottomSheet.js';
import { $ } from './utils.js';

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// On phones the Vipps link opens the app; on desktop show a QR code instead.
export function onVippsLink(e) {
  if (isTouchDevice) return;
  e.preventDefault();
  $('vippsModalBg').classList.add('visible');
}

export const closeVippsModal = () => $('vippsModalBg').classList.remove('visible');
export const isVippsModalOpen = () => $('vippsModalBg').classList.contains('visible');

export function dismissNudge() {
  $('donateNudge').classList.remove('visible');
  $('donateNudgeBg').classList.remove('visible');
}
export const isNudgeOpen = () => $('donateNudge').classList.contains('visible');

// The reminder is for returning users only. Usage is counted in days (not page
// loads), so reloading or a short first visit never triggers it.
const FIRST_ON_DAY = 4;      // shown on the 4th different day the app is used
const REPEAT_AFTER_DAYS = 10; // then again after 10 more days of use
const DELAY_MS = 60 * 1000;   // and only after a minute in the app
const RETRY_MS = 15 * 1000;   // wait while the user is busy with a card or page

const read = key => parseInt(localStorage.getItem(key) || '0', 10);

function countVisitDay() {
  const today = new Date().toDateString();
  let days = read('pp_visit_days');
  if (localStorage.getItem('pp_last_visit') !== today) {
    days += 1;
    localStorage.setItem('pp_visit_days', days);
    localStorage.setItem('pp_last_visit', today);
  }
  return days;
}

function showWhenIdle(days) {
  if (sheet.isOpen || document.querySelector('.profile-page.open')) {
    setTimeout(() => showWhenIdle(days), RETRY_MS);
    return;
  }
  localStorage.setItem('pp_donate_shown_day', days);
  $('donateNudge').classList.add('visible');
  $('donateNudgeBg').classList.add('visible');
}

export function maybeShowNudge() {
  try {
    const days = countVisitDay();
    const shownOn = read('pp_donate_shown_day');
    const due = shownOn === 0 ? days >= FIRST_ON_DAY : days - shownOn >= REPEAT_AFTER_DAYS;
    if (due) setTimeout(() => showWhenIdle(days), DELAY_MS);
  } catch { /* storage unavailable */ }
}
