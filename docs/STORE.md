# Chrome Web Store submission kit

Everything needed to publish merawallet. Assets live in `store/` (5 × 1280×800 PNG),
the upload zip is produced by `npm run package` → `merawallet-<version>.zip`.

## Runbook

1. Create a developer account at https://chrome.google.com/webstore/devconsole
   ($5 one-time fee) with the account that should own the listing.
2. **New item** → upload `merawallet-0.7.0.zip`.
3. Fill the listing from the copy below; upload `store/1-…5-….png` in order.
4. **Privacy practices** tab: paste the justifications below, link the privacy policy
   (host `docs/PRIVACY.md` — easiest: make the GitHub repo public and use the
   github.com blob URL, or serve it at nullterminal.xyz/merawallet/privacy).
5. Submit for review. Crypto wallets get a manual review — expect a few days and a
   possible request to clarify the host permissions; the answers below cover it.

## Listing

- **Name**: `merawallet — Monad passkey wallet`
- **Summary** (132 max — manifest description, 130 chars):
  `Passkey-native Monad wallet. Your passkey is the wallet — no seed phrase to lose. Connects to dApps, swaps routed by NullTerminal.`
- **Category**: Productivity → Tools
- **Language**: English

**Description**:

```
A passkey IS the wallet.

merawallet derives your Monad account from a WebAuthn passkey (Touch ID, iCloud
Keychain, YubiKey…). There is no seed phrase to write down at onboarding, no custody
service, and no key file to leak — your authenticator holds the entropy, and every
signing key lives in memory only for the moment it signs.

— PASSKEY NATIVE. One prompt creates the wallet. The recovery phrase stays
  re-derivable from your passkey (standard BIP-39/44 — portable to any wallet).
— BEST-PRICE SWAPS. Quotes routed across 16 Monad venues by the NullTerminal
  aggregator, with honest price impact and tiered fees.
— A REAL DAPP WALLET. EIP-1193 + EIP-6963 provider: connect to any Monad dApp,
  approve every signature in a dedicated window, revoke sites any time.
— BUILT-IN PNL. Average-cost PnL per token, computed by the NullTerminal index —
  realized, unrealized, ROI, and a trading calendar.
— A FULL DASHBOARD. Portfolio value chart, allocation, DEX trade tape, and live
  Monad markets in an expanded view.
— MONAD FIRST. Live 300ms block telemetry, WMON wrap/unwrap, gas-aware MAX,
  unlimited-approval warnings, contract-recipient hints.

Non-custodial: merawallet never transmits or stores your keys anywhere. Requires an
authenticator with the WebAuthn PRF extension (iCloud Keychain, Google Password
Manager on Android, YubiKey 5+). On macOS, save the passkey to iCloud Keychain.
```

## Privacy-practices justifications

- **Single purpose**: a non-custodial cryptocurrency wallet for the Monad network.
- **storage**: persists non-secret wallet metadata (public addresses, settings,
  transaction history, encrypted vault ciphertext) locally in the browser.
- **tabs**: needed to identify which site a dApp request came from and to deliver
  responses/events (accountsChanged) back to connected dApp tabs.
- **Host permission — nullterminal.xyz**: Chrome requires a host permission for the
  WebAuthn relying-party ID the wallet's passkeys are bound to.
- **Host permission — api.nullterminal.xyz**: token lists, prices, swap routes, and
  portfolio analytics (read-only public API).
- **Host permission — rpc.monad.xyz**: reading balances and broadcasting the
  transactions the user signs.
- **Content scripts on all sites**: the standard wallet-provider pattern
  (EIP-1193/EIP-6963): an inert provider object is exposed so dApps can request a
  connection. It reads nothing from pages; every sensitive action requires explicit
  user approval in an extension-owned window.
- **Remote code**: none — all scripts, styles, and fonts ship inside the package.
- **Data collection**: none collected, sold, or transferred. RPC/API endpoints
  necessarily see the wallet's public address and IP, as with any blockchain client.

## Assets

| File | Shows |
| --- | --- |
| store/1-passkey.png | Boot screen + "a passkey is the wallet" |
| store/2-swap.png | Live aggregator quote (rate, impact, route) |
| store/3-dashboard.png | Expanded-view overview |
| store/4-markets.png | Live Monad markets with per-row charts |
| store/5-console.png | Passkey console (create/sign-in/import) |

Store icon: `public/icons/icon128.png`.
