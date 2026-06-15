import {
  Wallet,
  LineChart,
  Activity,
  Layers,
  CalendarClock,
  FileText,
  ArrowLeftRight,
  ListChecks,
  UploadCloud,
} from 'lucide-react';
import type { ComponentType } from 'react';

export type Tab = 'holdings' | 'charts' | 'risk' | 'tranches' | 'earnings' | 'research' | 'trades' | 'lists' | 'setup';

const NAV: { id: Tab; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { id: 'holdings', label: 'Holdings', icon: Wallet },
  { id: 'charts', label: 'Charts', icon: LineChart },
  { id: 'risk', label: 'Risk', icon: Activity },
  { id: 'earnings', label: 'Catalysts', icon: CalendarClock },
  { id: 'tranches', label: 'Tranches', icon: Layers },
  { id: 'research', label: 'Research', icon: FileText },
  { id: 'trades', label: 'Trades', icon: ArrowLeftRight },
  { id: 'lists', label: 'Lists', icon: ListChecks },
  { id: 'setup', label: 'Setup', icon: UploadCloud },
];

export function Sidebar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <aside className="flex w-[208px] shrink-0 flex-col border-r border-[var(--border)] bg-black/20 px-3 py-4">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <div className="display flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--accent)] text-sm font-semibold text-[#1a1408] shadow-[0_6px_18px_-8px_rgba(255,168,40,0.85)]">
          CM
        </div>
        <div className="leading-tight">
          <div className="display text-[14px] text-slate-100">Catalyst Mosaic</div>
          <div className="text-[10px] tracking-wide text-slate-500">investing desk</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => onTab(id)} className={`nav-item ${tab === id ? 'active' : ''}`}>
            <Icon size={16} strokeWidth={2} />
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-2 px-2 pt-4 text-[10px] text-slate-500">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        live · 127.0.0.1
      </div>
    </aside>
  );
}
