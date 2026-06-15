import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchEarnings, type EarningsEvent } from '../lib/api';
import { Card } from './Card';

const TODAY = new Date().toISOString().slice(0, 10);

function countdown(date: string): string {
  const d = new Date(date + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (days === 0) return 'today';
  if (days > 0) return `in ${days}d`;
  return `${-days}d ago`;
}

function ConfDot({ c }: { c?: string }) {
  const color = !c ? '#5f6677' : c.startsWith('confirmed') ? 'var(--pos)' : c.startsWith('estimated') ? 'var(--accent)' : '#5f6677';
  return <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} title={c} />;
}

function Row({ e }: { e: EarningsEvent }) {
  const label = e.ticker ?? e.ticker_group ?? (e.tickers_in_universe || []).join(', ');
  const when = e.date ?? e.date_window ?? '';
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/5 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <ConfDot c={e.confidence} />
        <span className="truncate font-semibold text-slate-100">{label}</span>
        {e.held && (
          <span className="rounded bg-[rgba(255,168,40,0.14)] px-1 py-0.5 text-[10px] text-[var(--accent-2)]">held</span>
        )}
        {!e.held && e.watchlist && <span className="rounded bg-white/[0.06] px-1 py-0.5 text-[10px] text-slate-400">watch</span>}
        {e.note && (
          <span className="cursor-help text-[11px] text-slate-600" title={e.note}>
            ⓘ
          </span>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="tnum text-[12px] text-slate-300">
          {when}
          {e.session ? ` · ${e.session}` : ''}
        </div>
        {e.date && <div className="text-[11px] text-slate-500">{countdown(e.date)}</div>}
      </div>
    </div>
  );
}

function Section({ label, count }: { label: string; count: number }) {
  return (
    <div className="mt-3 mb-0.5 flex items-center gap-2">
      <span className="label">{label}</span>
      <span className="text-[10px] text-slate-600">{count}</span>
      <div className="h-px flex-1 bg-white/5" />
    </div>
  );
}

export function EarningsPanel() {
  const { data, isLoading, error } = useQuery({ queryKey: ['earnings'], queryFn: fetchEarnings });
  const [showWindows, setShowWindows] = useState(false);
  const [showPast, setShowPast] = useState(false);

  if (isLoading) return <Card title="Full calendar"><div className="skeleton h-24" /></Card>;
  if (error) return <Card title="Full calendar"><span className="text-rose-400">{String(error)}</span></Card>;

  const all: EarningsEvent[] = [];
  for (const [k, v] of Object.entries(data ?? {})) {
    if (k.startsWith('calendar_') && Array.isArray(v)) all.push(...(v as EarningsEvent[]));
  }
  const dated = all.filter((e) => e.date);
  const upcoming = dated.filter((e) => (e.date as string) >= TODAY).sort((a, b) => (a.date! < b.date! ? -1 : 1));
  const past = dated.filter((e) => (e.date as string) < TODAY).sort((a, b) => (a.date! > b.date! ? -1 : 1));
  const windows = all.filter((e) => !e.date && (e.date_window || e.ticker_group));

  return (
    <Card title="Full calendar" right={<span>{upcoming.length} confirmed ahead</span>}>
      <Section label="Upcoming · confirmed" count={upcoming.length} />
      {upcoming.length === 0 && <p className="py-1 text-xs text-slate-500">None confirmed yet.</p>}
      {upcoming.map((e, i) => (
        <Row key={'u' + i} e={e} />
      ))}

      {windows.length > 0 && (
        <>
          <button
            onClick={() => setShowWindows((s) => !s)}
            className="mt-3 flex w-full items-center gap-2 text-left text-[11px] text-slate-500 hover:text-slate-300"
          >
            <span>{showWindows ? '▼' : '▶'}</span>
            <span className="label">Estimated windows</span>
            <span className="text-[10px] text-slate-600">{windows.length}</span>
            <div className="h-px flex-1 bg-white/5" />
          </button>
          {showWindows && (
            <div className="opacity-75">
              {windows.map((e, i) => (
                <Row key={'w' + i} e={e} />
              ))}
            </div>
          )}
        </>
      )}

      {past.length > 0 && (
        <>
          <button
            onClick={() => setShowPast((s) => !s)}
            className="mt-3 flex w-full items-center gap-2 text-left text-[11px] text-slate-500 hover:text-slate-300"
          >
            <span>{showPast ? '▼' : '▶'}</span>
            <span className="label">Recent prints</span>
            <span className="text-[10px] text-slate-600">{past.length}</span>
            <div className="h-px flex-1 bg-white/5" />
          </button>
          {showPast && (
            <div className="opacity-60">
              {past.map((e, i) => (
                <Row key={'p' + i} e={e} />
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
