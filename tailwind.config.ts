import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        asfalto: "rgb(var(--asfalto) / <alpha-value>)",
        laranja: { DEFAULT: "rgb(var(--laranja) / <alpha-value>)", fg: "rgb(var(--laranja-fg) / <alpha-value>)" },
        amarelo: "rgb(var(--amarelo) / <alpha-value>)",
        ok: "rgb(var(--ok) / <alpha-value>)",
        alerta: "rgb(var(--alerta) / <alpha-value>)",
        perigo: "rgb(var(--perigo) / <alpha-value>)",
      },
      fontFamily: {
        // Bahnschrift (Windows) / DIN Alternate (Mac): tipografia de sinalização viária.
        display: ['Bahnschrift', '"DIN Alternate"', '"Roboto Condensed"', '"Arial Narrow"', "system-ui", "sans-serif"],
        sans: ['"Segoe UI"', "system-ui", "-apple-system", "Roboto", "sans-serif"],
      },
      borderRadius: { DEFAULT: "6px" },
    },
  },
  plugins: [],
};
export default config;
