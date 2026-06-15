import { useQuery } from '@tanstack/react-query';
import { fetchPortfolio, fetchQuotes, type Portfolio } from './api';

// Portfolio marked to live prices: market values / totals recomputed from
// shares × live price × FX, falling back to stored values when a quote is missing.
export function useLivePortfolio(): {
  data?: Portfolio;
  isLive: boolean;
  asOf?: string;
  isLoading: boolean;
  error: unknown;
} {
  const pfQ = useQuery({ queryKey: ['portfolio'], queryFn: fetchPortfolio });
  const tickers = pfQ.data?.holdings.map((h) => h.ticker) ?? [];
  const qQ = useQuery({
    queryKey: ['quotes', tickers.join(',')],
    queryFn: () => fetchQuotes(tickers),
    enabled: tickers.length > 0,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (!pfQ.data) return { data: undefined, isLive: false, isLoading: pfQ.isLoading, error: pfQ.error };
  const pf = pfQ.data;
  const q = qQ.data;
  if (!q) return { data: pf, isLive: false, isLoading: false, error: null };

  const usdPerEur = q.usd_per_eur || pf.fx_snapshot?.USD_EUR || 1.16;
  let any = false;
  const holdings = pf.holdings.map((h) => {
    const live = q.quotes[h.ticker];
    if (live == null) return h;
    any = true;
    const toEur = h.price_ccy === 'EUR' ? 1 : 1 / usdPerEur;
    const mv = h.shares * live * toEur;
    const upnl = mv - h.cost_basis_eur;
    return {
      ...h,
      price_local: live,
      market_value_eur: mv,
      unrealized_pnl_eur: upnl,
      unrealized_pnl_pct: h.cost_basis_eur ? (upnl / h.cost_basis_eur) * 100 : 0,
    };
  });

  if (!any) return { data: pf, isLive: false, isLoading: false, error: null };

  const equities = holdings.reduce((s, h) => s + h.market_value_eur, 0);
  const totalBook = equities + pf.totals.cash_eur;
  const costTotal = pf.totals.cost_basis_total_eur;
  const upnlTotal = equities - costTotal;
  const reweighted = holdings.map((h) => ({
    ...h,
    weight_pct_of_equity: equities ? (h.market_value_eur / equities) * 100 : 0,
    weight_pct_of_total: totalBook ? (h.market_value_eur / totalBook) * 100 : 0,
  }));

  const live: Portfolio = {
    ...pf,
    fx_snapshot: { USD_EUR: usdPerEur },
    holdings: reweighted,
    totals: {
      ...pf.totals,
      market_value_equities_eur: equities,
      total_book_eur: totalBook,
      unrealized_pnl_eur: upnlTotal,
      unrealized_pnl_pct_on_cost: costTotal ? (upnlTotal / costTotal) * 100 : 0,
    },
  };
  if (live.progress_to_eoj_target) {
    live.progress_to_eoj_target = {
      ...live.progress_to_eoj_target,
      current_book_eur: totalBook,
      gap_to_target_eur: live.progress_to_eoj_target.target_book_eur - totalBook,
    };
  }
  return { data: live, isLive: true, asOf: q.asOf, isLoading: false, error: null };
}
