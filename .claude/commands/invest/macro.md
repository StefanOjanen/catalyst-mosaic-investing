---
description: Sunday-evening macro routine — pull next week's economic calendar + map per-event sensitivity to held positions
---

# /invest:macro

Run the weekly macro routine per the spec in `/Users/stefanojanen/Documents/Personal/Investing with Claude/macro_run.md`.

Recommended cadence: Sunday evening (US time) before futures open, or Monday morning pre-open at latest. Once-per-week is enough — this is an OVERLAY, not a primary trade driver.

Process:

1. **Load state** — read `portfolio.json`, `tranches.json`, `event_trades.json`, `earnings_calendar.json`, and relevant memory files (especially `user_financial_situation.md` for risk-tolerance context).

2. **Spawn one Sonnet worker** to:
   - Pull next 5 trading days' macro calendar from federalreserve.gov, bls.gov, bea.gov, treasurydirect.gov, plus ISM/U-Michigan and geopolitical schedule (OPEC+, ECB/BoJ, Trump summits, etc.)
   - Identify the **3 most market-moving events** for this book's themes (AI-compute, AI-power, defense, materials)
   - For each top event, produce:
     - Expected/consensus number
     - Average S&P 500 ±% move on event day (last 12 historical instances)
     - Sectors most likely to react (XL* ETFs)
     - Per-held-position sensitivity (HIGH/MED/LOW) with one-line rationale across all 12 holdings
     - Any thesis-break triggers (per `tranches.json`) that the event could activate
     - Conditional position-management notes
   - Cross-reference: are any held names printing in the same window as a macro event? Flag COMPOUND BINARY RISK if so
   - List all scheduled Fed speakers in window (often higher signal than the headline data points)

3. **PM (Opus) synthesizes** into a markdown report following the template in `macro_run.md` Step 4. Write to:
   - `research/macro/YYYY-WW-macro.md` (ISO week number, e.g. `2026-W21-macro.md`)
   - Append one-line summary to `research/macro/index.md` (create if missing)

4. **Inline output to user:**
   - Top 3 events with day/time
   - The one action that should be pre-committed before the trading week opens (typically a /invest:preprint run, a trim consideration, or a cash-buffer rebuild)
   - Compound-binary-risk day flag if any (e.g., FOMC + held-name print + Treasury auction stacking)

If `--lite` flag passed: skip the per-held sensitivity grid; just identify top 3 events + headline read-through.

Honor user-memory rules:
- `user_financial_situation` — bridge-financing posture, gain compounding to offset cash burn; not distress
- Don't lecture on risk tolerance; surface the math, let the user choose the dial
- Surface aggregate concentration math proactively
- Use MM-DD date shorthand
