---
description: Quick portfolio status — no deep research, just the numbers
---

Quick status snapshot, no multi-agent fan-out:

1. Pull live prices for all 10 holdings via Yahoo Finance WebFetch.
2. Pull live EUR/USD FX rate.
3. Recompute market value, weights, and unrealized P&L in EUR.
4. Compare to the last saved state in `portfolio.json` — show delta since last update.
5. Flag any position that moved >±5% since last snapshot.
6. One-line summary per holding + portfolio totals.

No recommendations, no research. Just the current picture. Fast read.
