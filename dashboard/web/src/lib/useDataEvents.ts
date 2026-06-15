import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const FILE_TO_KEY: Record<string, string> = {
  'portfolio.json': 'portfolio',
  'event_trades.json': 'event-trades',
  'tranches.json': 'tranches',
  'earnings_calendar.json': 'earnings',
  'tracked_funds.json': 'funds',
  'tracked_analysts.json': 'analysts',
  'trades.log.jsonl': 'trade-log',
  'watch_list_normalized.csv': 'watchlist',
  'goals.json': 'goals',
  research: 'research',
};

// Subscribe once to the server's file-change stream and invalidate the
// matching React Query cache so panels auto-refresh after a skill writes.
export function useDataEvents() {
  const qc = useQueryClient();
  useEffect(() => {
    const es = new EventSource('/api/events');
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type !== 'data-changed') return;
        const key = FILE_TO_KEY[msg.file];
        if (key) qc.invalidateQueries({ queryKey: [key] });
        else qc.invalidateQueries();
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, [qc]);
}
