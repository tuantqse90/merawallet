// Signing pipeline: session seed -> BIP-44 private key -> mera signing session ->
// viem LocalAccount -> sign -> session.end(). The session (and its key copy) lives only
// for the duration of one callback; the private key buffer is zeroed as soon as the
// session has copied it.
import {
  createSecp256k1SigningSession,
  getEvmAddress,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import type { LocalAccount } from "viem";
import { hexToBytes } from "viem";
import { deriveEvmPrivateKey } from "./hd";
import { getSessionSeed } from "./storage";

export class WalletLockedError extends Error {
  constructor() {
    super("Wallet is locked.");
    this.name = "WalletLockedError";
  }
}

/** Address for a private key without keeping a session around (onboarding derivations). */
export function normalizeSecp256k1PublicKeyToAddress(
  privateKey: Uint8Array,
): `0x${string}` {
  const session = createSecp256k1SigningSession({ privateKey });
  try {
    return getEvmAddress(session.publicKey);
  } finally {
    session.end();
  }
}

/**
 * Runs `fn` with a live viem account for HD account `index`, then ends the mera session
 * (zeroing its key) no matter how `fn` exits.
 */
export async function withViemAccount<T>(
  index: number,
  fn: (account: LocalAccount) => Promise<T>,
): Promise<T> {
  const seedHex = await getSessionSeed();
  if (!seedHex) throw new WalletLockedError();
  const seed = hexToBytes(`0x${seedHex}`);
  let privateKey: Uint8Array;
  try {
    privateKey = deriveEvmPrivateKey(seed, index);
  } finally {
    seed.fill(0);
  }
  const session = createSecp256k1SigningSession({ privateKey });
  privateKey.fill(0);
  try {
    return await fn(toViemAccount(session));
  } finally {
    session.end();
  }
}
