// Small UI kit carrying the NullTerminal idiom: raw Tailwind strings, no variant machinery.
// Class recipes are verbatim from the NT dossier (docs/DESIGN_DOSSIER.md).
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function PrimaryButton({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`relative flex w-full items-center justify-center gap-2 rounded-xl gradient-primary py-3.5 font-semibold text-white shadow-glow-primary transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 ${className}`}
    />
  );
}

export function GhostButton({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`glass flex items-center justify-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-px hover:border-primary/50 disabled:pointer-events-none disabled:opacity-50 ${className}`}
    />
  );
}

export function Panel({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`glass rounded-2xl border border-border/60 p-4 ${className}`}>
      {children}
    </div>
  );
}

export function MicroLabel({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground ${className}`}
    >
      {children}
    </div>
  );
}

export function MintChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-mint/40 bg-mint/10 px-2 py-0.5 font-mono-num text-[10px] uppercase tracking-wider text-mint">
      {children}
    </span>
  );
}

export function VioletChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono-num text-[10px] uppercase tracking-wider text-primary">
      {children}
    </span>
  );
}

/** The pulsing mint "engine online" motif. */
export function StatusDot({ label = "engine" }: { label?: string }) {
  return (
    <span className="flex items-center gap-1.5" title="Routing engine online">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-mint shadow-glow-mint" />
      </span>
      <span className="font-mono-num text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </span>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="animate-fade-in rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
      {children}
    </div>
  );
}

export function Wordmark({ size = "text-lg" }: { size?: string }) {
  return (
    <span className={`${size} font-bold tracking-tight`}>
      mera<span className="gradient-text">wallet</span>
    </span>
  );
}

/**
 * The Mera mark: an M drawn as one continuous route (NT's route-and-node language),
 * endpoint nodes at both feet, and a single mint spark in the letter's notch.
 * With `animate`, the route draws itself on mount — left foot pops first, the stroke
 * travels to the right foot, and the spark ignites last (boot screens only; headers
 * stay static so the mark doesn't replay on every render).
 */
export function Mark({
  size = 28,
  animate = false,
}: {
  size?: number;
  animate?: boolean;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden>
      <defs>
        <linearGradient id="mw-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9B86FF" />
          <stop offset="0.55" stopColor="#6C4FE0" />
          <stop offset="1" stopColor="#5538C8" />
        </linearGradient>
        <radialGradient id="mw-n" cx="0.35" cy="0.3" r="1">
          <stop offset="0" stopColor="#C9BCFF" />
          <stop offset="1" stopColor="#7C63F0" />
        </radialGradient>
      </defs>
      <path
        d="M26 98 V34 L64 72 L102 34 V98"
        fill="none"
        stroke="url(#mw-g)"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
        className={animate ? "mark-draw-path" : undefined}
      />
      <circle
        cx="26"
        cy="98"
        r="11"
        fill="url(#mw-n)"
        className={animate ? "mark-draw-node" : undefined}
        style={animate ? { animationDelay: "0.1s" } : undefined}
      />
      <circle
        cx="102"
        cy="98"
        r="11"
        fill="url(#mw-n)"
        className={animate ? "mark-draw-node" : undefined}
        style={animate ? { animationDelay: "0.95s" } : undefined}
      />
      <circle
        cx="64"
        cy="44"
        r="7"
        fill="#2CEDAC"
        className={animate ? "mark-draw-node" : undefined}
        style={animate ? { animationDelay: "1.15s" } : undefined}
      />
    </svg>
  );
}

export function TokenLogo({
  src,
  symbol,
  size = 32,
}: {
  src?: string;
  symbol: string;
  size?: number;
}) {
  if (!src) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-accent font-mono-num text-[11px] font-bold text-accent-foreground"
        style={{ width: size, height: size }}
      >
        {symbol.slice(0, 3).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-card object-cover"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
