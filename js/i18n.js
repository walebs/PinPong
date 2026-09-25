import { LANG } from './translations.js';

export let lang = localStorage.getItem('pinpong-lang') || 'no';

const listeners = [];
export const onLangChange = fn => listeners.push(fn);

export function t(key) {
  return LANG[lang]?.[key] || LANG.no[key] || key;
}

// Filter cells hold an icon followed by a text node, so only the text is swapped.
const FILTER_LABELS = {
  'pill-outdoor': 'filter.ute',
  'pill-bar': 'filter.inne',
  'pill-roof': 'filter.tak',
  'pill-fav': 'filter.likte',
  'pill-verified': 'filter.besøkt',
  'pill-light': 'filter.lys',
};

export function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });

  document.getElementById('searchInput').placeholder = t('search.placeholder');
  document.querySelector('.search-label').textContent = t('search.label');
  document.getElementById('langSubLabel').textContent = t('lang.sub');
  document.getElementById('seg-no').classList.toggle('active', lang === 'no');
  document.getElementById('seg-en').classList.toggle('active', lang === 'en');

  for (const [id, key] of Object.entries(FILTER_LABELS)) {
    const textNodes = [...document.getElementById(id).childNodes].filter(n => n.nodeType === Node.TEXT_NODE);
    if (textNodes.length) textNodes[textNodes.length - 1].textContent = '\n' + t(key);
  }

  listeners.forEach(fn => fn(lang));
}

export function setLang(next) {
  lang = next;
  localStorage.setItem('pinpong-lang', next);
  applyLang();
}
