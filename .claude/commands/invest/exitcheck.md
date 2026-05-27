---
description: Post-print exit decision tool — references pre-committed rules in event_trades.json and outputs specific trim/hold/exit action
argument-hint: [TICKER]
---

# /invest:exitcheck [TICKER]

Post-earnings exit decision tool. Run the morning after a held position's print. Replaces emotional reassessment with mechanical rule execution.

## Process

### Step 1 — Load the event trade

1. Read `event_trades.json`.
2. Find the active event trade for `[TICKER]`. If none exists in `active_event_trades`, abort with: "No active event trade for [TICKER]. Either it's a thematic_core position (use /invest:thesis instead), or the event already closed."
3. Extract: entry price, entry shares, cost basis EUR, catalyst date, **pre-committed exit rules**.

### Step 2 — Pull actual print outcome

Use WebSearch + WebFetch to get:
- Earnings actual: revenue, EPS, key segment metrics
- Consensus expectations: revenue, EPS
- Beat/miss/in-line determination
- Forward guidance vs consensus
- Stock reaction: AH price move, next-day pre-market or open price
- Implied move (if pre-print options data available)

Cite sources.

### Step 3 — Match outcome to pre-committed rule

Use the rules captured at entry (from `event_trades.json` `pre_committed_exit_rules` field). Determine which scenario fired:

- `if_beat_+5_to_10pct_AH` — modest positive surprise
- `if_beat_+10pct_plus` — strong positive surprise
- `if_inline_or_chop` — no clear directional signal
- `if_miss_-5_to_10pct` — moderate negative surprise
- `if_miss_-10pct_plus` — strong negative surprise

If the actual outcome falls between two scenarios, default to the more conservative (e.g., +4.5% gap → use the in-line rule, not the beat-+5 rule).

### Step 4 — Output specific action

Format:

```
# /invest:exitcheck [TICKER] — Post-Print Decision

## Print result
- Revenue: $X (vs $Y consensus, +/-Z%)
- EPS: $X (vs $Y consensus, +/-Z%)
- Guide: [tone]
- AH / next-day move: ±X%

## Matched rule
"[exact text of rule from event_trades.json]"

## RECOMMENDED ACTION TODAY
- **Trade:** [SELL X sh / HOLD / FULL EXIT N sh]
- **Limit price:** [specific USD figure with rationale]
- **Order type:** DAY
- **Expected proceeds (EUR):** ~€XXX

## Position after action
- Remaining shares: N
- New weight: X.X% of equity
- Cost basis on remaining: €X (avg cost €X/sh)
- Cash freed: ~€XXX

## Cross-position read-through (if applicable)
- One-line implications for held names with thesis correlation
- Example: "BE clean print → expect APLD/VST sympathy bid +1-3% today"

## Source links
[citations from web search]
```

### Step 5 — Update state

After presenting the recommendation:
- **Do NOT update `portfolio.json`** until user pastes the trade confirmation
- **Do update `event_trades.json`**: move trade to `closed_event_trades` with the actual outcome and rule executed (or update status to `partially_closed_runner_held` if a partial trim)
- Append action to `trades.log.jsonl` as `event_trade_exit_recommended` with full context for audit trail

### Step 6 — Calibration log

Append to `event_trades.json` `calibration_log` array (create if missing):
- Setup score at entry (if available)
- Probability assigned at entry to each scenario
- Actual scenario realized
- This builds the EV-tracking corpus over time

---

## Honor durable preferences (from memory)

- **Don't push trim recommendations beyond once.** If the matched rule says trim and user declines, log the override but don't re-litigate.
- **Use MM-DD date format by default** in the output.
- **Never include CRWV** in cross-position read-through, even if relevant.
- **Match user's "max money" framing** — present the rule outcome decisively, no risk-tolerance lectures.

---

## Edge cases

- **No active event trade for ticker:** abort cleanly with explanation.
- **Print not yet released:** if WebSearch returns no Q[X] CY[YYYY] result, return: "[TICKER] has not yet reported. Use /invest:preprint instead." 
- **Conflicting data sources:** prefer official IR press release > Bloomberg > Yahoo Finance > generic aggregators. Note any conflicts.
- **Stock halted / pre-market not yet open:** flag as "Action pending market open" and recommend re-running the command 30 min after US open.
- **Position partially closed by prior runner-trim already:** apply rule to the *remaining* shares, not the original size.

---

## Argument parsing

- `[TICKER]` is required. Single ticker per invocation.
- Optional `--simulate` flag: runs the rule check without updating state files. Useful for testing.
- Optional `--rule-override [scenario_name]` flag: forces a specific rule to apply (e.g., for late re-evaluations after the matched rule was already executed once).

---

## Example invocation flow

```
User: /invest:exitcheck EXAMPLE

Tool:
- Loads EXAMPLE-YYYY-MM-DD event trade from event_trades.json
- Finds entry: N sh at $entry_price, catalyst date, rules locked
- WebSearches the company's quarterly earnings results
- Finds: rev beat consensus by X%, EPS beat by Y%, stock +Z% after-hours
- Matches rule: "if_beat_+5_to_10pct_AH" then "Trim 60% (3 of 5 sh), hold 40% runner"
- Outputs: SELL 3 sh EXAMPLE at $exit_limit DAY; expected post-fill weight ~3%
- Updates event_trades.json: status to "partially_closed_runner_held"
- Logs event_trade_exit_recommended to trades.log.jsonl
- Cross-read: outcome implications for held names in related sub-themes
```

---

## When NOT to use this command

- For thematic-core positions on regular-cadence earnings (those use `/invest:thesis` instead — different exit logic)
- For trades that aren't logged in `event_trades.json` (no rules to reference)
- More than 5 trading days post-print (the recoil window has closed; revisit thesis directly)
