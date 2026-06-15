import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { DATA_ROOT } from './dataRoot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, '../../.uploads');
const BACKUP_DIR = path.resolve(__dirname, '../../.backups');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function round2(x) {
  return Math.round((Number(x) || 0) * 100) / 100;
}
function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

// --- Parse: any file -> proposed holdings JSON via Claude ---

function extractionPrompt(extra) {
  return `Extract a stock/ETF portfolio from a broker export. ${extra}

Output ONLY a JSON object (no prose, no markdown code fences) with this exact shape:
{
  "broker": "<name if visible else empty>",
  "account": "<account name/type if visible else empty>",
  "base_currency": "EUR",
  "fx_usd_per_eur": <number or null>,
  "cash_eur": <number or null>,
  "holdings": [
    { "ticker": "<UPPERCASE symbol>", "name": "<company>", "shares": <number>,
      "price_local": <current price per share or null>, "price_ccy": "USD",
      "avg_cost_per_share": <number or null>, "cost_basis": <total cost or null> }
  ]
}
Rules: numbers only (strip currency symbols and thousands separators); skip totals/summary rows; one object per position; if a field is missing use null.`;
}

function detectKind(mimeType, filename) {
  const mt = (mimeType || '').toLowerCase();
  const ext = (filename || '').toLowerCase().split('.').pop();
  if (mt.includes('csv') || ext === 'csv') return 'csv';
  if (mt.includes('sheet') || mt.includes('excel') || ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (mt.includes('pdf') || ext === 'pdf') return 'pdf';
  if (mt.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
  return 'text';
}

function stripJson(text) {
  if (!text) return null;
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      prompt,
      '--output-format',
      'json',
      '--permission-mode',
      'bypassPermissions',
      '--disallowedTools',
      'Write',
      'Edit',
      'MultiEdit',
      'NotebookEdit',
    ];
    const child = spawn('claude', args, { cwd: DATA_ROOT, shell: false, env: process.env });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`claude exited ${code}: ${err.slice(0, 300)}`));
      try {
        const env = JSON.parse(out);
        resolve(typeof env.result === 'string' ? env.result : '');
      } catch {
        reject(new Error('failed to parse claude output'));
      }
    });
  });
}

export async function parseImport({ filename, mimeType, dataBase64 }) {
  if (!dataBase64) {
    const e = new Error('no file data');
    e.status = 400;
    throw e;
  }
  const buf = Buffer.from(dataBase64, 'base64');
  const kind = detectKind(mimeType, filename);
  let prompt;
  let tmpPath = null;
  try {
    if (kind === 'csv') {
      prompt = extractionPrompt('Here is the CSV content:\n\n' + buf.toString('utf8').slice(0, 20000));
    } else if (kind === 'xlsx') {
      const wb = XLSX.read(buf, { type: 'buffer' });
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
      prompt = extractionPrompt('Here is the spreadsheet (first sheet) as CSV:\n\n' + csv.slice(0, 20000));
    } else if (kind === 'image' || kind === 'pdf') {
      const ext = (filename || '').split('.').pop() || (kind === 'pdf' ? 'pdf' : 'png');
      tmpPath = path.join(UPLOAD_DIR, `import-${Date.now()}.${ext}`);
      await fsp.writeFile(tmpPath, buf);
      prompt = extractionPrompt(`Read the file at this absolute path and extract the portfolio from it: ${tmpPath}`);
    } else {
      prompt = extractionPrompt('Here is the content:\n\n' + buf.toString('utf8').slice(0, 20000));
    }
    const resultText = await runClaude(prompt);
    const parsed = stripJson(resultText);
    if (!parsed || !Array.isArray(parsed.holdings)) {
      const e = new Error('Could not extract holdings from the file');
      e.status = 422;
      throw e;
    }
    return parsed;
  } finally {
    if (tmpPath) fsp.unlink(tmpPath).catch(() => {});
  }
}

// --- Commit: edited holdings -> full portfolio.json (with backup) ---

export async function commitImport(payload) {
  const fxUsdPerEur = num(payload.fx_usd_per_eur) || 1.16;
  const usdToEur = (v) => v / fxUsdPerEur;
  const cashEur = num(payload.cash_eur);

  const holdings = (payload.holdings || [])
    .filter((h) => h.ticker && num(h.shares) > 0)
    .map((h) => {
      const shares = num(h.shares);
      const priceLocal = num(h.price_local);
      const ccy = (h.price_ccy || 'USD').toUpperCase();
      const toEur = ccy === 'EUR' ? (v) => v : usdToEur;
      const mvEur = toEur(shares * priceLocal);
      let costEur;
      if (num(h.cost_basis) > 0) costEur = toEur(num(h.cost_basis));
      else if (num(h.avg_cost_per_share) > 0) costEur = toEur(num(h.avg_cost_per_share) * shares);
      else costEur = mvEur;
      const upnl = mvEur - costEur;
      return {
        ticker: String(h.ticker).toUpperCase(),
        name: h.name || String(h.ticker).toUpperCase(),
        shares,
        price_local: priceLocal,
        price_ccy: ccy,
        market_value_eur: round2(mvEur),
        cost_basis_eur: round2(costEur),
        avg_cost_per_share_eur: shares ? round2(costEur / shares) : 0,
        unrealized_pnl_eur: round2(upnl),
        unrealized_pnl_pct: costEur ? round2((upnl / costEur) * 100) : 0,
        theme: Array.isArray(h.theme) ? h.theme : [],
        tranche: h.tranche || 'thematic_core',
        next_catalyst: h.next_catalyst || '',
      };
    });

  const equities = holdings.reduce((s, h) => s + h.market_value_eur, 0);
  const totalBook = equities + cashEur;
  const costTotal = holdings.reduce((s, h) => s + h.cost_basis_eur, 0);
  const upnlTotal = equities - costTotal;
  for (const h of holdings) {
    h.weight_pct_of_equity = equities ? round2((h.market_value_eur / equities) * 100) : 0;
    h.weight_pct_of_total = totalBook ? round2((h.market_value_eur / totalBook) * 100) : 0;
  }
  const largest = holdings.slice().sort((a, b) => b.weight_pct_of_total - a.weight_pct_of_total)[0];

  let realizedYtd = num(payload.realized_pnl_ytd_eur);
  try {
    const prev = JSON.parse(await fsp.readFile(path.join(DATA_ROOT, 'portfolio.json'), 'utf8'));
    if (!payload.realized_pnl_ytd_eur && prev?.totals?.realized_pnl_ytd_eur_estimate != null) {
      realizedYtd = prev.totals.realized_pnl_ytd_eur_estimate;
    }
  } catch {
    /* no prior file */
  }

  const today = new Date().toISOString().slice(0, 10);
  const portfolio = {
    base_currency: 'EUR',
    broker: payload.broker || '',
    account: payload.account || '',
    last_updated: today,
    last_source: `Established/updated via dashboard import wizard ${today}.`,
    fx_snapshot: { USD_EUR: fxUsdPerEur },
    totals: {
      market_value_equities_eur: round2(equities),
      cash_eur: round2(cashEur),
      total_book_eur: round2(totalBook),
      cost_basis_total_eur: round2(costTotal),
      unrealized_pnl_eur: round2(upnlTotal),
      unrealized_pnl_pct_on_cost: costTotal ? round2((upnlTotal / costTotal) * 100) : 0,
      realized_pnl_ytd_eur_estimate: round2(realizedYtd),
    },
    cash: { eur_total: round2(cashEur) },
    holdings,
    concentration: {
      single_largest_position: largest?.ticker ?? null,
      single_largest_position_pct_of_total_book: largest?.weight_pct_of_total ?? 0,
      single_largest_position_pct_of_equity: largest?.weight_pct_of_equity ?? 0,
      cash_pct_of_total_book: totalBook ? round2((cashEur / totalBook) * 100) : 0,
    },
  };

  await fsp.mkdir(BACKUP_DIR, { recursive: true });
  try {
    const cur = await fsp.readFile(path.join(DATA_ROOT, 'portfolio.json'), 'utf8');
    await fsp.writeFile(path.join(BACKUP_DIR, `${today}-portfolio-preimport-${Date.now()}.json`), cur);
  } catch {
    /* no prior file to back up */
  }
  await fsp.writeFile(path.join(DATA_ROOT, 'portfolio.json'), JSON.stringify(portfolio, null, 2) + '\n', 'utf8');
  return portfolio;
}
