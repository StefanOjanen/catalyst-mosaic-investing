import { type Holding } from '../lib/api';
import { useLivePortfolio } from '../lib/useLivePortfolio';
import { fmtEur, fmtNum, fmtPct, pnlColor } from '../lib/format';
import { Card } from './Card';

function MiniBar({ pct, max }: { pct: number; max: number }) {
  return (
    <div className="h-1 w-12 overflow-hidden rounded-full bg-white/5">
      <div
        className="h-full rounded-full bg-[var(--accent)]"
        style={{ width: `${Math.min((pct / max) * 100, 100)}%` }}
      />
    </div>
  );
}

function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  const rows = [...holdings].sort((a, b) => b.weight_pct_of_total - a.weight_pct_of_total);
  const maxWt = Math.max(...rows.map((r) => r.weight_pct_of_total), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="label">
            <th className="py-1.5 pr-3 text-left font-semibold">Position</th>
            <th className="py-1.5 pr-3 text-right font-semibold">Shares</th>
            <th className="py-1.5 pr-3 text-right font-semibold">Price</th>
            <th className="py-1.5 pr-3 text-right font-semibold">Value</th>
            <th className="py-1.5 pr-4 text-right font-semibold">Weight</th>
            <th className="py-1.5 pr-3 text-right font-semibold">P&L €</th>
            <th className="py-1.5 text-right font-semibold">P&L %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => {
            const alert = h.concentration_alert || h.drawdown_alert;
            return (
              <tr key={h.ticker} className="group align-top transition-colors hover:bg-white/[0.025]">
                <td className="border-t border-white/5 py-2.5 pr-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-50">{h.ticker}</span>
                    <span className="text-[11px] text-slate-500">{h.name}</span>
                  </div>
                  {h.next_catalyst && (
                    <div className="mt-0.5 max-w-[17rem] truncate text-[11px] text-[var(--accent)]" title={h.next_catalyst}>
                      {h.next_catalyst}
                    </div>
                  )}
                  {alert && (
                    <div className="mt-1 max-w-[20rem] rounded-md border border-rose-500/15 bg-rose-500/[0.07] px-1.5 py-0.5 text-[11px] text-rose-300/90">
                      {alert}
                    </div>
                  )}
                </td>
                <td className="tnum border-t border-white/5 py-2.5 pr-3 text-right text-slate-300">{h.shares}</td>
                <td className="tnum border-t border-white/5 py-2.5 pr-3 text-right text-slate-300">
                  ${fmtNum(h.price_local)}
                </td>
                <td className="tnum border-t border-white/5 py-2.5 pr-3 text-right text-slate-100">
                  {fmtEur(h.market_value_eur)}
                </td>
                <td className="border-t border-white/5 py-2.5 pr-4">
                  <div className="flex items-center justify-end gap-2">
                    <span className="tnum text-slate-300">{fmtPct(h.weight_pct_of_total, false)}</span>
                    <MiniBar pct={h.weight_pct_of_total} max={maxWt} />
                  </div>
                </td>
                <td className={`tnum border-t border-white/5 py-2.5 pr-3 text-right ${pnlColor(h.unrealized_pnl_eur)}`}>
                  {fmtEur(h.unrealized_pnl_eur)}
                </td>
                <td className={`tnum border-t border-white/5 py-2.5 text-right ${pnlColor(h.unrealized_pnl_pct)}`}>
                  {fmtPct(h.unrealized_pnl_pct)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ConcChip({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 ${
        warn ? 'border-rose-500/25 bg-rose-500/[0.06]' : 'border-white/[0.08] bg-white/[0.02]'
      }`}
    >
      <span className="label">{label}</span>
      <div className={`tnum text-sm font-semibold ${warn ? 'text-rose-300' : 'text-slate-200'}`}>{value}</div>
    </div>
  );
}

export function PortfolioPanel() {
  const { data, isLoading, error, isLive, asOf } = useLivePortfolio();

  if (isLoading)
    return (
      <Card title="Holdings">
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-9" />
          ))}
        </div>
      </Card>
    );
  if (error)
    return (
      <Card title="Holdings">
        <span className="text-rose-400">{String(error)}</span>
      </Card>
    );
  if (!data) return null;

  const c = (data.concentration ?? {}) as Record<string, number | string>;

  return (
    <Card
      title="Holdings"
      right={
        isLive ? (
          <span className="flex items-center gap-1 text-[var(--pos)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--pos)]" /> live{asOf ? ` · ${asOf.slice(11, 16)}` : ''}
          </span>
        ) : data.fx_snapshot ? (
          <span>USD/EUR {data.fx_snapshot.USD_EUR.toFixed(2)}</span>
        ) : undefined
      }
    >
      {(c.single_largest_position || c.memory_cluster_pct_of_equity != null) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {c.single_largest_position && (
            <ConcChip
              label={`Largest · ${c.single_largest_position}`}
              value={fmtPct(Number(c.single_largest_position_pct_of_total_book), false)}
              warn={Number(c.single_largest_position_pct_of_total_book) > 20}
            />
          )}
          {c.memory_cluster_pct_of_equity != null && (
            <ConcChip
              label="Memory cluster"
              value={fmtPct(Number(c.memory_cluster_pct_of_equity), false)}
              warn={Number(c.memory_cluster_pct_of_equity) > 40}
            />
          )}
          {c.ai_compute_semis_pct_of_equity != null && (
            <ConcChip
              label="AI-compute / semis"
              value={fmtPct(Number(c.ai_compute_semis_pct_of_equity), false)}
              warn={Number(c.ai_compute_semis_pct_of_equity) > 55}
            />
          )}
        </div>
      )}
      <HoldingsTable holdings={data.holdings} />
    </Card>
  );
}
