// Popup read models: keyring state, NullTerminal token/market data, balances.
// Module-level caches keep tab switches instant; a bumpable version lets mutations
// (send/swap) trigger refetches.
import { useCallback, useEffect, useState } from "react";
import { fetchMarket, fetchTokens, type MarketRow, type NtToken } from "../api/nullterminal";
import { loadBalances, type TokenBalance } from "../chain/balances";
import { getPublicClient } from "../chain/monad";
import { getKeyringState, type KeyringState } from "../keyring/keyring";
import { getLocal, getSettings, type Settings } from "../keyring/storage";

let tokenCache: NtToken[] | null = null;
let marketCache: Record<string, MarketRow> | null = null;
let marketFetchedAt = 0;

/** NT curated list + the user's dApp-added tokens (wallet_watchAsset), deduped. */
export async function getTokenList(): Promise<NtToken[]> {
  if (!tokenCache) tokenCache = await fetchTokens();
  const custom = (await getLocal("customTokens")) ?? [];
  if (!custom.length) return tokenCache;
  const known = new Set(tokenCache.map((t) => t.address.toLowerCase()));
  const extras: NtToken[] = custom
    .filter((t) => !known.has(t.address.toLowerCase()))
    .map((t) => ({
      address: t.address,
      symbol: t.symbol,
      name: t.symbol,
      decimals: t.decimals,
      logoURI: t.logoURI,
      verified: false,
    }));
  return [...tokenCache, ...extras];
}

export async function getMarketMap(): Promise<Record<string, MarketRow>> {
  if (!marketCache || Date.now() - marketFetchedAt > 60_000) {
    marketCache = await fetchMarket();
    marketFetchedAt = Date.now();
  }
  return marketCache;
}

export function useKeyring(): {
  state: KeyringState | null;
  reload: () => void;
} {
  const [state, setState] = useState<KeyringState | null>(null);
  const reload = useCallback(() => {
    void getKeyringState().then(setState);
  }, []);
  useEffect(reload, [reload]);
  return { state, reload };
}

export function useSettings(): Settings | null {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);
  return settings;
}

export function usePortfolio(
  address: `0x${string}` | undefined,
  rpcUrl: string | undefined,
): {
  rows: TokenBalance[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [rows, setRows] = useState<TokenBalance[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!address || !rpcUrl) return;
    let cancelled = false;
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        const [tokens, market] = await Promise.all([
          getTokenList(),
          getMarketMap(),
        ]);
        const result = await loadBalances(
          getPublicClient(rpcUrl),
          address,
          tokens,
          market,
        );
        if (!cancelled) setRows(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, rpcUrl, version]);

  return { rows, loading, error, refresh };
}
