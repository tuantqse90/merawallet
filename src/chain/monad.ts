import {
  http,
  createPublicClient,
  createWalletClient,
  defineChain,
  type LocalAccount,
  type PublicClient,
} from "viem";
import { DEFAULT_RPC_URL } from "../config";

export const monad = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [DEFAULT_RPC_URL] } },
  blockExplorers: {
    default: { name: "MonadScan", url: "https://monadscan.com" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
});

// No JSON-RPC request batching: the public Monad RPC drops/413s large batches.
// Multicall3 (aggregate3) does the fan-in on-chain instead.
export function getPublicClient(rpcUrl: string): PublicClient {
  return createPublicClient({ chain: monad, transport: http(rpcUrl) });
}

export function getWalletClient(account: LocalAccount, rpcUrl: string) {
  return createWalletClient({ account, chain: monad, transport: http(rpcUrl) });
}
