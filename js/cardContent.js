// HTML for the table card. Used both by the open card and by the preview card
// that slides in during a swipe, so the two always render identically.
import { t, lang } from './i18n.js';
import { esc } from './utils.js';

const CONDITION_EN = {
  'god': 'Good', 'meget god': 'Excellent', 'veldig god': 'Excellent',
  'grei': 'Decent', 'ok': 'Decent', 'middels': 'Average',
  'dårlig': 'Poor', 'dårleg': 'Poor', 'dårleg.': 'Poor',
  'ikke funnet': 'Not found', 'ukjent': 'Unknown', 'ny': 'New',
};

export function typeHtml(table) {
  const main = table.type === 'outdoor' ? '🏓 ' + t('type.outdoor') : '🍺 ' + t('type.bar');
  const label = table.label
    ? `<span style="font-size:9px;font-weight:700;color:var(--muted);margin-left:3px;letter-spacing:0.5px;text-transform:uppercase">${esc(table.label)}</span>`
    : '';
  return `<span>${main}</span>${label}`;
}

export const typeColor = table => (table.type === 'outdoor' ? 'var(--orange)' : 'var(--purple)');

export function notesHtml(table) {
  // Notes are written in Norwegian only
  const text = table.notater?.trim();
  if (!text || lang === 'en') return '';
  return `<div class="notes-inline"><span class="notes-tag">${t('notes.label')}</span>${esc(text)}</div>`;
}

const stat = (label, value, cls = '') =>
  `<div class="stat-item"><div class="stat-label">${label}</div><div class="stat-val${cls}">${value}</div></div>`;

const yesNo = value => (/ja/i.test(value) ? t('stats.ja') : /nei/i.test(value) ? t('stats.nei') : esc(value));

function stars(value) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += value >= i ? '★' : value >= i - 0.5 ? '⯨' : '☆';
  return s;
}

function conditionClass(condition) {
  if (/^(god|meget god|veldig god|excellent|good|ny)/i.test(condition)) return ' cond-good';
  if (/^(grei|ok|middels|decent|average)/i.test(condition)) return ' cond-mid';
  if (/^(dårlig|dårleg|poor)/i.test(condition)) return ' cond-bad';
  return '';
}

export function statsHtml(table) {
  let html;
  if (table.verifisert === 'ja') html = stat(t('stats.status'), '✓', ' verified status-icon');
  else if (table.verifisert === 'nei') html = stat(t('stats.status'), '✗', ' not-found status-icon');
  else html = stat(t('stats.status'), '−', ' status-icon');

  if (table.tilstand) {
    const text = lang === 'no' ? table.tilstand : (CONDITION_EN[table.tilstand.toLowerCase()] || table.tilstand);
    html += stat(t('stats.tilstand'), esc(text), conditionClass(table.tilstand));
  }
  if (table.antall) html += stat(t('stats.antall'), esc(table.antall), ' big-num');
  if (table.under_tak) {
    html += stat(t('stats.under_tak'), yesNo(table.under_tak), /ja/i.test(table.under_tak) ? ' verified' : '');
  }
  if (table.belysning) html += stat(t('stats.belysning'), yesNo(table.belysning));
  if (table.vibe !== null && !isNaN(table.vibe)) html += stat(t('stats.vibe'), stars(table.vibe), ' stars');
  return html;
}
