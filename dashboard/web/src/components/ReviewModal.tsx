import { useEffect, useState } from 'react';
import { collapse, diffLines } from '../lib/diff';
import { getReview, keepWrite, revertWrite, type DiffChange } from '../lib/skill';

function FileDiff({ change }: { change: DiffChange }) {
  const lines = collapse(diffLines(change.before, change.after));
  const added = lines.filter((l) => 'type' in l && l.type === 'add').length;
  const removed = lines.filter((l) => 'type' in l && l.type === 'del').length;
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-xs text-slate-200">{change.name}</span>
        <span className="text-[11px]">
          <span className="text-emerald-400">+{added}</span> <span className="text-rose-400">−{removed}</span>
        </span>
      </div>
      <div className="max-h-72 overflow-auto rounded border border-slate-800 bg-slate-950/60 font-mono text-[11px] leading-relaxed">
        {lines.map((l, i) =>
          'count' in l ? (
            <div key={i} className="px-2 py-0.5 text-center text-slate-600">⋯ {l.count} unchanged ⋯</div>
          ) : (
            <div
              key={i}
              className={
                l.type === 'add'
                  ? 'bg-emerald-950/50 px-2 text-emerald-300'
                  : l.type === 'del'
                    ? 'bg-rose-950/50 px-2 text-rose-300'
                    : 'px-2 text-slate-500'
              }
            >
              <span className="select-none pr-2 text-slate-600">{l.type === 'add' ? '+' : l.type === 'del' ? '−' : ' '}</span>
              {l.text || ' '}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

export function ReviewModal({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [changes, setChanges] = useState<DiffChange[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getReview(jobId)
      .then((r) => alive && setChanges(r.changes))
      .catch(() => alive && setChanges([]));
    return () => {
      alive = false;
    };
  }, [jobId]);

  async function onRevert() {
    if (!window.confirm('Revert these file changes to the pre-run snapshot?')) return;
    setBusy(true);
    await revertWrite(jobId);
    setDone('reverted');
    setBusy(false);
  }

  async function onKeep() {
    setBusy(true);
    await keepWrite(jobId);
    setBusy(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">
            Review write {changes ? `· ${changes.length} file(s)` : ''}
          </h2>
          <span className="text-[11px] text-amber-400">snapshot saved · fully reversible</span>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {changes === null && <p className="text-xs text-slate-500">Loading diff…</p>}
          {changes !== null && changes.length === 0 && (
            <p className="text-xs text-slate-500">No file changes were detected.</p>
          )}
          {changes?.map((c) => (
            <FileDiff key={c.name} change={c} />
          ))}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-800 px-4 py-3">
          {done === 'reverted' ? (
            <>
              <span className="mr-auto text-xs text-rose-300">Reverted to snapshot.</span>
              <button onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300">
                Close
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onRevert}
                disabled={busy || !changes?.length}
                className="rounded-lg border border-rose-700 bg-rose-900/40 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-900/70 disabled:opacity-40"
              >
                Revert
              </button>
              <button
                onClick={onKeep}
                disabled={busy}
                className="rounded-lg border border-emerald-700 bg-emerald-900/40 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-900/70 disabled:opacity-40"
              >
                Keep changes
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
