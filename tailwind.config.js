/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--bg))",
        surface: "hsl(var(--surface))",
        "surface-soft": "hsl(var(--surface-soft))",
        "surface-glass": "hsl(var(--surface-glass))",
        "text-primary": "hsl(var(--text))",
        muted: "hsl(var(--muted))",
        stroke: "hsl(var(--stroke))",
        "stroke-soft": "hsl(var(--stroke-soft))",
        "accent-blue": "hsl(var(--accent-blue))",
        "accent-purple": "hsl(var(--accent-purple))",
        "accent-green": "hsl(var(--accent-green))",
        "accent-orange": "hsl(var(--accent-orange))",
        "accent-red": "hsl(var(--accent-red))",
      },
      fontFamily: {
        body: ["Inter", "sans-serif"],
        display: ["'Instrument Serif'", "serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
