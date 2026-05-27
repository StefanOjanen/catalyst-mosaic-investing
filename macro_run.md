# Macro Catalyst Run — `/invest:macro` Specification

**Purpose:** Weekly Sunday-evening structured pull of next-week macro events + per-event sensitivity mapping to held positions. Fills the gap between ad-hoc macro chatter in daily Worker B and durable position-management discipline.

**Frequency:** Once per week. Recommended cadence: **Sunday evening (US time) before futures open**, or Monday morning pre-open at latest.

**Constraint:** Macro is overlay, not a primary trade driver — book is themed around AI/AI-power/critical-materials, not macro betas. Macro run flags WHICH events could disrupt theme execution, not which macro trades to make.

**Trigger:** `/invest:macro` invocation, OR scheduled via `/loop` or `/schedule` for Sunday 18:00 user time.

---

## Inputs

| File | Purpose |
|---|---|
| `portfolio.json` | Held positions for sensitivity mapping |
| `tranches.json` | Thesis-break triggers — flag macro events that could activate them |
| `earnings_calendar.json` | Cross-reference: any held names printing in the macro-event window? |
| Memory: `user_financial_situation.md` | Cash runway + risk-tolerance context |

---

## Process

### Step 1 — Pull next week's macro calendar (Sonnet, ~3 min)

Sources to scan (in order of authority):
- **Fed**: federalreserve.gov calendar — FOMC meetings, Beige Book, Powell/Warsh testimony, Fed minutes release
- **BLS**: bls.gov/schedule — NFP, CPI, PPI, JOLTS, average hourly earnings
- **BEA**: bea.gov/news/schedule — PCE, GDP, personal income/spending
- **Treasury**: treasurydirect.gov — 10Y/30Y auctions, Treasury refunding announcements
- **Other**: ISM (mfg + services PMI), University of Michigan consumer sentiment, China NBS data releases
- **Geopolitical**: Trump-Xi meetings, OPEC+ decisions, ECB / BoJ rate decisions

Identify the **3 most market-moving events** in the next 7 days. Default-high-impact: CPI, FOMC, NFP, major Treasury auctions, PPI, PCE.

### Step 2 — Per-event sensitivity mapping (Sonnet, ~3 min)

For each of the top 3 events, generate:

1. **Average S&P 500 move on event day** (last 12 instances, ±%)
2. **Sectors most likely to react** — link to specific XL* ETFs
3. **Direct read-through to held positions** — for each held name, score sensitivity HIGH / MEDIUM / LOW with one-line rationale
4. **Held names where event could activate a thesis-break trigger** (per `tranches.json`)
5. **Conditional trim/add hedges** if any held position has asymmetric exposure (e.g., MU has high IV pre-CPI, partial trim could lock gains)

Example mapping (CPI hot print):
- AI-compute cluster (MU, NVDA, AVGO): HIGH sensitivity — multiple compression on hot CPI
- AI-power (BE, VST, EQT): MEDIUM — rate-sensitive utilities take hit; gas demand thesis intact
- KTOS / MP (defense / materials): LOW — government-backed contracts dampen
- Cash buffer importance: if CPI hot, gap-down risk → buffer matters

### Step 3 — Cross-reference earnings-calendar (Opus PM, ~1 min)

Are any held names printing in the same window as a macro event? Compound binary risk if so — flag as elevated.

### Step 4 — Write report

Write to `research/macro/YYYY-WW-macro.md` (where WW is ISO week number). Format:

```markdown
# Macro Week — YYYY-WW (Mon DD - Fri DD)

## Top 3 events this week

### Event 1: [name] — [day] [time]
- **Consensus:** [number/range]
- **Average S&P move on event day:** ±X%
- **Sectors most sensitive:** [list]
- **Held position read-through:**
  - HIGH sensitivity: [names + rationale]
  - MEDIUM: [names]
  - LOW: [names]
- **Thesis-break activation risk:** [list any tranches.json triggers that could fire]

### Event 2: [...]
### Event 3: [...]

## Held names printing this week
- [names + dates + intersection with macro events]

## Action queue
- [Pre-event hedges if any]
- [Cash buffer assessment]
- [Position-management considerations]

## Sources
- [URLs]
```

### Step 5 — Append summary

Append a one-line summary to `research/macro/index.md` (running log).

---

## Integration with daily / weekly runs

- **Daily run** (`/invest:daily` Worker B): when a macro event is **today**, Worker B's news scan elevates it as the lead item (current ad-hoc; now structured per the weekly map)
- **Weekly run** (`/invest:weekly`): the macro run's output feeds the weekly synthesis as a "macro overlay" section
- **Event-day discipline**: if macro print runs hot/cold and triggers a held-position thesis-break trigger, escalate to PM for review, not auto-trim

---

## Cost calibration

Per weekly run: ~30-60k tokens (2 Sonnet workers + Opus synthesis). Cheap. ~50 weeks/year × 45k = ~2.5M tokens/year.

---

## Failure modes

| Failure | Mitigation |
|---|---|
| Event-day move overshoots sensitivity estimate | Sensitivity is reference, not forecast — manage via cash buffer + thesis flags |
| Macro-overlay analysis paralysis | Tight scope: 3 events max per week, sensitivity HIGH/MED/LOW only, no fine-grained scenario trees |
| Geopolitical event surprises mid-week | Daily Worker B macro check catches these; weekly macro_run is for SCHEDULED events |

---

## Phase 2 enhancements

- **Macro regime tracker** — separate weekly assessment of broader regime (risk-on vs risk-off, rates trajectory, dollar strength). Affects cluster-rotation calls (AI-compute vs AI-power vs defense)
- **Cross-asset reads** — fixed-income, commodity, FX moves that cross-correlate to held names (e.g., natgas spot for EQT, USD/CNY for MP rare-earth thesis)
- **Calibration log** — track macro-event-day actual moves vs predicted sensitivity; refine over 6-12 months
