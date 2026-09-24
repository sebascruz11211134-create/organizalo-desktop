/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "media", // sigue la preferencia del sistema operativo
  theme: {
    extend: {
      // ── Tipografía ─────────────────────────────────────────────────────────
      fontFamily: {
        sans: ["Archivo", "Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Fira Mono", "monospace"],
      },

      // ── Paleta de marca ────────────────────────────────────────────────────
      colors: {
        // Monki: amarillo + negro (igual que la web). Sin azul.
        monki: {
          y: "#FFD600", y2: "#F0C800", k: "#111111", k2: "#1c1c1c", k3: "#2a2a2a",
          cream: "#F4F1E6", w: "#FAFAF5", muted: "#8a8a80",
        },
        // Color marca: Yellow (Monki) — botones, links activos, accent
        brand: {
          50:  "#fefce8",
          100: "#fef9c3",
          200: "#fef08a",
          300: "#ffe44d",
          400: "#FFD600",   // ← amarillo Monki
          500: "#F0C800",
          600: "#ca8a04",
          700: "#a16207",
          800: "#854d0e",
          900: "#713f12",
          DEFAULT: "#FFD600",
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

      // ── Movimiento (misma curva que la web) ────────────────────────────────
      transitionTimingFunction: { monki: "cubic-bezier(.2,.8,.2,1)" },
      keyframes: {
        entrar:    { from: { opacity: 0, transform: "translateY(10px)" }, to: { opacity: 1, transform: "none" } },
        desplegar: { from: { opacity: 0, transform: "translateY(-4px)" }, to: { opacity: 1, transform: "none" } },
        pulso:     { "0%": { boxShadow: "0 0 0 0 rgba(53,224,107,.6)" }, "70%": { boxShadow: "0 0 0 8px rgba(53,224,107,0)" }, "100%": { boxShadow: "0 0 0 0 rgba(53,224,107,0)" } },
        flotar:    { "0%,100%": { transform: "translateY(0) rotate(-2deg)" }, "50%": { transform: "translateY(-6px) rotate(2deg)" } },
        letra:     { from: { transform: "translateY(110%)" }, to: { transform: "translateY(0)" } },
      },
      animation: {
        entrar: "entrar .5s cubic-bezier(.2,.8,.2,1) both",
        desplegar: "desplegar .3s cubic-bezier(.2,.8,.2,1) both",
        pulso: "pulso 1.6s infinite",
        flotar: "flotar 4s ease-in-out infinite",
        letra: "letra .7s cubic-bezier(.2,.8,.2,1) both",
      },

      // ── Border radius ──────────────────────────────────────────────────────
      borderRadius: {
        xl2: "1rem",
        xl3: "1.25rem",
        monki: "22px",
      },
    },
  },
  plugins: [],
};
