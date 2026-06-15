import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_ROOT } from './dataRoot.js';
import { fileToExtra, runClaude, stripJson } from './import.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.resolve(__dirname, '../../.backups');

const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

// --- Parse a single trade confirmation (screenshot / PDF / text) via Claude ---

function tradePrompt(extra) {
  return `Extract a SINGLE executed stock/ETF trade from this broker confirmation. ${extra}

Output ONLY a JSON object (no prose, no code fences):
{ "action": "buy" | "sell", "ticker": "<UPPERCASE>", "name": "<company or empty>",
  "shares": <number>, "price_local": <executed per-share price>, "price_ccy": "USD",
  "date": "<YYYY-MM-DD or null>", "fees": <number or null> }
Rules: numbers only (strip currency symbols/commas); action lowercase; if a field is missing use null.`;
}

export async function parseTrade(file) {
  const { extra, cleanup } = await fileToExtra(file);
  try {
    const t = stripJson(await runClaude(tradePrompt(extra)));
    if (!t || !t.ticker) {
      const e = new Error('Could not read a trade from the file');
      e.status = 422;
      throw e;
    }
    return t;
  } finally {
    cleanup();
  }
}

// --- Apply a completed buy/sell to portfolio.json + append to the trade log ---

function recompute(pf) {
  const equities = pf.holdings.reduce((s, h) => s + h.market_value_eur, 0);
  const cash = pf.totals.cash_eur;
  const totalBook = equities + cash;
  const costTotal = pf.holdings.reduce((s, h) => s + h.cost_basis_eur, 0);
  const upnl = equities - costTotal;
  for (const h of pf.holdings) {
    h.weight_pct_of_equity = equities ? r2((h.market_value_eur / equities) * 100) : 0;
    h.weight_pct_of_total = totalBook ? r2((h.market_value_eur / totalBook) * 100) : 0;
  }
  pf.totals.market_value_equities_eur = r2(equities);
  pf.totals.total_book_eur = r2(totalBook);
  pf.totals.cost_basis_total_eur = r2(costTotal);
  pf.totals.unrealized_pnl_eur = r2(upnl);
  pf.totals.unrealized_pnl_pct_on_cost = costTotal ? r2((upnl / costTotal) * 100) : 0;
  const largest = [...pf.holdings].sort((a, b) => b.weight_pct_of_total - a.weight_pct_of_total)[0];
  pf.concentration = {
    ...(pf.concentration || {}),
    single_largest_position: largest?.ticker ?? null,
    single_largest_position_pct_of_total_book: largest?.weight_pct_of_total ?? 0,
    single_largest_position_pct_of_equity: largest?.weight_pct_of_equity ?? 0,
    cash_pct_of_total_book: totalBook ? r2((cash / totalBook) * 100) : 0,
  };
}

export async function logTrade(payload, { commit = true } = {}) {
  const action = payload.action === 'sell' ? 'sell' : 'buy';
  const ticker = String(payload.ticker || '').toUpperCase().trim();
  const qty = num(payload.shares);
  const price = num(payload.price_local);
  const ccy = (payload.price_ccy || 'USD').toUpperCase();
  const fees = num(payload.fees_eur);
  const date = payload.date || new Date().toISOString().slice(0, 10);
  if (!ticker || qty <= 0 || price <= 0) {
    const e = new Error('ticker, positive shares and price are required');
    e.status = 400;
    throw e;
  }

  const pf = JSON.parse(await fsp.readFile(path.join(DATA_ROOT, 'portfolio.json'), 'utf8'));
  const fx = pf.fx_snapshot?.USD_EUR || 1.16;
  const toEur = (v) => (ccy === 'EUR' ? v : v / fx);
  const h = pf.holdings.find((x) => x.ticker === ticker);

  let realizedEur = null;
  let netEur;

  if (action === 'buy') {
    const costEur = r2(toEur(qty * price) + fees);
    netEur = -costEur;
    if (h) {
      h.cost_basis_eur = r2(h.cost_basis_eur + costEur);
      h.shares = h.shares + qty;
      h.avg_cost_per_share_eur = r2(h.cost_basis_eur / h.shares);
      h.price_local = price;
      h.price_ccy = ccy;
      h.market_value_eur = r2(toEur(h.shares * price));
      h.unrealized_pnl_eur = r2(h.market_value_eur - h.cost_basis_eur);
      h.unrealized_pnl_pct = h.cost_basis_eur ? r2((h.unrealized_pnl_eur / h.cost_basis_eur) * 100) : 0;
    } else {
      const mv = r2(toEur(qty * price));
      pf.holdings.push({
        ticker,
        name: payload.name || ticker,
        shares: qty,
        price_local: price,
        price_ccy: ccy,
        market_value_eur: mv,
        cost_basis_eur: costEur,
        avg_cost_per_share_eur: r2(costEur / qty),
        unrealized_pnl_eur: r2(mv - costEur),
        unrealized_pnl_pct: costEur ? r2(((mv - costEur) / costEur) * 100) : 0,
        theme: [],
        tranche: 'thematic_core',
        next_catalyst: '',
      });
    }
    pf.totals.cash_eur = r2(pf.totals.cash_eur - costEur);
  } else {
    if (!h) {
      const e = new Error(`No held position in ${ticker} to sell`);
      e.status = 400;
      throw e;
    }
    if (qty > h.shares + 1e-9) {
      const e = new Error(`Selling ${qty} but only ${h.shares} held in ${ticker}`);
      e.status = 400;
      throw e;
    }
    const proceedsEur = r2(toEur(qty * price) - fees);
    const costRemoved = r2(h.avg_cost_per_share_eur * qty);
    realizedEur = r2(proceedsEur - costRemoved);
    netEur = proceedsEur;
    h.shares = r2(h.shares - qty);
    h.cost_basis_eur = r2(h.cost_basis_eur - costRemoved);
    pf.totals.cash_eur = r2(pf.totals.cash_eur + proceedsEur);
    pf.totals.realized_pnl_ytd_eur_estimate = r2((pf.totals.realized_pnl_ytd_eur_estimate || 0) + realizedEur);
    if (h.shares <= 1e-9) {
      pf.holdings = pf.holdings.filter((x) => x.ticker !== ticker);
    } else {
      h.price_local = price;
      h.price_ccy = ccy;
      h.market_value_eur = r2(toEur(h.shares * price));
      h.avg_cost_per_share_eur = h.shares ? r2(h.cost_basis_eur / h.shares) : 0;
      h.unrealized_pnl_eur = r2(h.market_value_eur - h.cost_basis_eur);
      h.unrealized_pnl_pct = h.cost_basis_eur ? r2((h.unrealized_pnl_eur / h.cost_basis_eur) * 100) : 0;
    }
  }

  recompute(pf);
  pf.cash = { ...(pf.cash || {}), eur_total: pf.totals.cash_eur };
  pf.last_updated = date;
  pf.last_source = `Trade logged via dashboard ${new Date().toISOString().slice(0, 10)}: ${action} ${qty} ${ticker} @ ${price} ${ccy}.`;

  const entry = {
    event: action === 'buy' ? 'buy_confirmation' : 'sell_confirmation',
    date_trade: date,
    logged_on: new Date().toISOString().slice(0, 10),
    ticker,
    name: payload.name || h?.name || ticker,
    shares: qty,
    price_local: price,
    price_ccy: ccy,
    net_eur: r2(netEur),
    ...(realizedEur != null ? { realized_pnl_eur: realizedEur } : {}),
    ...(fees ? { fees_eur: fees } : {}),
    source: 'dashboard trade logger',
    ...(payload.note ? { note: payload.note } : {}),
  };

  const preview = { portfolio: pf, entry };
  if (!commit) return preview;

  // backup both files, then write
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const f of ['portfolio.json', 'trades.log.jsonl']) {
    try {
      const cur = await fsp.readFile(path.join(DATA_ROOT, f), 'utf8');
      await fsp.writeFile(path.join(BACKUP_DIR, `${stamp}-${f.replace('/', '_')}.pretrade`), cur);
    } catch {
      /* file may not exist */
    }
  }
  await fsp.writeFile(path.join(DATA_ROOT, 'portfolio.json'), JSON.stringify(pf, null, 2) + '\n', 'utf8');
  await fsp.appendFile(path.join(DATA_ROOT, 'trades.log.jsonl'), JSON.stringify(entry) + '\n', 'utf8');
  return preview;
}

// ensure backups dir exists
try {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
} catch {
  /* ignore */
}
