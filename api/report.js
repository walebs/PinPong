export const config = {
  api: { bodyParser: { sizeLimit: '8mb' } }
};

const ALLOWED_ORIGIN = 'https://pinpong.no';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  // Restrict CORS to pinpong.no (and Vercel preview deployments)
  const origin = req.headers.origin || '';
  if (origin === ALLOWED_ORIGIN || origin.endsWith('.vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ error: 'RESEND_API_KEY not set' });

  const recipient = process.env.RECIPIENT_EMAIL;
  if (!recipient) return res.status(500).json({ error: 'RECIPIENT_EMAIL not set' });

  const { type, subject, messageBody, replyEmail, photoData } = req.body || {};

  // Server-side validation
  if (!['rapport', 'feil'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
  if (typeof messageBody !== 'string' || !messageBody.trim() || messageBody.length > 5000)
    return res.status(400).json({ error: 'messageBody invalid' });
  if (subject && (typeof subject !== 'string' || subject.length > 200))
    return res.status(400).json({ error: 'subject invalid' });
  if (replyEmail && !EMAIL_RE.test(replyEmail))
    return res.status(400).json({ error: 'Invalid replyEmail' });
  if (photoData && (typeof photoData !== 'string' || !photoData.startsWith('data:image') || photoData.length > 6_000_000))
    return res.status(400).json({ error: 'photoData invalid or too large' });

  const emailSubject = type === 'rapport'
    ? `[PinPong] Nytt bord – ${subject || 'Ukjent'}`
    : `[PinPong] Feilrapport – ${subject || 'Ukjent'}`;

  const fullBody = messageBody.trim()
    + (replyEmail ? `\n\n---\nSvar til: ${replyEmail}` : '\n\n---\nIngen e-post oppgitt');

  // Strip data URL prefix: data:image/jpeg;base64,... → raw base64
  const attachments = photoData
    ? [{ filename: 'bilde.jpg', content: photoData.replace(/^data:[^;]+;base64,/, '') }]
    : [];

  const payload = {
    from: 'PinPong <noreply@pinpong.no>',
    to: [recipient],
    subject: emailSubject,
    text: fullBody,
    ...(replyEmail ? { reply_to: replyEmail } : {}),
    ...(attachments.length ? { attachments } : {})
  };

  let resendStatus, resendBody;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    resendStatus = r.status;
    resendBody = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('[report] Resend error', resendStatus, JSON.stringify(resendBody));
      return res.status(502).json({ error: 'Send failed', resendStatus, details: resendBody });
    }
  } catch (err) {
    console.error('[report] Fetch threw:', err.message);
    return res.status(500).json({ error: 'Network error', message: err.message });
  }

  return res.status(200).json({ ok: true, id: resendBody?.id, hasPhoto: !!photoData });
}
