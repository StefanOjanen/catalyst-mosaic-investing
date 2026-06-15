import { useRef, useState, type DragEvent, type ClipboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchQuotes, importCommit, importParse, type ImportResult } from '../lib/api';
import { fmtEur } from '../lib/format';
import { Card } from './Card';

interface Row {
  ticker: string;
  name: string;
  shares: string;
  price_local: string;
  price_ccy: string;
  avg_cost_per_share: string;
}

const emptyRow = (): Row => ({ ticker: '', name: '', shares: '', price_local: '', price_ccy: 'USD', avg_cost_per_share: '' });

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
  'rounded border border-[var(--border)] bg-white/[0.03] px-2 py-1 text-[12px] text-slate-200 focus:border-[var(--accent)] focus:outline-none';

export function SetupWizard() {
  const qc = useQueryClient();
  const [step, setStep] = useState<'choose' | 'parsing' | 'review' | 'done'>('choose');
  const [err, setErr] = useState<string | null>(null);
  const [broker, setBroker] = useState('');
  const [account, setAccount] = useState('');
  const [cash, setCash] = useState('');
  const [fx, setFx] = useState('1.16');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function loadResult(r: ImportResult) {
    setBroker(r.broker || '');
    setAccount(r.account || '');
    setCash(r.cash_eur != null ? String(r.cash_eur) : '');
    setFx(r.fx_usd_per_eur ? String(r.fx_usd_per_eur) : '1.16');
    setRows(
      (r.holdings || []).map((h) => ({
        ticker: h.ticker || '',
        name: h.name || '',
        shares: h.shares != null ? String(h.shares) : '',
        price_local: h.price_local != null ? String(h.price_local) : '',
        price_ccy: h.price_ccy || 'USD',
        avg_cost_per_share:
          h.avg_cost_per_share != null
            ? String(h.avg_cost_per_share)
            : h.cost_basis != null && h.shares
              ? String(+(h.cost_basis / h.shares).toFixed(2))
              : '',
      })),
    );
    setStep('review');
  }

  async function handleFile(file: File) {
    setErr(null);
    setStep('parsing');
    try {
      const dataBase64 = await fileToBase64(file);
      loadResult(await importParse({ filename: file.name, mimeType: file.type || '', dataBase64 }));
    } catch (e) {
      setErr(String((e as Error).message || e));
      setStep('choose');
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

  const setRow = (i: number, k: keyof Row, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  async function fetchLive() {
    const tickers = rows.map((r) => r.ticker.trim().toUpperCase()).filter(Boolean);
    if (!tickers.length) return;
    setBusy(true);
    try {
      const q = await fetchQuotes(tickers);
      setRows((rs) =>
        rs.map((r) => {
          const p = q.quotes[r.ticker.trim().toUpperCase()];
          return p != null ? { ...r, price_local: String(p) } : r;
        }),
      );
      if (q.usd_per_eur) setFx(String(+q.usd_per_eur.toFixed(4)));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await importCommit({
        broker,
        account,
        fx_usd_per_eur: Number(fx) || 1.16,
        cash_eur: Number(cash) || 0,
        holdings: rows
          .filter((r) => r.ticker.trim() && Number(r.shares) > 0)
          .map((r) => ({
            ticker: r.ticker.trim().toUpperCase(),
            name: r.name.trim(),
            shares: Number(r.shares),
            price_local: Number(r.price_local) || 0,
            price_ccy: r.price_ccy || 'USD',
            avg_cost_per_share: Number(r.avg_cost_per_share) || null,
          })),
      });
      await qc.invalidateQueries();
      setStep('done');
    } catch (e) {
      setErr(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  }

  const fxN = Number(fx) || 1.16;
  const previewEquity = rows.reduce((s, r) => {
    const v = (Number(r.shares) || 0) * (Number(r.price_local) || 0);
    return s + (r.price_ccy === 'EUR' ? v : v / fxN);
  }, 0);
  const previewBook = previewEquity + (Number(cash) || 0);

  return (
    <div className="flex flex-col gap-5">
      <Card title="Portfolio setup" right={<span>writes portfolio.json (backed up first)</span>}>
        {err && <div className="mb-3 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[12px] text-rose-300">{err}</div>}

        {step === 'choose' && (
          <div className="space-y-3">
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
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center outline-none transition-colors ${
                drag ? 'border-[var(--accent)] bg-[rgba(255,168,40,0.06)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]'
              }`}
            >
              <div className="text-[13px] text-slate-200">Drop a file, click to browse, or paste a screenshot (⌘V)</div>
              <div className="text-[11px] text-slate-500">broker screenshot · PNG/JPG · PDF · CSV · XLSX</div>
              <div className="mt-1 text-[10px] text-slate-600">parsed by Claude into an editable preview — nothing is saved until you confirm</div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf,.csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <button
              onClick={() => {
                setRows([emptyRow()]);
                setStep('review');
              }}
              className="btn text-[12px]"
            >
              or enter manually →
            </button>
          </div>
        )}

        {step === 'parsing' && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="text-[13px] text-slate-300">Reading your file with Claude…</div>
            <div className="text-[11px] text-slate-500">extracting tickers, shares, prices &amp; cost basis</div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="flex flex-col gap-1 text-[10px] text-slate-500">
                Broker<input className={inputCls} value={broker} onChange={(e) => setBroker(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-slate-500">
                Account<input className={inputCls} value={account} onChange={(e) => setAccount(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-slate-500">
                Cash (EUR)<input className={`${inputCls} tnum`} value={cash} onChange={(e) => setCash(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-slate-500">
                FX (USD per EUR)<input className={`${inputCls} tnum`} value={fx} onChange={(e) => setFx(e.target.value)} />
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="label text-left">
                    <th className="pr-2">Ticker</th>
                    <th className="pr-2">Name</th>
                    <th className="pr-2 text-right">Shares</th>
                    <th className="pr-2 text-right">Price</th>
                    <th className="pr-2">Ccy</th>
                    <th className="pr-2 text-right">Avg cost</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="py-0.5 pr-2"><input className={`${inputCls} w-20`} value={r.ticker} onChange={(e) => setRow(i, 'ticker', e.target.value)} /></td>
                      <td className="py-0.5 pr-2"><input className={`${inputCls} w-32`} value={r.name} onChange={(e) => setRow(i, 'name', e.target.value)} /></td>
                      <td className="py-0.5 pr-2"><input className={`${inputCls} tnum w-16 text-right`} value={r.shares} onChange={(e) => setRow(i, 'shares', e.target.value)} /></td>
                      <td className="py-0.5 pr-2"><input className={`${inputCls} tnum w-20 text-right`} value={r.price_local} onChange={(e) => setRow(i, 'price_local', e.target.value)} /></td>
                      <td className="py-0.5 pr-2"><input className={`${inputCls} w-14`} value={r.price_ccy} onChange={(e) => setRow(i, 'price_ccy', e.target.value)} /></td>
                      <td className="py-0.5 pr-2"><input className={`${inputCls} tnum w-20 text-right`} value={r.avg_cost_per_share} onChange={(e) => setRow(i, 'avg_cost_per_share', e.target.value)} /></td>
                      <td className="py-0.5"><button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="px-1 text-slate-600 hover:text-rose-400">×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setRows((rs) => [...rs, emptyRow()])} className="btn text-[11px]">+ row</button>
              <button onClick={() => void fetchLive()} disabled={busy} className="btn text-[11px]">fetch live prices</button>
              <span className="ml-auto text-[12px] text-slate-400">
                preview book <span className="tnum text-slate-100">{fmtEur(previewBook)}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3">
              <button onClick={() => setStep('choose')} className="btn text-[12px]">← back</button>
              <button onClick={() => void save()} disabled={busy || !rows.some((r) => r.ticker.trim())} className="btn btn-accent ml-auto text-[12px]">
                {busy ? 'Saving…' : 'Save portfolio'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="text-[13px] text-[var(--pos)]">✓ Portfolio saved</div>
            <div className="text-[11px] text-slate-500">Prior portfolio.json backed up to dashboard/.backups. All panels refreshed.</div>
            <button onClick={() => setStep('choose')} className="btn mt-2 text-[12px]">import again</button>
          </div>
        )}
      </Card>

      <Card title="Keeping it up to date">
        <ul className="space-y-2 text-[12px] leading-snug text-slate-300">
          <li>
            <span className="text-[var(--accent-2)]">Balance is tracked automatically.</span> You enter share counts and
            cost basis once — the dashboard marks every holding to live prices (Total Book shows a green <span className="text-[var(--pos)]">live</span>{' '}
            dot), so market value, weights and P&amp;L update on their own. You don't re-type prices.
          </li>
          <li>
            <span className="text-slate-100">After you buy or sell:</span> update only the <em>share count</em> (and cost
            basis for a buy) here, or re-import a fresh broker screenshot — that's the one thing to keep current.
          </li>
          <li>
            <span className="text-slate-100">Around earnings:</span> use <code className="text-[var(--accent-2)]">/invest:preprint</code> /{' '}
            <code className="text-[var(--accent-2)]">/invest:exitcheck</code> in the Assistant — they log the trade plan to
            event_trades.json (with a Keep/Revert review).
          </li>
          <li>
            <span className="text-slate-100">Every change is reversible:</span> each save backs up the previous
            portfolio.json to <code>dashboard/.backups</code> first.
          </li>
        </ul>
      </Card>
    </div>
  );
}
