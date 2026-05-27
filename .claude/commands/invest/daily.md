---
description: Daily portfolio + watchlist + earnings-calendar check with conditional deep-dive on de-risking setups
---

# /invest:daily

Run the full daily check per the spec in `/Users/stefanojanen/Documents/Personal/Investing with Claude/daily_run.md`.

Process:

1. **Load state** — read `portfolio.json`, `event_trades.json`, `tranches.json`, `earnings_calendar.json`, `universe.json`, and relevant memory files. Honor all exclusions (CRWV permanently excluded; PASS verdicts respected).

2. **Spawn 4 parallel Sonnet workers** in a single message:
   - **Worker A — Portfolio Status:** P&L vs yesterday, position-level alerts (>3% moves, drawdown tiers, concentration drift), held-position thesis-break scan per `tranches.json` `thesis_break_triggers`.
   - **Worker B — Watchlist Movers:** ±5%+ moves with named catalysts in last 24h across the watchlist (excluding CRWV).
   - **Worker C — Calendar Lookahead + Setup Scoring:** for each ticker printing in next 5 trading days (per `earnings_calendar.json`), score against the 5 de-risking criteria from `earnings_strategy.md`. Rank: ≥4/5 = Tier 1, 3/5 = Tier 2, ≤2/5 = Skip. Exclude held names.
   - **Worker D — Insider + Contract Flow:** Form 4 scan (openinsider.com) for held + Tier 1/2 candidates; SAM.gov / USAspending scan for defense + AI-power names. Flag clusters.

3. **Conditional Worker E** — if Worker C returned a Tier 1 candidate (4+/5) not already covered by an existing dossier, spawn a targeted deep-dive Sonnet agent for that name. Output a pre-committed entry/exit playbook per `earnings_strategy.md`.

4. **PM (Opus) synthesizes** — combine all workers into a single report at `research/daily/YYYY-MM-DD-daily.md`. Use the structure in `daily_run.md` Step 4. Append summary line to `research/daily/index.md`.

5. **Inline output to user:**
   - TL;DR (≤3 lines)
   - Action queue today (specific orders or "no action")
   - Monitoring queue (names to re-check tomorrow)

If the user passes a `--quick` flag, skip Workers D and E and produce a faster, lighter report.

If the user passes a specific date as argument, use that date as "today" for state purposes (useful for backtesting).

Default behavior is full run, current trading day, market-open prep mode.

Honor all the durable user preferences in memory:
- Never recommend CRWV
- Surface aggregate concentration math proactively
- Don't push trim/discipline recs more than once
- Respect "max money" framing (no lectures on risk tolerance)
- Use date format `MM-DD` shorthand by default (full month names if specifically requested)
