// Portfolio read model: one native getBalance + one Multicall3 sweep of balanceOf over
// the NullTerminal token list, joined with /v1/tokens/market prices.
import type { PublicClient } from "viem";
import { NATIVE_MON } from "../config";
import type { MarketRow, NtToken } from "../api/nullterminal";
import { erc20Abi } from "./erc20";

export type TokenBalance = {
  token: NtToken;
  /** raw units */
  balance: bigint;
  priceUsd?: number;
  change24h?: number;
  valueUsd?: number;
};

export async function loadBalances(
  client: PublicClient,
  owner: `0x${string}`,
  tokens: NtToken[],
  market: Record<string, MarketRow>,
): Promise<TokenBalance[]> {
  const erc20s = tokens.filter(
    (t) => t.address.toLowerCase() !== NATIVE_MON && t.logoURI,
  );

  const [native, results] = await Promise.all([
    client.getBalance({ address: owner }),
    client.multicall({
      contracts: erc20s.map((t) => ({
        address: t.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf" as const,
        args: [owner] as const,
      })),
      allowFailure: true,
    }),
  ]);

  const rows: TokenBalance[] = [];
  const nativeToken = tokens.find(
    (t) => t.address.toLowerCase() === NATIVE_MON,
  ) ?? {
    address: NATIVE_MON,
    symbol: "MON",
    name: "Monad",
    decimals: 18,
  };
  rows.push(withUsd({ token: nativeToken, balance: native }, market));

  for (let i = 0; i < erc20s.length; i++) {
    const r = results[i];
    if (r.status !== "success") continue;
    const balance = r.result as bigint;
    if (balance === 0n) continue;
    rows.push(withUsd({ token: erc20s[i], balance }, market));
  }

  // Highest USD value first; unpriced rows follow, biggest raw balance first.
  return rows.sort(
    (a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0) || Number(b.balance - a.balance),
  );
}

function withUsd(
  row: { token: NtToken; balance: bigint },
  market: Record<string, MarketRow>,
): TokenBalance {
  const m = market[row.token.address.toLowerCase()];
  const priceUsd = m?.priceUsd;
  const amount = Number(row.balance) / 10 ** row.token.decimals;
  return {
    ...row,
    priceUsd,
    change24h: m?.change24h,
    valueUsd: priceUsd !== undefined ? amount * priceUsd : undefined,
  };
}
