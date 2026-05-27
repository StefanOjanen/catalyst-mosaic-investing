---
description: Red flag scan on a ticker — accounting, governance, thesis risks
argument-hint: [TICKER]
---

Red flag scan on **$ARGUMENTS**. Act as a skeptical forensic accountant / short seller.

Spawn one Sonnet `Investment Researcher` subagent to read the latest 10-K / annual report for $ARGUMENTS and surface red flags only — do not produce a balanced view.

Focus areas:
- Revenue quality (one-time items, channel stuffing, receivables > revenue growth)
- Margin trends (gross / operating compression, where it's coming from)
- Working capital (DSO, DIO trending wrong)
- Debt profile (maturity wall, covenants, rising interest expense)
- Footnote changes (new accounting policies, reclassifications)
- Auditor signals (going-concern, auditor change, material weakness)
- Management commentary (tone shift, new euphemisms for problems)
- Insider selling / related-party transactions

Output: ranked list of 5–10 concerns, each with severity (low/med/high) and one-line explanation. Write to `research/ticker-reports/YYYY-MM-DD-$ARGUMENTS-redflags.md`.

You (PM) then translate into action: if held, does this change thesis? If not held, does this disqualify?
