// NullTerminal public aggregator API client (Jupiter-style shapes).
// The engine is the single source of truth for routing: merawallet signs the returned
// transaction verbatim and never reconstructs DEX logic client-side.
import { API_BASE } from "../config";

export type NtToken = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  verified?: boolean;
  liquidityUsd?: number;
};

export type MarketRow = {
  priceUsd?: number;
  change24h?: number;
  volume24h?: number;
};

export type RoutePlanStep = {
  percent: number;
  swapInfo: {
    dex: string;
    pool: string;
    inputMint: string;
    outputMint: string;
    inputAmount: string;
    outputAmount: string;
  };
};

export type QuoteResponse = {
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string; // PRE-fee raw DEX output
  otherAmountThreshold: string; // min out AFTER fee + slippage
  priceImpactPct: string;
  routePlan: RoutePlanStep[];
  gasEstimate: string;
  gasCostUSD: string;
  blockNumber: number;
  timeTaken: number;
  feeBps?: number;
  feeAmount?: string;
  feeMint?: string;
  feeTier?: string;
  noRouteReason?: "INSUFFICIENT_LIQUIDITY" | "NO_POOLS";
};

export type UnsignedTransaction = {
  to: `0x${string}`;
  data: `0x${string}`;
  value: string;
  gasLimit: string;
  chainId: number;
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    let message = `NullTerminal API ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      message = body.message || body.error || message;
    } catch {
      /* keep the status message */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export async function fetchTokens(): Promise<NtToken[]> {
  const body = await getJson<{ tokens: NtToken[] } | NtToken[]>("/v1/tokens");
  return Array.isArray(body) ? body : body.tokens;
}

export async function fetchMarket(): Promise<Record<string, MarketRow>> {
  const body = await getJson<{ market: Record<string, MarketRow> }>(
    "/v1/tokens/market",
  );
  return body.market ?? {};
}

export async function fetchQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: bigint;
  slippageBps: number;
}): Promise<QuoteResponse> {
  const q = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount.toString(),
    slippageBps: params.slippageBps.toString(),
  });
  return getJson<QuoteResponse>(`/v1/quote?${q}`);
}

export async function buildSwapTx(params: {
  quoteResponse: QuoteResponse;
  userPublicKey: `0x${string}`;
  slippageBps: number;
}): Promise<UnsignedTransaction> {
  const res = await fetch(`${API_BASE}/v1/swap`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    let message = `NullTerminal API ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      message = body.message || body.error || message;
    } catch {
      /* keep the status message */
    }
    throw new Error(message);
  }
  const body = (await res.json()) as { transaction: UnsignedTransaction };
  return body.transaction;
}
