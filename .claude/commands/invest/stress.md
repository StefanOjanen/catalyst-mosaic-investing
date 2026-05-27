---
description: Stress-test the portfolio across adverse scenarios
---

Multi-agent stress test per `agents.md` Prompt C.

Spawn one Sonnet subagent per scenario (parallel). Each estimates per-holding drawdown in %:

1. **AI capex slowdown** — Mag7 capex cut 20%. MU/NVDA/AVGO hit hardest.
2. **Data-center power bubble deflates** — VST/CEG/BE/SEI down 30%+.
3. **US recession** — broad 15% market draw, defensives hold better.
4. **China AI optical crack** — watchlist names 300394/300308/300502 down 40% (would affect correlated US plays).
5. **USD/EUR → 1.25** (EUR strengthens) — translation loss on USD book.
6. **Rare-earth / China export control reversal** — MP Materials specific shock.

You (PM) aggregate into portfolio EUR P&L per scenario, identify the top 3 positions driving loss in each, and answer:

- Which scenario has the worst outcome?
- What single trim or hedge would most improve the worst-case outcome while preserving upside in the base case?
- Is current concentration defensible given expected-value math?

Write to `research/YYYY-MM-DD-stress.md`.
