# Daily Run — `/invest:daily` Specification

**Purpose:** Daily check that produces an actionable summary covering portfolio status, watchlist movers, earnings-calendar lookahead, and conditional deep-dives on de-risking setup candidates.

**Frequency:** Once per trading day. Best run before US open (CET morning).

**Constraint:** Compatible with daily-only trading. Output is decision-ready, not a research dump.

---

## Inputs

| File | Purpose |
|---|---|
| `portfolio.json` | Current holdings, weights, P&L, cost basis |
| `event_trades.json` | Active event trades with pre-committed rules |
| `tranches.json` | Per-holding classification + thesis-break triggers |
| `earnings_calendar.json` | Upcoming print dates, setup-eligibility flags |
| `universe.json` | Watchlist universe |
| `earnings_strategy.md` | De-risking 5-criteria filter |
| `tracked_funds.json` | Funds whose 13F holdings overlap with the book — supplementary signal layer for Worker B |
| `memory/feedback_no_crwv.md` | Hard exclusion (never include CRWV) |
| `memory/feedback_event_trade_exits.md` | Event-trade exit framework |

---

## Process

### Step 1 — PM loads state (Opus, fast)

Read all input files. Identify:
- Active event trades and their status (pre-event / in-resolution / closed)
- Held positions with prints in next 5 trading days
- Watchlist names with prints in next 5 trading days
- Concentration vs targets

### Step 2 — Spawn 4 parallel workers (Sonnet, ~3 min wall-clock)

#### Worker A — Portfolio Status + Sector Rotation Detector
**Input:** Current portfolio.json, yesterday's snapshot
**Task:** 
- Compute today's P&L vs yesterday (book-level + per-position)
- Flag positions with >3% single-day moves
- Flag concentration drifts >1pp from target
- Flag thematic-cluster drifts
- Flag positions in drawdown (-15%+, -25%+, -35%+ tiers)
- **Sector rotation detector** (added 2026-05-17): pull 30-day return on relevant sector ETFs vs same period one year ago. Cohort: **XLK** (tech), **XLC** (communication), **XLE** (energy), **XLU** (utilities), **XLI** (industrials), **XLF** (financials), **XLV** (health), **XLP** (staples), **XLY** (discretionary), **XLB** (materials), plus thematic: **SMH/SOXX** (semis), **XLE** + utility-mix for AI-power. Flag any sector where relative strength has flipped (negative→positive vs SPY YoY). Meaningful flips to watch: AI-compute (SMH/SOXX) leadership vs AI-power (XLE/XLU) — note when capital rotates between these. Output: 2-3 line sector-rotation read.
**Output:** Structured summary, ~350 words including the sector-rotation block.

#### Worker B — Watchlist Movers + News Scan + Tracked-Fund Overlay + Scout Layer
**Input:** Watchlist (excluding CRWV per hard exclusion), held names, `tracked_funds.json`, `universe.json`
**Task:**
- For each watchlist name, scan last 24h: stock move ±5%+, named catalyst (earnings, contract, regulatory, M&A)
- For each held name, scan for thesis-break triggers (per `tranches.json` `thesis_break_triggers`)
- **Tracked-fund overlay**: for each watchlist mover, check whether the name appears in any tracked fund's most recent 13F (per `tracked_funds.json`). Flag as "🎯 TRACKED-FUND ALIGNMENT — [fund] [rank/%weight]" when present.
- For each held name, flag material delta from tracked-fund recent 13F (new addition, large add, trim, or exit by the fund) since prior quarter
- **NEW-13F-DETECTION**: At start of each Worker B run, check `tracked_funds.json` `next_filing_expected` dates against today. If a filing window is hit (within ±5 trading days of expected date), do a quick check on WhaleWisdom / SEC EDGAR / Insider Monkey to see if a fresher 13F has been filed than what's stored in `tracked_funds.json`. If YES → flag to PM that the static snapshot needs an update.
- **Scout-layer flag** (lightweight): for `scout_active` tier names in `universe.json`, scan for any >5% move or named catalyst in the window. One-line flag only — does NOT drive action, just keeps the small-cap candidates visible. `scout_monitor` tier checked weekly only, not daily.
- Cite source URLs for every claim
**Output:** Top 5 watchlist movers with one-line reads + tracked-fund flag where relevant, plus held-name alerts if any. Brief "tracked-fund holdings not yet in your book" candidate line. If new 13F detected: deliver a flag like "🆕 NEW 13F DETECTED for [fund] — PM should update tracked_funds.json". Scout-active movers as a separate sub-bullet with named catalyst.

#### Worker C — Calendar Lookahead + Setup Scoring + Earnings-Whiplash Asymmetry
**Input:** earnings_calendar.json (next 5-7 trading days)
**Task:**
- For each ticker printing in window: score against 5-criteria de-risking filter
  - Down ≥5% in 10d?
  - Underperformed sector by ≥3%?
  - IV ≥7% (estimate from options if available)?
  - ≥3 of last 4 prints were beats?
  - No thesis-break news in 30 days?
- Exclude held names (those are tracked separately as event_trades)
- **Earnings-Whiplash asymmetry overlay** (added 2026-05-17): for each name in window, also compute the **IV vs historical-realized-vol gap**. Pull current implied move (from options) and compare to average ACTUAL post-print moves over the last 4-8 quarters. When IV is meaningfully BELOW historical realized vol AND beat history is strong, flag as "⚡ ASYMMETRIC IV SETUP — implied X% vs realized avg Y%" — this is a different asymmetry than the 5-criteria de-risking and can stack with it (or flag a name the 5-criteria missed). Capture even on names not passing 5-criteria — these are watchlist additions, not necessarily entries.
- Rank candidates: ≥4/5 = Tier 1, 3/5 = Tier 2, ≤2/5 = Skip
**Output:** Ranked table of upcoming-print candidates with setup scores

#### Worker D — Insider + Contract Flow Scan + Options-Flow Confluence
**Input:** Held + Tier 1/Tier 2 candidates from Worker C, scout_active names, tracked-fund holdings
**Task:**
- Pull Form 4 filings via openinsider.com for each name (last 7 days)
- For defense / AI-power names (KTOS, AVAV, MP, BE, EQT, VST, CEG): scan SAM.gov / USAspending for new contract awards (last 7 days)
- **Filter Form 4s to high-signal subset**: insider OPEN-MARKET PURCHASES >$500k using personal funds (NOT stock grants, NOT 10b5-1 routine sells, NOT RSU vesting). This is the "executive putting money where mouth is" signal — much higher quality than passive sells.
- **Options-flow overlay** (added 2026-05-17): for any held / watchlist / scout_active name flagged by Form 4 high-signal purchase OR by tracked-fund accumulation, search web for unusual options activity coverage in past 7 days. Sources: Unusual Whales, BarChart unusual options, Cheddar Flow coverage. Look for unusual call sweeps, dark pool prints, large block trades. Flag confluence as "📈 INSIDER + OPTIONS CONFLUENCE — [name]" — this is the highest-value rare signal.
- Flag any clusters: e.g., "3 insiders bought CEG last week" or "BE awarded $X DoD contract"
**Output:** Insider/contract flow summary, flagged signals only. Confluence flags called out separately at top.

### Step 3 — Conditional Worker E (Opus or Sonnet, ~5 min)

**Trigger condition:** Worker C identified ≥1 candidate at Tier 1 (4+/5) AND that candidate is not already in the dossier system.

**Task:** Targeted deep-dive on the highest-scored candidate:
- Recent quarterly trajectory
- Sell-side preview sentiment
- Implied move
- Specific catalysts on the print (guidance items to watch)
- Pre-committed entry/exit playbook per `earnings_strategy.md`

**Output:** A tradeable playbook, ~500 words

### Step 4 — PM synthesizes (Opus, ~2 min)

PM combines all worker outputs into a single daily report. Structure:

```markdown
# Daily Run — YYYY-MM-DD

## TL;DR (≤3 lines)
- Today's book P&L
- One key alert (if any)
- One decision pending (if any)

## 📊 Portfolio status
- Book value, P&L, cash
- Position-level alerts (>3% moves, drawdown tiers, drift)
- Held-position thesis-break alerts (if any)

## 📰 Watchlist top 5 movers
- Ranked by ±5%+ move with named catalyst
- One-line read each

## 📅 Calendar lookahead — next 5 trading days
- Held names printing (with event_trade rules pointer)
- Watchlist Tier 1 setups (4+/5 score)
- Watchlist Tier 2 monitor (3/5 score)

## 🔍 Insider + contract flow
- Notable Form 4 activity
- Notable government contract awards

## 🎯 Deep-dive — [TICKER] (if conditional Worker E ran)
- Setup score breakdown
- Pre-committed entry/exit playbook

## 🏦 Tracked-fund overlay (if Worker B flagged)
- Held-name deltas in latest 13F (adds / trims / exits)
- Watchlist movers in tracked fund(s)
- "NEW 13F DETECTED" flag if applicable — PM update `tracked_funds.json` REQUIRED before closing the run

## ✅ Action queue today
- Specific orders to consider (or "no action")
- If new 13F detected: include "Update tracked_funds.json with [fund] Q[N] [YYYY] holdings" as a synthesis-step action

## 📌 Monitoring queue
- Names to re-check tomorrow

## Sources
[All cited URLs]
```

### Step 5 — Persist + offer

- Write to `research/daily/YYYY-MM-DD-daily.md`
- Append summary line to `research/daily/index.md` (running log)
- PM presents TL;DR + action queue inline to user

---

## Invocation

Three ways to invoke:

1. **Manual:** type `/invest:daily` each morning (preferred for control)
2. **Loop:** `/loop 1d /invest:daily` (auto-runs daily; lets model self-pace)
3. **Schedule:** `/schedule` to run as a scheduled remote agent at fixed time (most automated)

For a daily-cadence retail investor, **option 1** is recommended — keeps the user in the loop on cost and timing.

---

## Cost calibration

Per run, expected:
- Sonnet workers (4× parallel): ~150-200k tokens combined
- Opus PM synthesis: ~30-50k tokens
- Optional Worker E deep-dive: +50-80k Sonnet
- **Total per run: ~250-330k tokens**

Annual cost (≈250 trading days × 280k avg): ~70M tokens. Substantial but defensible if it generates the strategy's expected 3-5% incremental alpha on the book.

---

## Failure modes & mitigations

| Failure | Mitigation |
|---|---|
| Worker can't pull live prices | Fall back to last close from screenshot; flag as stale |
| Web search misses key catalyst | Worker B scope expansion + manual override option |
| Setup score on watchlist name is wrong because data is stale | Re-verify on entry day, not at daily-run time |
| Daily run becomes noise (no actions most days) | That's expected and correct — discipline > activity |
| Cost creep | Monitor token usage weekly; trim worker scope if needed |

---

## Exclusions (carry-forward from memory)

- **CRWV** is permanently excluded from all scans, comps, and recommendations
- **Names with PASS verdicts** (LITE, IREN as of 04-30) are still scanned but flagged as "not actionable" without re-dossier
- **Names with WAIT verdicts** (AVAV) are tracked, action only on dossier-specified trigger date

---

## Phase 2 enhancements (build later)

- **Pre-committed playbooks per ticker** — once setup-score ≥4/5 on a name, freeze the playbook so daily run doesn't re-deliberate
- **Calibration tracking** — log setup-score → actual outcome for every traded setup; tune thresholds over time
- **Macro overlay** — broad-market vol regime check (VIX, sector rotation) to up-/down-weight Tier 1 candidates

---

## Sample run output

See `research/daily/2026-05-01-daily.md` for the first proof-of-concept run (built when this skill goes live).
