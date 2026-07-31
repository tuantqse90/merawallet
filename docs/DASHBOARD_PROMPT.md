# BUILD PROMPT — merawallet v0.6: the Dashboard (expanded view)

> Fourth build prompt. MetaMask has its expanded view / Portfolio page; merawallet gets a
> full-tab **Dashboard** that no Monad wallet can copy, because it drinks straight from the
> NullTerminal data platform (the whole point: wallet = the first-party client of the
> "Jupiter of Monad" API). All endpoint shapes below verified live on 2026-07-31.

## Verified data surface (api.nullterminal.xyz)

- `GET /v1/portfolio/:wallet/history` → `{points: {t,v}[], current: {t,v}}` — **portfolio
  USD value over time** (the hero chart MetaMask Portfolio charges for).
- `GET /v1/portfolio/:wallet/trades` → `{trades: {t, side, usd, tokenAmt, token, symbol,
  tx}[]}` — the wallet's DEX buy/sell tape.
- `GET /v1/portfolio/:wallet/pnl` → totals + per-token TokenPnl (already wired in popup).
- `GET /v1/portfolio/:wallet/pnl-calendar` → `{days: {date, realizedUsd, trades}[],
  firstDate, realizedTotal}` — day-by-day realized PnL, UTC.
- `/v1/tokens`, `/v1/tokens/market`, `/v1/tokens/chart/:addr?tf=1h` — already wired.

## The page

`dashboard.html` — a real extension tab (like onboarding), force-dark NT terminal. Opened
from a new **expand icon** in the popup header (MetaMask's exact affordance) and available
whenever a wallet exists — viewing needs no unlock (addresses are public; signing stays in
popup/approval flows). Locked state shows a `locked` chip, never blocks reading.

Layout: fixed left sidebar (mark + wordmark, nav, account chip with avatar + copy, live
block/gas telemetry at the bottom) + a max-width content pane on `bg-grid` with the violet
`bg-glow-top` wash. Five views, local-state routing:

1. **Overview** — headline total (count-up) + 24h chip + address; the **portfolio value
   area chart** from `/history` (large Sparkline, current/high/low readouts); **allocation
   donut** of top-5 holdings + other, using NullTerminal's validated categorical viz slots
   (`--viz-1..5`, ported into globals.css); PnL tiles; five most recent trades.
2. **Tokens** — holdings table (token, price, 24h, balance, value) sorted by value,
   linking each row to nullterminal.xyz/token/:addr.
3. **PnL** — totals, per-token ROI table, and the **realized-PnL calendar heatmap**
   (last ~16 weeks, GitHub-style: mint intensity for green days, danger for red,
   muted for flat) with realizedTotal caption.
4. **Trades** — full tape: time, buy/sell chip, symbol, token amount, USD, MonadScan tx
   link. Empty state explains it reads router swaps from the NT index.
5. **Markets** — top-30 Monad tokens by 24h volume (list ∪ market map): price, 24h,
   volume, link out to NullTerminal. The wallet doubles as a market terminal.

## Build notes

- New Vite input `dashboard.html` → `src/dashboard/` (main, App, views/, Donut).
- Sparkline gets a `useId`-based gradient id (multiple instances per page) — keep the
  existing draw-on animation.
- Donut = SVG stroke-dasharray segments over a muted track; legend with `.font-mono-num`
  percentages; center shows holding count.
- Reuse popup data hooks (chrome.storage is shared across extension pages); `?demo` seeding
  moves to a shared `src/lib/demo.ts` so popup and dashboard previews both work.
- Popup header: expand icon (chrome.tabs.create dashboard.html) beside the account chip.
- English-only copy, mono numerals everywhere, panels `glass rounded-2xl`, controls
  `rounded-xl`. Version 0.6.0. Acceptance: typecheck+build clean, screenshots of Overview
  and Markets, committed and pushed.
