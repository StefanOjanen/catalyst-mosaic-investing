import { useQuery } from '@tanstack/react-query';
import { fetchGoals, type Goal, type Portfolio } from '../lib/api';
import { useLivePortfolio } from '../lib/useLivePortfolio';
import { fmtEur } from '../lib/format';
import { Card } from './Card';

function currentValue(g: Goal, pf: Portfolio): number {
  if (g.type === 'realized_pnl') return pf.totals.realized_pnl_ytd_eur_estimate;
  if (g.type === 'cash') return pf.totals.cash_eur;
  return pf.totals.total_book_eur;
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86_400_000);
}

const TODAY = new Date().toISOString().slice(0, 10);

function GoalRow({ g, pf }: { g: Goal; pf: Portfolio }) {
  const cur = currentValue(g, pf);
  const gap = g.target_eur - cur;
  const span = g.target_eur - g.baseline_eur;
  const progress = span > 0 ? Math.max(0, Math.min(((cur - g.baseline_eur) / span) * 100, 100)) : 100;
  const daysLeft = daysBetween(TODAY, g.target_date);
  const sessions = Math.max(1, Math.round((daysLeft * 5) / 7));
  const reqPct = cur > 0 ? (gap / cur) * 100 : 0;

  const elapsed = Math.max(1, daysBetween(g.baseline_date, TODAY));
  const pacePerDay = (cur - g.baseline_eur) / elapsed;
  const projected = cur + pacePerDay * Math.max(0, daysLeft);

  let verdict: { label: string; cls: string };
  if (cur >= g.target_eur) verdict = { label: 'HIT', cls: 'text-[var(--pos)]' };
  else if (daysLeft < 0) verdict = { label: 'MISSED', cls: 'text-[var(--neg)]' };
  else if (projected >= g.target_eur) verdict = { label: 'On track', cls: 'text-[var(--pos)]' };
  else verdict = { label: `Behind ${fmtEur(g.target_eur - projected)}`, cls: 'text-[var(--accent-2)]' };

  const blocks = Math.round(progress / 10);
  const bar = '▓'.repeat(blocks) + '░'.repeat(10 - blocks);

  return (
    <div className="rounded-md border border-[var(--border)] bg-white/[0.02] p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-slate-100">{g.label}</span>
        <span className={`text-[11px] ${verdict.cls}`}>{verdict.label}</span>
      </div>
      <div className="mt-1 text-[12px] text-slate-300">
        <span className="tnum text-slate-100">{fmtEur(cur)}</span>
        <span className="text-slate-600"> → {fmtEur(g.target_eur)}</span>
        <span className="tnum ml-2 text-slate-400">gap {fmtEur(gap)}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="tnum text-[12px] text-[var(--accent)]">{bar}</span>
        <span className="tnum text-[11px] text-slate-400">{progress.toFixed(0)}%</span>
      </div>
      <div className="mt-1 text-[11px] text-slate-500">
        {daysLeft >= 0 ? (
          <>
            {sessions} sessions left · need {reqPct > 0 ? `+${reqPct.toFixed(1)}%` : 'nothing'} · by {g.target_date}
          </>
        ) : (
          <>target date {g.target_date} passed</>
        )}
      </div>
    </div>
  );
}

export function GoalsPanel() {
  const { data: goals, isLoading, error } = useQuery({ queryKey: ['goals'], queryFn: fetchGoals });
  const { data: pf } = useLivePortfolio();

  if (isLoading) return <Card title="Goals"><div className="skeleton h-16" /></Card>;
  if (error) return null; // goals.json optional — hide on error
  const active = (goals?.goals ?? []).filter((g) => g.status === 'active');

  return (
    <Card title="Goals" right={<span>set via /invest:goal</span>}>
      {!pf || active.length === 0 ? (
        <p className="text-[11px] text-slate-500">
          No active goal. Set one in chat: <code className="text-[var(--accent-2)]">/invest:goal set 50000 by 2026-09-30</code>
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {active.map((g) => (
            <GoalRow key={g.id} g={g} pf={pf} />
          ))}
        </div>
      )}
    </Card>
  );
}
