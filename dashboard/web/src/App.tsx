import { useState } from 'react';
import { Sidebar, type Tab } from './components/Sidebar';
import { KpiHero } from './components/KpiHero';
import { PortfolioPanel } from './components/PortfolioPanel';
import { GoalsPanel } from './components/GoalsPanel';
import { EventTradesPanel } from './components/EventTradesPanel';
import { ChartsPanel } from './components/ChartsPanel';
import { RiskPanel } from './components/RiskPanel';
import { OpportunityRanker } from './components/OpportunityRanker';
import { CatalystCenter } from './components/CatalystCenter';
import { TranchesPanel } from './components/TranchesPanel';
import { EarningsPanel } from './components/EarningsPanel';
import { ResearchPanel } from './components/ResearchPanel';
import { TradeLogPanel } from './components/TradeLogPanel';
import { ListsPanel } from './components/ListsPanel';
import { SetupWizard } from './components/SetupWizard';
import { ChatPane } from './components/ChatPane';
import { useDataEvents } from './lib/useDataEvents';

const TITLES: Record<Tab, string> = {
  holdings: 'Holdings',
  charts: 'Charts',
  risk: 'Risk & exposure',
  tranches: 'Tranches & theses',
  earnings: 'Catalysts',
  research: 'Research',
  trades: 'Trade log',
  lists: 'Lists',
  setup: 'Portfolio setup',
};

export default function App() {
  const [tab, setTab] = useState<Tab>('holdings');
  useDataEvents();

  return (
    <div className="flex h-full">
      <Sidebar tab={tab} onTab={setTab} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-6 pb-3 pt-5">
          <div>
            <div className="display text-[19px] leading-tight text-[var(--accent)]">{TITLES[tab]}</div>
            <div className="text-[11px] text-slate-500">Portfolio desk · EUR · live-marked</div>
          </div>
        </header>

        <div className="px-6">
          <KpiHero />
        </div>

        <main className="grid min-h-0 flex-1 grid-cols-1 gap-5 p-6 lg:grid-cols-[1.7fr_1fr]">
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto pr-1">
            {tab === 'holdings' && (
              <>
                <PortfolioPanel />
                <GoalsPanel />
                <EventTradesPanel />
              </>
            )}
            {tab === 'charts' && <ChartsPanel />}
            {tab === 'risk' && (
              <>
                <RiskPanel />
                <OpportunityRanker />
              </>
            )}
            {tab === 'tranches' && <TranchesPanel />}
            {tab === 'earnings' && (
              <>
                <CatalystCenter />
                <EarningsPanel />
              </>
            )}
            {tab === 'research' && <ResearchPanel />}
            {tab === 'trades' && <TradeLogPanel />}
            {tab === 'lists' && <ListsPanel />}
            {tab === 'setup' && <SetupWizard />}
          </div>
          <div className="hidden min-h-0 lg:block">
            <ChatPane onNavigate={(t) => setTab(t as Tab)} />
          </div>
        </main>
      </div>
    </div>
  );
}
