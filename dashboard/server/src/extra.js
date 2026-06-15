import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_ROOT } from './dataRoot.js';

const RESEARCH_DIR = path.join(DATA_ROOT, 'research', 'daily');

// --- trades.log.jsonl -> newest-first array ---
export async function readTradeLog() {
  const text = await fs.readFile(path.join(DATA_ROOT, 'trades.log.jsonl'), 'utf8');
  const out = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      /* skip malformed line */
    }
  }
  return out.reverse();
}

// --- CSV parser (handles quoted fields with embedded commas/quotes) ---
function parseCsv(text) {
  const rows = [];
  let field = '';
  let record = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      record.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      record.push(field);
      field = '';
      if (record.length > 1 || record[0] !== '') rows.push(record);
      record = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || record.length) {
    record.push(field);
    rows.push(record);
  }
  return rows;
}

export async function readWatchlist() {
  const text = await fs.readFile(path.join(DATA_ROOT, 'watch_list_normalized.csv'), 'utf8');
  const rows = parseCsv(text).filter((r) => r.some((c) => c !== ''));
  const header = rows.shift() ?? [];
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

// --- research/daily/*.md ---
export async function listResearch() {
  let files;
  try {
    files = await fs.readdir(RESEARCH_DIR);
  } catch {
    return [];
  }
  return files
    .filter((f) => f.endsWith('.md'))
    .sort((a, b) => {
      const ad = /^\d/.test(a);
      const bd = /^\d/.test(b);
      if (ad && bd) return a < b ? 1 : -1; // both dated -> newest first
      if (ad !== bd) return ad ? -1 : 1; // dated files before index.md etc.
      return a < b ? -1 : 1;
    })
    .map((name) => ({ name }));
}

const MD_NAME = /^[A-Za-z0-9._-]+\.md$/;

export async function readResearch(name) {
  if (!MD_NAME.test(name)) {
    const e = new Error('Invalid research filename');
    e.status = 400;
    throw e;
  }
  const resolved = path.join(RESEARCH_DIR, name);
  if (!resolved.startsWith(RESEARCH_DIR + path.sep)) {
    const e = new Error('Path escapes research dir');
    e.status = 400;
    throw e;
  }
  try {
    return { name, content: await fs.readFile(resolved, 'utf8') };
  } catch {
    const e = new Error('Research file not found');
    e.status = 404;
    throw e;
  }
}
