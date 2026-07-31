// Wallet lifecycle on top of @category-labs/mera. Ceremony functions
// (create/signIn/import/unlock/reveal) call WebAuthn and may therefore ONLY run in the
// onboarding tab — Chrome closes the popup when the OS passkey sheet appears.
// Secret hygiene follows the mera demo: PRF outputs and seeds are zeroed as soon as the
// next derivation step has consumed them; only the seed (hex) enters chrome.storage.session.
import {
  createPasskeyWithPrfOutput,
  createSecretVaultWithNewPasskey,
  decryptSecretVaultWithPasskey,
  getEvmAddress,
  getPasskeyPrfOutput,
  isMeraError,
  parseSecretVault,
} from "@category-labs/mera";
import { bytesToHex, hexToBytes } from "viem";
import { DEFAULT_USER_NAME, RP_ID, RP_NAME } from "../config";
import {
  deriveEvmPrivateKey,
  isValidMnemonic,
  mnemonicToSeed,
  prfOutputToMnemonic,
} from "./hd";
import {
  type AccountRec,
  type WalletMeta,
  clearSessionSeed,
  getLocal,
  getSessionSeed,
  setLocal,
  setSessionSeed,
} from "./storage";
import { normalizeSecp256k1PublicKeyToAddress } from "./signer";

export type KeyringState = {
  hasWallet: boolean;
  unlocked: boolean;
  mode?: WalletMeta["mode"];
  accounts: AccountRec[];
  activeIndex: number;
};

export async function getKeyringState(): Promise<KeyringState> {
  const [meta, accounts, activeIndex, seed] = await Promise.all([
    getLocal("walletMeta"),
    getLocal("accounts"),
    getLocal("activeIndex"),
    getSessionSeed(),
  ]);
  return {
    hasWallet: !!meta,
    unlocked: !!seed,
    mode: meta?.mode,
    accounts: accounts ?? [],
    activeIndex: activeIndex ?? 0,
  };
}

function addressForIndex(seed: Uint8Array, index: number): `0x${string}` {
  const priv = deriveEvmPrivateKey(seed, index);
  try {
    return normalizeSecp256k1PublicKeyToAddress(priv);
  } finally {
    priv.fill(0);
  }
}

/** Stores the seed in storage.session and (re)builds the account list for index 0..n. */
async function commitUnlockedSeed(
  seed: Uint8Array,
  existing?: AccountRec[],
): Promise<AccountRec[]> {
  const accounts: AccountRec[] =
    existing && existing.length > 0
      ? existing.map((a) => ({ ...a, address: addressForIndex(seed, a.index) }))
      : [{ index: 0, address: addressForIndex(seed, 0), label: "Account 1" }];
  await setSessionSeed(bytesToHex(seed).slice(2));
  seed.fill(0);
  await setLocal({ accounts, activeIndex: 0 });
  return accounts;
}

// ---------------------------------------------------------------------------
// Ceremonies (onboarding tab only)

/** Create a brand-new passkey wallet. The PRF output is the HD root; nothing is stored. */
export async function createWallet(): Promise<`0x${string}`> {
  const credential = await createPasskeyWithPrfOutput({
    rp: { id: RP_ID, name: RP_NAME },
    user: { name: DEFAULT_USER_NAME, displayName: DEFAULT_USER_NAME },
  });
  const meta: WalletMeta = {
    mode: "passkey",
    credentialId: credential.credentialId,
    transports: credential.transports ? [...credential.transports] : undefined,
  };
  const seed = mnemonicToSeed(prfOutputToMnemonic(credential.prfOutput));
  credential.prfOutput.fill(0);
  await setLocal({ walletMeta: meta });
  const accounts = await commitUnlockedSeed(seed);
  return accounts[0].address;
}

/** Sign back in with an existing passkey (fresh device or cleared storage). */
export async function signIn(): Promise<`0x${string}`> {
  const known = await getLocal("walletMeta");
  const pinned =
    known?.mode === "passkey"
      ? { credentialId: known.credentialId, transports: known.transports }
      : undefined;
  const { prfOutput, credentialId } = await getPasskeyPrfOutput({
    rpId: RP_ID,
    credential: pinned,
  });
  const meta: WalletMeta = {
    mode: "passkey",
    credentialId,
    transports:
      known?.credentialId === credentialId ? known?.transports : undefined,
  };
  const seed = mnemonicToSeed(prfOutputToMnemonic(prfOutput));
  prfOutput.fill(0);
  await setLocal({ walletMeta: meta });
  const existing = known?.credentialId === credentialId ? await getLocal("accounts") : undefined;
  const accounts = await commitUnlockedSeed(seed, existing);
  return accounts[0].address;
}

/** Import an existing mnemonic; a NEW passkey encrypts it into a stored vault. */
export async function importWallet(mnemonic: string): Promise<`0x${string}`> {
  const phrase = mnemonic.trim().toLowerCase().split(/\s+/).join(" ");
  if (!isValidMnemonic(phrase)) {
    throw new Error("That is not a valid BIP-39 recovery phrase.");
  }
  const secret = new TextEncoder().encode(phrase);
  let vault;
  try {
    vault = await createSecretVaultWithNewPasskey({
      rp: { id: RP_ID, name: RP_NAME },
      user: { name: DEFAULT_USER_NAME, displayName: DEFAULT_USER_NAME },
      secret,
    });
  } finally {
    secret.fill(0);
  }
  const meta: WalletMeta = {
    mode: "vault",
    credentialId: vault.credential.credentialId,
    transports: vault.credential.transports
      ? [...vault.credential.transports]
      : undefined,
    vault,
  };
  await setLocal({ walletMeta: meta });
  const accounts = await commitUnlockedSeed(mnemonicToSeed(phrase));
  return accounts[0].address;
}

/** Unlock with one ceremony: passkey mode re-derives, vault mode decrypts. */
export async function unlock(): Promise<void> {
  const meta = await getLocal("walletMeta");
  if (!meta) throw new Error("No wallet on this device yet — create one first.");
  if (meta.mode === "vault") {
    const seed = mnemonicToSeed(await decryptVaultPhrase(meta));
    const accounts = await getLocal("accounts");
    await commitUnlockedSeed(seed, accounts);
    return;
  }
  const { prfOutput } = await getPasskeyPrfOutput({
    rpId: RP_ID,
    credential: { credentialId: meta.credentialId, transports: meta.transports },
  });
  const seed = mnemonicToSeed(prfOutputToMnemonic(prfOutput));
  prfOutput.fill(0);
  const accounts = await getLocal("accounts");
  await commitUnlockedSeed(seed, accounts);
}

/** Reveal the recovery phrase behind a FRESH ceremony. Never cached. */
export async function revealMnemonic(): Promise<string> {
  const meta = await getLocal("walletMeta");
  if (!meta) throw new Error("No wallet on this device yet.");
  if (meta.mode === "vault") return decryptVaultPhrase(meta);
  const { prfOutput } = await getPasskeyPrfOutput({
    rpId: RP_ID,
    credential: { credentialId: meta.credentialId, transports: meta.transports },
  });
  try {
    return prfOutputToMnemonic(prfOutput);
  } finally {
    prfOutput.fill(0);
  }
}

async function decryptVaultPhrase(meta: WalletMeta): Promise<string> {
  if (!meta.vault) throw new Error("Stored vault is missing.");
  const vault = parseSecretVault(JSON.stringify(meta.vault));
  const secret = await decryptSecretVaultWithPasskey({ rpId: RP_ID, vault });
  try {
    return new TextDecoder().decode(secret);
  } finally {
    secret.fill(0);
  }
}

// ---------------------------------------------------------------------------
// Non-ceremony operations (popup-safe)

export async function lock(): Promise<void> {
  await clearSessionSeed();
}

/** Derives the next HD index. Requires an unlocked session. */
export async function addAccount(): Promise<AccountRec> {
  const seedHex = await getSessionSeed();
  if (!seedHex) throw new Error("Wallet is locked.");
  const accounts = (await getLocal("accounts")) ?? [];
  const index = accounts.length ? Math.max(...accounts.map((a) => a.index)) + 1 : 0;
  const seed = hexToBytes(`0x${seedHex}`);
  let address: `0x${string}`;
  try {
    address = addressForIndex(seed, index);
  } finally {
    seed.fill(0);
  }
  const rec: AccountRec = { index, address, label: `Account ${index + 1}` };
  await setLocal({ accounts: [...accounts, rec] });
  return rec;
}

export async function setActiveIndex(index: number): Promise<void> {
  await setLocal({ activeIndex: index });
}

/**
 * The raw error chain for field debugging: "MeraError: … ← SecurityError: …".
 * WebAuthn failures hide the real cause (SecurityError, NotAllowedError…) inside
 * MeraError.cause, and that name is what distinguishes an rpId-permission problem
 * from a cancelled prompt from a missing platform authenticator.
 */
export function rawErrorDetail(error: unknown): string {
  const parts: string[] = [];
  let e: unknown = error;
  for (let depth = 0; e && depth < 4; depth++) {
    if (e instanceof Error) {
      parts.push(`${e.name}: ${e.message}`);
      e = e.cause;
    } else {
      parts.push(String(e));
      break;
    }
  }
  return parts.join(" ← ");
}

/** Maps mera / generic failures to one calm sentence (demo's describeError table). */
export function describeKeyringError(error: unknown): string {
  if (isMeraError(error)) {
    switch (error.code) {
      case "PRF_UNAVAILABLE":
        return "This browser or authenticator does not support the WebAuthn PRF extension merawallet needs.";
      case "DECRYPT_FAILED":
        return "Could not unlock the wallet with that passkey.";
      case "SESSION_ENDED":
        return "The signing session ended. Unlock again.";
      case "CRYPTO_UNAVAILABLE":
        return "This browser does not provide the Web Crypto APIs merawallet needs.";
      case "PASSKEY_OPERATION_FAILED":
        return "The passkey request was cancelled or failed.";
      case "VAULT_FORMAT_INVALID":
        return "The stored vault is malformed.";
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : String(error);
}

export { getEvmAddress };
