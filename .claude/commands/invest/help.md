---
description: List all /invest commands
---

Print the full `/invest:*` command reference. Tab-complete works for all of them.

## Daily / weekly routine

| Command | Use for | Args |
|---------|---------|------|
| `/invest:daily` | Full daily run — 4 parallel workers + PM synthesis → `research/daily/YYYY-MM-DD-daily.md` | — |
| `/invest:weekly` | Multi-agent weekly review → research note with actions | — |
| `/invest:macro` | Sunday-evening macro routine — next-week event calendar + sensitivity mapping | — |
| `/invest:status` | Quick live price & P&L snapshot (no deep research) | — |

## Decision tools

| Command | Use for | Args |
|---------|---------|------|
| `/invest:preprint` | Pre-print scoring + lock pre-committed exit rules into event_trades.json | `TICKER` |
| `/invest:exitcheck` | Post-print exit decision — references locked rule, outputs trim/hold/exit | `TICKER` |
| `/invest:trade` | Pre-trade sanity check before executing | `BUY/SELL QTY TICKER` |

## Research

| Command | Use for | Args |
|---------|---------|------|
| `/invest:dossier` | Deep dive on a ticker (bull + bear analysts in parallel + PM synthesis) | `TICKER` |
| `/invest:redflags` | Skeptical forensic scan on a ticker — accounting, governance, thesis risks | `TICKER` |
| `/invest:watchlist` | Scan watchlist for interesting movers + catalysts | — |
| `/invest:thesis` | Check thesis drift across all holdings | — |

## Signal scans

| Command | Use for | Args |
|---------|---------|------|
| `/invest:insiders` | Insider Form 4 scan — cluster buying, unusual sells, 10b5-1 changes | — |
| `/invest:contracts` | Government contract flow scan — SAM.gov + USAspending.gov for defense + AI-power names | — |

## Stress tests

| Command | Use for | Args |
|---------|---------|------|
| `/invest:stress` | Stress test the book across adverse scenarios | — |
| `/invest:devils` | Devil's advocate — argue the book is badly positioned | — |

| Command | Use for | Args |
|---------|---------|------|
| `/invest:help` | This list | — |

---

**Non-command workflows (just paste content — no command needed):**
- Paste broker **trade confirmation** block → logged to `trades.log.jsonl` and `portfolio.json` updated.
- Paste broker **holdings screenshot** → reconciled into `portfolio.json` and image archived to `snapshots/`.
- Ask anything ad-hoc — commands are shortcuts, not required.

Full architecture in `agents.md`, framework spec in `daily_run.md` / `macro_run.md` / `earnings_strategy.md`, prompt library in `prompts.md`, operating manual in `README.md`.
