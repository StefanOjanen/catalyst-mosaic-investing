# Catalyst Mosaic — Dashboard

A local, single-user web dashboard for the Catalyst Mosaic investing framework. It turns the framework's JSON state files into a glanceable, Bloomberg-terminal-styled UI and puts the `/invest:*` skills one click away — without leaving your machine.

> Companion to the framework in the repo root. The **data tabs work standalone**; the **Assistant** (chat) shells out to the Claude Code CLI and your own `/invest:*` skills.

## Features

- **Holdings** — positions table, marked to **live prices** automatically (shares × live quote × FX), with concentration flags.
- **Charts** — normalized performance vs a benchmark (SPY), allocation donut, unrealized P&L, cluster exposure.
- **Risk** — correlation heatmap, effective-bets / diversification / portfolio-β, a benchmark-shock scenario, and an opportunity-cost "redeploy" ranker.
- **Catalysts** — earnings command-center cards with countdowns, pre-committed exit rules, and a full forward calendar.
- **Tranches**, **Research** (markdown viewer), **Trades**, **Lists** (sortable watchlist + tracked funds/analysts).
- **Setup** — a wizard that imports a broker **screenshot / image / PDF / CSV / XLSX** (parsed by Claude) into an editable preview, then writes `portfolio.json` (previous file backed up first).
- **Assistant** — a prominent "Run daily check" action plus the `/invest:*` skills grouped by flow; replies stream live; write-skills are gated by a snapshot + Keep/Revert diff review.

## Stack

- **Backend** — Node + Express. Reads the JSON/CSV state files, proxies daily/live prices from Yahoo Finance, computes risk analytics, and (for the Assistant) spawns `claude -p` and relays its `stream-json` output over SSE.
- **Frontend** — Vite + React + TypeScript + Tailwind v4 + Recharts, IBM Plex Mono.

## Quick start

```bash
# 1) backend  (http://127.0.0.1:4317)
cd server && npm install && npm run dev

# 2) frontend (http://127.0.0.1:5173)  — in a second terminal
cd web && npm install && npm run dev
```

Open **http://127.0.0.1:5173**. With no configuration it runs on the bundled `sample-data/` (fictional holdings) so you can explore immediately.

## Pointing it at your data

The backend resolves its data directory (`DATA_ROOT`) in this order:

1. `DATA_ROOT` environment variable (set it in `server/.env`), else
2. the parent folder if it contains a `portfolio.json`, else
3. the bundled `sample-data/`.

So either set `DATA_ROOT=/path/to/your/data` in `server/.env`, or run the dashboard from inside a framework checkout where your real `portfolio.json` lives one level up. The expected files match `sample-data/` (and the repo's `*.example.json`): `portfolio.json`, `goals.json`, `event_trades.json`, `tranches.json`, `earnings_calendar.json`, `tracked_funds.json`, `tracked_analysts.json`, `watch_list_normalized.csv`, `trades.log.jsonl`, and `research/daily/*.md`.

## Assistant / skills

The Assistant pane runs `claude -p` in your data directory, so it loads your `CLAUDE.md`, memory, and `.claude/commands/invest/*` skills. It requires the [Claude Code](https://claude.com/claude-code) CLI installed and authenticated. Read-only skills run with write tools disabled; the write-skills (`preprint`, `exitcheck`, `goal`) snapshot the target file and show a Keep/Revert diff before anything persists. The data tabs work fine without Claude Code.

## Privacy & security

- Binds to `127.0.0.1` only — **never** expose it to a network.
- Your real data is **never committed**: it lives outside this folder (or in gitignored files); only `sample-data/` is in the repo.
- API keys live in `server/.env` (gitignored) and stay server-side; the browser only ever calls this app's own `/api`.

## Optional

- `server/.env` → `COINGLASS_API_KEY=` enables an (optional) crypto-macro panel hook.
- Price history/quotes use Yahoo Finance's public chart endpoint (no key).
