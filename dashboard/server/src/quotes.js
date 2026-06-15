// Live last-price + FX via Yahoo, cached ~60s, for automatic balance marking.
const CACHE = new Map();
const TTL_MS = 60 * 1000;
const VALID = /^[A-Z0-9.\-=]{1,10}$/;

async function quote(symbol) {
  const hit = CACHE.get(symbol);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.price;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } });
  if (!r.ok) throw new Error(`yahoo ${r.status}`);
  const j = await r.json();
  const meta = j?.chart?.result?.[0]?.meta;
  const price = Number.isFinite(meta?.regularMarketPrice) ? meta.regularMarketPrice : null;
  CACHE.set(symbol, { ts: Date.now(), price });
  return price;
}

export async function getQuotes(tickers) {
  const clean = [...new Set(tickers.map((t) => t.toUpperCase()).filter((t) => VALID.test(t)))].slice(0, 25);
  const quotes = {};
  await Promise.all(
    clean.map(async (t) => {
      try {
        quotes[t] = await quote(t);
      } catch {
        quotes[t] = null;
      }
    }),
  );
  let usdPerEur = null;
  try {
    usdPerEur = await quote('EURUSD=X');
  } catch {
    /* ignore */
  }
  return { quotes, usd_per_eur: usdPerEur, asOf: new Date().toISOString() };
}
