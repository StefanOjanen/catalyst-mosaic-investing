---
description: Multi-agent deep dive on a ticker (bull + bear analysts in parallel)
argument-hint: [TICKER]
---

Multi-agent dossier on **$ARGUMENTS** per `agents.md` Prompt B.

1. Spawn two Sonnet `Investment Researcher` subagents in parallel:
   - Agent A: build the strongest BULL case for $ARGUMENTS. Steelman 2–3x upside in 3 years.
   - Agent B: build the strongest BEAR case + red flag scan for $ARGUMENTS. Steelman -50% in 2 years.
2. Each writes full findings to `research/ticker-reports/YYYY-MM-DD-$ARGUMENTS-bull.md` and `-bear.md`.
3. You (Opus) read both, run a variant perception test (where does my view diverge from consensus?), assign bull/base/bear probabilities, compute expected return.
4. Portfolio fit check: correlation with my AI-power cluster, sizing given €25.8k book, respect "no single name >20%" rule.
5. Final verdict: GO / WAIT / PASS with conviction (low/med/high), target weight %, EUR sizing, and entry plan (single tranche vs legs).
6. If already held: ADD / TRIM / HOLD instead of GO / WAIT / PASS.
