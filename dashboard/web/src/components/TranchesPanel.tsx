import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTranches, type TrancheEntry } from '../lib/api';
import { Card } from './Card';

function WeightBar({ current, target }: { current?: number; target?: number }) {
  const cur = current ?? 0;
  const tgt = target ?? 0;
  const max = Math.max(cur, tgt, 1) * 1.15;
  const over = tgt > 0 && cur > tgt * 1.5;
  return (
    <div className="relative h-2 w-full rounded bg-slate-800">
      <div
        className={`h-2 rounded ${over ? 'bg-rose-400' : 'bg-[var(--accent)]'}`}
        style={{ width: `${Math.min((cur / max) * 100, 100)}%` }}
      />
      {tgt > 0 && (
        <div
          className="absolute -top-0.5 h-3 w-0.5 bg-slate-300"
          style={{ left: `${(tgt / max) * 100}%` }}
          title={`target ${tgt}%`}
        />
      )}
    </div>
  );
}

function TrancheRow({ ticker, t }: { ticker: string; t: TrancheEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-800/30 px-3 py-2">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-semibold text-slate-100">{ticker}</span>
            <span className="ml-2 text-[11px] text-slate-500">{t.tranche_type}</span>
          </div>
          <div className="text-[11px] tabular-nums text-slate-400">
            {t.current_weight_pct?.toFixed(1)}% <span className="text-slate-600">/ {t.thematic_target_weight_pct}%</span>
          </div>
        </div>
        <div className="mt-1.5">
          <WeightBar current={t.current_weight_pct} target={t.thematic_target_weight_pct} />
        </div>
        {t.thesis_short && <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{t.thesis_short}</p>}
      </button>
      {t.concentration_alert && (
        <div className="mt-1.5 rounded border border-rose-500/15 bg-rose-500/[0.07] px-1.5 py-1 text-[11px] text-rose-300">
          {t.concentration_alert}
        </div>
      )}
      {open && (
        <div className="mt-2 space-y-1.5 border-t border-slate-800 pt-2">
          {t.thesis_horizon && (
            <div className="text-[11px] text-slate-500">
              horizon: <span className="text-slate-300">{t.thesis_horizon}</span>
            </div>
          )}
          {t.thesis_break_triggers && t.thesis_break_triggers.length > 0 && (
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Thesis-break triggers</div>
              <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[11px] text-slate-400">
                {t.thesis_break_triggers.map((tr, i) => (
                  <li key={i}>{tr}</li>
                ))}
              </ul>
            </div>
          )}
          {t.note && <p className="text-[11px] italic text-slate-500">{t.note}</p>}
        </div>
      )}
    </div>
  );
}

export function TranchesPanel() {
  const { data, isLoading, error } = useQuery({ queryKey: ['tranches'], queryFn: fetchTranches });
  if (isLoading) return <Card title="Tranches & theses">Loading…</Card>;
  if (error) return <Card title="Tranches & theses"><span className="text-rose-400">{String(error)}</span></Card>;
  const entries = Object.entries(data?.tranche_classification ?? {});
  return (
    <Card title="Tranches & theses" right={data?.last_updated ? <span>as of {data.last_updated}</span> : undefined}>
      <div className="space-y-2">
        {entries.map(([ticker, t]) => (
          <TrancheRow key={ticker} ticker={ticker} t={t} />
        ))}
      </div>
    </Card>
  );
}
