// Typed wrappers over chrome.storage with a strict secret/public split:
//   storage.local   — persistent, unencrypted → ONLY non-secret data (credential metadata,
//                     vault ciphertext JSON, addresses, settings, activity).
//   storage.session — memory-only, gone when the browser exits, trusted contexts only →
//                     the unlocked BIP-39 seed lives here and nowhere else.
// A dev shim backs both with in-memory maps so `vite dev` can render the UI in a plain tab.
import type { PasskeySecretVault } from "@category-labs/mera";
import {
  DEFAULT_AUTO_LOCK_MINUTES,
  DEFAULT_RPC_URL,
  DEFAULT_SLIPPAGE_BPS,
} from "../config";

export type WalletMeta = {
  mode: "passkey" | "vault";
  credentialId: string;
  transports?: string[];
  /** vault mode only: the passkey-encrypted mnemonic (ciphertext — safe at rest). */
  vault?: PasskeySecretVault;
};

export type AccountRec = {
  index: number;
  address: `0x${string}`;
  label: string;
};

export type Settings = {
  rpcUrl: string;
  slippageBps: number;
  autoLockMinutes: number;
  /** Privacy mode: mask balances on the home screen. */
  hideBalances?: boolean;
};

export type ActivityKind = "send" | "approve" | "swap" | "dapp";

export type ActivityItem = {
  hash: `0x${string}`;
  kind: ActivityKind;
  summary: string;
  ts: number;
  status: "pending" | "confirmed" | "failed";
  from: `0x${string}`;
};

type LocalSchema = {
  walletMeta?: WalletMeta;
  accounts?: AccountRec[];
  activeIndex?: number;
  settings?: Settings;
  activity?: ActivityItem[];
  /** Last few send targets, newest first, for one-tap reuse. */
  recentRecipients?: `0x${string}`[];
  customTokens?: CustomToken[];
};

type SessionSchema = {
  seedHex?: string;
  unlockedAt?: number;
};

export const DEFAULT_SETTINGS: Settings = {
  rpcUrl: DEFAULT_RPC_URL,
  slippageBps: DEFAULT_SLIPPAGE_BPS,
  autoLockMinutes: DEFAULT_AUTO_LOCK_MINUTES,
};

// ---------------------------------------------------------------------------
// chrome.storage areas with an in-memory dev fallback

type Area = {
  get(keys: string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
};

function memoryArea(): Area {
  const store = new Map<string, unknown>();
  return {
    async get(keys) {
      const out: Record<string, unknown> = {};
      for (const k of keys ?? [...store.keys()]) {
        if (store.has(k)) out[k] = store.get(k);
      }
      return out;
    },
    async set(items) {
      for (const [k, v] of Object.entries(items)) store.set(k, v);
    },
    async remove(keys) {
      for (const k of keys) store.delete(k);
    },
  };
}

export const isExtension =
  typeof chrome !== "undefined" && !!chrome.storage?.local;

const localArea: Area = isExtension ? chrome.storage.local : memoryArea();
const sessionArea: Area = isExtension ? chrome.storage.session : memoryArea();

// ---------------------------------------------------------------------------
// local (public data)

export async function getLocal<K extends keyof LocalSchema>(
  key: K,
): Promise<LocalSchema[K]> {
  const out = await localArea.get([key]);
  return out[key] as LocalSchema[K];
}

export async function setLocal(items: Partial<LocalSchema>): Promise<void> {
  await localArea.set(items);
}

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...((await getLocal("settings")) ?? {}) };
}

// ---------------------------------------------------------------------------
// session (unlocked seed)

export async function getSessionSeed(): Promise<string | undefined> {
  const out = (await sessionArea.get(["seedHex", "unlockedAt"])) as SessionSchema;
  if (!out.seedHex) return undefined;
  const { autoLockMinutes } = await getSettings();
  if (
    autoLockMinutes > 0 &&
    out.unlockedAt !== undefined &&
    Date.now() - out.unlockedAt > autoLockMinutes * 60_000
  ) {
    await clearSessionSeed();
    return undefined;
  }
  return out.seedHex;
}

export async function setSessionSeed(seedHex: string): Promise<void> {
  await sessionArea.set({ seedHex, unlockedAt: Date.now() } satisfies SessionSchema);
}

export async function clearSessionSeed(): Promise<void> {
  await sessionArea.remove(["seedHex", "unlockedAt"]);
}

// ---------------------------------------------------------------------------
// activity log (append + status patch, newest first, capped)

const ACTIVITY_CAP = 100;

export async function appendActivity(item: ActivityItem): Promise<void> {
  const list = (await getLocal("activity")) ?? [];
  await setLocal({ activity: [item, ...list].slice(0, ACTIVITY_CAP) });
}

export async function patchActivity(
  hash: `0x${string}`,
  status: ActivityItem["status"],
): Promise<void> {
  const list = (await getLocal("activity")) ?? [];
  await setLocal({
    activity: list.map((a) => (a.hash === hash ? { ...a, status } : a)),
  });
}

export type CustomToken = {
  address: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
};

/** dApp-added tokens (wallet_watchAsset), merged into the NT list at read time. */
export async function addCustomToken(token: CustomToken): Promise<void> {
  const list = (await getLocal("customTokens")) ?? [];
  if (list.some((t) => t.address.toLowerCase() === token.address.toLowerCase())) {
    return;
  }
  await setLocal({ customTokens: [...list, token] });
}

export async function rememberRecipient(address: `0x${string}`): Promise<void> {
  const list = (await getLocal("recentRecipients")) ?? [];
  const next = [
    address,
    ...list.filter((a) => a.toLowerCase() !== address.toLowerCase()),
  ].slice(0, 5);
  await setLocal({ recentRecipients: next });
}
