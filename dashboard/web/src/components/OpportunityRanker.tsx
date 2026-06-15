import { useQuery } from '@tanstack/react-query';
import { fetchAnalytics, fetchEarnings, fetchPortfolio, type EarningsEvent } from '../lib/api';
import { fmtEur, fmtPct, pnlColor } from '../lib/format';
import { Card } from './Card';

const TODAY = new Date().toISOString().slice(0, 10);

function daysTo(date: string): number {
  return Math.round((new Date(date + 'T00:00:00').getTime() - Date.now()) / 86_400_000);
}

// Higher = stronger redeploy candidate (dead money). Each sub-score in [0,1].
function pnlScore(pct: number): number {
  if (pct <= 0) return 1;
  if (pct < 10) return 0.55;
  if (pct < 30) return 0.2;
  return 0;
}
function momScore(r: number | null): number {
  if (r == null) return 0.4;
  if (r <= -5) return 1;
  if (r < 0) return 0.6;
  if (r < 5) return 0.3;
  return 0;
}
function catScore(days: number | null): number {
  if (days == null) return 0.8; // no catalyst on the calendar
  if (days <= 14) return 0;
  if (days <= 45) return 0.35;
  return 0.7;
}

function verdict(score: number): { label: string; cls: string } {
  if (score >= 0.6) return { label: 'Review — opp. cost', cls: 'text-[var(--neg)]' };
  if (score >= 0.35) return { label: 'Monitor', cls: 'text-[var(--accent-2)]' };
  return { label: 'Keep', cls: 'text-[var(--pos)]' };
}

export function OpportunityRanker() {
  const { data: pf, isLoading } = useQuery({ queryKey: ['portfolio'], queryFn: fetchPortfolio });
  const { data: a } = useQuery({ queryKey: ['analytics', '1y'], queryFn: () => fetchAnalytics('1y') });
  const { data: earn } = useQuery({ queryKey: ['earnings'], queryFn: fetchEarnings });

  if (isLoading) return <Card title="Opportunity cost"><div className="skeleton h-[200px]" /></Card>;
  if (!pf) return null;

  // soonest upcoming catalyst per ticker
  const nextCat: Record<string, number> = {};
  for (const [k, v] of Object.entries(earn ?? {})) {
    if (!k.startsWith('calendar_') || !Array.isArray(v)) continue;
    for (const e of v as EarningsEvent[]) {
      if (e.ticker && e.date && e.date >= TODAY) {
        const d = daysTo(e.date);
        if (nextCat[e.ticker] == null || d < nextCat[e.ticker]) nextCat[e.ticker] = d;
      }
    }
  }

  const rows = pf.holdings
    .map((h) => {
      const mom = a?.ret1mo?.[h.ticker] ?? null;
      const cat = nextCat[h.ticker] ?? null;
      const score = +(0.4 * pnlScore(h.unrealized_pnl_pct) + 0.3 * momScore(mom) + 0.3 * catScore(cat)).toFixed(2);
      return { h, mom, cat, score, v: verdict(score) };
    })
    .sort((x, y) => y.score - x.score);

  return (
    <Card title="Opportunity cost · redeploy candidates" right={<span>flat / no-catalyst / weak = review</span>}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="label">
              <th className="py-1.5 pr-3 text-left">Position</th>
              <th className="py-1.5 pr-3 text-right">P&L%</th>
              <th className="py-1.5 pr-3 text-right">1mo</th>
              <th className="py-1.5 pr-3 text-right">Next cat.</th>
              <th className="py-1.5 pr-3 text-right">Capital</th>
              <th className="py-1.5 pr-3 text-right">Score</th>
              <th className="py-1.5 text-right">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ h, mom, cat, score, v }) => (
              <tr key={h.ticker} className="border-t border-white/5">
                <td className="py-2 pr-3">
                  <span className="font-semibold text-slate-100">{h.ticker}</span>
                  <span className="ml-2 tnum text-[11px] text-slate-500">{fmtPct(h.weight_pct_of_total, false)}</span>
                </td>
                <td className={`tnum py-2 pr-3 text-right ${pnlColor(h.unrealized_pnl_pct)}`}>{fmtPct(h.unrealized_pnl_pct)}</td>
                <td className={`tnum py-2 pr-3 text-right ${pnlColor(mom ?? 0)}`}>{mom != null ? fmtPct(mom) : '—'}</td>
                <td className="tnum py-2 pr-3 text-right text-slate-300">{cat != null ? `${cat}d` : 'none'}</td>
                <td className="tnum py-2 pr-3 text-right text-slate-300">{fmtEur(h.market_value_eur)}</td>
                <td className="py-2 pr-3">
                  <div className="ml-auto h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${score * 100}%`, background: score >= 0.6 ? 'var(--neg)' : score >= 0.35 ? 'var(--accent)' : 'var(--pos)' }}
                    />
                  </div>
                </td>
                <td className={`py-2 text-right text-[11px] ${v.cls}`}>{v.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Score = 40% P&L state + 30% 1-month momentum + 30% catalyst proximity. High = capital working hard
        elsewhere — a candidate to redeploy on opportunity-cost grounds (an intact thesis isn't itself a reason to hold).
      </p>
    </Card>
  );
}
