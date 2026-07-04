const CACHE_TTL_MS = 5 * 60 * 1000;
let _cache = null;

export default async function handler(req, res) {
  const url = process.env.SHEETS_CSV_URL;
  if (!url) {
    res.status(500).json({ error: 'Not configured' });
    return;
  }

  if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).send(_cache.csv);
  }

  try {
    const upstream = await fetch(url, { cache: 'no-store' });
    if (!upstream.ok) {
      if (_cache) {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=60');
        res.setHeader('X-Cache', 'STALE');
        return res.status(200).send(_cache.csv);
      }
      return res.status(502).json({ error: 'Upstream error' });
    }

    const csv = await upstream.text();
    _cache = { csv, at: Date.now() };

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).send(csv);
  } catch (e) {
    if (_cache) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).send(_cache.csv);
    }
    return res.status(500).json({ error: 'Fetch failed' });
  }
}
