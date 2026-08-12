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
        // Color marca: Emerald — botones, links activos, accent
        brand: {
          50:  "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",   // ← color principal
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          DEFAULT: "#10b981",
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
