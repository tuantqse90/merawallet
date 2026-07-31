# RESEARCH PROMPT — merawallet v0.5: what makes it *the* Monad wallet

> Third build prompt. Research question: with keyring/dApp/swap/charts shipped, what set of
> upgrades makes merawallet unambiguously the classiest wallet on Monad? Method: audit what
> MetaMask/Rabby/Phantom have that we lack, what NullTerminal's API offers that NO wallet
> anywhere has, and what Monad-specific truths (300ms blocks, gas-limit charging, WMON
> everywhere) deserve first-class UI. Findings below are verified against live endpoints;
> execute everything.

## Research findings

1. **NullTerminal computes wallet PnL** — `GET /v1/portfolio/:wallet/pnl` (live, verified):
   `{tokens: TokenPnl[], realized, unrealized, total, updatedAt}` where TokenPnl =
   `{token, symbol, logo, realizedUsd, unrealizedUsd, totalUsd, costRemaining, curValue,
   curAmount, avgCost, roiPct, untrackedAmount, untrackedValue}` — average-cost basis over
   the full dex_trades index. **No wallet on Monad shows native PnL. This is the flex.**
2. **Monad's speed is invisible in every wallet** — 300ms blocks deserve a live telemetry
   readout, not a static "Monad" label.
3. **Rabby-class safety features are the trust bar**: unlimited-approval warnings,
   contract-recipient detection, recipient identicons (address-poisoning defense).
4. **Native-MON MAX is subtly broken in most wallets** (sends full balance → no gas left;
   worse on Monad, which charges the gas LIMIT). Gas-aware MAX is correctness, not polish.
5. **WMON wrap/unwrap is daily Monad life** and takes two selectors (`deposit()`,
   `withdraw(uint256)` — canonical WETH9 interface).
6. **dApps expect `wallet_watchAsset`** (add-token button on every token page).
7. **A user-set RPC that dies bricks the wallet** — viem `fallback()` to the default fixes it.

## Execution plan (all items)

### A. PnL view (the differentiator)
Portfolio gets a segmented control `tokens | pnl`. PnL panel: three stat tiles
(total / realized / unrealized, mint-or-danger), then per-token rows (logo, symbol,
totalUsd, roiPct badge, avgCost). Empty state explains PnL tracks DEX trades.
Fetch on demand, cache 60s. Powered-by-NullTerminal micro-caption.

### B. Live Monad telemetry bar
Thin strip above the tab bar: `⛓ block 12,345,678 · ~300ms · <gwei> gwei`, polling
`eth_blockNumber` + `eth_gasPrice` every 2s while the popup is open; block number pulses
mint on change. font-mono-num, muted; the wallet feels *live*.

### C. WMON wrap / unwrap
TokenDetail for MON gains **Wrap**, for WMON gains **Unwrap**: inline amount → one tx
(`deposit()` payable / `withdraw(amount)`), gas-aware MAX, activity entries
`Wrap X MON → WMON` / `Unwrap X WMON → MON`.

### D. Gas-aware MAX (correctness)
Native-MON MAX in Send = balance − 21000 × gasPrice × 2 (floored at 0). ERC-20 MAX
unchanged.

### E. Safety pack
- Approval window: ERC-20 `approve` with amount ≥ 2²⁵⁵ shows an amber
  **"Unlimited spending approval"** banner (+ human amount otherwise).
- Send: `getCode(recipient)` → "Recipient is a smart contract" hint when non-empty.
- Send: identicon `<Avatar>` appears beside a valid recipient — glanceable
  address-poisoning defense (recents chips already carry short addresses).

### F. wallet_watchAsset
Background accepts `{type:"ERC20", options:{address,symbol,decimals,image}}` → approval
mini-screen (logo, symbol, address) → saves to `customTokens` in storage.local → portfolio
and token pickers merge custom tokens (deduped against the NT list) → returns `true`.

### G. RPC resilience
`getPublicClient`/`getWalletClient` use viem `fallback([userRpc, defaultRpc])` when the
user overrides the RPC — a dead custom endpoint degrades instead of bricking.

Version 0.5.0. Acceptance: typecheck + build clean; screenshots of PnL view and telemetry
bar; all seven items implemented; UI stays NullTerminal-native, English-only.
