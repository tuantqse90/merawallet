# merawallet privacy policy

_Last updated: 2026-07-31_

merawallet is a non-custodial cryptocurrency wallet for the Monad network, published
as a Chrome extension.

## What we collect

**Nothing.** merawallet has no backend, no analytics, no telemetry, and no accounts.
We do not collect, store, sell, or share any personal data.

## Where your data lives

- **Keys**: your wallet is derived from a WebAuthn passkey held by your device's
  authenticator (e.g. iCloud Keychain). Private keys exist only in memory, only for
  the moment they sign, and are zeroed afterwards. They are never written to disk and
  never leave your device.
- **Local data**: public addresses, settings, transaction history, connected-site
  records, and (for imported wallets) a passkey-encrypted ciphertext vault are stored
  in your browser's extension storage on your device. Uninstalling the extension
  deletes them.

## Network requests the wallet makes

Like any blockchain client, merawallet talks to public endpoints to function. These
services see your public wallet address and IP address as an inherent part of serving
the request:

- **Monad RPC** (`rpc.monad.xyz`, or an RPC you configure): reading balances and
  broadcasting transactions you sign.
- **NullTerminal API** (`api.nullterminal.xyz`): token lists, prices, swap routes,
  and portfolio analytics for addresses you view.
- **Token logo hosts**: token icons load from the URLs published in token lists.

merawallet sends nothing else to anyone.

## dApp connections

Sites you explicitly connect can see your public address and may request signatures;
every request is shown to you for approval in a wallet-owned window and can be
declined. You can disconnect any site in Settings at any time.

## Contact

Issues and questions: https://github.com/tuantqse90/merawallet/issues
