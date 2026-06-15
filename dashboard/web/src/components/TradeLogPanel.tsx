import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTradeLog, type TradeLogEntry } from '../lib/api';
import { fmtEur, fmtNum } from '../lib/format';
import { Card } from './Card';

function Entry({ e }: { e: TradeLogEntry }) {
  const [open, setOpen] = useState(false);
  const rationale = e.pm_rationale || e.execution_commentary || e.summary;

  if (e.event === 'session_summary') {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-800/20 px-3 py-2">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          session summary · {e.logged_on as string}
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{e.summary}</p>
      </div>
    );
  }

  const isBuy = String(e.event).includes('buy');
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-800/30 px-3 py-2">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
        <div className="text-sm">
          <span className={`mr-1.5 rounded px-1 py-0.5 text-[10px] ${isBuy ? 'bg-emerald-900/50 text-emerald-300' : 'bg-rose-900/50 text-rose-300'}`}>
            {isBuy ? 'BUY' : 'SELL'}
          </span>
          <span className="font-semibold text-slate-100">{e.ticker}</span>
          {e.shares != null && (
            <span className="ml-1.5 text-slate-400">
              {e.shares} sh @ ${fmtNum(e.price_local)}
            </span>
          )}
        </div>
        <div className="text-right text-[11px] text-slate-400">
          {e.net_eur != null && <div className="tabular-nums">{fmtEur(e.net_eur)}</div>}
          <div className="text-slate-600">{(e.date_trade as string) || (e.logged_on as string)}</div>
        </div>
      </button>
      {open && rationale && <p className="mt-1.5 border-t border-slate-800 pt-1.5 text-[11px] leading-snug text-slate-400">{rationale}</p>}
    </div>
  );
}

export function TradeLogPanel() {
  const { data, isLoading, error } = useQuery({ queryKey: ['trade-log'], queryFn: fetchTradeLog });
  if (isLoading) return <Card title="Trade log">Loading…</Card>;
  if (error) return <Card title="Trade log"><span className="text-rose-400">{String(error)}</span></Card>;
  return (
    <Card title="Trade log" right={<span>{data?.length ?? 0} entries</span>}>
      <div className="space-y-2">
        {(data ?? []).map((e, i) => (
          <Entry key={i} e={e} />
        ))}
      </div>
    </Card>
  );
}
