import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        radar: {
          canvas: "hsl(var(--radar-canvas))",
          surface: "hsl(var(--radar-surface))",
          "surface-soft": "hsl(var(--radar-surface-soft))",
          ink: "hsl(var(--radar-ink))",
          "ink-soft": "hsl(var(--radar-ink-soft))",
          "ink-muted": "hsl(var(--radar-ink-muted))",
          line: "hsl(var(--radar-line))",
          "line-strong": "hsl(var(--radar-line-strong))",
          lime: "hsl(var(--radar-lime))",
          "lime-ink": "hsl(var(--radar-lime-ink))",
          blue: "hsl(var(--radar-blue))",
          "blue-ink": "hsl(var(--radar-blue-ink))",
          purple: "hsl(var(--radar-purple))",
          "purple-ink": "hsl(var(--radar-purple-ink))",
          pink: "hsl(var(--radar-pink))",
          "pink-ink": "hsl(var(--radar-pink-ink))",
          yellow: "hsl(var(--radar-yellow))",
          "yellow-ink": "hsl(var(--radar-yellow-ink))"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        control: "var(--radar-radius-control)",
        card: "var(--radar-radius-card)",
        panel: "var(--radar-radius-panel)"
      },
      boxShadow: {
        claude: "var(--radar-shadow-card)",
        card: "var(--radar-shadow-card)",
        popover: "var(--radar-shadow-popover)"
      }
    }
  },
  plugins: []
} satisfies Config;
