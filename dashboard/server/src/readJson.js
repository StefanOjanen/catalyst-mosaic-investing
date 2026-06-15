import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_ROOT } from './dataRoot.js';

// Whitelist of readable files in the data root. Never accept a client-supplied path.
export const ALLOWED_FILES = new Set([
  'portfolio.json',
  'event_trades.json',
  'tranches.json',
  'earnings_calendar.json',
  'tracked_funds.json',
  'tracked_analysts.json',
  'scout_universe.json',
  'goals.json',
]);

function safeResolve(name) {
  if (typeof name !== 'string' || name.includes('/') || name.includes('\\') || name.includes('..')) {
    const err = new Error(`Invalid filename: ${name}`);
    err.status = 400;
    throw err;
  }
  if (!ALLOWED_FILES.has(name)) {
    const err = new Error(`File not allowed: ${name}`);
    err.status = 403;
    throw err;
  }
  const resolved = path.resolve(DATA_ROOT, name);
  if (resolved !== path.join(DATA_ROOT, name) || !resolved.startsWith(DATA_ROOT + path.sep)) {
    const err = new Error('Path escapes data root');
    err.status = 400;
    throw err;
  }
  return resolved;
}

export async function readJsonFile(name) {
  const resolved = safeResolve(name);
  let raw;
  try {
    raw = await fs.readFile(resolved, 'utf8');
  } catch {
    const err = new Error(`Cannot read ${name}`);
    err.status = 404;
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error(`${name} is not valid JSON`);
    err.status = 502;
    throw err;
  }
}
