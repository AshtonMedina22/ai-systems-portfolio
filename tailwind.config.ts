import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        label: "var(--text-label)",
        accent: {
          DEFAULT: "var(--accent)",
          soft: "var(--accent-soft)",
          deep: "var(--accent-deep)",
        },
        line: {
          DEFAULT: "var(--line)",
          strong: "var(--line-strong)",
        },
        surface: "var(--surface)",
        ok: {
          DEFAULT: "var(--ok)",
          soft: "var(--ok-soft)",
        },
        warn: {
          DEFAULT: "var(--warn)",
          soft: "var(--warn-soft)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          soft: "var(--danger-soft)",
        },
        console: {
          bg: "var(--console-bg)",
          fg: "var(--console-fg)",
          muted: "var(--console-muted)",
          panel: "var(--console-panel)",
          border: "var(--console-border)",
        },
        /* Keep opal.* names so existing classes resolve to the unified tokens */
        opal: {
          canvas: "var(--bg-canvas)",
          card: "var(--card-surface)",
          main: "var(--text-main)",
          muted: "var(--text-muted)",
          label: "var(--text-label)",
          purple: "var(--accent)",
          violet: "var(--accent-deep)",
          rose: "var(--danger)",
          amber: "var(--warn)",
          lilac: "var(--opal-lilac)",
          orchid: "var(--opal-orchid)",
          aqua: "var(--opal-aqua)",
          teal: "var(--opal-teal)",
          mist: "var(--opal-mist)",
          shell: "var(--opal-shell)",
          coral: "var(--opal-coral)",
          periwinkle: "var(--opal-periwinkle)",
          terminal: "var(--terminal)",
        },
      },
      boxShadow: {
        "opal-soft": "0 18px 48px -30px rgba(56, 60, 112, 0.42)",
        "opal-hover": "0 22px 55px -28px rgba(94, 98, 168, 0.46)",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "sans-serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        "log-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-line": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "log-in": "log-in 280ms ease-out both",
        "pulse-line": "pulse-line 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
