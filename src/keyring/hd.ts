// PRF output -> standard HD wallet, copied from mera's reference demo (demo/src/hd.ts).
// The 32-byte WebAuthn PRF output is used as 256 bits of BIP-39 entropy, so the resulting
// 24-word phrase imported into MetaMask reproduces the same addresses. Changing this
// mapping would change every derived address — never touch it.
import { HDKey } from "@scure/bip32";
import {
  entropyToMnemonic,
  mnemonicToSeedSync,
  validateMnemonic,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

const PRF_OUTPUT_LENGTH = 32;

// BIP-44, coin type 60 (Ethereum — shared by EVM chains), MetaMask convention.
const evmPath = (index: number): string => `m/44'/60'/0'/0/${index}`;

export function prfOutputToMnemonic(prfOutput: Uint8Array): string {
  if (prfOutput.length !== PRF_OUTPUT_LENGTH) {
    throw new Error("PRF output must be 32 bytes");
  }
  return entropyToMnemonic(prfOutput, wordlist);
}

/** 64-byte BIP-39 seed (PBKDF2, empty passphrase). */
export function mnemonicToSeed(mnemonic: string): Uint8Array {
  return mnemonicToSeedSync(mnemonic);
}

export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic, wordlist);
}

/** secp256k1 private key for EVM account `index` (BIP-32 over BIP-44). */
export function deriveEvmPrivateKey(seed: Uint8Array, index: number): Uint8Array {
  const node = HDKey.fromMasterSeed(seed).derive(evmPath(index));
  if (!node.privateKey) {
    throw new Error("BIP-32 derivation produced no private key");
  }
  return node.privateKey;
}
