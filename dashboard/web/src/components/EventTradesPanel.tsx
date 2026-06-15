import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchEventTrades, type EventTrade } from '../lib/api';
import { Card } from './Card';

function daysUntil(dateStr?: string): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  const days = Math.round(ms / 86_400_000);
  if (days === 0) return 'today';
  if (days > 0) return `in ${days}d`;
  return `${-days}d ago`;
}

function renderRules(rules: unknown) {
  if (!rules) return null;
  if (typeof rules === 'string') return <p className="text-[11px] text-slate-400">{rules}</p>;
  if (typeof rules === 'object') {
    return (
      <ul className="space-y-0.5 text-[11px] text-slate-400">
        {Object.entries(rules as Record<string, unknown>).map(([k, v]) => (
          <li key={k}>
            <span className="text-slate-500">{k.replace(/_/g, ' ')}:</span>{' '}
            {typeof v === 'object' ? (v as any).action ?? JSON.stringify(v) : String(v)}
          </li>
        ))}
      </ul>
    );
  }
  return null;
}

function TradeRow({ trade }: { trade: EventTrade }) {
  const [open, setOpen] = useState(false);
  const countdown = daysUntil(trade.catalyst_date);
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-800/30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div>
          <span className="font-semibold text-slate-100">{trade.ticker}</span>
          <span className="ml-2 text-[11px] text-slate-500">{trade.catalyst_event}</span>
        </div>
        <div className="text-right text-[11px]">
          {trade.catalyst_date && (
            <div className="text-[var(--accent)]">
              {trade.catalyst_date}
              {countdown ? ` · ${countdown}` : ''}
            </div>
          )}
          <div className="text-slate-500">{open ? '▲' : '▼'}</div>
        </div>
      </button>
      {open && (
        <div className="space-y-2 border-t border-slate-800 px-3 py-2">
          {trade.thesis_at_entry && (
            <p className="text-[11px] leading-snug text-slate-400">{trade.thesis_at_entry}</p>
          )}
          {trade.status && (
            <div className="text-[11px] text-slate-500">
              status: <span className="text-slate-300">{trade.status}</span>
            </div>
          )}
          {trade.pre_committed_exit_rules ? (
            <div>
              <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Pre-committed exit rules
              </div>
              {renderRules(trade.pre_committed_exit_rules)}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function EventTradesPanel() {
  const { data, isLoading, error } = useQuery({ queryKey: ['event-trades'], queryFn: fetchEventTrades });
  const [showClosed, setShowClosed] = useState(false);

  if (isLoading) return <Card title="Event trades">Loading…</Card>;
  if (error) return <Card title="Event trades"><span className="text-rose-400">{String(error)}</span></Card>;
  if (!data) return null;

  const active = [
    ...(data.concentration_catalyst_trades ?? []),
    ...(data.active_event_trades ?? []),
  ].filter((t) => !String(t.status ?? '').startsWith('fully_closed') && !String(t.status ?? '').startsWith('closed'));
  const closed = [
    ...(data.active_event_trades ?? []),
    ...(data.concentration_catalyst_trades ?? []),
  ].filter((t) => String(t.status ?? '').includes('closed'));

  return (
    <Card title="Event trades" right={<span>{active.length} active</span>}>
      <div className="space-y-2">
        {active.length === 0 && <p className="text-xs text-slate-500">No open event trades.</p>}
        {active.map((t) => (
          <TradeRow key={t.id} trade={t} />
        ))}
      </div>

      {data.framework?.key_lesson && (
        <p className="mt-3 rounded bg-slate-800/40 px-2 py-1.5 text-[11px] italic text-slate-400">
          {data.framework.key_lesson}
        </p>
      )}

      {closed.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowClosed((s) => !s)}
            className="text-[11px] text-slate-500 hover:text-slate-300"
          >
            {showClosed ? '▼' : '▶'} {closed.length} closed
          </button>
          {showClosed && (
            <div className="mt-2 space-y-2 opacity-80">
              {closed.map((t) => (
                <TradeRow key={t.id} trade={t} />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
