import { readJsonFile } from './readJson.js';
import { getPrices } from './prices.js';

const TRADING_DAYS = 252;
const BENCHMARKS = ['SOXX', 'SPY'];

// --- small stats helpers ---
function returnsFromCloses(rows) {
  // rows: [{date, close}] sorted asc -> [{date, r}]
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1].close;
    if (prev) out.push({ date: rows[i].date, r: rows[i].close / prev - 1 });
  }
  return out;
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function std(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

// Align two return series on common dates -> [ax[], bx[]]
function align(aRet, bRet) {
  const bMap = new Map(bRet.map((p) => [p.date, p.r]));
  const ax = [];
  const bx = [];
  for (const p of aRet) {
    if (bMap.has(p.date)) {
      ax.push(p.r);
      bx.push(bMap.get(p.date));
    }
  }
  return [ax, bx];
}

function correlation(aRet, bRet) {
  const [ax, bx] = align(aRet, bRet);
  if (ax.length < 5) return { rho: null, n: ax.length };
  const ma = mean(ax);
  const mb = mean(bx);
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < ax.length; i++) {
    const da = ax[i] - ma;
    const db = bx[i] - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  const denom = Math.sqrt(va * vb);
  return { rho: denom ? cov / denom : null, n: ax.length };
}

function beta(stockRet, benchRet) {
  const [sx, bx] = align(stockRet, benchRet);
  if (sx.length < 5) return null;
  const mb = mean(bx);
  const ms = mean(sx);
  let cov = 0;
  let vb = 0;
  for (let i = 0; i < sx.length; i++) {
    cov += (sx[i] - ms) * (bx[i] - mb);
    vb += (bx[i] - mb) ** 2;
  }
  return vb ? cov / vb : null;
}

function trailingReturn(rows, days) {
  if (rows.length < 2) return null;
  const last = rows[rows.length - 1].close;
  const idx = Math.max(0, rows.length - 1 - days);
  const base = rows[idx].close;
  return base ? (last / base - 1) * 100 : null;
}

export async function getAnalytics(range = '1y') {
  const pf = await readJsonFile('portfolio.json');
  const holdings = (pf.holdings ?? []).map((h) => ({
    ticker: h.ticker,
    wBook: Number(h.weight_pct_of_total) || 0,
    wEq: Number(h.weight_pct_of_equity) || 0,
  }));
  const tickers = holdings.map((h) => h.ticker);

  const prices = await getPrices([...tickers, ...BENCHMARKS], range);
  const ret = {};
  for (const sym of [...tickers, ...BENCHMARKS]) ret[sym] = returnsFromCloses(prices[sym] ?? []);

  // per-ticker vol / beta / momentum (each on its own series)
  const vol = {};
  const betaSoxx = {};
  const betaSpy = {};
  const ret1mo = {};
  const ret3mo = {};
  for (const t of tickers) {
    vol[t] = +(std(ret[t].map((p) => p.r)) * Math.sqrt(TRADING_DAYS) * 100).toFixed(1);
    betaSoxx[t] = round2(beta(ret[t], ret.SOXX));
    betaSpy[t] = round2(beta(ret[t], ret.SPY));
    ret1mo[t] = roundN(trailingReturn(prices[t] ?? [], 21), 1);
    ret3mo[t] = roundN(trailingReturn(prices[t] ?? [], 63), 1);
  }

  // pairwise correlation matrix
  const corr = tickers.map((a) =>
    tickers.map((b) => {
      if (a === b) return 1;
      return round2(correlation(ret[a], ret[b]).rho);
    }),
  );

  // average pairwise correlation (off-diagonal, upper triangle)
  let csum = 0;
  let ccount = 0;
  for (let i = 0; i < tickers.length; i++)
    for (let j = i + 1; j < tickers.length; j++) {
      const v = corr[i][j];
      if (v != null) {
        csum += v;
        ccount++;
      }
    }
  const avgCorr = ccount ? +(csum / ccount).toFixed(2) : null;

  // portfolio beta = Σ wBook * beta  (cash contributes 0)
  const pBetaSoxx = round2(
    holdings.reduce((s, h) => s + (betaSoxx[h.ticker] != null ? (h.wBook / 100) * betaSoxx[h.ticker] : 0), 0),
  );
  const pBetaSpy = round2(
    holdings.reduce((s, h) => s + (betaSpy[h.ticker] != null ? (h.wBook / 100) * betaSpy[h.ticker] : 0), 0),
  );

  // equity-normalized weights for diversification stats
  const eqSum = holdings.reduce((s, h) => s + h.wEq, 0) || 1;
  const eqW = Object.fromEntries(holdings.map((h) => [h.ticker, h.wEq / eqSum]));

  // effective number of bets (weights only) = 1 / Σ w²
  const effectiveBets = +(1 / holdings.reduce((s, h) => s + eqW[h.ticker] ** 2, 0)).toFixed(1);

  // portfolio vol via assembled covariance (per-ticker σ + pairwise ρ), equity weights
  let pVar = 0;
  for (let i = 0; i < tickers.length; i++)
    for (let j = 0; j < tickers.length; j++) {
      const ti = tickers[i];
      const tj = tickers[j];
      const rho = i === j ? 1 : corr[i][j];
      if (rho == null) continue;
      pVar += eqW[ti] * eqW[tj] * (vol[ti] / 100) * (vol[tj] / 100) * rho;
    }
  const pVol = +(Math.sqrt(Math.max(pVar, 0)) * 100).toFixed(1);
  const weightedAvgVol = holdings.reduce((s, h) => s + eqW[h.ticker] * vol[h.ticker], 0);
  const diversificationRatio = pVol ? +(weightedAvgVol / pVol).toFixed(2) : null;

  const nDays = Math.max(...tickers.map((t) => ret[t].length), 0);

  return {
    range,
    asOf: pf.last_updated ?? null,
    nDays,
    tickers,
    weightsBook: Object.fromEntries(holdings.map((h) => [h.ticker, h.wBook])),
    vol,
    betaSoxx,
    betaSpy,
    ret1mo,
    ret3mo,
    corr,
    portfolio: {
      betaSoxx: pBetaSoxx,
      betaSpy: pBetaSpy,
      vol: pVol,
      effectiveBets,
      diversificationRatio,
      avgCorr,
    },
  };
}

function round2(x) {
  return x == null || Number.isNaN(x) ? null : +x.toFixed(2);
}
function roundN(x, n) {
  return x == null || Number.isNaN(x) ? null : +x.toFixed(n);
}
