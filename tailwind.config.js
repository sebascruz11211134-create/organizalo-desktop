/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "media", // sigue la preferencia del sistema operativo
  theme: {
    extend: {
      // ── Tipografía ─────────────────────────────────────────────────────────
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Fira Mono", "monospace"],
      },

      // ── Paleta de marca ────────────────────────────────────────────────────
      colors: {
        // Color marca: Yellow (Monki) — botones, links activos, accent
        brand: {
          50:  "#fefce8",
          100: "#fef9c3",
          200: "#fef08a",
          300: "#fde047",
          400: "#facc15",   // ← color principal
          500: "#eab308",
          600: "#ca8a04",
          700: "#a16207",
          800: "#854d0e",
          900: "#713f12",
          DEFAULT: "#facc15",
        },
        // Semánticos
        danger:  { DEFAULT: "#ef4444", light: "#fee2e2", dark: "#dc2626" },
        warning: { DEFAULT: "#f59e0b", light: "#fef3c7", dark: "#d97706" },
        success: { DEFAULT: "#10b981", light: "#d1fae5", dark: "#059669" },
      },

      // ── Sombras ────────────────────────────────────────────────────────────
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        modal:"0 10px 40px -4px rgb(0 0 0 / 0.15), 0 4px 16px -4px rgb(0 0 0 / 0.10)",
      },

      // ── Border radius ──────────────────────────────────────────────────────
      borderRadius: {
        xl2: "1rem",
        xl3: "1.25rem",
      },
    },
  },
  plugins: [],
};
