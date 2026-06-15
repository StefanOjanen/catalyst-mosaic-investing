const eur = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const eur2 = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

export function fmtEur(n: number | undefined, decimals = false): string {
  if (n === undefined || Number.isNaN(n)) return '—';
  return (decimals ? eur2 : eur).format(n);
}

export function fmtPct(n: number | undefined, withSign = true): string {
  if (n === undefined || Number.isNaN(n)) return '—';
  const sign = withSign && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

export function fmtNum(n: number | undefined, decimals = 2): string {
  if (n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

// Compact EUR like €29.1k / €1.2M for sub-labels.
export function fmtEurCompact(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return '—';
  if (Math.abs(n) >= 1e6) return `€${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `€${(n / 1e3).toFixed(1)}k`;
  return `€${Math.round(n)}`;
}

// Signed-value color → Bloomberg up-green / down-red tokens.
export function pnlColor(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n) || n === 0) return 'text-slate-400';
  return n > 0 ? 'text-[var(--pos)]' : 'text-[var(--neg)]';
}
