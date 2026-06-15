import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAnalytics, fetchEarnings, fetchEventTrades, type EarningsEvent, type EventTrade } from '../lib/api';
import { Card } from './Card';

const TODAY = new Date().toISOString().slice(0, 10);
const SQRT252 = Math.sqrt(252);

function daysTo(date: string): number {
  return Math.round((new Date(date + 'T00:00:00').getTime() - Date.now()) / 86_400_000);
}

function renderRules(rules: unknown) {
  if (!rules) return null;
  if (typeof rules === 'string') return <p className="text-[11px] leading-snug text-slate-400">{rules}</p>;
  if (typeof rules === 'object') {
    return (
      <ul className="space-y-0.5 text-[11px] text-slate-400">
        {Object.entries(rules as Record<string, unknown>).map(([k, val]) => (
          <li key={k}>
            <span className="text-slate-500">{k.replace(/_/g, ' ')}:</span>{' '}
            {typeof val === 'object' && val ? (val as { action?: string }).action ?? JSON.stringify(val) : String(val)}
          </li>
        ))}
      </ul>
    );
  }
  return null;
}

function CatalystCard({ e, trade, dailySigma }: { e: EarningsEvent; trade?: EventTrade; dailySigma?: number }) {
  const [open, setOpen] = useState(false);
  const d = e.date ? daysTo(e.date) : null;
  const plan = (trade as { next_decision_window?: string } | undefined)?.next_decision_window;
  return (
    <div className="rounded-md border border-[var(--border)] bg-white/[0.02] p-3">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[15px] font-semibold text-slate-50">{e.ticker}</span>
          {e.held && (
            <span className="ml-2 rounded border border-[rgba(255,168,40,0.3)] bg-[rgba(255,168,40,0.12)] px-1 py-0.5 text-[10px] text-[var(--accent-2)]">
              held
            </span>
          )}
          {!e.held && e.watchlist && (
            <span className="ml-2 rounded bg-slate-700/60 px-1 py-0.5 text-[10px] text-slate-300">watch</span>
          )}
          <div className="mt-0.5 text-[11px] text-slate-500">
            {e.period} {e.session ? `· ${e.session}` : ''}
          </div>
        </div>
        <div className="text-right">
          <div className="tnum text-[13px] text-[var(--accent)]">{e.date}</div>
          <div className="tnum text-[11px] text-slate-400">
            {d === 0 ? 'today' : d != null && d > 0 ? `in ${d}d` : `${d}d`}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-4 text-[11px]">
        {dailySigma != null && (
          <span className="text-slate-400">
            daily σ ≈ <span className="tnum text-slate-200">{dailySigma.toFixed(1)}%</span>{' '}
            <span className="text-slate-600">(vol ref)</span>
          </span>
        )}
        {trade && (
          <button onClick={() => setOpen((o) => !o)} className="text-[var(--accent-2)] hover:underline">
            {open ? 'hide rules' : 'pre-committed rules'}
          </button>
        )}
      </div>

      {plan && (
        <div className="mt-2 rounded border border-[rgba(255,168,40,0.18)] bg-[rgba(255,168,40,0.05)] px-2 py-1.5 text-[11px] text-slate-300">
          <span className="label text-[var(--accent-2)]">Plan</span>
          <div className="mt-0.5 leading-snug">{plan}</div>
        </div>
      )}

      {open && trade && (
        <div className="mt-2 border-t border-[var(--border)] pt-2">{renderRules(trade.pre_committed_exit_rules)}</div>
      )}
    </div>
  );
}

export function CatalystCenter() {
  const { data: earn, isLoading } = useQuery({ queryKey: ['earnings'], queryFn: fetchEarnings });
  const { data: et } = useQuery({ queryKey: ['event-trades'], queryFn: fetchEventTrades });
  const { data: a } = useQuery({ queryKey: ['analytics', '1y'], queryFn: () => fetchAnalytics('1y') });

  if (isLoading) return <Card title="Catalyst command center"><div className="skeleton h-[160px]" /></Card>;

  const events: EarningsEvent[] = [];
  for (const [k, v] of Object.entries(earn ?? {})) {
    if (k.startsWith('calendar_') && Array.isArray(v)) events.push(...(v as EarningsEvent[]));
  }
  const upcoming = events
    .filter((e) => e.date && (e.date as string) >= TODAY && e.ticker)
    .sort((x, y) => (x.date! < y.date! ? -1 : 1))
    .slice(0, 8);

  const tradeByTicker: Record<string, EventTrade> = {};
  for (const t of [...(et?.concentration_catalyst_trades ?? []), ...(et?.active_event_trades ?? [])]) {
    if (t.ticker && !tradeByTicker[t.ticker]) tradeByTicker[t.ticker] = t;
  }

  return (
    <Card title="Catalyst command center" right={<span>{upcoming.length} upcoming</span>}>
      {upcoming.length === 0 ? (
        <p className="text-xs text-slate-500">No confirmed upcoming prints.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {upcoming.map((e, i) => (
            <CatalystCard
              key={(e.ticker ?? '') + i}
              e={e}
              trade={e.ticker ? tradeByTicker[e.ticker] : undefined}
              dailySigma={e.ticker && a?.vol?.[e.ticker] != null ? a.vol[e.ticker] / SQRT252 : undefined}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
