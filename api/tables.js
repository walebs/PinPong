// Serves the table list from a published Google Sheet (CSV).
// SHEETS_CSV_URL is set in the Vercel project settings.

// Kept between invocations while the function instance is warm.
const MEMORY_TTL_MS = 5 * 60 * 1000;
let cached = null; // { csv, at }

// Browsers always revalidate; Vercel's CDN keeps a copy for 60 s and refreshes it
// in the background, so most visitors skip the cold start and the Sheets request.
const CACHE_HEADER = 'public, max-age=0, s-maxage=60, stale-while-revalidate=600';

function sendCsv(res, csv, cacheControl, source) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  if (cacheControl) res.setHeader('Cache-Control', cacheControl);
  res.setHeader('X-Cache', source);
  return res.status(200).send(csv);
}

export default async function handler(req, res) {
  const url = process.env.SHEETS_CSV_URL;
  if (!url) return res.status(500).json({ error: 'Not configured' });

  if (cached && Date.now() - cached.at < MEMORY_TTL_MS) {
    return sendCsv(res, cached.csv, CACHE_HEADER, 'HIT');
  }

  try {
    const upstream = await fetch(url, { cache: 'no-store' });
    if (!upstream.ok) {
      // Prefer slightly old data over an error
      if (cached) return sendCsv(res, cached.csv, 'public, max-age=0, s-maxage=30', 'STALE');
      return res.status(502).json({ error: 'Upstream error' });
    }
    const csv = await upstream.text();
    cached = { csv, at: Date.now() };
    return sendCsv(res, csv, CACHE_HEADER, 'MISS');
  } catch {
    if (cached) return sendCsv(res, cached.csv, null, 'STALE');
    return res.status(500).json({ error: 'Fetch failed' });
  }
}
