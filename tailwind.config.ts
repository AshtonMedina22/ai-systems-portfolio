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
        line: "var(--line)",
        surface: "var(--surface)",
        ok: "var(--ok)",
        warn: "var(--warn)",
        danger: "var(--danger)",
        opal: {
          canvas: "#FBFBFC",
          card: "#FFFFFF",
          main: "#0F172A",
          muted: "#334155",
          label: "#1E293B",
          purple: "#7C3AED",
          violet: "#9333EA",
          rose: "#E11D48",
          amber: "#D97706",
          terminal: "#1E293B",
        },
      },
      boxShadow: {
        "opal-soft": "0 12px 32px -12px rgba(100, 116, 139, 0.22)",
        "opal-hover": "0 20px 40px -14px rgba(124, 58, 237, 0.18)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
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
