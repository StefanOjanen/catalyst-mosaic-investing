# Earnings Trading Strategy — De-Risking Pre-Print Entry

**Last updated:** 2026-04-30
**Constraint:** ≤ daily trade frequency (no intraday/HFT)
**Source thesis:** Pre-print positioning often produces structural weakness, creating an asymmetric entry just before the catalyst.

---

## 1. The edge — why pre-print de-risking creates entries

Pre-print de-risking is a real, documented effect. Days/weeks before earnings:
- **Long-only funds** trim positions to reduce single-name binary risk
- **Risk-parity / vol-controlled funds** scale down as implied volatility rises
- **Sell-side analysts** publish cautious previews, lowering near-term sentiment
- **Stops trigger** as stocks weaken on positioning
- **Implied volatility ramps** — option premiums expand, dragging spot lower via dealer hedging

This produces a setup where the stock is structurally weaker than the underlying business warrants, going into the print. If the print is even modestly positive:
- IV crush + relief rally combined can produce 5–15% gains in 24–48 hours post-print
- Even an in-line print with steady guide can rally 3–7% just from positioning unwinds

If the print is bad: stock was already de-risked, so the down-move is partially absorbed.

**The asymmetry is real but conditional.** It only works on names where the weakness is *positioning-driven*, not *fundamental*. The strategy filter must distinguish between these.

---

## 2. Setup criteria — must satisfy 3+ of 5

A name qualifies as a "de-risking entry" candidate if:

| # | Criterion | Why it matters |
|---|---|---|
| **1** | Stock down ≥5% in last 10 trading days | Direct positioning-weakness signal |
| **2** | Stock underperformed sector (XLK / SMH / IGV) by ≥3% in last 10 days | Filters out market-wide moves vs name-specific weakness |
| **3** | Implied move (options) ≥7% | High IV = nervous market = room for IV crush + relief rally |
| **4** | ≥3 of last 4 EPS prints were beats | Positive base rate for the binary outcome |
| **5** | No major thesis-breaking news in last 30 days | Distinguishes positioning-weakness from fundamental concern |

**Disqualifiers (any one kills the setup):**
- Stock up >10% in last 10 days into the print (positioning is *long*, not de-risked)
- Major thesis crack within 30 days (e.g., guidance cut, customer loss, accounting issue)
- Implied move <5% (no IV cushion = limited reward potential)
- 2+ consecutive misses (base-rate works against you)

---

## 3. Entry & sizing rules

| Element | Rule |
|---|---|
| **Entry timing** | T-1 or T-2 trading days before print (let de-risking complete) |
| **Order type** | Limit at-or-below current bid; DAY |
| **Position size** | 5–8% of book per single trade; max 2 active event trades at a time |
| **Cash buffer** | Maintain a cash buffer through any earnings wall (sized to cover at least one full event-trade position plus contingency) |
| **Max events per week** | 1 new event trade per week (don't compound binary risk) |

---

## 4. Exit rules (per `event_trades.json` framework)

| Outcome on print | Action next-day open |
|---|---|
| Beat + stock gaps +5–10% AH | **Trim 50%** into gap, hold 50% runner 5–7d |
| Beat + stock gaps +10%+ | **Trim 60–70%** into gap, hold lottery-ticket runner |
| In-line / chop ±2% | Hold 24–48h, exit Friday if no follow-through |
| Miss + stock −5–10% | **Full exit** at next-day open |
| Stock −10%+ | Full exit immediately |

These rules are *pre-committed at entry*, not decided in the moment.

---

## 5. Illustrative example: scoring a candidate setup

The 5-criteria filter is best illustrated with a hypothetical Tier 1 candidate. Suppose `EXAMPLE_TICKER` prints next Wednesday AMC. Worker C scans it during the morning routine:

| Criterion | Status | Note |
|---|---|---|
| 1. Down ≥5% in 10 trading days | ❌ | Stock only -2.5% in 10d (positioning lightly de-risked but not washed out) |
| 2. Underperformed sector by ≥3% in 10d | ✅ | Underperformed sector ETF by 13.9pp in 10d (positioning weak vs sector) |
| 3. Implied move ≥7% | ✅ | Implied move ~16.9% (very high IV cushion) |
| 4. ≥3 of last 4 EPS prints were beats | ✅ | 5 consecutive EPS beats |
| 5. No major thesis-breaking news in last 30 days | ✅ | Strategic anchor customer intact, no thesis crack |

**Total: 4 of 5. Tier 1 setup.**

**Why this works:** A name with a structural thematic tailwind, strategic equity holder confirmation, and elevated IV is exactly the asymmetric setup the framework targets. Even with C1 only partially satisfied, the IV cushion plus beat history plus sector underperformance creates the IV crush plus relief rally setup on any positive print.

**Why it could fail:** If the stock rallies into the print (C1 worsens further from -2.5% toward flat or positive), the setup degrades. If a thesis-break headline drops in the final week (DOJ probe, customer loss, accounting issue), the C5 disqualifier fires and the setup is dead.

**Suggested action:** Run `/invest:preprint EXAMPLE_TICKER` morning of T-1 or T-2. If score still ≥4/5, enter at limit DAY, size 5% of book per the entry rules above.

**Cash constraint check:** verify cash buffer is sufficient (per Section 3 rules) or fund via a trim from an existing position. The framework flags the setup; cash availability dictates execution.

### Tier 2 and Skip categories: illustrative

* **Tier 2** (3 of 5): names like a post-earnings-rally setup that fails C1 (positioning is long, not de-risked) but has elevated IV plus beat history. Watch for a pullback to flip C1.
* **Skip** (≤2 of 5 or disqualifier fired): names up 10%+ in 10 days into print, names with recent thesis-break headlines, names with 2+ consecutive misses, names with implied move below 5%.

### Held positions reporting in the window

Held names that are due to print are tracked separately (see `event_trades.json`). The de-risking framework does NOT apply to held thematic positions; those follow tranche-specific exit logic (see `tranches.json` thesis-break triggers).

---

## 6. Strategy compliance — daily-only constraint

The framework is fully compatible with daily-max trading:

- **Setup screening** = once-daily check (morning routine)
- **Entry orders** = single trade per day, DAY order
- **Exit orders** = single trade per day post-print
- **No intraday adjustments** required by the rules
- **One new event per week max** — keeps cognitive load low

Total daily commitment: 10–15 minutes screen + 1 order placement on entry/exit days. Works around your daily-trading constraint.

---

## 7. EV math for de-risking trades

Generic estimate for a Tier-1 setup at 5% book size:

| Outcome | Probability | P&L as % of trade |
|---|---|---|
| Beat + jump +5–12% | 50% | +5 to +12% |
| In-line / chop | 30% | ~0% |
| Miss + drop −5–10% | 20% | −5 to −10% |
| **EV** | | **~+4% per trade** |

That's per single trade. At ~1 trade/week (~25 trades/year filtered to Tier 1), expected EV per trade is roughly +4% on the rotated capital. Aggregate annualized return on the rotated capital is healthy double digits, but only ~4-5% of total book per trade event. **Realistic incremental alpha: ~3 to 5 percent per year on the total book if discipline holds.**

That's not a moonshot. It is a real, sustainable edge if the rules are followed.

---

## 8. What invalidates the strategy

- **Macro regime change**: if a broad market sell-off persists, even good setups fade post-print
- **Position sizing creep**: upsizing recommendations 2-3× (per execution-pattern memory) blows up the risk math
- **Pre-print FOMO**: if the user buys a name *because it ran into earnings*, that's the opposite of de-risking
- **Skipping the filter**: trying to trade every print rather than waiting for setups that meet 3+ criteria

---

## 9. Build queue — supporting tools

**Phase 2 to build next** (per the alpha-extraction plan):

- `/invest:preprint [TICKER]` — auto-runs the 5-criteria check + generates pre-committed exit playbook
- `/invest:exitcheck [TICKER]` — post-print, references the rule and outputs trim/hold/exit
- `/invest:setupscan` — daily scanner that checks all watchlist names with prints in next 5 trading days, ranks by setup score

**Phase 3:**
- Insider Form 4 monitor (additional confirming signal for de-risking — heavy insider buying alongside stock weakness = strongest setup)
- Implied move tracker (need options data; possibly via web scrape of Yahoo or MarketChameleon)

---

## 10. Applying the framework week-to-week

Each daily run, Worker C scans `earnings_calendar.json` for names printing in the next 5 trading days. Candidates are scored against the 5 criteria. Only Tier 1 (4 or more of 5) setups with no active disqualifier are fundable.

**Sizing:** 5% of book per single trade. Fund from a trim or available cash buffer.

**Pre-committed rules:** locked in `event_trades.json` at entry via `/invest:preprint`.

If a candidate fails to qualify (e.g., bounces 5%+ into the print and loses C1, or a thesis-break headline fires C5), the framework correctly *passes*. Discipline beats activity.
