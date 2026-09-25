// Receives "tip a table" and "report an issue" submissions and forwards them
// by email via Resend. RESEND_API_KEY and RECIPIENT_EMAIL are set in Vercel.

export const config = {
  api: { bodyParser: { sizeLimit: '4.5mb' } }, // Vercel's hard limit for function bodies
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_PHOTO_CHARS = 4_000_000;

function isAllowedOrigin(origin) {
  return origin === 'https://pinpong.no'
    || /^https:\/\/[\w-]+\.vercel\.app$/.test(origin)
    || /^http:\/\/localhost(:\d+)?$/.test(origin);
}

// Best-effort limit per IP. Kept in memory, so it resets when Vercel starts a
// new instance, but it stops simple scripts from flooding the inbox.
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 5;
const recent = new Map(); // ip -> timestamps

function rateLimited(ip) {
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5000) recent.clear(); // don't grow without bound
  return hits.length > RATE_MAX;
}

// Accept only real JPEG, PNG, WebP or HEIC data, whatever the data URL claims.
function isImage(base64) {
  const head = Buffer.from(base64.slice(0, 24), 'base64');
  const hex = head.toString('hex');
  const ascii = head.toString('latin1');
  return hex.startsWith('ffd8ff')                                  // JPEG
    || hex.startsWith('89504e47')                                  // PNG
    || (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') // WebP
    || ascii.slice(4, 8) === 'ftyp';                               // HEIC/HEIF
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (isAllowedOrigin(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAllowedOrigin(origin)) return res.status(403).json({ error: 'Forbidden' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'Too many requests' });

  const key = process.env.RESEND_API_KEY;
  const recipient = process.env.RECIPIENT_EMAIL;
  if (!key || !recipient) {
    console.error('[report] RESEND_API_KEY or RECIPIENT_EMAIL is not set');
    return res.status(500).json({ error: 'Not configured' });
  }

  const { type, subject, messageBody, replyEmail, photoData } = req.body || {};
  if (!['rapport', 'feil'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
  if (typeof messageBody !== 'string' || !messageBody.trim() || messageBody.length > 5000) {
    return res.status(400).json({ error: 'Invalid message' });
  }
  if (subject && (typeof subject !== 'string' || subject.length > 200)) {
    return res.status(400).json({ error: 'Invalid subject' });
  }
  if (replyEmail && (typeof replyEmail !== 'string' || replyEmail.length > 254 || !EMAIL_RE.test(replyEmail))) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  let attachments = [];
  if (photoData) {
    const match = typeof photoData === 'string' && photoData.length <= MAX_PHOTO_CHARS
      && photoData.match(/^data:image\/[\w.+-]+;base64,([A-Za-z0-9+/=]+)$/);
    if (!match || !isImage(match[1])) return res.status(400).json({ error: 'Invalid photo' });
    attachments = [{ filename: 'bilde.jpg', content: match[1] }];
  }

  const label = type === 'rapport' ? 'Nytt bord' : 'Feilrapport';
  const payload = {
    from: 'PinPong <noreply@pinpong.no>',
    to: [recipient],
    subject: `[PinPong] ${label} – ${(subject || 'Ukjent').replace(/[\r\n]+/g, ' ')}`,
    text: messageBody.trim() + (replyEmail ? `\n\n---\nSvar til: ${replyEmail}` : '\n\n---\nIngen e-post oppgitt'),
    ...(replyEmail ? { reply_to: replyEmail } : {}),
    ...(attachments.length ? { attachments } : {}),
  };

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      console.error('[report] Resend error', r.status, await r.text().catch(() => ''));
      return res.status(502).json({ error: 'Send failed' });
    }
  } catch (err) {
    console.error('[report] Request to Resend failed:', err.message);
    return res.status(502).json({ error: 'Send failed' });
  }

  return res.status(200).json({ ok: true });
}
