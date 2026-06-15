import { useLivePortfolio } from '../lib/useLivePortfolio';
import { fmtEur, fmtPct, pnlColor } from '../lib/format';

function Satellite({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="kpi animate-in">
      <div className="label">{label}</div>
      <div className={`tnum mt-1 text-[19px] font-semibold leading-none ${tone ?? 'text-slate-100'}`}>{value}</div>
      {sub && <div className="mt-1.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function KpiHero() {
  const { data, isLoading, isLive, asOf } = useLivePortfolio();

  if (isLoading || !data) {
    return (
      <div className="grid gap-3 xl:grid-cols-[1.05fr_1.4fr]">
        <div className="skeleton h-[132px]" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-[60px]" />
          ))}
        </div>
      </div>
    );
  }

  const t = data.totals;
  const cashPct = t.total_book_eur ? (t.cash_eur / t.total_book_eur) * 100 : 0;
  const prog = data.progress_to_eoj_target;
  const progPct = prog ? Math.min((prog.current_book_eur / prog.target_book_eur) * 100, 100) : 0;

  return (
    <div className="grid gap-3 xl:grid-cols-[1.05fr_1.4fr]">
      {/* Featured */}
      <div className="kpi animate-in flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="label">Total Book</span>
              {isLive && (
                <span
                  className="flex items-center gap-1 text-[9px] text-[var(--pos)]"
                  title={asOf ? `live as of ${asOf}` : 'live'}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--pos)]" />
                  live{asOf ? ` ${asOf.slice(11, 16)}` : ''}
                </span>
              )}
            </div>
            <div className="tnum mt-1.5 text-[32px] font-medium leading-none text-slate-50">{fmtEur(t.total_book_eur)}</div>
          </div>
          <div className={`tnum text-right text-sm ${pnlColor(t.unrealized_pnl_eur)}`}>
            {fmtEur(t.unrealized_pnl_eur)}
            <div className="text-[11px] opacity-80">{fmtPct(t.unrealized_pnl_pct_on_cost)} unreal.</div>
          </div>
        </div>
        {prog && (
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${progPct}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
              <span>
                <span className="text-[var(--accent)]">{fmtEur(prog.gap_to_target_eur)}</span> to{' '}
                {fmtEur(prog.target_book_eur)}
              </span>
              <span>by {prog.target_date}</span>
            </div>
          </div>
        )}
      </div>

      {/* Satellites */}
      <div className="grid grid-cols-2 gap-3">
        <Satellite label="Equity" value={fmtEur(t.market_value_equities_eur)} sub={`${data.holdings.length} positions`} />
        <Satellite label="Cash" value={fmtEur(t.cash_eur)} sub={`${cashPct.toFixed(1)}% of book`} />
        <Satellite
          label="Realized YTD"
          value={fmtEur(t.realized_pnl_ytd_eur_estimate)}
          tone={pnlColor(t.realized_pnl_ytd_eur_estimate)}
        />
        <Satellite
          label="USD / EUR"
          value={data.fx_snapshot ? data.fx_snapshot.USD_EUR.toFixed(2) : '—'}
          sub="fx snapshot"
        />
      </div>
    </div>
  );
}
