# Prompt library — Investing with Claude

Tailored prompts for this project. Each one assumes Claude has already loaded `portfolio.json`, `watch_list_normalized.csv`, and the memory system. Just paste and run. Square brackets `[LIKE_THIS]` are fill-ins.

**Why these work (design principles from the research):**
1. **Role persona** — "act as a portfolio manager at a $2B fund" meaningfully shifts output quality.
2. **Structured output** — asking for specific sections (bull / bear / catalyst / recommendation) produces more usable answers than open-ended questions.
3. **Chain-of-thought** — explicitly ask Claude to reason step by step before concluding.
4. **Variant perception** — force identification of where your view diverges from consensus, not just restate consensus.
5. **Sequence matters** — disruption scan → red flag scan → bull/bear → position sizing is a stronger workflow than any single prompt.
6. **Source material beats questions** — paste the earnings transcript, the 10-K section, the analyst note. Specific input → specific output.

---

## 1. Portfolio-level prompts

### 1a-multi. Weekly review, multi-agent (preferred)
```
Run the multi-agent weekly review per agents.md Prompt A.
- Fan out Sonnet Investment Researcher subagents in parallel, one per ticker in scope.
- Each writes to research/ticker-reports/.
- You (Opus) synthesize into research/YYYY-MM-DD-weekly.md with Monday-morning actions.
```

### 1a. Weekly review, single-agent (fallback)
```
Run the weekly review. Use Morningstar for quotes, WebFetch for news/earnings.
Structure the note as:

1. Headline — portfolio MV, WoW / MTD / YTD return in EUR, best/worst position.
2. Per-holding table — price chg WoW, news catalysts last 7d, earnings within 30d, thesis check (still intact / drifting / broken).
3. Watchlist scan — top 5 movers ±5%, call out anything with a catalyst.
4. Concentration & risk — flag if AI-power theme exposure moved materially, flag single-name weight >20%.
5. Actions — explicit BUY / ADD / TRIM / SELL / HOLD recommendations with conviction (low/med/high) and EUR sizing.

Write to research/YYYY-MM-DD-weekly.md. End with a one-paragraph "what I'd do Monday morning" summary.
```

### 1b. Portfolio attribution (quarterly-ish)
```
Attribute portfolio performance since [DATE]. Decompose total return into:
- Stock selection (did I pick the right names within the theme?)
- Thematic tilt (was the AI-power theme the right bet vs S&P 500 / MSCI World in EUR?)
- FX (USD/EUR impact on USD-denominated holdings)
- Sizing (did the biggest positions drive the return, or the small ones?)

End with: one thing that worked I should do more of, one thing that didn't I should stop.
```

### 1c. Risk check
```
Stress-test the portfolio against these scenarios and estimate EUR drawdown:
1. AI capex cycle slows — "magnificent 7" capex cut 20%, MU/NVDA/AVGO/ANET hit hardest.
2. US data-center power bubble deflates — VST/CEG/BE/SEI down 30%.
3. US recession — broad 15% market draw, defensives hold better.
4. China AI optical names crack — watchlist names 300394/300308/300502 down 40%.
5. USD/EUR to 1.25 (EUR strengthens) — translation loss on USD book.

For each, estimate EUR P&L impact and name the top 3 positions that drive the loss.
Then: what single hedge or trim would most improve the worst-case outcome?
```

---

## 2. Single-name research prompts

### 2a. Full institutional dossier
```
Produce an institutional-grade dossier on [TICKER]. Act as a senior analyst at a long-only
equity fund writing for the investment committee. Sections:

1. Business snapshot — what they do, segments, end markets, geographic mix.
2. Recent results — last 2 quarters beat/miss, guidance vs consensus, management tone shift.
3. Drivers — the 3 variables that determine the next 2 years of earnings.
4. Valuation — current multiples vs 5Y avg and vs peer median (name the peers).
5. Bull case — the scenario where it's a 2x in 3 years. What has to be true?
6. Bear case — the scenario where it's down 40%. What breaks it?
7. Variant perception — where does my/market view diverge from consensus? Be specific.
8. Catalysts — next 6 months, dated if possible (earnings, product launches, regulatory).
9. Fit with current book — correlation with my AI-power cluster; additive or concentrated?
10. Recommendation — BUY / HOLD / PASS, conviction low/med/high, suggested EUR sizing
    given my €25.8k book. If already held, ADD / TRIM / HOLD instead.

Use Morningstar for data. Cite sources for any claimed numbers. Avoid hedging language.
```

### 2b. Red flag scan (do this before any BUY)
```
Read [TICKER]'s latest 10-K / annual report and surface red flags only.
Ignore the bull case. Look at:
- Revenue quality (one-time items, channel stuffing, receivables growing faster than revenue)
- Margin trends (gross, operating, where compression is coming from)
- Working capital (DSO, DIO trending wrong)
- Debt profile (maturity wall, covenants, rising interest expense)
- Footnote changes (new accounting policies, reclassifications)
- Auditor signals (going-concern language, auditor change, material weakness)
- Management commentary (tone shift vs prior year, new euphemisms for problems)
- Related-party / insider selling patterns

Output format: ranked list of 5–10 concerns, each with severity (low/med/high) and a
one-line explanation of why it matters. No "on the other hand." Just the concerns.
```

### 2c. Business durability / moat check
```
How durable is [TICKER]'s business model on a 10-year horizon?
Score 1–5 on each, with one sentence justification:
- Switching costs
- Network effects
- Scale economies
- Intangibles (brand, patents, regulatory)
- Cost advantage (input, process, location)

Then answer: what would kill this business? Name the concrete mechanism.
Finally: is the current valuation pricing durability correctly, under-pricing it, or
assuming more durability than exists?
```

### 2d. Bull vs bear synthesis
```
Steelman both sides for [TICKER]. No hedging.
- BULL CASE (500 words): make the most compelling argument for 2–3x upside in 3 years.
  Name the specific metrics that have to move and by how much.
- BEAR CASE (500 words): make the most compelling argument for -50% in 2 years.
  Name the specific triggers.
- PROBABILITY WEIGHTING: assign % probability to bull / base / bear and justify.
- BASE CASE EV: expected return = prob-weighted outcomes. Is it worth owning given risk?
```

### 2e. Variant perception test (use before sizing up a conviction trade)
```
What does consensus believe about [TICKER] right now? Summarize in 5 bullets using
recent sell-side reports, earnings call Q&A tone, and forward estimates.

Then: where does my view diverge? If my view is identical to consensus, I have no edge
and should size the position as beta exposure, not a conviction bet. Tell me honestly.
```

---

## 3. Watchlist / idea-generation prompts

### 3a. Watchlist weekly scan
```
Scan watch_list_normalized.csv. For each ticker, pull last week's price change and any
material news. Rank the top 5 most interesting — defined as: meaningful move + genuine
catalyst (not just market beta). For each, one paragraph on what happened and whether
it warrants a deep-dive. Do NOT recommend buys yet — just flag the opportunities.
```

### 3b. Theme-coherent idea generation
```
I want [N] new ideas in the [THEME] theme. Must be:
- Not already in portfolio.json
- Market cap > $2B (ex-US: > €1B equivalent)
- Listed on an exchange Danske can trade (US major exchanges, Frankfurt, Helsinki,
  Stockholm, Oslo, Copenhagen, major EU). Avoid Chinese A-shares (not accessible
  via Danske retail).
- Additive to the book — not 0.9-correlated to positions I already own.

For each idea: thesis in 3 sentences, why now, key risk, starter position size in EUR.
```

### 3c. Earnings calendar ahead
```
Which of my holdings and watchlist names report earnings in the next 14 days?
For each: date, consensus EPS/rev, what the key read-through is for your book,
and whether I should pre-position / trim / hold into the print.
```

---

## 4. Pre-trade prompts

### 4a. Pre-trade sanity check
```
I'm thinking about [BUY/SELL] [QTY] shares of [TICKER] at market.
Before I execute, pressure-test:
1. Does this fit the thesis I already have on the name (if held) or the portfolio
   structure (if new)?
2. What's the current weight post-trade, and does it respect my "no single name >20%" rule?
3. Does this worsen concentration in the AI-power theme (currently ~77%)?
4. Is there a better-expressed version of the same bet (peer I should own instead)?
5. Is the entry price reasonable vs 50-day avg and 52-week range?
6. Any earnings / event in the next 10 days I'd be buying into?

Verdict: GO / WAIT / DON'T. Be direct.
```

### 4b. Position sizing
```
I've decided to add [TICKER]. Given:
- Conviction: [HIGH/MED/LOW]
- Book size: €25.8k (update if changed)
- Current position count: 10
- Max single-name weight: 20%
- Theme concentration limits: AI-power should drift down, not up

Recommend: target weight %, starter size in EUR, whether to build in tranches, and
where to add if the name drops -10% / -20% from entry.
```

---

## 5. Meta / calibration prompts

### 5a. Thesis drift check (run monthly)
```
For each holding in portfolio.json with a thesis note, compare the original thesis
against the last 90 days of news and results. Flag:
- Thesis INTACT — still playing out as expected
- Thesis DRIFTING — the story has changed but still credible, needs revised thesis
- Thesis BROKEN — the original reason to own is no longer true, should exit

For each DRIFTING or BROKEN, recommend action with conviction.
```

### 5b. Decision journal — pre-commit
```
Before I execute this trade, capture my reasoning for the record:
- What I'm doing and why (one paragraph)
- What has to be true for this to work
- What would tell me I'm wrong (specific trigger — price level, earnings miss, thesis event)
- How long I'm willing to give it
- What conviction I'd assign (1–10)

Save to research/decisions/YYYY-MM-DD-[TICKER].md
```

### 5c. Post-mortem on closed positions
```
Review every closed position in trades.log.jsonl. For each:
- Was the initial thesis right or wrong?
- Was the exit well-timed or forced?
- What, specifically, did I learn that changes future decisions?

Output a short "lessons" file. No "it's all learning" platitudes — I want concrete
changes to my process.
```

### 5d. Devil's advocate on the whole book
```
Argue that my current portfolio is badly positioned for the next 12 months. Be harsh.
Use public data, sentiment indicators, positioning reports, recent AI-capex commentary,
power-grid policy news. End with: the single change that would most reduce risk without
abandoning the core thesis.
```

---

## How to use this file

- **Don't paste prompts verbatim every time.** Reference them: "run prompt 1a" or "dossier on MP per 2a" and I'll execute with your current state loaded.
- **Prompts stack.** For a new idea: 2a (dossier) → 2b (red flags) → 2d (bull/bear) → 4a (sanity) → 4b (sizing). That's a full research cycle in 30 minutes.
- **Edit freely.** If a prompt produces output you don't like, tell me and I'll revise the template here — future sessions benefit.

---

## Research sources

Synthesized from:
- [Claude for Financial Services — Anthropic](https://www.anthropic.com/news/claude-for-financial-services)
- [Claude Skills for financial applications — Anthropic Cookbook](https://platform.claude.com/cookbook/skills-notebooks-02-skills-financial-applications)
- [financial-services-plugins — Anthropic GitHub](https://github.com/anthropics/financial-services-plugins)
- [8 AI Prompts That Replace a $25K/Year Financial Analyst — VC Corner](https://www.thevccorner.com/p/8-ai-prompts-that-replace-a-25kyear)
- [Claude for Investing: Complete 4-Level Setup — The AI Corner](https://www.the-ai-corner.com/p/claude-for-investing-4-level-system)
- [claude-trading-skills — tradermonty](https://github.com/tradermonty/claude-trading-skills)
- [claude-equity-research plugin — quant-sentiment-ai](https://github.com/quant-sentiment-ai/claude-equity-research)
- [Born to Be Claude: 5 Best Prompts For Analyzing a Stock — Jimmy's Journal](https://jimmysjournal.substack.com/p/born-to-be-claude-5-best-prompts)
- [Large Language Models in equity markets — Frontiers in AI](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1608365/full)
- [MarketSenseAI 2.0: Enhancing Stock Analysis through LLM Agents — arXiv](https://arxiv.org/html/2502.00415v2)
- [GuruAgents: Emulating Wise Investors with Prompt-Guided LLM Agents — arXiv](https://arxiv.org/html/2510.01664v1)
- [The AI Assisted Equity Research Library — Inferential Investor](https://www.inferentialinvestor.com/p/prompting-profits)
