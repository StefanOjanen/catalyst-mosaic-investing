# Multi-agent architecture

## Roles

| Role | Agent type | Model | Runs where |
|------|-----------|-------|------------|
| **Portfolio Manager** | main session | Opus 4 | This conversation |
| **Research Analyst** (per ticker) | `Investment Researcher` subagent | Sonnet 4 | Spawned in parallel |
| **Risk Analyst** (optional) | `general-purpose` subagent | Sonnet 4 | Spawned when stress-testing |
| **Data Fetcher** (optional) | `general-purpose` subagent | Haiku 4.5 | Spawned for bulk quote pulls |

PM is the only agent that writes to `portfolio.json` or `trades.log.jsonl`. Analysts only read and produce reports — they are stateless workers.

---

## Analyst output contract

Every Research Analyst MUST return a report in this exact structure. PM depends on it for deterministic synthesis.

```markdown
# [TICKER] — Research Report ([DATE])

## POSITION_CONTEXT
- Held: [YES/NO]
- Shares: [N]
- Avg cost (EUR): [X]
- Current weight: [X.X%]
- Unrealized P&L: [+/-X.X% / +/-€XXX]

## PRICE_ACTION
- 1W: [+/-X.X%]
- MTD: [+/-X.X%]
- YTD: [+/-X.X%]
- vs S&P 500 YTD: [+/-X.X%]

## NEWS_MATERIAL
Bullet list of 3–7 material news items in last 7 days. Each item: date, headline,
one-line read-through. No filler. If nothing material, write "None."

## EARNINGS_PROXIMITY
- Next report date: [YYYY-MM-DD or "not scheduled"]
- Days out: [N]
- Consensus EPS / revenue: [X]
- Whisper / direction of estimates (rising/falling/stable): [X]

## THESIS_STATUS
One of: INTACT / DRIFTING / BROKEN
One paragraph justification. Reference the original thesis note in portfolio.json.

## VALUATION_SNAPSHOT
- Fwd P/E: [X] vs 5Y avg [X] vs peer median [X]
- EV/EBITDA: [X] vs peers [X]
- One-line takeaway: cheap / fair / expensive vs history and peers.

## CATALYST_30D
List dated catalysts in next 30 days (earnings, product launches, regulatory, macro).

## BULL_BEAR_SYNTHESIS
- Bull case (2–3 sentences): what upside looks like.
- Bear case (2–3 sentences): what downside looks like.
- Asymmetry: favorable / neutral / unfavorable.

## ANALYST_RECOMMENDATION
One of: BUY / ADD / HOLD / TRIM / SELL
Conviction: [1–10]
Key risk: [one sentence]

This is a NAME-LOCAL view only. PM overlays portfolio constraints and sizing.
```

---

## Orchestration prompts

### Prompt A — Weekly parallel review (the main one)

User invokes with: *"Run the multi-agent weekly review"*

PM (this agent) executes:

1. Read `portfolio.json` and `universe.json`.
2. Decide scope:
   - **Full:** all 10 holdings + top 5 watchlist movers (15 analysts).
   - **Incremental (default):** holdings with >5% move WoW + any earnings in next 7d + 3 watchlist breakouts.
3. Fan out analysts in a single message (parallel execution):

   ```
   For each ticker T in scope, spawn an Investment Researcher subagent with:
     model: "sonnet"
     description: "Research [T]"
     prompt: (see Analyst brief template below)
     run_in_background: false    ← keep foreground so we gather results this turn
   ```

4. Wait for all reports. Each agent writes to `research/ticker-reports/YYYY-MM-DD-[TICKER].md`
   and returns a summary in its final message.
5. Synthesize (Opus work, only PM does this):
   - Aggregate P&L, attribution (what drove WoW move).
   - Concentration check — did AI-power theme exposure drift?
   - Cross-position trade-offs — if 3 names are BUY, which one first?
   - Risk budget — respect "no single name >20%" and thematic limits.
   - Translate name-local recommendations into portfolio actions with EUR sizing.
   - **Tracked-fund overlay** (per `tracked_funds.json`): compare your current book to most recent 13F holdings of all tracked funds. Output (a) overlap table (held names that the fund also owns, with delta vs prior quarter if known), (b) tracked-fund-held names not yet in your book — candidate list for evaluation, (c) tracked-fund EXITS in last quarter on names you still hold — divergence signal. When a fresh 13F drops in the past week (~mid-Feb/May/Aug/Nov), run a one-shot fund-delta deep dive.
6. Write `research/YYYY-MM-DD-weekly.md` with the synthesis and a "Monday morning action list."

### Analyst brief template (what PM sends each subagent)

```
You are the Research Analyst for [TICKER] ([COMPANY NAME]).

Position context: held=[YES/NO], shares=[N], avg cost=[€X], current weight=[X%],
unrealized P&L=[+/-X% / +/-€X]. Original thesis: "[THESIS_FROM_PORTFOLIO_JSON]"
(or "no thesis on file — infer from typical investor reasoning for this name").

Base currency EUR. Report using the output contract in /Users/stefanojanen/Documents/Personal/Investing with Claude/agents.md (section "Analyst output contract"). Do not deviate from the section names or order.

Data sources:
1. Morningstar MCP if authenticated — primary.
2. Yahoo Finance via WebFetch — fallback for quotes.
3. Company IR for primary filings if needed for thesis check.

Time horizon: focus on last 7 days of news + next 30 days of catalysts. Don't rewrite
the 10-K. Your job is DELTA since last review.

Write your full report to:
  /Users/stefanojanen/Documents/Personal/Investing with Claude/research/ticker-reports/[YYYY-MM-DD]-[TICKER].md

Return to me only: THESIS_STATUS, ANALYST_RECOMMENDATION, CONVICTION, KEY_RISK,
and one sentence of "most important thing PM should know."

You are NAME-LOCAL. Do not opine on portfolio construction or sizing. That is PM's job.
```

### Prompt B — New idea evaluation (single ticker, deep)

User: *"Deep dive on [TICKER] — is it worth adding?"*

PM spawns **two** analysts in parallel:
- One Investment Researcher on Sonnet — positive-bias brief ("build the best bull case for [T]").
- One Investment Researcher on Sonnet — negative-bias brief ("build the best bear case / red flag scan for [T]").

Then PM (Opus) reads both, runs its own variant perception test, and produces a GO / WAIT / PASS with EUR sizing.

### Prompt C — Risk stress test

User: *"Stress test the book"*

PM spawns:
- One `general-purpose` Sonnet agent per scenario (AI capex slowdown, power bubble, US recession, China AI crack, EUR strength) — each scenario agent estimates per-name drawdown.
- PM aggregates into portfolio EUR P&L by scenario and recommends hedges.

---

## Cost / latency notes

- 10 Sonnet analysts in parallel ≈ 3 minutes wall-clock vs ~15 min sequential.
- Opus only on PM synthesis = meaningful cost saving. Full weekly review estimated 4–5× cheaper than all-Opus.
- Haiku reserved for pure data-fetch tasks where no reasoning is needed (e.g., "pull close prices for these 45 tickers").

## Safety / correctness

- Analysts are **read-only**. They write markdown reports; they do not touch `portfolio.json` or `trades.log.jsonl`.
- Only the PM (main session, Opus) mutates state files.
- Analyst reports are kept on disk (`research/ticker-reports/`) so the PM's synthesis is auditable — if you disagree with a recommendation, you can trace which analyst input drove it.
- PM must cite analyst reports when making a recommendation (e.g., "TRIM MU — analyst flagged DRAM price deterioration, see research/ticker-reports/2026-04-26-MU.md").

## Invocation shortcuts

- *"Run multi-agent weekly"* → Prompt A
- *"Multi-agent dossier on [T]"* → Prompt B
- *"Multi-agent stress test"* → Prompt C
- *"Run single-analyst on [T]"* → one Sonnet analyst, no synthesis, fastest path to one report

---

## Tranche framework — event-trade vs thematic-core (added 2026-04-30)

Every position belongs to one of three tranche types. Different exit logic applies to each. Source of truth: `tranches.json`. Active event-trade rules: `event_trades.json`.

| Tranche | Sized for | Exit logic |
|---|---|---|
| **`thematic_core`** | Long-horizon thesis conviction | Hold through noise. Trim only on **thesis break** or weight ≥ 1.5× target. Don't trim on news that *confirms* the thesis. |
| **`event_trade`** | Specific catalyst (earnings, contract, regulatory) | Trim 50–70% into post-catalyst gap-up by default. Full exit on miss. **Recoil/IV-crush is real.** Rules pre-committed in `event_trades.json` *before* the catalyst. |
| **`tactical_swing`** | Sentiment / sector rotation / technical | Hard time-stop, ATR-based exits. Not currently in use. |

**Critical:** The "don't trim winners on confirmation" rule applies to `thematic_core` only. Event trades **must** trim into the post-print gap because the catalyst that justified the size has resolved. See `memory/feedback_event_trade_exits.md` for the BE 2026-04-28 lesson.

### Workflow for event trades

1. **At entry**: log to `event_trades.json` with entry, catalyst date, **pre-committed exit rules** (if-beat-+5%, if-beat-+10%, if-inline, if-miss-5%, if-miss-10%).
2. **Pre-catalyst**: don't second-guess the rules; the rule book is the playbook.
3. **At catalyst**: execute the rule that matches the outcome. No emotional reassessment.
4. **Post-catalyst**: log actual outcome vs expected for calibration. Move to `closed_event_trades`.

### Default exit rule template (use unless name has specific reason to deviate)

```
if_beat_+5_to_10pct_AH:    Trim 50% into gap, hold 50% runner 5–7 days
if_beat_+10pct_plus:       Trim 60–70% into gap, hold lottery-ticket runner
if_inline_or_chop_+/-2pct: Hold 24–48h. If no follow-through, exit by Friday.
if_miss_-5_to_10pct:       Full exit at next-day open.
if_miss_-10pct_plus:       Full exit immediately.
```

### Slash command stack (built 2026-04-30)

- `/invest:daily` — daily portfolio + watchlist + calendar lookahead with conditional deep-dive on de-risking setups
- `/invest:preprint [TICKER]` — pre-print scoring + rule lock-in to event_trades.json
- `/invest:exitcheck [TICKER]` — post-print mechanical rule execution
- `/invest:insiders [TICKER?]` — Form 4 cluster scan (alpha signal layer)
- `/invest:contracts [TICKER?]` — government contract flow for defense + AI-power names

---

## Cross-position read-through framework (added 2026-04-30)

When one held name has a material event (earnings, contract, regulatory), the move usually has correlated implications for thematically-linked names. The daily run (`/invest:daily` Worker B) and earnings exits (`/invest:exitcheck`) should reference this map to flag sympathy moves before they're priced.

### Correlation map for current book

| Trigger event on... | Strong read-through to | Weaker read-through to |
|---|---|---|
| **BE** (fuel cells, AI-power) | VST, EQT, APLD, CEG (watchlist) | NVDA, MU, AVGO (compute demand confirmation) |
| **VST** (merchant power) | BE, EQT, CEG (watchlist) | APLD (data center demand) |
| **EQT** (natgas / AI-power) | VST, BE, ET (watchlist) | CEG (power complex) |
| **APLD** (data center landlord) | BE, VST, EQT | NVDA, AVGO, MU (compute fill at landlords) |
| **NVDA** (GPU compute) | AVGO, MU, ANET (watchlist) | APLD (GPU customers fill DCs), AI-power complex |
| **AVGO** (custom silicon + networking) | NVDA, ANET (watchlist), MU | GOOG (TPU customer) |
| **MU** (memory / HBM) | Samsung GDR (watchlist) | NVDA, AVGO (memory consumers) |
| **GOOG** (capex + cloud) | AVGO (TPU silicon partner), NVDA, MU, APLD | Entire AI-infra stack |
| **MP** (rare earths) | KTOS (defense supply chain) | AVAV (watchlist) |
| **KTOS** (defense) | AVAV (watchlist), MP (materials) | RTX, GE (watchlist, primes) |
| **APP** (ad-tech AI) | GOOG (ad-market), RDDT/PINS (watchlist) | None for AI-infra book |

### Correlation directionality

- **Positive correlations**: a clean print on one name lifts related names; a miss drags them
- **Inverse correlations** (rare in this book): MU vs Samsung GDR — Samsung HBM4 qualification at NVIDIA is bearish for MU
- **Mixed**: BE Project Jupiter (fuel cell win replacing gas turbines) — bullish for AI-power demand generally, mildly bearish for VST/EQT (lost specific Oracle Project Jupiter share)

### How to apply in daily run

When Worker A (portfolio status) flags a held name with a >3% single-day move on news:
1. Check the correlation map for read-through names
2. Check whether those read-through names have moved sympathetically yet
3. If sympathy move hasn't fully priced in: flag as "read-through bid likely; monitor for entry"
4. If sympathy move has overshot: flag as "potentially mispriced — fade candidate" (rare)

### Calibration

Track read-through accuracy in `event_trades.json` `read_through_log` array over time. After 6 months of data, refine the correlation map based on actual co-movement patterns.
