import { $ } from './utils.js';

// `body` may contain markup (bold settings paths), so only pass trusted strings.
export function showToast(title, body) {
  $('locToastTitle').textContent = title;
  $('locToastBody').innerHTML = body;
  $('locToast').classList.add('show');
}

export function closeToast() {
  $('locToast').classList.remove('show');
}
