---
description: Insider Form 4 scan — flags cluster buying, unusual sells, and 10b5-1 plan changes for held names + watchlist
argument-hint: [TICKER?] (optional; defaults to held + Tier 1/2 watchlist)
---

# /invest:insiders [TICKER?]

Daily-compatible alpha signal — heavy insider buying is among the most reliable retail-accessible signals. Heavy insider selling outside automatic plans is a meaningful warning. This command scans Form 4 filings via openinsider.com and flags signal-grade activity.

## Process

### Step 1 — Scope

- **With `[TICKER]`**: scan that single name only.
- **Without argument**: scan all held names + watchlist names that scored Tier 1 or Tier 2 in the most recent `/invest:daily` calendar lookahead. Exclude CRWV per hard exclusion.

### Step 2 — Pull Form 4 data

Use WebFetch on `http://openinsider.com/screener?s=[TICKER]&o=&pl=&ph=&ll=&lh=&fd=730&fdr=&td=0&tdr=&fdlyl=&fdlyh=&daysago=30&xp=1&xs=1&vl=&vh=&ocl=&och=&sic1=-1&sicl=100&sich=9999&grp=0&nfl=&nfh=&nil=&nih=&nol=&noh=&v2l=&v2h=&oc2l=&oc2h=&sortcol=0&cnt=100&page=1` (last 30 days).

Parse for each filing:
- Insider name + title (CEO, CFO, Director, 10% Owner, etc.)
- Transaction date
- Buy / Sell
- Shares + value (USD)
- % change in insider's holdings
- 10b5-1 plan flag (vs discretionary)

### Step 3 — Apply signal filters

**Cluster buy signals (high alpha):**
- ≥3 distinct insiders buying in last 30 days (cluster signal)
- CEO + CFO buying together
- Director buying after a stock decline ≥10%
- Buy size >$100k for officers, >$500k for directors (insiders rarely buy small)

**Cluster sell signals (warning):**
- CEO or CFO selling >50% of personal holdings (outside 10b5-1)
- Multiple officers selling within 5 trading days
- 10b5-1 plan started shortly before a major print (planned cover)

**Routine / no signal:**
- Tax-related disposals (vesting cover, exercise-and-sell)
- Small-dollar transactions (<$25k for officers)
- 10b5-1 plan executions on schedule

### Step 4 — Output

Format:

```
# /invest:insiders [TICKER or "all"] — Form 4 Scan

## 🟢 Cluster buy signals
| Ticker | Insiders | Total $ | Last 30d | Note |
|---|---|---|---|---|
| ... | CEO + 2 Directors | $1.2M | YYYY-MM-DD | "Cluster buy after -12% drawdown" |

## 🔴 Cluster sell warnings
| Ticker | Insider | $ | % of holdings | Plan? | Note |
|---|---|---|---|---|---|
| ... | CFO | $400k | 60% | Discretionary | "Pre-print sell 5 days before earnings" |

## ⚪ Routine activity (no signal)
- [TICKER]: 1 director small buy, 2 officers vesting cover. No signal.

## Action items
- [If cluster buy on a Tier 1 setup] → strengthens the de-risking thesis
- [If cluster sell on held name] → run /invest:thesis [TICKER] to reassess

## Sources
[openinsider.com URLs cited]
```

### Step 5 — Persist

Append summary to `research/daily/index.md`:
- `[DATE] /invest:insiders → [N] cluster buys, [N] cluster sells flagged`

If a held name has a cluster sell warning, also log to `event_trades.json` `alerts` array (create if missing).

---

## Honor durable preferences

- Never include CRWV in scans
- Date format MM-DD by default
- Don't lecture on risk if a sell signal appears — flag the data, recommend `/invest:thesis`, move on

---

## Edge cases

- **No Form 4 activity in window**: return "No notable insider activity for [TICKER] in last 30 days."
- **Foreign-listed names** (Samsung, Chinese fabs, Japanese names): SEC Form 4 doesn't apply — return "Form 4 doesn't cover non-US-listed names. Check local filings."
- **Recent IPO** (e.g., CRWV [excluded], NBIS): insider lockup expirations create artificial sell signals — note explicitly.
- **Activist filings** (13D/13G): out of scope but flag if seen.

---

## Argument parsing

- `[TICKER]` optional. Single ticker if provided.
- Optional `--days [N]` flag: window in days (default 30).
- Optional `--min-value [USD]` flag: filter out transactions below threshold (default $25k officers / $100k directors).
- Optional `--include-routine` flag: show routine activity that's normally filtered out.

---

## Example invocation

```
User: /invest:insiders KTOS

Tool:
- Fetches openinsider.com Form 4 data for KTOS, last 30 days
- Finds: 1 director sold 50% of holdings 04-15 (discretionary), no buys
- Output: 🔴 Cluster sell warning — director discretionary sell on KTOS
- Action: "Run /invest:thesis KTOS pre-print on 05-06 to reassess"
- Logs alert to event_trades.json
```

---

## When NOT to use

- For broad market timing (insider data is noisy at index level)
- As a sole signal for a trade decision (combine with setup score, fundamental check)
- For micro-cap names where insider holdings are too concentrated to be informative
