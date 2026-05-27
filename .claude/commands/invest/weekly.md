---
description: Run the multi-agent weekly portfolio review
---

Run the multi-agent weekly review per `agents.md` Prompt A.

1. Read `portfolio.json` and `universe.json`.
2. Decide scope: all 10 holdings + top 3–5 watchlist movers (or all 15 if time allows).
3. Fan out Sonnet `Investment Researcher` subagents in parallel, one per ticker. Each agent follows the output contract in `agents.md` and writes to `research/ticker-reports/YYYY-MM-DD-[TICKER].md`.
4. Synthesize (Opus work): aggregate P&L + attribution, concentration check, cross-position trade-offs, risk budget.
5. Write `research/YYYY-MM-DD-weekly.md` with explicit BUY/ADD/HOLD/TRIM/SELL actions, conviction, EUR sizing, and a "Monday morning action list."
6. End with the one action I should prioritize tomorrow.
