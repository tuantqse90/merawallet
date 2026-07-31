// Wallet-wide constants. RP_ID must stay in sync with manifest.json host_permissions —
// Chrome (122+) only lets an extension run WebAuthn ceremonies for relying-party domains
// its host permissions cover. Passkeys created here are bound to nullterminal.xyz, so the
// same credential also works on the NullTerminal web app.
export const RP_ID = "nullterminal.xyz";
export const RP_NAME = "merawallet";
export const DEFAULT_USER_NAME = "mera";

export const API_BASE = "https://api.nullterminal.xyz";
export const DEFAULT_RPC_URL = "https://rpc.monad.xyz";
export const EXPLORER_URL = "https://monadscan.com";

export const CHAIN_ID = 143;
export const NATIVE_MON = "0x0000000000000000000000000000000000000000" as const;
/** NullRouter (UUPS) — the spender ERC-20 swap inputs are approved to. */
export const NULL_ROUTER = "0x1b1fee89a381e595fe6536b99ba91f3e16e9601a" as const;
export const WMON = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A" as const;
export const USDC = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603" as const;

export const DEFAULT_SLIPPAGE_BPS = 50;
export const DEFAULT_AUTO_LOCK_MINUTES = 30;
export const QUOTE_REFRESH_MS = 10_000;
export const RECEIPT_POLL_MS = 1_000;
export const RECEIPT_TIMEOUT_MS = 45_000;
