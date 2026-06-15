export interface Holding {
  ticker: string;
  name: string;
  shares: number;
  price_local: number;
  price_ccy: string;
  market_value_eur: number;
  weight_pct_of_equity: number;
  weight_pct_of_total: number;
  unrealized_pnl_eur: number;
  unrealized_pnl_pct: number;
  cost_basis_eur: number;
  avg_cost_per_share_eur: number;
  theme?: string[];
  tranche?: string;
  next_catalyst?: string;
  drawdown_alert?: string;
  concentration_alert?: string;
}

export interface PortfolioTotals {
  market_value_equities_eur: number;
  cash_eur: number;
  total_book_eur: number;
  cost_basis_total_eur: number;
  unrealized_pnl_eur: number;
  unrealized_pnl_pct_on_cost: number;
  realized_pnl_ytd_eur_estimate: number;
}

export interface ProgressToTarget {
  current_book_eur: number;
  target_book_eur: number;
  gap_to_target_eur: number;
  gap_to_target_pct: number;
  target_date: string;
  sessions_remaining_approx?: number;
}

export interface Portfolio {
  base_currency: string;
  broker: string;
  account: string;
  last_updated: string;
  fx_snapshot?: { USD_EUR: number };
  totals: PortfolioTotals;
  holdings: Holding[];
  concentration?: Record<string, unknown>;
  progress_to_eoj_target?: ProgressToTarget;
}

export interface EventTrade {
  id: string;
  ticker: string;
  name?: string;
  entry_date?: string;
  entry_price_usd?: number;
  entry_shares?: number;
  catalyst_event?: string;
  catalyst_date?: string;
  thesis_at_entry?: string;
  status?: string;
  pre_committed_exit_rules?: unknown;
}

export interface EventTrades {
  framework?: {
    purpose?: string;
    default_exit_rules_for_event_trades?: Record<string, string>;
    key_lesson?: string;
  };
  active_event_trades?: EventTrade[];
  closed_event_trades?: EventTrade[];
  concentration_catalyst_trades?: EventTrade[];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json()).error ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(`${url} → ${res.status}${detail ? ` (${detail})` : ''}`);
  }
  return (await res.json()) as T;
}

export interface TrancheEntry {
  tranche_type?: string;
  thematic_target_weight_pct?: number;
  current_weight_pct?: number;
  thesis_horizon?: string;
  thesis_short?: string;
  thesis_break_triggers?: string[];
  concentration_alert?: string;
  note?: string;
}

export interface Tranches {
  last_updated?: string;
  tranche_classification?: Record<string, TrancheEntry>;
}

export interface EarningsEvent {
  date?: string;
  date_window?: string;
  ticker?: string;
  ticker_group?: string;
  tickers_in_universe?: string[];
  session?: string;
  period?: string;
  confidence?: string;
  held?: boolean;
  watchlist?: boolean;
  shares?: number;
  note?: string;
}

export type EarningsCalendar = Record<string, unknown> & { last_updated?: string };

export interface TradeLogEntry {
  event?: string;
  date_trade?: string;
  logged_on?: string;
  ticker?: string;
  name?: string;
  shares?: number;
  price_local?: number;
  net_eur?: number;
  pm_rationale?: string;
  execution_commentary?: string;
  summary?: string;
  [k: string]: unknown;
}

export interface WatchlistRow {
  ticker: string;
  name: string;
  primary_exchange: string;
  region: string;
  notes: string;
}

export interface ResearchFile {
  name: string;
}

export const fetchPortfolio = () => getJson<Portfolio>('/api/portfolio');
export const fetchEventTrades = () => getJson<EventTrades>('/api/event-trades');
export const fetchTranches = () => getJson<Tranches>('/api/tranches');
export const fetchEarnings = () => getJson<EarningsCalendar>('/api/earnings');
export const fetchTradeLog = () => getJson<TradeLogEntry[]>('/api/trade-log');
export const fetchWatchlist = () => getJson<WatchlistRow[]>('/api/watchlist');
export const fetchFunds = () => getJson<Record<string, unknown>>('/api/funds');
export const fetchAnalysts = () => getJson<Record<string, unknown>>('/api/analysts');
export const fetchResearchList = () => getJson<ResearchFile[]>('/api/research');
export const fetchResearchDoc = (name: string) =>
  getJson<{ name: string; content: string }>(`/api/research/${encodeURIComponent(name)}`);

export interface PricePoint {
  date: string;
  close: number;
}
export const fetchPrices = (symbols: string[], range: string) =>
  getJson<Record<string, PricePoint[]>>(
    `/api/prices?symbols=${encodeURIComponent(symbols.join(','))}&range=${encodeURIComponent(range)}`,
  );

export interface Analytics {
  range: string;
  asOf: string | null;
  nDays: number;
  tickers: string[];
  weightsBook: Record<string, number>;
  vol: Record<string, number>;
  betaSoxx: Record<string, number | null>;
  betaSpy: Record<string, number | null>;
  ret1mo: Record<string, number | null>;
  ret3mo: Record<string, number | null>;
  corr: (number | null)[][];
  portfolio: {
    betaSoxx: number;
    betaSpy: number;
    vol: number;
    effectiveBets: number;
    diversificationRatio: number | null;
    avgCorr: number | null;
  };
}
export const fetchAnalytics = (range = '1y') => getJson<Analytics>(`/api/analytics?range=${range}`);

export interface Goal {
  id: string;
  label: string;
  type: 'book_value' | 'realized_pnl' | 'cash';
  target_eur: number;
  target_date: string;
  baseline_eur: number;
  baseline_date: string;
  status: 'active' | 'hit' | 'missed' | 'abandoned';
  note?: string;
}
export interface Goals {
  active_goal_id?: string;
  goals: Goal[];
}
export const fetchGoals = () => getJson<Goals>('/api/goals');

export interface ImportHolding {
  ticker: string;
  name?: string;
  shares: number | null;
  price_local?: number | null;
  price_ccy?: string;
  avg_cost_per_share?: number | null;
  cost_basis?: number | null;
}
export interface ImportResult {
  broker?: string;
  account?: string;
  base_currency?: string;
  fx_usd_per_eur?: number | null;
  cash_eur?: number | null;
  holdings: ImportHolding[];
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json()).error ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status}${detail ? ` — ${detail}` : ''}`);
  }
  return (await res.json()) as T;
}

export const importParse = (file: { filename: string; mimeType: string; dataBase64: string }) =>
  postJson<ImportResult>('/api/import/parse', file);
export const importCommit = (payload: unknown) => postJson<Portfolio>('/api/import/commit', payload);

export interface QuotesResp {
  quotes: Record<string, number | null>;
  usd_per_eur: number | null;
  asOf: string;
}
export const fetchQuotes = (symbols: string[]) =>
  getJson<QuotesResp>(`/api/quotes?symbols=${encodeURIComponent(symbols.join(','))}`);
