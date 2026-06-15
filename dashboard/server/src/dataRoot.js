import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve the data directory the dashboard reads from:
//   1. DATA_ROOT env var (explicit override), else
//   2. the parent folder if it already holds a portfolio.json (the live private setup), else
//   3. the bundled sample-data/ (so a fresh clone runs out of the box).
function resolveDataRoot() {
  if (process.env.DATA_ROOT) return path.resolve(process.env.DATA_ROOT);
  const parent = path.resolve(__dirname, '../../../');
  if (fs.existsSync(path.join(parent, 'portfolio.json'))) return parent;
  return path.resolve(__dirname, '../sample-data');
}

export const DATA_ROOT = resolveDataRoot();
