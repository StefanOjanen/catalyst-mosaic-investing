---
description: Pre-print decision tool — scores a ticker against the de-risking filter, generates pre-committed exit rules, and locks them into event_trades.json
argument-hint: [TICKER]
---

# /invest:preprint [TICKER]

Pre-earnings decision tool. Run 1–2 trading days before any earnings print on a watchlist candidate or held name where you might pre-position. Replaces ad-hoc deliberation with a setup-scored decision and locks the exit rules in advance.

## Process

### Step 1 — Load state

1. Read `event_trades.json` — check if `[TICKER]` already has an active event trade. If yes, abort: "[TICKER] already has an open event trade [ID]. Use /invest:exitcheck after the print, or close the existing trade first."
2. Read `portfolio.json` — get current holdings, cash, position weight if held.
3. Read `tranches.json` — get tranche classification + thesis-break triggers if held.
4. Read `earnings_calendar.json` — confirm `[TICKER]` has an upcoming print in the next 7 trading days. If not, abort: "No print scheduled in the next 7 days. Use /invest:dossier for general thesis work."
5. Read `earnings_strategy.md` — pull the 5-criteria filter and default exit rule template.
6. Read memory: `feedback_no_crwv.md`, `feedback_event_trade_exits.md`, `user_execution_pattern.md`.

If `[TICKER]` is CRWV, abort immediately per hard exclusion.

### Step 2 — Score against the 5-criteria de-risking filter

Use WebSearch + WebFetch to gather:
- Stock price now + 10 trading days ago (compute % move)
- Sector ETF (XLK / SMH / IGV / XLE / etc.) move over same 10 days (compute relative weakness)
- Implied move from options (Yahoo / MarketChameleon / TipRanks if available)
- Beat history: last 4 EPS prints (beat/miss/in-line)
- News scan last 30 days for thesis-break triggers (use `tranches.json` triggers if held; otherwise infer typical bull case for the name and check for breaks)

Score each criterion ✅ / ❌ / ⚠️ (uncertain):

| # | Criterion | Threshold | Score |
|---|---|---|---|
| 1 | Stock down ≥5% in last 10 trading days | ≥5% | ✅/❌/⚠️ |
| 2 | Underperformed sector ETF by ≥3% in last 10 days | ≥3% | ✅/❌/⚠️ |
| 3 | Implied move ≥7% | ≥7% | ✅/❌/⚠️ |
| 4 | ≥3 of last 4 prints were beats | ≥3 of 4 | ✅/❌/⚠️ |
| 5 | No major thesis-break news in last 30 days | clean | ✅/❌/⚠️ |

Cite sources for each.

### Step 3 — Tier classification + decision

Total score:
- **5/5 ✅** = Tier 1+ (rare; near-perfect setup)
- **4/5 ✅** = Tier 1 (high-conviction de-risking play)
- **3/5 ✅** = Tier 2 (monitor, marginal)
- **≤2/5 ✅** = Skip (no edge)

**Disqualifiers (any one kills the setup):**
- Stock up >10% in last 10 days into the print → "positioning is long, opposite of de-risked"
- Major thesis crack within 30 days
- Implied move <5% (no IV cushion)
- 2+ consecutive misses

### Step 4 — Generate pre-committed exit rules

Use the default rule template from `earnings_strategy.md` unless specific name characteristics warrant deviation:

```
if_beat_+5_to_10pct_AH:    Trim 50% into gap, hold 50% runner 5–7 days
if_beat_+10pct_plus:       Trim 60–70% into gap, hold lottery-ticket runner
if_inline_or_chop_+/-2pct: Hold 24–48h. If no follow-through, exit by Friday.
if_miss_-5_to_10pct:       Full exit at next-day open.
if_miss_-10pct_plus:       Full exit immediately.
```

Customize per the specific position size — convert "trim 50%" into specific share counts.

### Step 5 — Sizing recommendation

Calculate:
- Available cash from `portfolio.json`
- Recommended size: 5–8% of book per Tier 1 setup; 3–5% per Tier 2 monitor (only enter if subsequent confirming signal)
- Max single-name event-trade size: respect "no single name >20%" rule even with the new add
- Adjust if held: an "add" event trade against an existing thematic_core position uses different sizing math (small additive tranche, not full position size)

Output specific share count, EUR cost estimate, FX assumption, and limit price guidance.

### Step 6 — Output decision

Format:

```
# /invest:preprint [TICKER] — Pre-Print Decision

## Setup score: X/5

| # | Criterion | Score | Detail |
|---|---|---|---|
| 1 | Down ≥5% in 10d | ✅ | -X% in 10 days |
| 2 | Underperformed sector ≥3% | ✅ | -X% vs SMH |
| 3 | Implied move ≥7% | ✅ | ~X% per options |
| 4 | ≥3 of 4 beats | ✅ | 4/4 beats |
| 5 | No thesis-break | ✅ | clean |

## Tier: [Tier 1 / Tier 2 / Skip]

## DECISION: [PRE-POSITION / WAIT / SKIP]

[If PRE-POSITION:]
## Pre-committed exit rules (will be written to event_trades.json on confirm)
- Beat +5–10% AH: trim X sh, hold Y sh
- Beat +10%+ AH: trim X sh, hold Y sh
- In-line / chop: hold full, exit Friday if no follow-through
- Miss −5–10%: full exit next-day open
- Miss −10%+: full exit immediately

## Recommended order
- BUY [N] sh [TICKER] @ $X limit DAY
- Estimated cost: ~€XXX
- Cash remaining post-fill: ~€XXX
- Position weight at fill: X.X%

[If WAIT:]
## Why wait
- [specific criterion not yet met or signal still developing]
## Re-check on
- [date / specific trigger]

[If SKIP:]
## Why skip
- [disqualifier triggered or score too low]

## Sources
[URLs from web research]
```

### Step 7 — Confirm + persist

After presenting the decision:
- **If PRE-POSITION**: ask user "Confirm pre-position with these rules? (yes/no/modify)". If yes, append entry to `event_trades.json` `active_event_trades` with full pre_committed_exit_rules. Don't update portfolio.json (user executes manually and pastes confirmation).
- **If WAIT or SKIP**: don't write to event_trades.json. Append a brief note to `research/daily/index.md` log: "[DATE] /invest:preprint [TICKER] → [decision], score X/5".

### Step 8 — Calibration log

Append to `event_trades.json` `calibration_log`:
- Setup score at entry
- Each criterion's status
- Probability assigned to each rule scenario (estimated from setup score)
- This data feeds the EV-calibration journal over time

---

## Honor durable preferences (from memory)

- **Never recommend CRWV.** Hard exclusion.
- **Honor LITE PASS verdict** and **AVAV WAIT verdict** unless the user explicitly overrides.
- **Don't push trim/discipline recommendations more than once.** If the user says skip, log the override and move on.
- **Use MM-DD date format** in output.
- **Match user's "max money" framing** — present the decision decisively, no risk-tolerance lectures.
- **Surface aggregate concentration math** — if pre-positioning would push any cluster >5pp above target, flag it explicitly.

---

## Edge cases

- **Stock data unavailable / market closed**: use last close + 10-day prior close from public sources. Flag if data is stale.
- **Implied move data not available**: estimate from name's average post-print move historically (typical 5-10% for most AI-semis, 8-15% for SMID-caps).
- **Setup score borderline (3.5/5 between two tiers)**: default to the more conservative tier (Tier 2 = monitor only).
- **Held name pre-print**: focus on whether to ADD ahead of the print, not initiate. Use smaller add-tranche sizing (~2-3% of book).
- **Multiple event trades open**: if 2+ already active in `event_trades.json`, warn that adding a third exceeds the "max 2 active event trades" rule from `earnings_strategy.md` and require explicit override.

---

## Argument parsing

- `[TICKER]` is required. Single ticker per invocation.
- Optional `--score-only` flag: runs steps 1-3 (load + score), skips rule generation. Useful for quick screening.
- Optional `--simulate` flag: runs full process but does NOT write to event_trades.json. Useful for testing.
- Optional `--size [EUR]` flag: override the auto-sized recommendation with a specific EUR amount.

---

## Example invocation flow

```
User: /invest:preprint EXAMPLE

Tool:
- Loads EXAMPLE state. Confirms no existing event trade. Print date confirmed.
- WebSearches price action, sector compare, options IV, beat history, recent news.
- Scores:
  ✅ Down 7% in 10 days
  ✅ Underperformed sector ETF by 4%
  ✅ IV ~9%
  ⚠️ 2 of 4 last beats (mixed)
  ✅ No thesis-break in 30 days
  → 4/5 = Tier 1
- Recommends: PRE-POSITION N sh EXAMPLE at $limit DAY, sized to ~5% of book
- Generates rules: trim into +5-10% gap, larger trim on +10%+ gap, etc.
- Asks user: "Confirm pre-position with these rules? (yes/no/modify)"
- On yes: appends to event_trades.json. User executes order manually.
```

---

## When NOT to use this command

- For thematic-core positions on regular-cadence earnings (use `/invest:thesis` for drift check, not pre-positioning logic)
- For names with a current PASS dossier verdict (the dossier already said no)
- For tickers without a print scheduled in the next 7 trading days (use `/invest:dossier` for general thesis work)
- For CRWV — hard exclusion, abort immediately
