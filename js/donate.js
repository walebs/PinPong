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
  try { localStorage.setItem('pp_donate_shown', localStorage.getItem('pp_sessions') || '0'); } catch { /* ignore */ }
  $('donateNudge').classList.remove('visible');
  $('donateNudgeBg').classList.remove('visible');
}
export const isNudgeOpen = () => $('donateNudge').classList.contains('visible');

// First shown on the 5th visit, then every 15 visits.
export function maybeShowNudge() {
  try {
    const sessions = parseInt(localStorage.getItem('pp_sessions') || '0', 10) + 1;
    localStorage.setItem('pp_sessions', sessions);
    const lastShown = parseInt(localStorage.getItem('pp_donate_shown') || '0', 10);
    const due = lastShown === 0 ? sessions >= 5 : sessions - lastShown >= 15;
    if (!due) return;
    setTimeout(() => {
      // Don't interrupt; try again next visit
      if (sheet.isOpen || document.querySelector('.profile-page.open')) return;
      $('donateNudge').classList.add('visible');
      $('donateNudgeBg').classList.add('visible');
    }, 10000);
  } catch { /* storage unavailable */ }
}
