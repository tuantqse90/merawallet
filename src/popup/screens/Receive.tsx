import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { AccountRec } from "../../keyring/storage";
import { MicroLabel, MintChip } from "../../shared/ui";

export function Receive({
  account,
  onClose,
}: {
  account: AccountRec;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, account.address, {
      width: 208,
      margin: 1,
      color: { dark: "#0D0B14", light: "#EBEAF0" },
    });
  }, [account.address]);

  const copy = async () => {
    await navigator.clipboard.writeText(account.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
        <MicroLabel>receive</MicroLabel>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Close
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 pb-10">
        <MintChip>monad mainnet · chain 143</MintChip>
        <div className="glass-strong gradient-ring rounded-2xl p-4">
          <canvas ref={canvasRef} className="rounded-lg" />
        </div>
        <button
          type="button"
          onClick={copy}
          className="code-literal font-mono-num w-full break-all rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-center text-xs leading-relaxed transition-colors hover:border-primary/50"
          title="Copy address"
        >
          {account.address}
        </button>
        <div className="h-5">
          {copied && (
            <span className="animate-fade-in font-mono-num text-[11px] uppercase tracking-wider text-mint">
              copied to clipboard
            </span>
          )}
        </div>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Send only Monad-network assets to this address. Tokens on other chains
          will not arrive here.
        </p>
      </div>
    </div>
  );
}
