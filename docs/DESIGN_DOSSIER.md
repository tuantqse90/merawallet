# NullTerminal Design System — extraction dossier

Extracted 2026-07-31 from `nullterminal/packages/web` (source of truth: `src/styles/globals.css`,
`tailwind.config.ts`, component sources). merawallet ports these tokens verbatim.

## TL;DR

Monad-violet monochrome brand (`#836EF9`) + mint/terminal-green accent (`#2CEDAC`) on a deep
violet-undertone near-black (`hsl(252 30% 6%)`). Terminal identity = JetBrains Mono tabular
numerals everywhere numbers appear (`.font-mono-num`), tiny uppercase letter-spaced labels,
hairline `border-border/60` on `rounded-2xl` glass panels (`backdrop-filter: blur(16px)
saturate(140%)`), pulsing mint status dots. No scanlines/CRT/ASCII — typographic terminal,
not skeuomorphic.

## CSS tokens (space-separated HSL channels, shadcn convention)

### `.dark` (the signature theme; merawallet popup/onboarding force-dark)

```css
.dark {
  --background: 252 30% 6%;        /* #0D0B14 */
  --foreground: 250 18% 93%;       /* #EBEAF0 */
  --card: 250 26% 10%;             /* #151320 */
  --card-foreground: 250 18% 93%;
  --primary: 252 91% 71%;          /* ≈ #836EF9 Monad purple */
  --primary-foreground: 252 30% 5%;
  --secondary: 250 18% 15%;
  --secondary-foreground: 250 14% 92%;
  --muted: 250 18% 13%;
  --muted-foreground: 250 12% 62%;
  --accent: 252 35% 22%;
  --accent-foreground: 250 14% 92%;
  --mint: 160 84% 55%;             /* #2CEDAC */
  --mint-foreground: 160 60% 6%;
  --success: 158 74% 52%;
  --success-foreground: 160 60% 6%;
  --danger: 0 84% 68%;
  --danger-foreground: 0 40% 8%;
  --warning: 38 92% 55%;
  --warning-foreground: 38 60% 8%;
  --destructive: 0 72% 51%;
  --destructive-foreground: 0 0% 100%;
  --border: 250 20% 20%;
  --input: 250 20% 18%;
  --ring: 252 80% 64%;
  --glass-bg: 250 30% 12%;
  --glass-opacity: 0.55;
  --glass-hi: 0 0% 100%;
  --glass-hi-a: 0.04;
  --glass-shadow: 252 80% 4% / 0.8;
  --glow-primary: 252 91% 71%;
  --glow-mint: 160 84% 55%;
  --glow-a-ring: 0.28;
  --glow-a-spread: 0.52;
}
```

`:root` (light — kept for completeness; merawallet is dark-only v1):
`--background: 252 44% 98.5%; --foreground: 252 28% 13%; --primary: 252 80% 62%;
--mint: 162 80% 30%; --success: 158 82% 28%; --danger: 0 72% 47%; --warning: 30 92% 37%;
--border: 250 24% 89%; --radius: 0.75rem;` (radius declared only on :root, inherits).

### Utility classes (verbatim)

```css
.glass {
  background-color: hsl(var(--glass-bg) / var(--glass-opacity));
  backdrop-filter: blur(16px) saturate(140%);
  border: 1px solid hsl(var(--border) / 0.7);
}
.glass-strong {
  background-color: hsl(var(--glass-bg) / calc(var(--glass-opacity) + 0.15));
  backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid hsl(var(--border) / 0.8);
  box-shadow: 0 1px 0 0 hsl(var(--glass-hi) / var(--glass-hi-a)) inset,
              0 20px 50px -20px hsl(var(--glass-shadow));
}
.glow-primary { box-shadow: 0 0 0 1px hsl(var(--glow-primary) / var(--glow-a-ring)),
                            0 8px 28px -8px hsl(var(--glow-primary) / var(--glow-a-spread)); }
.glow-mint    { box-shadow: 0 0 0 1px hsl(var(--glow-mint) / var(--glow-a-ring)),
                            0 8px 28px -8px hsl(var(--glow-mint) / var(--glow-a-spread)); }
.gradient-text    { color: hsl(var(--primary)); }          /* misnomer: solid, no gradient */
.gradient-primary { background-color: hsl(var(--primary)); }
.gradient-ring::before { /* 1px violet ring via mask-composite, see globals.css */ }
.font-mono-num { font-family: var(--font-mono);
                 font-feature-settings: "tnum" 1, "zero" 1;
                 font-variant-numeric: tabular-nums; }
.bg-grid { background-image: radial-gradient(hsl(var(--foreground) / 0.06) 1px, transparent 1px);
           background-size: 22px 22px; background-position: -1px -1px; }
.bg-glow-top { background-image: radial-gradient(60% 50% at 50% -10%,
               hsl(var(--primary) / 0.22) 0%, hsl(var(--primary) / 0.05) 40%, transparent 72%); }
```

NOTE: on mobile (and by decision, in the 360px popup) `.glass` drops to `blur(7px)
saturate(135%)` + opacity `+0.07`, `.glass-strong` to `blur(10px) saturate(150%)` + `+0.22` —
popup pays phone-class paint cost, use the reduced variants as the popup default.

### Keyframes / animation utilities

`pulse-glow`, `pulse-glow-mint` (2.4s), `grow-width` (.6s cubic-bezier(0.22,1,0.36,1)),
`float-y`, `shimmer` (1.8s), `modal-in` (.18s: opacity 0 + translateY(8px) scale(.97) → none),
`fade-in` (.18s), `sheet-up` (.26s), `reveal-up` (.42s), `glow-breathe` (14s),
`nt-caret` (1.05s steps(1): 0-49% opacity 1, 50-100% 0 — the blinking terminal caret),
`.code-literal` (ligature kill for copyable code). Full `prefers-reduced-motion` block that
nulls all animation except `.animate-spin`.

## Fonts

- Display/UI: **Space Grotesk** 400/500/600/700 — `"Space Grotesk", ui-sans-serif, system-ui, sans-serif`
- Numbers/addresses/code: **JetBrains Mono** 400/500/600/700 —
  `--font-mono: "JetBrains Mono", ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace`
- NT loads from Google Fonts CDN; merawallet MUST self-host woff2 (MV3 CSP).

## Tailwind — v3.4, `darkMode: "class"`, no plugins

Colors map tokens (`background/foreground/primary/secondary/muted/accent/mint/destructive/
success/danger/warning/border/input/ring/card`, each `hsl(var(--x))` + `-foreground`),
`borderRadius: lg=var(--radius) md=-2px sm=-4px`, boxShadow `glow-primary`/`glow-mint`.
All motion lives in globals.css, not the config.

## Component recipes (exact class strings from NT source)

- **Primary button** (`PrimaryButton.tsx`):
  `relative flex w-full items-center justify-center gap-2 rounded-xl gradient-primary py-3.5
  font-semibold text-white shadow-glow-primary transition-all duration-200
  hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2
  focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
  disabled:pointer-events-none disabled:opacity-50`
- **Ghost button**: `glass flex items-center gap-2 rounded-xl border border-border/60 px-3
  py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-px
  hover:border-primary/50`
- **Disabled CTA**: `w-full rounded-xl bg-muted py-3.5 text-muted-foreground font-semibold
  cursor-not-allowed`
- **Panel**: `glass rounded-2xl border border-border/60 p-4` (list variant adds
  `divide-y divide-border/40 overflow-hidden`)
- **Hero card** (SwapCard): `glass-strong gradient-ring w-full max-w-[440px] rounded-2xl p-5`
- **Modal**: `glass-strong gradient-ring animate-modal-in relative flex w-full max-w-md
  flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl`; scrim `bg-background/70
  backdrop-blur-sm`
- **Input wrapper** (TokenInput): `group/input rounded-xl border border-border/60 bg-muted/40
  p-4 transition-colors duration-150 focus-within:border-primary/50 hover:border-border`
- **Inner input**: `font-mono-num w-full min-w-0 rounded-md bg-transparent text-2xl
  font-semibold tracking-tight outline-none placeholder:text-muted-foreground/40
  focus-visible:ring-2 focus-visible:ring-ring sm:text-3xl`
- **Token pill**: `flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border
  border-border/70 bg-card/70 py-2 pl-1.5 pr-2.5 text-sm font-semibold shadow-sm
  hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-glow-primary`
- **MAX button**: `rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase
  tracking-wide text-primary`
- **Micro-label**: `text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground`
  (mono variant: `font-mono-num text-[10px] uppercase tracking-wider text-muted-foreground`)
- **Mint chip**: `rounded-full border border-mint/40 bg-mint/10 px-2 py-0.5 font-mono-num
  text-[10px] uppercase tracking-wider text-mint` (violet variant swaps mint→primary)
- **Status dot** (engine online):
  ```jsx
  <span className="relative flex h-2 w-2">
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
    <span className="relative inline-flex h-2 w-2 rounded-full bg-mint shadow-glow-mint" />
  </span>
  <span className="font-mono-num text-[10px] uppercase tracking-wider text-muted-foreground">engine</span>
  ```
- **Header**: `glass sticky top-0 z-40 border-b border-border/60`; inner rail
  `flex h-14 items-center justify-between gap-2 px-4`
- **Wordmark**: `Null<span class="gradient-text">Terminal</span>` two-tone → merawallet:
  `mera<span class="gradient-text">wallet</span>`
- **Nav pills**: group `glass flex items-center gap-1 rounded-2xl border border-border/60 p-1`;
  active item `bg-primary/20 text-foreground shadow-glow-primary`, idle
  `text-muted-foreground hover:bg-foreground/5 hover:text-foreground`
- **App shell**: `relative min-h-[100dvh] bg-background text-foreground bg-grid flex flex-col`
  + fixed `-z-10 bg-glow-top` ambient layer
- **Radius rule**: panels `rounded-2xl` · controls/buttons/inputs `rounded-xl` ·
  chips/dots/pills `rounded-full`

## Boot terminal (lock/splash idiom, from NT index.html pre-React splash)

Dark rounded card, title bar with three traffic-light dots (`hsl(0 68% 60%)` /
`hsl(40 88% 56%)` / `hsl(160 84% 52%)`), JetBrains Mono log lines fading in staggered
(0/.45/.9/1.35s), blinking mint block caret (7×13px, `nt-caret`), violet→mint sweep
progress bar. Wordmark accent gradient: `linear-gradient(90deg, hsl(252 91% 74%), hsl(160 84% 55%))`
— the ONE place a violet→mint gradient is allowed (also MobileTabBar active indicator).

## Icons & logo

No icon package — hand-drawn inline SVGs, 24×24 viewBox, 1.7-2px stroke, round caps,
`currentColor`. NT logo: two nodes joined by a diagonal route through a "null" ring
(`M32 96 L96 32` + circle r=30 + two r=12.5 nodes), gradient `#9B86FF → #6C4FE0 → #5538C8`.
merawallet mark: same language — rounded-square violet tile + diagonal route + key-dot.

## Theme switching (NT)

localStorage `nt-theme` (`light|dark|system`), `.dark` class on `<html>`, no-flash inline
head script, `useSyncExternalStore` module store (no zustand). merawallet: static
`<html class="dark">` (force-dark pro terminal, same as NT /app and /admin).

## Hex reference (dark)

background `#0D0B14` · card `#151320` · primary `#8D72F8`≈`#836EF9` · mint `#2CEDAC` ·
success `#2ADF9D` · danger `#F26969` · warning `#F6A823` · border `#2C293D` ·
muted-fg `#9692AA` · chart up `#2ebd85` / down `#f6465d`.
Brand gradient (logo only): `#9B86FF → #6C4FE0 → #5538C8`.
