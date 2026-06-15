import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAnalysts, fetchFunds, fetchWatchlist, type WatchlistRow } from '../lib/api';
import { Card } from './Card';

type Tab = 'watchlist' | 'funds' | 'analysts';

function fmtAum(n?: number): string {
  if (!n) return '';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n}`;
}

function findArrayByPrefix(obj: Record<string, unknown>, prefix: string): unknown[] {
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith(prefix) && Array.isArray(v)) return v;
  }
  return [];
}

type WlSort = 'held' | 'ticker' | 'name' | 'primary_exchange';

function Watchlist() {
  const { data, isLoading, error } = useQuery({ queryKey: ['watchlist'], queryFn: fetchWatchlist });
  const [sortKey, setSortKey] = useState<WlSort>('held');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  if (isLoading) return <span className="text-xs text-slate-500">Loading…</span>;
  if (error) return <span className="text-rose-400">{String(error)}</span>;

  const held = (r: WatchlistRow) => /HELD/i.test(r.notes);
  const rows = [...(data ?? [])].sort((a, b) => {
    const m = dir === 'asc' ? 1 : -1;
    if (sortKey === 'held') {
      const d = (held(b) ? 1 : 0) - (held(a) ? 1 : 0);
      return d !== 0 ? d * m : a.ticker.localeCompare(b.ticker);
    }
    return (a[sortKey] || '').toLowerCase().localeCompare((b[sortKey] || '').toLowerCase()) * m;
  });

  function sortBy(key: WlSort) {
    if (key === sortKey) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setDir(key === 'held' ? 'desc' : 'asc');
    }
  }
  const arrow = (key: WlSort) => (sortKey === key ? (dir === 'asc' ? ' ↑' : ' ↓') : '');
  const thCls = 'cursor-pointer select-none py-1 pr-3 hover:text-slate-200';

  return (
    <div className="overflow-x-auto">
      <div className="mb-1.5 flex items-center justify-between text-[10px] text-slate-600">
        <span>{rows.length} names</span>
        <span>click a column to sort</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
            <th className={`${thCls} text-center`} onClick={() => sortBy('held')} title="Held first">●{arrow('held')}</th>
            <th className={thCls} onClick={() => sortBy('ticker')}>Ticker{arrow('ticker')}</th>
            <th className={thCls} onClick={() => sortBy('name')}>Name{arrow('name')}</th>
            <th className={thCls} onClick={() => sortBy('primary_exchange')}>Exch{arrow('primary_exchange')}</th>
            <th className="py-1 pr-3">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-800/70 align-top">
              <td className="py-1.5 pr-2 text-center">{held(r) && <span className="text-[var(--accent-2)]">●</span>}</td>
              <td className="py-1.5 pr-3 font-semibold text-slate-100">{r.ticker}</td>
              <td className="py-1.5 pr-3 text-slate-300">{r.name}</td>
              <td className="py-1.5 pr-3 text-[11px] text-slate-500">{r.primary_exchange}</td>
              <td className="py-1.5 pr-3 text-[11px] text-slate-500">
                <span className="line-clamp-2">{r.notes?.replace(/^HELD$/, '')}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Funds() {
  const { data, isLoading, error } = useQuery({ queryKey: ['funds'], queryFn: fetchFunds });
  if (isLoading) return <span className="text-xs text-slate-500">Loading…</span>;
  if (error) return <span className="text-rose-400">{String(error)}</span>;
  const funds = (data?.tracked_funds as any[]) ?? [];
  return (
    <div className="space-y-3">
      {funds.map((f, i) => {
        const holdings = findArrayByPrefix(f, 'latest_known_top_holdings') as any[];
        return (
          <div key={i} className="rounded-lg border border-slate-800 bg-slate-800/30 px-3 py-2">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-slate-100">{f.name}</span>
              <span className="text-[11px] text-slate-500">{fmtAum(f.aum_usd)}</span>
            </div>
            <div className="text-[11px] text-slate-500">{f.manager}</div>
            {f.strategy_summary && <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">{f.strategy_summary}</p>}
            {holdings.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {holdings.slice(0, 14).map((h: any, j: number) => (
                  <span key={j} className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] text-slate-300" title={h.note}>
                    {h.ticker}
                    {h.delta ? ` ${h.delta === 'NEW' ? '🟢' : h.delta === 'ADDED' ? '+' : ''}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Analysts() {
  const { data, isLoading, error } = useQuery({ queryKey: ['analysts'], queryFn: fetchAnalysts });
  if (isLoading) return <span className="text-xs text-slate-500">Loading…</span>;
  if (error) return <span className="text-rose-400">{String(error)}</span>;
  const analysts = (data?.tracked_analysts as any[]) ?? [];
  return (
    <div className="space-y-3">
      {analysts.map((a, i) => {
        const pts = findArrayByPrefix(a, 'current_pt_baseline') as any[];
        return (
          <div key={i} className="rounded-lg border border-slate-800 bg-slate-800/30 px-3 py-2">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-slate-100">{a.name}</span>
              <span className="text-[11px] text-slate-500">{a.firm}</span>
            </div>
            {a.title && <div className="text-[11px] text-slate-500">{a.title}</div>}
            {pts.length > 0 && (
              <table className="mt-1.5 w-full text-[11px]">
                <tbody>
                  {pts.map((p: any, j: number) => (
                    <tr key={j} className="border-t border-slate-800/60">
                      <td className="py-0.5 pr-2 font-medium text-slate-200">{p.ticker}</td>
                      <td className="py-0.5 pr-2 text-slate-400">{p.rating}</td>
                      <td className="py-0.5 pr-2 text-right tabular-nums text-slate-300">${p.pt_usd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ListsPanel() {
  const [tab, setTab] = useState<Tab>('watchlist');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'watchlist', label: 'Watchlist' },
    { id: 'funds', label: 'Tracked funds' },
    { id: 'analysts', label: 'Analysts' },
  ];
  return (
    <Card
      title="Lists"
      right={
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded px-2 py-0.5 text-[11px] ${
                tab === t.id ? 'bg-[rgba(255,168,40,0.14)] text-[var(--accent-2)]' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {tab === 'watchlist' && <Watchlist />}
      {tab === 'funds' && <Funds />}
      {tab === 'analysts' && <Analysts />}
    </Card>
  );
}
