import express from 'express';
import { readJsonFile } from './readJson.js';
import { DATA_ROOT } from './dataRoot.js';
import { createJob, getJob, cancelJob, getReview, revertJob, keepJob } from './jobs.js';
import { readTradeLog, readWatchlist, listResearch, readResearch } from './extra.js';
import { getPrices } from './prices.js';
import { getAnalytics } from './risk.js';
import { getQuotes } from './quotes.js';
import { parseImport, commitImport } from './import.js';
import { dataBus, startWatcher } from './watcher.js';

const app = express();
const PORT = Number(process.env.PORT) || 4317;
const HOST = '127.0.0.1'; // localhost only — never expose this to the network

app.use(express.json({ limit: '30mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, dataRoot: DATA_ROOT });
});

// Map of REST routes -> whitelisted data files.
const NAMED_ROUTES = {
  '/api/portfolio': 'portfolio.json',
  '/api/event-trades': 'event_trades.json',
  '/api/tranches': 'tranches.json',
  '/api/earnings': 'earnings_calendar.json',
  '/api/funds': 'tracked_funds.json',
  '/api/analysts': 'tracked_analysts.json',
  '/api/scout': 'scout_universe.json',
  '/api/goals': 'goals.json',
};

for (const [route, file] of Object.entries(NAMED_ROUTES)) {
  app.get(route, async (_req, res) => {
    try {
      const data = await readJsonFile(file);
      res.json(data);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });
}

// --- Non-JSON data readers ---

app.get('/api/trade-log', async (_req, res) => {
  try {
    res.json(await readTradeLog());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/watchlist', async (_req, res) => {
  try {
    res.json(await readWatchlist());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/research', async (_req, res) => {
  try {
    res.json(await listResearch());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/research/:name', async (req, res) => {
  try {
    res.json(await readResearch(req.params.name));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/prices', async (req, res) => {
  const symbols = String(req.query.symbols || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!symbols.length) return res.status(400).json({ error: 'symbols required' });
  try {
    res.json(await getPrices(symbols, String(req.query.range || '6mo')));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/analytics', async (req, res) => {
  try {
    res.json(await getAnalytics(String(req.query.range || '1y')));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/quotes', async (req, res) => {
  const symbols = String(req.query.symbols || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!symbols.length) return res.status(400).json({ error: 'symbols required' });
  try {
    res.json(await getQuotes(symbols));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// --- Portfolio import wizard ---

app.post('/api/import/parse', async (req, res) => {
  try {
    res.json(await parseImport(req.body || {}));
  } catch (err) {
    res.status(err.status || 502).json({ error: err.message });
  }
});

app.post('/api/import/commit', async (req, res) => {
  try {
    res.json(await commitImport(req.body || {}));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- Global data-change stream (chokidar -> SSE) ---

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.write('retry: 3000\n\n');
  const onChange = (file) => res.write(`data: ${JSON.stringify({ type: 'data-changed', file })}\n\n`);
  dataBus.on('change', onChange);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    dataBus.off('change', onChange);
    clearInterval(ping);
  });
});

// --- Skill execution (shell out to headless claude -p, stream over SSE) ---

app.post('/api/skill', (req, res) => {
  const { prompt, sessionId, mode } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt (string) required' });
  }
  const job = createJob({ prompt: prompt.trim(), sessionId, mode: mode === 'write' ? 'write' : undefined });
  res.json({ jobId: job.id, sessionId: job.sessionId, mode: job.mode });
});

app.get('/api/skill/:id/stream', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).end();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.write('retry: 2000\n\n');

  const send = (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`);

  // Replay buffered events so a refresh / reconnect re-attaches mid-run.
  for (const ev of job.events) send(ev);
  if (job.status === 'done' || job.status === 'error') {
    res.write('event: end\ndata: {}\n\n');
    return res.end();
  }

  const onEvent = (ev) => {
    send(ev);
    if (ev.kind === 'status' && (ev.status === 'done' || ev.status === 'error')) {
      res.write('event: end\ndata: {}\n\n');
      res.end();
    }
  };
  job.emitter.on('event', onEvent);
  req.on('close', () => job.emitter.off('event', onEvent));
});

app.post('/api/skill/:id/cancel', (req, res) => {
  res.json({ cancelled: cancelJob(req.params.id) });
});

// Write-skill review (snapshot + revert model)
app.get('/api/skill/:id/review', (req, res) => {
  const review = getReview(req.params.id);
  if (!review) return res.status(404).json({ error: 'no review' });
  res.json({ changes: review.changes, reverted: review.reverted, kept: review.kept });
});

app.post('/api/skill/:id/revert', async (req, res) => {
  try {
    res.json({ reverted: await revertJob(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/skill/:id/keep', (req, res) => {
  res.json({ kept: keepJob(req.params.id) });
});

startWatcher();

app.listen(PORT, HOST, () => {
  console.log(`[invest-dashboard] API listening on http://${HOST}:${PORT}`);
  console.log(`[invest-dashboard] data root: ${DATA_ROOT}`);
});
