// "Tip us about a table" and "Report an issue" forms. Both post to /api/report,
// which forwards the message by email.
import { openPage, closePage } from './pages.js';
import { showToast } from './toast.js';
import { $ } from './utils.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Vercel rejects request bodies over 4.5 MB; keep the base64 photo well below.
const MAX_PHOTO_CHARS = 4_000_000;

const PHOTO_EMPTY = '<div style="width:52px;height:52px;border-radius:10px;background:var(--s2);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div><div style="flex:1;min-width:0"><div class="rapport-label">Legg til bilde</div><div style="font-size:14px;color:var(--muted);margin-top:2px">Valgfritt</div></div><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
const CHEVRON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
const photoThumb = dataUrl =>
  `<img src="${dataUrl}" style="width:52px;height:52px;border-radius:10px;object-fit:cover;flex-shrink:0">`
  + '<div style="flex:1;min-width:0"><div class="rapport-label">Bilde lagt til</div><div style="font-size:14px;color:var(--text);margin-top:2px">Trykk for å bytte</div></div>'
  + CHEVRON;

// Simple per-device daily limit to discourage spam.
function dailyLimit(key, max) {
  const today = new Date().toDateString();
  const read = () => {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
  };
  return {
    allowed: () => {
      const d = read();
      return d.date !== today || (d.count || 0) < max;
    },
    record: () => {
      const d = read();
      const count = d.date === today ? (d.count || 0) + 1 : 1;
      try { localStorage.setItem(key, JSON.stringify({ date: today, count })); } catch { /* storage full */ }
    },
  };
}

// Downscale to max 1200 px JPEG. Falls back to the original if the browser
// can't decode it (e.g. HEIC).
function compressImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const raw = reader.result;
      const img = new Image();
      img.onerror = () => resolve(raw);
      img.onload = () => {
        try {
          const scale = Math.min(1200 / img.width, 1200 / img.height, 1);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        } catch {
          resolve(raw);
        }
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

async function postReport(payload) {
  const res = await fetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Report failed: ${res.status}`);
}

// Shared form behaviour: photo picker, validation, sending state.
class ReportForm {
  constructor({ pageId, submitId, submitLabel, photoInputId, previewId, emailId, limit }) {
    this.pageId = pageId;
    this.submit = $(submitId);
    this.submitLabel = submitLabel;
    this.preview = $(previewId);
    this.email = $(emailId);
    this.limit = limit;
    this.photo = null;

    $(photoInputId).addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      this.photo = await compressImage(file);
      this.preview.innerHTML = this.photo ? photoThumb(this.photo) : PHOTO_EMPTY;
    });
  }

  reset() {
    this.photo = null;
    this.preview.innerHTML = PHOTO_EMPTY;
    this.email.value = '';
    this.submit.disabled = false;
    this.submit.textContent = this.submitLabel;
  }

  // Returns the reply address, or null after telling the user what's wrong.
  validEmail() {
    const email = this.email.value.trim();
    if (!email) {
      this.email.focus();
      showToast('E-post mangler', 'Vi trenger adressen din for å svare.');
      return null;
    }
    if (!EMAIL_RE.test(email)) {
      this.email.focus();
      showToast('Ugyldig e-post', 'Sjekk at adressen er riktig.');
      return null;
    }
    return email;
  }

  async send(payload, thanksText) {
    this.submit.disabled = true;
    this.submit.textContent = 'Sender…';

    if (this.photo && this.photo.length > MAX_PHOTO_CHARS) {
      showToast('Bilde for stort', 'Bildet er for stort til å sende. Prøv et annet bilde.');
      this.submit.disabled = false;
      this.submit.textContent = this.submitLabel;
      return;
    }

    try {
      await postReport({ ...payload, photoData: this.photo || null });
      this.limit.record();
      this.submit.textContent = '✓ Sendt!';
      setTimeout(() => {
        closePage(this.pageId);
        setTimeout(() => showToast('Takk! 🙏', thanksText), 350);
      }, 1400);
    } catch {
      this.submit.disabled = false;
      this.submit.textContent = this.submitLabel;
      showToast('Feil', 'Kunne ikke sende. Sjekk internett og prøv igjen.');
    }
  }
}

// Tip about a new table

const tipForm = new ReportForm({
  pageId: 'rapportPage',
  submitId: 'rapportSubmitBtn',
  submitLabel: 'Send inn',
  photoInputId: 'rapportPhotoInput',
  previewId: 'rapportPhotoPreview',
  emailId: 'rEmail',
  limit: dailyLimit('pinpong-rapport-rl', 3),
});

const segmentValue = id => document.querySelector(`#${id} .rapport-seg-btn.active`)?.dataset.val;

export function openTipForm() {
  tipForm.reset();
  $('rNavn').value = '';
  $('rAdresse').value = '';
  document.querySelectorAll('#rTypeSeg .rapport-seg-btn').forEach(b => b.classList.toggle('active', b.dataset.val === 'ute'));
  document.querySelectorAll('#rBelysingSeg .rapport-seg-btn').forEach(b => b.classList.toggle('active', b.dataset.val === 'ja'));
  openPage('rapportPage');
}

export function pickSegment(button) {
  button.closest('.rapport-seg').querySelectorAll('.rapport-seg-btn').forEach(b => b.classList.remove('active'));
  button.classList.add('active');
}

export function submitTip() {
  if (!tipForm.limit.allowed()) {
    showToast('For mange innsendelser', 'Du har sendt inn for mange bord i dag! Prøv igjen i morgen.');
    return;
  }
  const name = $('rNavn').value.trim();
  if (!name) {
    $('rNavn').focus();
    showToast('Navn/sted mangler', 'Fortell oss hvor bordet er.');
    return;
  }
  const email = tipForm.validEmail();
  if (!email) return;

  const type = segmentValue('rTypeSeg') || 'ute';
  const light = segmentValue('rBelysingSeg') || 'ukjent';
  const messageBody = [
    'Navn / Sted: ' + name,
    'Adresse: ' + ($('rAdresse').value.trim() || '–'),
    'Type: ' + (type === 'ute' ? 'Utebord' : 'Innebord'),
    'Belysning: ' + (light === 'ja' ? 'Ja' : light === 'nei' ? 'Nei' : 'Vet ikke'),
  ].join('\n');

  tipForm.send(
    { type: 'rapport', subject: name, messageBody, replyEmail: email },
    'Bordet er sendt inn. Vi sjekker det og legger det til på kartet!',
  );
}

// Report a problem

const issueForm = new ReportForm({
  pageId: 'feilPage',
  submitId: 'feilSubmitBtn',
  submitLabel: 'Send rapport',
  photoInputId: 'feilPhotoInput',
  previewId: 'feilPhotoPreview',
  emailId: 'feilEmail',
  limit: dailyLimit('pp_feil_rl', 2),
});

export function openIssueForm() {
  issueForm.reset();
  $('feilDesc').value = '';
  $('feilSubject').selectedIndex = 0;
  openPage('feilPage');
}

export function submitIssue() {
  if (!issueForm.limit.allowed()) {
    showToast('For mange rapporter', 'Du har sendt inn for mange i dag! Prøv igjen i morgen.');
    return;
  }
  const subject = $('feilSubject').value;
  const description = $('feilDesc').value.trim();
  if (!description) {
    $('feilDesc').focus();
    showToast('Beskrivelse mangler', 'Forklar kort hva problemet er.');
    return;
  }
  const email = issueForm.validEmail();
  if (!email) return;

  issueForm.send(
    { type: 'feil', subject, messageBody: `Kategori: ${subject}\n\n${description}`, replyEmail: email },
    'Din rapport er mottatt. Vi ser på det så fort vi kan.',
  );
}

// Grow the description field with its content
$('feilDesc').addEventListener('input', e => {
  e.target.style.height = 'auto';
  e.target.style.height = e.target.scrollHeight + 'px';
});

// Re-enable buttons if the app was backgrounded mid-request
export function resetSubmitButtons() {
  for (const form of [tipForm, issueForm]) form.submit.disabled = false;
}
