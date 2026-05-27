---
description: Thesis drift check on current holdings
---

For each holding in `portfolio.json` with a thesis note, compare the original thesis against the last 60–90 days of news and results.

For each, classify:
- **INTACT** — story still playing out as expected.
- **DRIFTING** — story has changed, still credible, thesis needs rewriting.
- **BROKEN** — original reason to own is no longer true; should exit.

For any DRIFTING or BROKEN positions, recommend specific action with conviction and EUR sizing.

For holdings with `thesis: null` in portfolio.json, flag them — I need to dictate thesis notes so future drift checks are grounded.

Write to `research/YYYY-MM-DD-thesis-drift.md`.
