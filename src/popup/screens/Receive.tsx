import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { AccountRec } from "../../keyring/storage";
import { MicroLabel, MintChip } from "../../shared/ui";

/** Paints the Mera M tile into the QR center (same geometry as <Mark/>, canvas edition). */
function drawCenterMark(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const s = canvas.width; // actual pixels (qrcode lib handles devicePixelRatio)
  const tile = s * 0.24;
  const x0 = (s - tile) / 2;
  const y0 = (s - tile) / 2;
  const k = tile / 128;

  // violet tile with rounded corners
  const grad = ctx.createLinearGradient(x0, y0, x0, y0 + tile);
  grad.addColorStop(0, "#9B86FF");
  grad.addColorStop(1, "#5538C8");
  ctx.beginPath();
  ctx.roundRect(x0, y0, tile, tile, 29 * k);
  ctx.fillStyle = grad;
  ctx.fill();

  // white M route
  ctx.beginPath();
  ctx.moveTo(x0 + 26 * k, y0 + 98 * k);
  ctx.lineTo(x0 + 26 * k, y0 + 34 * k);
  ctx.lineTo(x0 + 64 * k, y0 + 72 * k);
  ctx.lineTo(x0 + 102 * k, y0 + 34 * k);
  ctx.lineTo(x0 + 102 * k, y0 + 98 * k);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 13 * k;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  // feet nodes + mint spark
  ctx.fillStyle = "#ffffff";
  for (const cx of [26, 102]) {
    ctx.beginPath();
    ctx.arc(x0 + cx * k, y0 + 98 * k, 11 * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x0 + 64 * k, y0 + 44 * k, 7 * k, 0, Math.PI * 2);
  ctx.fillStyle = "#2CEDAC";
  ctx.fill();
}

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
    const canvas = canvasRef.current;
    if (!canvas) return;
    void QRCode.toCanvas(canvas, account.address, {
      width: 208,
      margin: 1,
      // High error correction leaves room for the center mark.
      errorCorrectionLevel: "H",
      color: { dark: "#0D0B14", light: "#EBEAF0" },
    }).then(() => drawCenterMark(canvas));
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
