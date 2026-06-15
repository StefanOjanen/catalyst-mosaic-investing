import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { fetchPortfolio, fetchPrices, type PricePoint } from '../lib/api';
import { fmtEur, fmtPct } from '../lib/format';
import { Card } from './Card';

const SERIES_COLORS = ['#ffa028', '#4cc2ff', '#2fd472', '#ffd23f', '#ff7847', '#9b8cff', '#5fd0c4', '#e0689a', '#c98aff'];
const BENCH = 'SPY';
const BENCH_COLOR = '#8a8f98';
const POS = '#2fd472';
const NEG = '#ff3b30';

const RANGES: { id: string; label: string }[] = [
  { id: '1mo', label: '1M' },
  { id: '3mo', label: '3M' },
  { id: '6mo', label: '6M' },
  { id: '1y', label: '1Y' },
];

const axisTick = { fill: '#9a948a', fontSize: 10 };
const tooltipStyle = {
  background: '#0c0c0e',
  border: '1px solid rgba(255,168,40,0.3)',
  borderRadius: 4,
  fontSize: 12,
};

function buildPerf(prices: Record<string, PricePoint[]>, symbols: string[]) {
  const bases: Record<string, number> = {};
  const bySym: Record<string, Record<string, number>> = {};
  const dates = new Set<string>();
  for (const s of symbols) {
    const arr = prices[s] ?? [];
    if (arr.length) bases[s] = arr[0].close;
    bySym[s] = {};
    for (const p of arr) {
      bySym[s][p.date] = p.close;
      dates.add(p.date);
    }
  }
  return [...dates].sort().map((date) => {
    const row: Record<string, number | string | null> = { date };
    for (const s of symbols) {
      const c = bySym[s][date];
      row[s] = c != null && bases[s] ? Number((((c as number) / bases[s] - 1) * 100).toFixed(2)) : null;
    }
    return row;
  });
}

function Performance({ tickers }: { tickers: string[] }) {
  const [range, setRange] = useState('6mo');
  const symbols = [...tickers, BENCH];
  const { data, isLoading } = useQuery({
    queryKey: ['prices', range, symbols.join(',')],
    queryFn: () => fetchPrices(symbols, range),
    enabled: tickers.length > 0,
    staleTime: 30 * 60 * 1000,
  });

  const rows = data ? buildPerf(data, symbols) : [];

  return (
    <Card
      title="Performance · normalized %"
      right={
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`rounded px-2 py-0.5 text-[11px] ${
                range === r.id ? 'bg-[rgba(255,168,40,0.16)] text-[var(--accent-2)]' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      }
    >
      {isLoading ? (
        <div className="skeleton h-[280px]" />
      ) : (
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                tick={axisTick}
                minTickGap={48}
                tickFormatter={(d: string) => d.slice(5)}
                stroke="rgba(255,255,255,0.12)"
              />
              <YAxis tick={axisTick} tickFormatter={(v: number) => `${v}%`} stroke="rgba(255,255,255,0.12)" width={44} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: '#9a948a' }}
                formatter={(v: number, name: string) => [`${v > 0 ? '+' : ''}${v}%`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
              {tickers.map((t, i) => (
                <Line
                  key={t}
                  type="monotone"
                  dataKey={t}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                />
              ))}
              <Line
                key={BENCH}
                type="monotone"
                dataKey={BENCH}
                stroke={BENCH_COLOR}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function Allocation({ holdings }: { holdings: { ticker: string; weight_pct_of_total: number }[] }) {
  const data = [...holdings]
    .sort((a, b) => b.weight_pct_of_total - a.weight_pct_of_total)
    .map((h) => ({ name: h.ticker, value: Number(h.weight_pct_of_total.toFixed(2)) }));
  return (
    <Card title="Allocation · % of book">
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={84} paddingAngle={1} stroke="none">
              {data.map((_, i) => (
                <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`${v}%`, n]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function PnlTooltip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; pnl: number } }[] }) {
  if (!active || !payload?.length) return null;
  const { name, pnl } = payload[0].payload;
  return (
    <div style={{ ...tooltipStyle, padding: '5px 10px' }}>
      <span style={{ color: '#e6e3da', fontWeight: 600, marginRight: 8 }}>{name}</span>
      <span className="tnum" style={{ color: pnl >= 0 ? POS : NEG }}>{fmtEur(pnl)}</span>
    </div>
  );
}

function PnlByPosition({ holdings }: { holdings: { ticker: string; unrealized_pnl_eur: number }[] }) {
  const data = [...holdings]
    .sort((a, b) => a.unrealized_pnl_eur - b.unrealized_pnl_eur)
    .map((h) => ({ name: h.ticker, pnl: Math.round(h.unrealized_pnl_eur) }));
  return (
    <Card title="Unrealized P&L · €">
      <div className="h-[264px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 28, bottom: 8, left: 12 }} barCategoryGap="24%">
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" horizontal={false} />
            <XAxis type="number" tick={axisTick} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} stroke="rgba(255,255,255,0.12)" />
            <YAxis type="category" dataKey="name" tick={axisTick} width={48} tickMargin={8} stroke="rgba(255,255,255,0.12)" />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<PnlTooltip />} />
            <Bar dataKey="pnl" radius={[0, 2, 2, 0]} maxBarSize={22}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.pnl >= 0 ? POS : NEG} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ClusterExposure({ c }: { c: Record<string, number | string> }) {
  const data = [
    { name: 'AI-compute / semis', v: Number(c.ai_compute_semis_pct_of_equity) || 0, cap: 55 },
    { name: 'AI-power', v: Number(c.ai_power_pct_of_equity) || 0, cap: 25 },
  ].filter((d) => d.v > 0);
  if (!data.length) return null;
  return (
    <Card title="Cluster exposure · % of equity">
      <div className="space-y-3">
        {data.map((d) => {
          const over = d.v > d.cap;
          return (
            <div key={d.name}>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-slate-300">{d.name}</span>
                <span className={`tnum ${over ? 'text-[var(--neg)]' : 'text-slate-400'}`}>
                  {fmtPct(d.v, false)} <span className="text-slate-600">/ {d.cap}% cap</span>
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-sm bg-white/[0.06]">
                <div
                  className={`h-full ${over ? 'bg-[var(--neg)]' : 'bg-[var(--accent)]'}`}
                  style={{ width: `${Math.min(d.v, 100)}%` }}
                />
                <div className="absolute top-0 h-full w-px bg-slate-300/60" style={{ left: `${d.cap}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function ChartsPanel() {
  const { data: pf, isLoading, error } = useQuery({ queryKey: ['portfolio'], queryFn: fetchPortfolio });

  if (isLoading) return <Card title="Charts"><div className="skeleton h-[280px]" /></Card>;
  if (error) return <Card title="Charts"><span className="text-rose-400">{String(error)}</span></Card>;
  if (!pf) return null;

  const tickers = pf.holdings.map((h) => h.ticker);

  return (
    <div className="flex flex-col gap-5">
      <Performance tickers={tickers} />
      <div className="grid gap-5 md:grid-cols-2">
        <Allocation holdings={pf.holdings} />
        <PnlByPosition holdings={pf.holdings} />
      </div>
      <ClusterExposure c={(pf.concentration ?? {}) as Record<string, number | string>} />
    </div>
  );
}
