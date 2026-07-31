# merawallet

**A passkey is the wallet.** Chrome extension (Manifest V3) wallet for Monad mainnet built on
[`@category-labs/mera`](https://mera.category.xyz) — WebAuthn PRF entropy instead of a seed
phrase, in-memory signing sessions that zero their keys, and swaps routed by the
[NullTerminal](https://nullterminal.xyz) aggregator API. UI is a port of the NullTerminal
design system (Monad-violet terminal aesthetic).

Built from a single deep-dive spec: [`docs/BUILD_PROMPT.md`](docs/BUILD_PROMPT.md)
(design tokens in [`docs/DESIGN_DOSSIER.md`](docs/DESIGN_DOSSIER.md)).

## How it works

```
passkey (WebAuthn PRF, rpId nullterminal.xyz)
  └─ 32-byte PRF output  = BIP-39 entropy (24 words, re-derivable — that IS the backup)
       └─ BIP-44 m/44'/60'/0'/0/i → secp256k1 key → mera signing session → viem account
```

- **Passkey mode** — nothing secret is ever stored; the phrase re-derives from a ceremony.
- **Vault mode (import)** — an existing mnemonic is AES-256-GCM-encrypted behind a new
  passkey (`createSecretVaultWithNewPasskey`); only ciphertext is persisted.
- **Unlock model** — the BIP-39 seed sits in `chrome.storage.session` (memory-only, cleared
  when the browser exits, auto-lock timer on top). Signing derives a key, signs, and calls
  `session.end()` — keys never outlive one operation.
- **Ceremonies run in a tab** (`onboarding.html`) — Chrome closes the popup when the OS
  passkey sheet appears (documented WebAuthn-in-extensions limitation, Chrome 122+).
- **Swap** — `GET /v1/quote` → `POST /v1/swap` on `api.nullterminal.xyz`; the returned
  transaction is signed verbatim (the engine is the source of truth, no client DEX logic).

## Develop

```bash
npm install
npm run typecheck
npm run build        # → dist/ (loadable extension)
npm run dev          # UI preview in a plain tab (chrome.* shimmed in-memory)
npm run icons        # regenerate public/icons from scripts/gen-icons.mjs
```

## Load in Chrome

1. `npm run build`
2. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick `dist/`
3. The passkey console opens on install — create a wallet with one prompt.

Requires Chrome 122+ and an authenticator with the WebAuthn **PRF** extension
(iCloud Keychain, Google Password Manager, 1Password, YubiKey 5+…).

## Feature map

| Surface | Features |
| --- | --- |
| Popup · Wallet | balances (Multicall3 sweep over the NT token list), USD via `/v1/tokens/market`, send (MON + ERC-20), receive (QR) |
| Popup · Swap | NullTerminal aggregator quotes (10s refresh), route/impact/fee-tier display, approve→swap for ERC-20 inputs |
| Popup · Activity | local history with receipt polling (~300ms blocks), MonadScan links |
| Popup · Settings | HD account switcher/derive, RPC override, slippage, auto-lock, reveal phrase, lock |
| Onboarding tab | create / sign-in / import / unlock / reveal — every WebAuthn ceremony |

## Non-goals (v1)

No dApp injection (`window.ethereum`), no Solana (mera supports ed25519 — later), no
multichain, no WalletConnect. See `docs/BUILD_PROMPT.md` §11.
