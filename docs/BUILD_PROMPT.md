# BUILD PROMPT — merawallet

> The single deep-dive prompt this repo is built from. Everything below was verified against
> primary sources on 2026-07-31: the published `@category-labs/mera@0.1.0` tarball + its GitHub
> demo, MDN's WebAuthn-in-extensions doc, and the NullTerminal codebase. Follow it top to bottom.

---

## 1. Mission

Build **merawallet** — a Chrome extension (Manifest V3) crypto wallet for **Monad mainnet
(chain id 143)** whose entire key management is powered by **`@category-labs/mera`**
(Category Labs' passkey library): no seed phrase to write down at onboarding, no custody
service, no smart-account contracts. A passkey **is** the wallet. The UI is a faithful port of
the **NullTerminal design system** (Monad-violet terminal aesthetic), and the swap feature is
powered by the **NullTerminal public aggregator API** — making merawallet the first
third-party consumer of the "Jupiter of Monad" API.

Repo: `/Users/s6klabs/Desktop/hackgrowth/merawallet` — standalone git repo, not part of the
nullterminal workspace.

---

## 2. The mera library — verified API surface (v0.1.0)

`npm i @category-labs/mera` — ESM-only, deps: `@noble/curves`, `@noble/hashes`, `@scure/base`.
Optional peer: `viem ^2.28.0`. Two entry points: `.` and `./viem`.

### 2.1 Core exports (from the tarball's `src/index.ts`)

```ts
// Passkey ceremonies (WebAuthn + PRF extension)
createPasskeyWithPrfOutput({ rp: {id, name}, user: {name, displayName, id?}, timeout?, prfSalt? })
  // -> { credentialId, transports?, prfSalt, prfOutput }  (prfOutput = 32 bytes)
  // Creates a DISCOVERABLE, user-verified passkey with the PRF extension required.
  // Some authenticators don't evaluate PRF at create-time -> the lib silently falls back to a
  // second navigator.credentials.get() ceremony (= 2 OS prompts, expected, not a bug).
getPasskeyPrfOutput({ rpId, credential?, prfSalt?, timeout? })
  // -> { credentialId, prfOutput }
  // credential = {credentialId, transports?} pins one passkey via allowCredentials;
  // omit it for discoverable sign-in on a fresh device.
  // Default salt = sha256("mera.prf.salt.v1") — FIXED forever; PRF output is deterministic
  // per (credential, rpId, salt).

// Signing sessions (in-memory key, zeroed on end)
createSecp256k1SigningSession({ privateKey })  // -> { publicKey(65B), signDigest(d32), end() }
createEd25519SigningSession({ privateKey })    // -> Solana-side, NOT used in v1

// Addresses
getEvmAddress(publicKey)     // EIP-55 checksummed 0x address
getSolanaAddress(publicKey)  // NOT used in v1

// Secret vault (protect an IMPORTED secret behind a passkey)
createSecretVaultWithNewPasskey({ rp, user, secret, ... })       // -> PasskeySecretVault (JSON-safe)
createSecretVaultWithExistingPasskey({ rpId, credential?, secret, ... })
decryptSecretVaultWithPasskey({ rpId, vault })                   // -> secret bytes
parseSecretVault(json)
// Vault crypto: HKDF-SHA256(prfOutput, info="mera.v1.encrypt.secret") -> AES-256-GCM.
// Vault JSON = {version:1, credential, prfSalt, nonce, ciphertext} — ciphertext-only, SAFE to
// persist in chrome.storage.local. Each vault gets a FRESH random prfSalt (reusing one PRF
// output across vaults shares the encryption key).

// Errors
MeraError, isMeraError; codes: PRF_UNAVAILABLE | INPUT_INVALID | CRYPTO_UNAVAILABLE |
PASSKEY_OPERATION_FAILED | SESSION_ENDED | DECRYPT_FAILED | VAULT_FORMAT_INVALID
```

### 2.2 viem adapter (`@category-labs/mera/viem`)

```ts
toViemAccount(session, {nonceManager?}) // -> LocalAccount<"mera">
// Implements signTransaction, signMessage (EIP-191), signTypedData (EIP-712),
// signAuthorization (EIP-7702), raw sign. Hashing is done by viem; only the 32-byte digest
// hits session.signDigest — so signing NEVER shows a passkey prompt while the session lives.
```

### 2.3 Account derivation (the official demo's pattern — copy it exactly)

mera deliberately leaves derivation to the app. The reference demo (`demo/src/hd.ts` +
`connect.ts` on GitHub) does, and merawallet MUST do, this — it makes wallets portable to
MetaMask via a standard seed phrase:

```
PRF output (32 bytes)
  = 256 bits of BIP-39 entropy -> 24-word mnemonic   (entropyToMnemonic, english wordlist)
  -> BIP-39 seed (PBKDF2, empty passphrase)          (mnemonicToSeedSync)
  -> BIP-44 path m/44'/60'/0'/0/{index}              (@scure/bip32 HDKey)
  -> secp256k1 private key -> createSecp256k1SigningSession -> toViemAccount
```

Two account modes, same downstream pipeline:
- **passkey mode**: the PRF output IS the HD root. Nothing secret is ever stored anywhere;
  the mnemonic is re-derivable from a fresh ceremony (that's also the "backup/reveal" flow).
- **vault mode** (import): user pastes an existing BIP-39 mnemonic; it's encrypted into a
  `PasskeySecretVault` (stored in `chrome.storage.local`); unlock = decrypt via ceremony.

Zeroing discipline (the demo does this everywhere): `prfOutput.fill(0)` and `seed.fill(0)`
immediately after derivation; `session.end()` zeroes the key copy.

Extra deps this requires: `@scure/bip32`, `@scure/bip39`.

---

## 3. Platform constraints — WebAuthn inside an MV3 extension (all verified)

1. **Chrome 122+ lets extension pages call WebAuthn with an rpId for any domain covered by
   `host_permissions`** (MDN: "Use the Web Authn API in web extensions"). merawallet uses
   `RP_ID = "nullterminal.xyz"` with `host_permissions: ["https://nullterminal.xyz/*"]`.
   Bonus: the same passkeys will work on the real nullterminal.xyz website later (mera's
   cross-platform story); origin in clientDataJSON will be `chrome-extension://<id>`.
2. **The popup closes when the OS passkey sheet appears** (documented known issue). Therefore
   ALL WebAuthn ceremonies run in a full extension TAB (`onboarding.html`), never in the
   popup. The popup deep-links into it: `onboarding.html?action=unlock|create|signin|import|reveal`.
3. **MV3 CSP forbids remote code** → self-host Space Grotesk + JetBrains Mono as woff2 with
   `@font-face`. Remote **images** (token logos) are fine (default CSP doesn't restrict img-src).
4. **Session model**: MV3 has no long-lived page. The unlocked secret lives in
   **`chrome.storage.session`** (memory-only, cleared when the browser exits, visible only to
   trusted extension contexts — the standard MV3 wallet pattern). We store the 64-byte BIP-39
   **seed** hex + `unlockedAt`. The popup reads it, derives the account key, signs, and calls
   `session.end()` right after each signing operation. "Lock" clears storage.session.
   Auto-lock: on popup open, if `now - unlockedAt > autoLockMinutes` (default 30, 0 = never)
   → clear and show locked state.
5. **`chrome.storage.local`** (persistent, unencrypted) holds ONLY non-secret data: mode,
   credentialId+transports, vault JSON (ciphertext), account list (addresses/labels/indices),
   settings, activity history, token cache.
6. Background service worker: minimal — `chrome.runtime.onInstalled` → open onboarding tab.
   No dApp injection in v1 (see Non-goals).

---

## 4. Architecture

```
merawallet/
├── manifest (public/manifest.json)     MV3: action popup, background SW, host_permissions
├── popup.html    → src/popup/          360×600 wallet UI (NO WebAuthn here)
├── onboarding.html → src/onboarding/   full-tab ceremonies page (ALL WebAuthn here)
├── src/background.ts                   onInstalled → onboarding tab
├── src/keyring/                        mera integration (framework-free TS)
│   ├── hd.ts          PRF→mnemonic→seed→BIP-44 privkey (copied pattern from mera demo)
│   ├── keyring.ts     create/signin/import/unlock/reveal/lock + account add/switch
│   ├── storage.ts     typed chrome.storage.local/session wrappers + schema
│   └── signer.ts      withAccount(): seed→session→viem account→sign→end (auto-zeroing)
├── src/chain/         viem chain def (Monad 143, Multicall3 0xcA11bde0...76CA11),
│                      client factory (user-overridable RPC), erc20 helpers
├── src/api/           NullTerminal API client (tokens, market, quote, swap)
├── src/shared/        UI kit ported from NullTerminal + shared components
└── src/styles/globals.css              NT design tokens verbatim
```

State: React hooks + a tiny module-store (`useSyncExternalStore`, same idiom as NT's
useTheme) — no zustand/react-query (NT web doesn't use them either).

---

## 5. Feature spec

### Popup (360×600, force-dark like NT's /app)
- **Locked screen**: boot-terminal card (NT's index.html splash idiom — traffic-light dots,
  mono log lines, blinking mint caret) + "Unlock with passkey" → opens onboarding tab.
  No wallet yet → "Create wallet" CTA → onboarding.
- **Home**: header (wordmark `mera`+violet`wallet`, engine status dot, account chip),
  total balance USD, token list (logo, symbol, balance `.font-mono-num`, USD value, 24h
  change in mint/danger), action row: Send / Receive / Swap.
  Balances: native via `getBalance` + ERC-20 via viem `multicall` (Multicall3
  `0xcA11bde05977b3631167028862bE2a173976CA11`) over the NT token list; prices from
  `/v1/tokens/market`. Only render tokens with logo (NT rule) and nonzero balance
  (+ MON, WMON, USDC always).
- **Send**: token picker → amount (MAX) → recipient (0x validation) → review
  (fee estimate) → sign & broadcast → success + monadscan link. Native MON = plain value tx;
  ERC-20 = `transfer(to, amount)`.
- **Receive**: big QR (`qrcode` npm pkg, local render) + address + copy chip.
- **Swap** (NullTerminal public API — see §7): token in/out with balances, amount, live
  quote (refetch every ~10s while visible), route plan summary (dex hop labels), price
  impact, tiered-fee display (feeBps/feeTier), slippage setting (default 50bps),
  ERC-20 approve→swap two-step when allowance to NullRouter is insufficient,
  native-MON input needs no approval. Sign & broadcast the returned tx verbatim
  (`to/data/value/gasLimit` — NEVER reconstruct DEX logic client-side; that's the NT
  engine-is-source-of-truth rule).
- **Activity**: local history (`send | approve | swap`) with pending→confirmed/failed
  status polling via `getTransactionReceipt` on popup open; explorer links.
- **Settings**: RPC URL override (default `https://rpc.monad.xyz`), slippage default,
  auto-lock minutes, Reveal recovery phrase (→ onboarding tab ceremony), Lock now,
  account list + add account (next HD index; needs unlocked seed), about.

### Onboarding tab (`onboarding.html?action=...`)
- **welcome**: create / sign in / import cards (NT glass panels), PRF-support caveat note.
- **create**: passkey ceremony → derive address → success screen (address + "back up later:
  your phrase is re-derivable from your passkey" note) → seed into storage.session (arrives
  unlocked).
- **signin**: discoverable-or-pinned ceremony (`getPasskeyPrfOutput`) → rebuild wallet on a
  new device / after data clear.
- **import**: paste mnemonic (validate BIP-39) → `createSecretVaultWithNewPasskey` → vault
  JSON to storage.local → unlocked.
- **unlock**: ceremony per mode (passkey: PRF → seed; vault: decrypt → seed) → seed to
  storage.session → "Unlocked — close this tab and open the popup".
- **reveal**: fresh ceremony → show 24-word grid (NT warning styling) — never cached.
- Friendly error mapping via `MeraError.code` (copy the demo's `describeError` table, incl.
  PRF_UNAVAILABLE → "this browser/authenticator lacks WebAuthn PRF").

---

## 6. Design system — NullTerminal port (dossier extracted from packages/web)

**Identity**: Monad violet `#836EF9` primary + terminal-mint `#2CEDAC` accent on violet-black
`hsl(252 30% 6%)`. Terminal feel = typography + hairline borders, NOT skeuomorphism (no
scanlines/ASCII). JetBrains Mono tabular numerals on EVERY number/address/hash
(`.font-mono-num`), tiny uppercase letter-spaced labels, glass panels, pulsing mint status dot.

Port verbatim from the dossier (kept in `docs/DESIGN_DOSSIER.md`):
1. `:root` + `.dark` CSS custom-property blocks (space-separated HSL triplets, shadcn
   convention) — popup + onboarding force `.dark` on `<html>` statically (pro-terminal rule).
2. `@layer components`: `.glass`, `.glass-strong`, `.glow-primary`, `.glow-mint`,
   `.gradient-text/-primary/-border/-ring` (misnomers — solid violet, keep names),
   `.font-mono-num`, `.bg-grid`, `.bg-glow-top`, keyframes (`pulse-glow`, `modal-in`,
   `fade-in`, `reveal-up`, `nt-caret`, `shimmer`...). Use the ≤640px reduced-blur variants as
   the popup DEFAULT (blur 7-10px — popup pays phone-class paint cost).
3. Tailwind **v3.4** config verbatim (`darkMode: "class"`, token color map, Space Grotesk
   sans / JetBrains Mono mono stacks, `--radius` border radii, glow box-shadows).
4. Fonts self-hosted woff2 (weights 400/500/600/700, latin), `@font-face` in globals.css.
5. Component recipes (exact class strings in the dossier):
   - Panel: `glass rounded-2xl border border-border/60 p-4`
   - Hero card: `glass-strong gradient-ring rounded-2xl p-5`
   - Primary button: `rounded-xl gradient-primary py-3.5 font-semibold text-white
     shadow-glow-primary hover:-translate-y-0.5 active:scale-[0.98] ...`
   - Input wrapper: `rounded-xl border border-border/60 bg-muted/40 p-4
     focus-within:border-primary/50`; inner input `font-mono-num text-2xl bg-transparent`
   - Micro-label: `text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground`
   - Status dot: ping mint dot + `font-mono-num text-[10px] uppercase tracking-wider` label
   - Chips: `rounded-full border border-mint/40 bg-mint/10 px-2 py-0.5 font-mono-num
     text-[10px] uppercase tracking-wider text-mint`
   - Radius rule: panels `rounded-2xl`, controls `rounded-xl`, chips/dots `rounded-full`.
6. Icons: hand-drawn inline SVG (24×24, 1.7-2px stroke, round caps, currentColor) — NT uses
   no icon package. Wordmark: `mera<span class="gradient-text">wallet</span>` two-tone.
7. **UI copy: ENGLISH ONLY** (hard NT rule).

---

## 7. NullTerminal public API (base `https://api.nullterminal.xyz`)

```
GET  /v1/tokens                -> Token[] {address, symbol, name, decimals, logoURI?, tags?,
                                          verified?, liquidityUsd?}   (logo-gated, deduped)
GET  /v1/tokens/market         -> { market: { [addrLowercase]: {priceUsd?, change24h?, volume24h?} } }
                                  (native MON row present under 0x000...000)
GET  /v1/quote?inputMint&outputMint&amount&slippageBps
                               -> QuoteResponse (Jupiter-style): outputAmount (PRE-fee),
                                  otherAmountThreshold (min out AFTER fee+slippage), routePlan
                                  [{percent, swapInfo:{dex, pool, ...}}], priceImpactPct,
                                  feeBps/feeAmount/feeTier, noRouteReason?
                                  ("INSUFFICIENT_LIQUIDITY" = try smaller | "NO_POOLS")
POST /v1/swap  {quoteResponse, userPublicKey, slippageBps?}
                               -> { transaction: {to, data, value, gasLimit, chainId} }
                                  value>0 when input is native MON; output auto-delivered
                                  native when outputMint = 0x000...000 and wallet is an EOA.
```
Native MON sentinel = `0x0000000000000000000000000000000000000000`. Approve target for ERC-20
input = the returned `transaction.to` (NullRouter `0x1b1fee89a381e595fe6536b99ba91f3e16e9601a`).
Send the returned tx AS-IS (gasLimit included — Monad charges gas LIMIT, the API knows this).

---

## 8. Chain config

```ts
export const monad = defineChain({
  id: 143, name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.monad.xyz"] } },   // user-overridable in settings
  blockExplorers: { default: { name: "MonadScan", url: "https://monadscan.com" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});
```
~300ms blocks — poll receipts fast (1s interval, ~30s timeout). WMON
`0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A`, USDC `0x754704Bc059F8C67012fEd69BC8A327a5aafb603`.

## 9. Stack & tooling

Vite 5 + React 18 + TS 5 (strict) + Tailwind 3.4 (all matching NT web). Deps:
`@category-labs/mera`, `viem ^2.55`, `@scure/bip32`, `@scure/bip39`, `qrcode`.
Build: single `vite build` — rollup inputs `popup.html`, `onboarding.html`, `src/background.ts`
(stable un-hashed `background.js` for the manifest; ES-module SW `"type": "module"`).
`public/manifest.json` + generated PNG icons (16/32/48/128 — scripts/gen-icons.mjs, pure-node
zlib PNG encoder, violet rounded-square + route glyph, no binary assets committed).
Dev preview: `chrome.*` shim (in-memory) when `typeof chrome.storage === "undefined"` so
`vite dev` can render UI in a plain tab.

## 10. Acceptance criteria

1. `npm run typecheck` (tsc --noEmit) clean; `npm run build` emits a loadable `dist/`
   (chrome://extensions → Load unpacked) with popup + onboarding + background wired.
2. Create-wallet flow on a PRF-capable authenticator yields a stable EVM address across
   sign-out/sign-in (PRF determinism), identical to importing the revealed mnemonic into any
   BIP-44 wallet.
3. No secret material ever written to `chrome.storage.local` (grep-provable: only mode,
   credential metadata, vault ciphertext JSON, addresses, settings, activity).
4. Every ceremony lives in the onboarding tab; the popup never calls `navigator.credentials`.
5. Send + swap sign via mera sessions that are `end()`ed immediately after use.
6. UI is recognisably NullTerminal: violet/mint tokens, glass panels, mono numerals,
   micro-labels, status dot, boot-terminal lock screen. English-only copy.

## 11. Non-goals (v1)

- No dApp provider injection (window.ethereum / EIP-6963) — self-contained wallet first.
- No Solana side (mera supports ed25519; wire later).
- No multichain beyond Monad 143. No testnet.
- No Ledger/QR airgap, no WalletConnect.
- Store listing/packaging (CWS zip) later — dev-mode Load-unpacked is the v1 target.
