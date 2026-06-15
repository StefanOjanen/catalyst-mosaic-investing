import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPortfolio, tradeLog, tradeParse, type TradeResult } from '../lib/api';
import { fmtEur } from '../lib/format';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(',') + 1));
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const inputCls =
  'rounded border border-[var(--border)] bg-white/[0.03] px-2 py-1.5 text-[13px] text-slate-200 focus:border-[var(--accent)] focus:outline-none';

export function TradeForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: pf } = useQuery({ queryKey: ['portfolio'], queryFn: fetchPortfolio });
  const heldTickers = (pf?.holdings ?? []).map((h) => h.ticker);

  const [action, setAction] = useState<'buy' | 'sell'>('buy');
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [ccy, setCcy] = useState('USD');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [fees, setFees] = useState('');
  const [note, setNote] = useState('');

  const [parsing, setParsing] = useState(false);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<TradeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    setErr(null);
    setParsing(true);
    try {
      const t = await tradeParse({ filename: file.name, mimeType: file.type || '', dataBase64: await fileToBase64(file) });
      if (t.action) setAction(t.action);
      if (t.ticker) setTicker(t.ticker.toUpperCase());
      if (t.name) setName(t.name);
      if (t.shares != null) setShares(String(t.shares));
      if (t.price_local != null) setPrice(String(t.price_local));
      if (t.price_ccy) setCcy(t.price_ccy);
      if (t.date) setDate(t.date);
      if (t.fees != null) setFees(String(t.fees));
    } catch (e) {
      setErr(String((e as Error).message || e));
    } finally {
      setParsing(false);
    }
  }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  }
  function onPaste(e: ClipboardEvent<HTMLDivElement>) {
    const f = e.clipboardData.files?.[0];
    if (f) {
      e.preventDefault();
      void handleFile(f);
    }
  }

  // live preview of the effect (server is authoritative), debounced
  const valid = ticker.trim() && Number(shares) > 0 && Number(price) > 0;
  useEffect(() => {
    if (!valid) {
      setPreview(null);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const r = await tradeLog({
          action,
          ticker: ticker.trim().toUpperCase(),
          name,
          shares: Number(shares),
          price_local: Number(price),
          price_ccy: ccy,
          date,
          fees_eur: Number(fees) || 0,
          preview: true,
        });
        setPreview(r);
        setErr(null);
      } catch (e) {
        setPreview(null);
        setErr(String((e as Error).message || e));
      }
    }, 400);
    return () => clearTimeout(id);
  }, [action, ticker, name, shares, price, ccy, date, fees, valid]);

  async function submit() {
    if (!valid) return;
    setBusy(true);
    setErr(null);
    try {
      await tradeLog({
        action,
        ticker: ticker.trim().toUpperCase(),
        name,
        shares: Number(shares),
        price_local: Number(price),
        price_ccy: ccy,
        date,
        fees_eur: Number(fees) || 0,
        note,
      });
      await qc.invalidateQueries();
      onClose();
    } catch (e) {
      setErr(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  }

  const h = preview?.portfolio.holdings.find((x) => x.ticker === ticker.trim().toUpperCase());
  const prevShares = pf?.holdings.find((x) => x.ticker === ticker.trim().toUpperCase())?.shares;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="display text-[13px] text-[var(--accent)]">Log a trade</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">×</button>
        </header>

        <div className="space-y-3 p-4">
          {/* paste / upload */}
          <div
            tabIndex={0}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onPaste={onPaste}
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed px-3 py-4 text-center text-[12px] outline-none transition-colors ${
              drag ? 'border-[var(--accent)] bg-[rgba(255,168,40,0.06)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]'
            }`}
          >
            {parsing ? (
              <span className="text-slate-300">Reading the confirmation with Claude…</span>
            ) : (
              <>
                <span className="text-slate-200">Paste a trade-confirmation screenshot (⌘V)</span>
                <span className="text-slate-500"> — or drop / click · image / PDF</span>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />

          {/* manual fields */}
          <div className="flex gap-1">
            {(['buy', 'sell'] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAction(a)}
                className={`flex-1 rounded border px-2 py-1.5 text-[12px] uppercase tracking-wide ${
                  action === a
                    ? a === 'buy'
                      ? 'border-emerald-600 bg-emerald-900/30 text-emerald-300'
                      : 'border-rose-600 bg-rose-900/30 text-rose-300'
                    : 'border-[var(--border)] text-slate-400'
                }`}
              >
                {a}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[10px] text-slate-500">
              Ticker
              {action === 'sell' && heldTickers.length ? (
                <select className={inputCls} value={ticker} onChange={(e) => setTicker(e.target.value)}>
                  <option value="">select…</option>
                  {heldTickers.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <input className={`${inputCls} uppercase`} value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} />
              )}
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-slate-500">
              Shares<input className={`${inputCls} tnum`} value={shares} onChange={(e) => setShares(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-slate-500">
              Price<input className={`${inputCls} tnum`} value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-slate-500">
              Currency<input className={inputCls} value={ccy} onChange={(e) => setCcy(e.target.value.toUpperCase())} />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-slate-500">
              Date<input className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-slate-500">
              Fees (EUR)<input className={`${inputCls} tnum`} value={fees} onChange={(e) => setFees(e.target.value)} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-[10px] text-slate-500">
            Note (optional)<input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          {/* effect preview */}
          {preview && h !== undefined && (
            <div className="rounded-md border border-[var(--border)] bg-white/[0.02] px-3 py-2 text-[12px]">
              <div className="label mb-1">Effect</div>
              <div className="text-slate-300">
                {ticker.toUpperCase()}{' '}
                <span className="tnum">
                  {prevShares ?? 0} → {h ? h.shares : 0} sh
                </span>
                <span className="text-slate-500"> · cash {preview.entry.net_eur >= 0 ? '+' : ''}{fmtEur(preview.entry.net_eur)}</span>
              </div>
              {preview.entry.realized_pnl_eur != null && (
                <div className="mt-0.5">
                  realized P&L{' '}
                  <span className={`tnum ${preview.entry.realized_pnl_eur >= 0 ? 'text-[var(--pos)]' : 'text-[var(--neg)]'}`}>
                    {fmtEur(preview.entry.realized_pnl_eur)}
                  </span>
                </div>
              )}
              <div className="mt-0.5 text-slate-500">new book {fmtEur(preview.portfolio.totals.total_book_eur)}</div>
            </div>
          )}

          {err && <div className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[12px] text-rose-300">{err}</div>}
        </div>

        <footer className="flex items-center gap-2 border-t border-slate-800 px-4 py-3">
          <span className="text-[10px] text-slate-600">updates portfolio.json + trade log · backed up first</span>
          <button onClick={onClose} className="btn ml-auto text-[12px]">Cancel</button>
          <button onClick={() => void submit()} disabled={!valid || busy} className="btn btn-accent text-[12px]">
            {busy ? 'Saving…' : 'Log trade'}
          </button>
        </footer>
      </div>
    </div>
  );
}
