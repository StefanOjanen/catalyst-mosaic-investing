export type SkillEvent =
  | { kind: 'status'; status: string; text?: string; mode?: string }
  | { kind: 'session'; sessionId: string }
  | { kind: 'assistant_text'; text: string }
  | { kind: 'tool'; name: string; summary?: string }
  | { kind: 'result'; text: string; isError: boolean; cost?: number | null; durationMs?: number | null }
  | { kind: 'review'; changeCount: number; files: string[] }
  | { kind: 'error'; text: string }
  | { kind: 'debug'; text: string };

export interface DiffChange {
  name: string;
  before: string;
  after: string;
}

export async function getReview(jobId: string): Promise<{ changes: DiffChange[]; reverted: boolean; kept: boolean }> {
  const r = await fetch(`/api/skill/${jobId}/review`);
  if (!r.ok) throw new Error('no review available');
  return r.json();
}

export async function revertWrite(jobId: string): Promise<void> {
  await fetch(`/api/skill/${jobId}/revert`, { method: 'POST' });
}

export async function keepWrite(jobId: string): Promise<void> {
  await fetch(`/api/skill/${jobId}/keep`, { method: 'POST' });
}

export interface StartResult {
  jobId: string;
  sessionId: string | null;
}

export async function startSkill(prompt: string, sessionId: string | null): Promise<StartResult> {
  const res = await fetch('/api/skill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, sessionId }),
  });
  if (!res.ok) throw new Error(`Failed to start skill (${res.status})`);
  return res.json();
}

export function cancelSkill(jobId: string): void {
  void fetch(`/api/skill/${jobId}/cancel`, { method: 'POST' });
}
