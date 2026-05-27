---
description: Pre-trade sanity check before executing
argument-hint: BUY/SELL QTY TICKER [at PRICE]
---

Pre-trade sanity check: **$ARGUMENTS**

Before I execute, pressure-test:
1. Fit — does this match existing thesis (if held) or portfolio structure (if new)?
2. Weight — post-trade weight %, and does it respect "no single name >20%"?
3. Concentration — does this worsen the AI-power theme concentration (~77% baseline)?
4. Better-expressed version — is there a peer I should own instead that captures the same bet?
5. Entry level — reasonable vs 50-day avg and 52-week range? Pull live quote.
6. Event proximity — any earnings / catalyst in the next 10 days I'd be buying into?
7. OSK eligibility — is this instrument allowed in the Osakesäästötili wrapper? (listed equity = yes; ETF/option/bond = no)

Verdict: **GO / WAIT / DON'T** with one-paragraph reasoning. Be direct.

If GO, also compute the expected post-trade portfolio stats (new weights, new theme concentration, remaining cash).
