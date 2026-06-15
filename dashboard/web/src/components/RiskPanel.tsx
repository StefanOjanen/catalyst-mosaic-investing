import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAnalytics, fetchPortfolio } from '../lib/api';
import { fmtEur } from '../lib/format';
import { Card } from './Card';

function corrColor(v: number | null): string {
  if (v == null) return 'transparent';
  if (v >= 0) {
    const t = Math.min(v, 1);
    return `rgba(255, ${Math.round(160 - 70 * t)}, ${Math.round(40 * (1 - t))}, ${(0.1 + 0.55 * t).toFixed(2)})`;
  }
  const t = Math.min(-v, 1);
  return `rgba(76, 194, 255, ${(0.1 + 0.4 * t).toFixed(2)})`;
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className={`tnum mt-1 text-[18px] font-semibold leading-none ${tone ?? 'text-slate-100'}`}>{value}</div>
      {sub && <div className="mt-1 text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

const SHOCKS = [-5, -10, -20];

export function RiskPanel() {
  const { data: a, isLoading, error } = useQuery({ queryKey: ['analytics', '1y'], queryFn: () => fetchAnalytics('1y') });
  const { data: pf } = useQuery({ queryKey: ['portfolio'], queryFn: fetchPortfolio });
  const [shock, setShock] = useState(-10);

  if (isLoading) return <Card title="Risk & exposure"><div className="skeleton h-[260px]" /></Card>;
  if (error) return <Card title="Risk & exposure"><span className="text-rose-400">{String(error)}</span></Card>;
  if (!a) return null;

  const p = a.portfolio;
  const book = pf?.totals.total_book_eur ?? 0;
  const estPct = p.betaSoxx * shock;
  const estEur = (book * estPct) / 100;

  return (
    <div className="flex flex-col gap-5">
      <Card title="Portfolio risk" right={<span>{a.nDays}d · vs SOXX/SPY</span>}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat
            label="Effective bets"
            value={`${p.effectiveBets}`}
            sub={`of ${a.tickers.length} positions`}
            tone={p.effectiveBets < a.tickers.length * 0.6 ? 'text-[var(--accent-2)]' : undefined}
          />
          <Stat
            label="Avg correlation"
            value={p.avgCorr != null ? p.avgCorr.toFixed(2) : '—'}
            sub="pairwise"
            tone={p.avgCorr != null && p.avgCorr > 0.5 ? 'text-[var(--neg)]' : undefined}
          />
          <Stat label="Portfolio β" value={`${p.betaSoxx}`} sub={`SOXX · ${p.betaSpy} SPY`} />
          <Stat label="Diversification" value={p.diversificationRatio != null ? `${p.diversificationRatio}×` : '—'} sub="wtd vol ÷ port vol" />
          <Stat label="Annualized vol" value={`${p.vol}%`} sub="portfolio" tone={p.vol > 40 ? 'text-[var(--accent-2)]' : undefined} />
        </div>

        <div className="mt-4 rounded-md border border-[var(--border)] bg-white/[0.02] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="label">Scenario · SOXX shock</span>
            <div className="flex gap-1">
              {SHOCKS.map((s) => (
                <button
                  key={s}
                  onClick={() => setShock(s)}
                  className={`rounded px-2 py-0.5 text-[11px] ${
                    shock === s ? 'bg-[rgba(255,168,40,0.16)] text-[var(--accent-2)]' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {s}%
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-[12px] text-slate-400">SOXX {shock}% →</span>
            <span className="tnum text-[20px] font-semibold text-[var(--neg)]">{estPct.toFixed(1)}%</span>
            <span className="tnum text-[14px] text-[var(--neg)]">{fmtEur(estEur)}</span>
            <span className="text-[10px] text-slate-600">est. via portfolio β (cash unaffected)</span>
          </div>
        </div>
      </Card>

      <Card title="Correlation matrix" right={<span>amber = moves together</span>}>
        <div className="overflow-x-auto">
          <div
            className="inline-grid gap-px text-[10px]"
            style={{ gridTemplateColumns: `2.6rem repeat(${a.tickers.length}, 2.4rem)` }}
          >
            <div />
            {a.tickers.map((t) => (
              <div key={t} className="px-1 py-1 text-center font-semibold text-slate-400">{t}</div>
            ))}
            {a.tickers.map((row, i) => (
              <Row key={row} row={row} i={i} a={a} />
            ))}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          The hottest pair is your real concentration — names that move together aren't two bets, they're one.
          Low/negative cells are the genuine diversifiers.
        </p>
      </Card>
    </div>
  );
}

function Row({ row, i, a }: { row: string; i: number; a: import('../lib/api').Analytics }) {
  return (
    <>
      <div className="flex items-center px-1 font-semibold text-slate-400">{row}</div>
      {a.tickers.map((col, j) => {
        const v = a.corr[i][j];
        const diag = i === j;
        return (
          <div
            key={col}
            className="tnum flex items-center justify-center py-1.5 text-slate-200"
            style={{ background: diag ? 'rgba(255,255,255,0.05)' : corrColor(v) }}
            title={`${row} ↔ ${col}: ${v ?? 'n/a'}`}
          >
            {diag ? '·' : v != null ? v.toFixed(2) : '—'}
          </div>
        );
      })}
    </>
  );
}
