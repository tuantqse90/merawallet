# UPGRADE PROMPT — merawallet v0.3: a real wallet for Monad

> The second build prompt. v0.1–0.2 (docs/BUILD_PROMPT.md) built a self-contained passkey
> wallet. This prompt turns it into a **MetaMask-grade wallet**: any dApp on Monad —
> nullterminal.xyz first — can discover it, connect to it, and ask it to sign, through the
> standard `window.ethereum` / EIP-6963 interfaces, with every request approved in a
> wallet-owned window. The popup also grows up: account identity, token detail, connected
> sites. Keep everything from v0.2 (passkey keyring, NT design system, swap via NT API).

## 1. What "a real wallet" adds (scope)

1. **dApp provider** — EIP-1193 `window.ethereum` + EIP-6963 multi-wallet announce,
   injected into every http(s) page. Chain: Monad only (`0x8f` / 143).
2. **Approval windows** — connect / sign message / sign typed data / send transaction each
   open a 372×640 extension popup window; nothing signs without an explicit click.
3. **Per-origin permissions** — `connectedSites` in storage.local; Settings lists and
   disconnects them; `accountsChanged` events flow to connected tabs.
4. **Wallet-grade popup identity** — deterministic gradient avatar, account bottom-sheet
   switcher, copyable address chip, Monad network pill, token-detail screen.

Non-goals (v0.3): multi-network UI, wallet_addEthereumChain, watch-asset, tx speed-up/nonce
management, hardware wallets, session-scoped per-account permissions (active account is the
connected account).

## 2. Provider architecture (MV3-safe)

```
page (MAIN world)          isolated world              service worker            approval window
┌─────────────┐  postMessage ┌────────────┐  sendMessage ┌─────────────┐  window  ┌────────────┐
│ inpage.js    │◄───────────►│ content.js │◄────────────►│ background  │◄────────►│ approval/  │
│ EIP-1193     │             │ relay only │              │ hub         │  storage  │ React UI   │
│ EIP-6963     │             └────────────┘              └─────────────┘  .session └────────────┘
└─────────────┘
```

- **inpage.ts** (MAIN world via manifest `content_scripts[].world: "MAIN"`, document_start,
  ZERO imports so it bundles as a classic script): the provider object. `request()` posts
  `{source:"mera:inpage", id, method, params}`; resolves on `{source:"mera:content", id,…}`.
  Exposes `isMera`, `chainId "0x8f"`, `networkVersion "143"`, `selectedAddress`, `on/
  removeListener`, legacy `enable()/send/sendAsync`. Announces EIP-6963
  (`rdns "xyz.nullterminal.merawallet"`, M-mark data-URI icon) on load and on
  `eip6963:requestProvider`. Sets `window.ethereum` only if absent — 6963 is the real path.
- **content.ts** (isolated, zero imports): dumb relay. Forwards page requests with
  `chrome.runtime.sendMessage` (waking the SW per request — no long-lived ports to babysit),
  pipes responses and `{type:"mera:asyncResult"|"mera:event"}` runtime messages back via
  `window.postMessage`.
- **background.ts** (hub):
  - *Read proxy*: allowlisted read methods (`eth_call`, `eth_getBalance`, `eth_blockNumber`,
    `eth_estimateGas`, `eth_gasPrice`, `eth_feeHistory`, `eth_getTransactionReceipt/ByHash`,
    `eth_getTransactionCount`, `eth_getCode`, `eth_getLogs`, …) → JSON-RPC fetch to the
    settings RPC. `eth_chainId`/`net_version` answered locally.
  - *Accounts*: `eth_accounts` → active address if origin connected, else `[]`.
    `eth_requestAccounts`/`wallet_requestPermissions` → approval flow (or instant if already
    connected). `wallet_revokePermissions` → disconnect. `wallet_switchEthereumChain` → ok
    for 0x8f, error 4902 otherwise.
  - *Approval flow*: `req:<uuid>` record `{id, origin, method, params, tabId}` into
    storage.session → `chrome.windows.create(approval.html?id=…)` → in-memory resolver map;
    `chrome.windows.onRemoved` without a result ⇒ EIP-1193 error 4001 (user rejected).
    **SW-death fallback**: the approval page reports its result with
    `chrome.runtime.sendMessage`; if the resolver map is gone (SW restarted), background
    delivers via `chrome.tabs.sendMessage(tabId, {type:"mera:asyncResult", id, …})` —
    inpage keeps pendings by id and dedupes, so either path may land first.
  - *Events*: on account switch / site disconnect (popup sends `mera:internal` messages),
    broadcast `accountsChanged` to connected origins' tabs.
- **approval/** (React page, full keyring access):
  - `connect` — origin, avatar + active account, Connect / Cancel.
  - `personal_sign` — origin + message (hex→utf8 when decodable). Wallet locked ⇒ inline
    "Unlock first" CTA → onboarding unlock tab → poll until unlocked.
  - `eth_signTypedData_v4` — domain summary + scrollable pretty JSON.
  - `eth_sendTransaction` — from-guard (must equal active account), to, MON value, decoded
    ERC-20 `transfer`/`approve` when the calldata matches, data size, gas estimate
    (best-effort), Confirm → sign via `withViemAccount` → broadcast → activity entry
    (kind `dapp`) → return the tx hash.

## 3. Popup redesign (NT skin, MetaMask bones)

- **Identity header** (Portfolio): `Avatar` (deterministic 2-hue gradient from address
  bytes) + account label + chevron → **AccountSheet** (bottom sheet: avatars, addresses,
  active ring, switch, "+ Derive next account"); copyable `0x1234…abcd` chip under the
  label; **network pill** (`● MONAD`) on the right.
- **TokenDetail overlay** — tapping a row opens it: logo, balance, USD value, price,
  24h change, Send (prefilled) / Swap buttons, MonadScan + NullTerminal token links.
- **Settings → Connected sites** — origin list with favicons, per-site Disconnect
  (notifies background → `accountsChanged []` to that origin).
- Activity gains kind `dapp` for transactions signed on behalf of sites.

## 4. Acceptance

1. On nullterminal.xyz, the wallet appears in the connect list (EIP-6963) as
   **merawallet** with the M icon; connecting opens the approval window; approving
   returns the active account and the site shows as connected in Settings.
2. `personal_sign` + `eth_signTypedData_v4` + `eth_sendTransaction` each round-trip
   through their approval screens; rejection returns EIP-1193 code 4001.
3. Read methods work without approval; `eth_chainId` is `0x8f` everywhere.
4. No page ever receives key material; signing happens only in extension pages with the
   storage.session seed; approval windows never auto-approve.
5. Popup: avatar/account sheet/copy/network pill/token detail/connected sites all live;
   typecheck + build clean; UI stays recognisably NullTerminal.
