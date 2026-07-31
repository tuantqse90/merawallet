import type { Config } from "tailwindcss";

// Ported verbatim from nullterminal/packages/web/tailwind.config.ts (see docs/DESIGN_DOSSIER.md).
const config: Config = {
  darkMode: "class",
  content: ["./popup.html", "./onboarding.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        mint: { DEFAULT: "hsl(var(--mint))", foreground: "hsl(var(--mint-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
        danger: { DEFAULT: "hsl(var(--danger))", foreground: "hsl(var(--danger-foreground))" },
        warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      fontFamily: {
        sans: ["Space Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "glow-primary":
          "0 0 0 1px hsl(var(--glow-primary) / var(--glow-a-ring)), 0 8px 28px -8px hsl(var(--glow-primary) / var(--glow-a-spread))",
        "glow-mint":
          "0 0 0 1px hsl(var(--glow-mint) / var(--glow-a-ring)), 0 8px 28px -8px hsl(var(--glow-mint) / var(--glow-a-spread))",
      },
    },
  },
  plugins: [],
};

export default config;
