import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_ROOT } from './dataRoot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.resolve(__dirname, '../../.backups'); // dashboard/.backups

const MAX_CONCURRENT = 1; // single user; skills are token-heavy (daily spawns 4 subagents)

// Files the write-skills (preprint/exitcheck) may mutate. Snapshotted before a
// write run so the change can be reviewed and reverted.
const PROTECTED_FILES = ['event_trades.json', 'trades.log.jsonl', 'goals.json', 'portfolio.json'];

// Read-only runs: keep write tools out of context, auto-run everything else.
const READONLY_GUARD = [
  '--permission-mode',
  'bypassPermissions',
  '--disallowedTools',
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
];

// Write runs: full autonomy (writes allowed). Safety comes from snapshot + revert.
const WRITE_GUARD = ['--permission-mode', 'bypassPermissions'];

const jobs = new Map();
const queue = [];
let running = 0;

function makeId() {
  return 'job_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function inferMode(prompt) {
  return /\/invest:(preprint|exitcheck|goal)\b/.test(prompt) ? 'write' : 'read';
}

function pushEvent(job, ev) {
  job.events.push(ev);
  job.emitter.emit('event', ev);
}

export function createJob({ prompt, sessionId, mode }) {
  const job = {
    id: makeId(),
    prompt,
    sessionId: sessionId || null,
    mode: mode || inferMode(prompt),
    status: 'queued',
    events: [],
    emitter: new EventEmitter(),
    child: null,
    cost: null,
    createdAt: Date.now(),
    snapshot: null,
    review: null,
    _released: false,
  };
  job.emitter.setMaxListeners(0);
  jobs.set(job.id, job);
  pushEvent(job, { kind: 'status', status: 'queued', text: 'queued', mode: job.mode });
  queue.push(job);
  drain();
  return job;
}

function drain() {
  if (running >= MAX_CONCURRENT) return;
  const job = queue.shift();
  if (!job) return;
  running += 1;
  startJob(job).catch((e) => finishJob(job, { kind: 'error', text: 'start error: ' + e.message }));
}

async function snapshotProtected(job) {
  const dir = path.join(BACKUP_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}-${job.id}`);
  await fsp.mkdir(dir, { recursive: true });
  const files = {};
  for (const name of PROTECTED_FILES) {
    const src = path.join(DATA_ROOT, name);
    try {
      const content = await fsp.readFile(src, 'utf8');
      files[name] = content;
      await fsp.writeFile(path.join(dir, name), content, 'utf8');
    } catch {
      files[name] = null; // file may not exist
    }
  }
  job.snapshot = { dir, files };
  pushEvent(job, { kind: 'status', status: 'running', text: `snapshot saved (${dir})`, mode: 'write' });
}

async function startJob(job) {
  job.status = 'running';
  pushEvent(job, { kind: 'status', status: 'running', text: 'starting claude…', mode: job.mode });

  if (job.mode === 'write') {
    await snapshotProtected(job);
  }

  const guard = job.mode === 'write' ? WRITE_GUARD : READONLY_GUARD;
  const args = [
    '-p',
    job.prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    ...(job.sessionId ? ['--resume', job.sessionId] : []),
    ...guard,
  ];

  let child;
  try {
    child = spawn('claude', args, { cwd: DATA_ROOT, shell: false, env: process.env });
  } catch (e) {
    finishJob(job, { kind: 'error', text: 'spawn failed: ' + e.message });
    return;
  }
  job.child = child;

  let buf = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (line) handleLine(job, line);
    }
  });

  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d) => {
    stderr += d;
  });

  child.on('error', (e) => {
    finishJob(job, { kind: 'error', text: 'process error: ' + e.message });
  });

  child.on('close', (code) => {
    if (buf.trim()) handleLine(job, buf.trim());
    if (job.status === 'done' || job.status === 'error') {
      releaseSlot(job);
    } else if (code === 0) {
      completeJob(job, { kind: 'result', text: '', isError: false });
    } else {
      finishJob(job, {
        kind: 'error',
        text: `claude exited with code ${code}${stderr ? ': ' + stderr.slice(0, 600) : ''}`,
      });
    }
  });
}

function handleLine(job, line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  switch (msg.type) {
    case 'system':
      if (msg.subtype === 'init') {
        if (msg.session_id) {
          job.sessionId = msg.session_id;
          pushEvent(job, { kind: 'session', sessionId: msg.session_id });
        }
        if (Array.isArray(msg.tools)) pushEvent(job, { kind: 'debug', text: 'tools: ' + msg.tools.join(', ') });
      }
      break;
    case 'assistant': {
      const blocks = msg.message?.content ?? [];
      for (const b of blocks) {
        if (b.type === 'text' && b.text) pushEvent(job, { kind: 'assistant_text', text: b.text });
        else if (b.type === 'tool_use')
          pushEvent(job, { kind: 'tool', name: b.name, summary: summarizeTool(b.name, b.input) });
      }
      break;
    }
    case 'result':
      if (msg.session_id) job.sessionId = msg.session_id;
      job.cost = msg.total_cost_usd ?? null;
      completeJob(job, {
        kind: 'result',
        text: typeof msg.result === 'string' ? msg.result : '',
        isError: msg.subtype !== 'success',
        cost: msg.total_cost_usd ?? null,
        durationMs: msg.duration_ms ?? null,
      });
      break;
    default:
      break;
  }
}

function summarizeTool(name, input) {
  try {
    if (name === 'Task') return input?.description || input?.subagent_type || 'subagent';
    if (name === 'WebSearch') return input?.query || '';
    if (name === 'WebFetch') return input?.url || '';
    if (name === 'Read') return input?.file_path || '';
    if (name === 'Write' || name === 'Edit') return input?.file_path || '';
    if (name === 'Bash') return input?.description || (input?.command || '').slice(0, 60);
    if (name === 'Skill') return input?.skill || '';
  } catch {
    /* ignore */
  }
  return '';
}

// Terminal path for errors / read-mode success.
function finishJob(job, ev) {
  if (job.status === 'done' || job.status === 'error') return;
  job.status = ev.kind === 'error' ? 'error' : 'done';
  pushEvent(job, ev);
  pushEvent(job, { kind: 'status', status: job.status, text: job.status });
  releaseSlot(job);
}

// Success path: emit result, then (write mode) compute the diff review, then done.
async function completeJob(job, resultEv) {
  if (job.status === 'done' || job.status === 'error') return;
  pushEvent(job, resultEv);

  if (job.mode === 'write' && !resultEv.isError && job.snapshot) {
    try {
      const changes = [];
      for (const name of PROTECTED_FILES) {
        const before = job.snapshot.files[name];
        let after = null;
        try {
          after = await fsp.readFile(path.join(DATA_ROOT, name), 'utf8');
        } catch {
          after = null;
        }
        if (after != null && before !== after) changes.push({ name, before: before ?? '', after });
      }
      if (changes.length) {
        job.review = { changes, reverted: false, kept: false };
        pushEvent(job, { kind: 'review', changeCount: changes.length, files: changes.map((c) => c.name) });
      }
    } catch (e) {
      pushEvent(job, { kind: 'debug', text: 'review computation failed: ' + e.message });
    }
  }

  job.status = 'done';
  pushEvent(job, { kind: 'status', status: 'done', text: 'done' });
  releaseSlot(job);
}

function releaseSlot(job) {
  if (job._released) return;
  job._released = true;
  running = Math.max(0, running - 1);
  drain();
}

export function getJob(id) {
  return jobs.get(id);
}

export function getReview(id) {
  return jobs.get(id)?.review ?? null;
}

export async function revertJob(id) {
  const job = jobs.get(id);
  if (!job?.review || job.review.reverted) return false;
  for (const c of job.review.changes) {
    await fsp.writeFile(path.join(DATA_ROOT, c.name), c.before, 'utf8');
  }
  job.review.reverted = true;
  return true;
}

export function keepJob(id) {
  const job = jobs.get(id);
  if (!job?.review) return false;
  job.review.kept = true;
  return true;
}

export function cancelJob(id) {
  const job = jobs.get(id);
  if (job?.child && job.status === 'running') {
    job.child.kill('SIGTERM');
    finishJob(job, { kind: 'error', text: 'cancelled by user' });
    return true;
  }
  return false;
}

// Ensure the backups directory exists at startup.
try {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
} catch {
  /* ignore */
}
