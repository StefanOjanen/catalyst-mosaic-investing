---
description: Government contract flow scan — pulls SAM.gov + USAspending.gov data for defense + AI-power names; flags new awards and forward-indicator filings (Sources Sought / RFI / RFP)
argument-hint: [TICKER?] (optional; defaults to defense + AI-power universe)
---

# /invest:contracts [TICKER?]

Government contracts are leading-indicator data for several names in the book. New awards land in press releases days-to-weeks after the actual award shows in USAspending.gov. Sources Sought / RFI filings on SAM.gov can preview contracts months before they're awarded. This command surfaces both.

## Scope universe (when no ticker specified)

Defense + AI-power + critical-materials names where government contracts are material:
- **Held**: KTOS, MP, BE, EQT, VST
- **Watchlist (high relevance)**: AVAV, CEG, RTX, GE, PLTR, FEIM
- **Watchlist (medium relevance)**: KEYS, SITM, ANET (federal IT contracts)

Non-relevant names skipped (NVDA, MU, AVGO, etc. are commercial-driven).

## Process

### Step 1 — Determine scope

- **With `[TICKER]`**: scan that single name. If not in the relevant universe, warn but proceed.
- **Without argument**: scan the full relevant universe.

### Step 2 — Pull contract data

For each name in scope:

**A. USAspending.gov — recent awards (last 30 days)**

WebFetch query: search for awards where the recipient name matches the company. URL pattern:
`https://www.usaspending.gov/search/?hash=...` or via API `https://api.usaspending.gov/api/v2/search/spending_by_award/`

Parse:
- Award date
- Award amount (USD)
- Awarding agency (DoD, DOE, NASA, etc.)
- Sub-agency / program
- Contract description / NAICS
- Period of performance

**B. SAM.gov — Sources Sought / RFI / RFP / Solicitations (forward-looking)**

WebFetch query on SAM.gov for solicitations that mention the company by name in solicitation history, OR scan high-relevance NAICS codes for new RFIs:
- Defense unmanned systems (KTOS, AVAV)
- Rare-earth magnet supply (MP)
- Fuel-cell / power generation (BE, VST, CEG)
- Natural gas / pipelines (EQT, ET)
- Frequency / time products (FEIM, SITM)

Forward-looking flags:
- Sources Sought = early-stage interest, 6-12 months out from award
- RFI = mid-stage, 3-6 months out
- RFP / Solicitation = active competition, 1-3 months out

### Step 3 — Apply filters

**Signal-grade events:**
- New award ≥$10M for defense names
- New award ≥$50M for power names
- DoD multi-year IDIQ contract awards
- Sources Sought specifically naming the company in narrative
- RFP where the company is widely expected to win (incumbent, sole-source candidate)

**Noise (filter out):**
- Sub-$1M task orders on existing contracts
- Routine renewals
- Vague NAICS-only matches

### Step 4 — Output

Format:

```
# /invest:contracts [TICKER or "all"] — Government Flow Scan

## 🟢 New awards (last 30 days)
| Ticker | Date | Amount | Agency | Description | Read-through |
|---|---|---|---|---|---|
| KTOS | YYYY-MM-DD | $42M | USAF | "CCA Increment 2 study" | Strengthens 05-06 print thesis |

## 🟡 Forward-looking (Sources Sought / RFI / RFP)
| Ticker | Stage | Title | Posted | Expected award | Note |
|---|---|---|---|---|---|
| MP | Sources Sought | "Domestic NdFeB magnet supply" | YYYY-MM-DD | 2026-Q4 | Direct read on 10X demand |

## ⚪ Watch-only
- [Names with no notable activity in window]

## Action items
- [If new award on held name pre-print] → strengthens setup
- [If RFP win on watchlist name] → re-score in next /invest:daily
- [If contract loss / non-renewal] → potential thesis-break, run /invest:thesis

## Sources
[USAspending.gov + SAM.gov URLs cited]
```

### Step 5 — Persist

Append summary to `research/daily/index.md`:
- `[DATE] /invest:contracts → [N] new awards, [N] forward filings flagged`

For high-signal events on held names, log to `event_trades.json` `alerts` array.

---

## Honor durable preferences

- Skip CRWV (not in scope universe anyway)
- Date format MM-DD
- Combine with `/invest:insiders` output mentally — concurrent insider buying + contract win is the strongest possible bullish signal

---

## Edge cases

- **Company name fuzzy-matching issues** on USAspending: try multiple variants (e.g., "Bloom Energy" + "Bloom Energy Corporation" + "Bloom Energy Inc")
- **Subsidiary contracts**: defense names often have subsidiary names on awards (e.g., AVAV → BlueHalo). Include subsidiary names in queries.
- **Classified contracts**: not visible in USAspending. SAM.gov only shows unclassified. Note this caveat.
- **API rate limits**: if USAspending API is rate-limited, fall back to web search ("Company Name DoD contract YYYY-MM-DD").

---

## Argument parsing

- `[TICKER]` optional. Single ticker if provided.
- Optional `--days [N]` flag: window for awards (default 30).
- Optional `--min-amount [USD]` flag: filter awards (default $1M).
- Optional `--forward-only` flag: skip awards, only show Sources Sought / RFI / RFP.

---

## Example invocation

```
User: /invest:contracts KTOS

Tool:
- USAspending.gov: $14.6M VAPOR Army production contract awarded 2026-04-08 (already in tape)
  + $4.2M AFRL extension on existing R&D contract
- SAM.gov: 1 new Sources Sought filing 2026-04-22 — "Group 1 Loitering Munitions IDIQ" (relevant to Switchblade)
- Output: 1 new award flagged, 1 forward filing
- Action: "Sources Sought on Loitering Munitions — read-through to KTOS Switchblade unit. Re-check setup pre-05-06 print."
- Cross-references with /invest:insiders KTOS director-sell warning from earlier today — flags conflict for /invest:thesis review
```

---

## When NOT to use

- For non-defense / non-power names where commercial revenue dominates (NVDA, MU, AVGO, etc.)
- As a sole trade signal — confirms / contradicts other signals, doesn't drive decisions on its own
- For early-stage / small-cap names where any single contract would be material noise
