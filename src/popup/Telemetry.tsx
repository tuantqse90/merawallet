// Live Monad telemetry strip: block height + gas, polled every 2s while the popup
// is open. The block number remounts on change (fade pulse) — the wallet feels live,
// and 300ms blocks are Monad's whole point.
import { useEffect, useState } from "react";
import { getPublicClient } from "../chain/monad";

export function Telemetry({ rpcUrl }: { rpcUrl: string }) {
  const [block, setBlock] = useState<bigint | null>(null);
  const [gwei, setGwei] = useState<string | null>(null);

  useEffect(() => {
    const client = getPublicClient(rpcUrl);
    let alive = true;
    const poll = async () => {
      try {
        const [bn, gp] = await Promise.all([
          client.getBlockNumber({ cacheTime: 0 }),
          client.getGasPrice(),
        ]);
        if (!alive) return;
        setBlock(bn);
        setGwei((Number(gp) / 1e9).toFixed(0));
      } catch {
        /* keep the last reading */
      }
    };
    void poll();
    const t = setInterval(poll, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [rpcUrl]);

  return (
    <div className="glass flex items-center justify-center gap-2 border-t border-border/60 py-1 font-mono-num text-[9px] uppercase tracking-wider text-muted-foreground">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-50" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint" />
      </span>
      {block !== null ? (
        <span key={block.toString()} className="animate-fade-in">
          block {block.toLocaleString("en-US")}
        </span>
      ) : (
        <span>connecting…</span>
      )}
      <span className="text-muted-foreground/50">·</span>
      <span>~300ms</span>
      {gwei && (
        <>
          <span className="text-muted-foreground/50">·</span>
          <span>{gwei} gwei</span>
        </>
      )}
    </div>
  );
}
