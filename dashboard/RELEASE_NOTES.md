# Catalyst Mosaic Dashboard — v0.1.0

First release of the **web dashboard** for the Catalyst Mosaic investing framework. Until now the framework was CLI + JSON only; this adds a local, single-user UI on top of it — a Bloomberg-terminal-styled cockpit that visualizes your book and runs the `/invest:*` skills from the browser. Runs entirely on `127.0.0.1`; your real data never leaves your machine and is never committed.

## Highlights

- **Live-marked book.** Holdings and the Total-Book hero recompute from live prices (shares × live quote × FX) every 60s — you only ever re-enter share counts when you trade.
- **One-click daily flow.** A prominent **Run daily check** action (with last-run date + jump to the latest report); the rest of the skills are grouped by flow — Explore / Catalysts / Review / Manage.
- **Import wizard.** Drop, click, or paste (⌘V) a broker **screenshot, image, PDF, CSV, or XLSX** → Claude extracts holdings into an editable preview → save to `portfolio.json`. The previous file is backed up first.

## What's included

**Tabs**
- **Holdings** — live-marked positions table, totals hero (book / equity / cash / unrealized / realized / target-gap), concentration flags.
- **Charts** — normalized performance vs SPY (1M/3M/6M/1Y), allocation donut, unrealized-P&L bars, cluster exposure.
- **Risk** — correlation heatmap, effective-bets, average correlation, portfolio β (SOXX/SPY), diversification ratio, annualized vol, a benchmark-shock scenario, and an opportunity-cost redeploy ranker.
- **Catalysts** — earnings command-center cards (countdown, pre-committed exit rules, daily-σ reference) + a collapsible full calendar.
- **Tranches** — target vs current weights, thesis + break-triggers per holding.
- **Research** — markdown viewer for `research/daily/*`.
- **Trades** — append-only trade log.
- **Lists** — sortable watchlist (held-first / ticker / name / exchange) + tracked funds & analysts.
- **Setup** — the import wizard + "keep it up to date" guidance.

**Assistant**
- Streams `claude -p` output over SSE with tool-use progress, per-message cost/duration, and session resume.
- Slash-command autocomplete (`/invest:…`) and a flow-grouped launcher.
- Write-skills (`preprint`, `exitcheck`, `goal`) are gated by a pre-write snapshot + **Keep / Revert** diff review.

**Backend**
- Express API over the framework's JSON/CSV state, with a path-escape guard and a read whitelist.
- Yahoo Finance proxy for daily history + live quotes (no key), cached.
- Risk analytics (returns, vol, β, pairwise correlation, portfolio aggregates).
- File-watcher → SSE so panels auto-refresh when state files change.

## Stack

Node + Express · Vite + React + TypeScript · Tailwind v4 · Recharts · IBM Plex Mono.

## Running it

```bash
cd dashboard/server && npm install && npm run dev   # http://127.0.0.1:4317
cd dashboard/web    && npm install && npm run dev   # http://127.0.0.1:5173
```

Ships with `sample-data/` (fictional holdings) so it runs immediately. Point it at real data via `DATA_ROOT` in `server/.env`. See `dashboard/README.md` for details.

## Notes & limitations

- Single-user, localhost-only by design (no auth).
- The Assistant requires the Claude Code CLI installed + authenticated; the data tabs work without it.
- Image/PDF import uses a Claude call (token cost); CSV/XLSX parsing is cheaper.
- Live prices come from Yahoo Finance's public chart endpoint.
