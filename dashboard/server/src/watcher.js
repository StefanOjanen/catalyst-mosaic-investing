import chokidar from 'chokidar';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { DATA_ROOT } from './dataRoot.js';

export const dataBus = new EventEmitter();
dataBus.setMaxListeners(0);

export function startWatcher() {
  const targets = [
    path.join(DATA_ROOT, '*.json'),
    path.join(DATA_ROOT, 'trades.log.jsonl'),
    path.join(DATA_ROOT, 'watch_list_normalized.csv'),
    path.join(DATA_ROOT, 'research', 'daily'),
  ];

  const watcher = chokidar.watch(targets, {
    ignoreInitial: true,
    ignored: (p) => p.includes(`${path.sep}node_modules${path.sep}`) || p.includes(`${path.sep}dashboard${path.sep}`),
    depth: 1,
  });

  // Debounce bursts (skills can rewrite a file in several steps).
  let timer = null;
  const pending = new Set();
  const flush = () => {
    for (const f of pending) dataBus.emit('change', f);
    pending.clear();
    timer = null;
  };

  for (const ev of ['add', 'change', 'unlink']) {
    watcher.on(ev, (p) => {
      const base = path.basename(p);
      pending.add(base.endsWith('.md') ? 'research' : base);
      if (!timer) timer = setTimeout(flush, 300);
    });
  }

  watcher.on('error', (e) => console.error('[invest-dashboard] watcher error:', e?.message));
  return watcher;
}
