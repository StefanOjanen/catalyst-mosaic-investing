// Server-side daily price proxy via Yahoo Finance chart API (free, no key). Cached 1h.
// (Stooq was tried first but serves an anti-bot JS challenge to programmatic clients.)
const CACHE = new Map(); // `${symbol}:${range}` -> { ts, rows }
const TTL_MS = 60 * 60 * 1000;

const ALLOWED_RANGE = new Set(['1mo', '3mo', '6mo', '1y', '2y']);
const VALID_SYMBOL = /^[A-Z0-9.\-]{1,8}$/;

async function fetchSeries(symbol, range) {
  const key = `${symbol}:${range}`;
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.rows;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } });
  if (!res.ok) throw new Error(`yahoo ${res.status}`);

  const j = await res.json();
  const result = j?.chart?.result?.[0];
  const ts = result?.timestamp ?? [];
  const close = result?.indicators?.quote?.[0]?.close ?? [];

  const rows = [];
  for (let i = 0; i < ts.length; i++) {
    const c = close[i];
    if (Number.isFinite(c)) {
      rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: Number(c.toFixed(2)) });
    }
  }
  CACHE.set(key, { ts: Date.now(), rows });
  return rows;
}

export async function getPrices(tickers, range) {
  const r = ALLOWED_RANGE.has(range) ? range : '6mo';
  const clean = [...new Set(tickers.map((t) => t.toUpperCase()).filter((t) => VALID_SYMBOL.test(t)))].slice(0, 15);

  const entries = await Promise.all(
    clean.map(async (t) => {
      try {
        return [t, await fetchSeries(t, r)];
      } catch {
        return [t, []];
      }
    }),
  );
  return Object.fromEntries(entries);
}
