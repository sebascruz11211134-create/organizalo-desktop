import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import "./i18n";
import { iniciarAlmacen, almacenBloqueado } from "./utils/almacen";

// Los datos del negocio se cargan (y migran a IndexedDB) antes de mostrar la app,
// así todas las pantallas los leen al instante como antes.
// Si los datos de la empresa existen pero no se pudieron abrir, NO se arranca
// con una copia vacía: se pide reintentar.
function AlmacenNoDisponible() {
  const ingles = localStorage.getItem("monki_idioma") === "en";
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#FFFBEA", fontFamily: "system-ui, sans-serif", color: "#111" }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <img src="/MK_Logo2.png" alt="Monki" width="56" height="56" />
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: "16px 0 8px" }}>
          {ingles ? "Couldn't open your data" : "No se pudieron abrir tus datos"}
        </h1>
        <p style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.5 }}>
          {ingles
            ? "Your data is safe on this device, but the browser couldn't open it right now. Close other Monki tabs and try again. If you're in a private window, use a normal one."
            : "Tus datos están a salvo en este equipo, pero el navegador no pudo abrirlos ahora. Cerrá otras pestañas de Monki y reintentá. Si estás en una ventana privada, usá una normal."}
        </p>
        {almacenBloqueado()?.message?.includes("otra empresa") && (
          <p style={{ fontSize: 13, marginTop: 10, fontWeight: 700 }}>{almacenBloqueado().message}</p>
        )}
        <button onClick={() => location.reload()} style={{ marginTop: 16, background: "#111", color: "#FFD600", border: 0, borderRadius: 999, padding: "10px 22px", fontWeight: 800, cursor: "pointer" }}>
          {ingles ? "Try again" : "Reintentar"}
        </button>
        {/* Salir de la cuenta sin tocar los datos del negocio guardados en el equipo */}
        <button onClick={() => {
          ["@finanzia/authToken", "@finanzia/refreshToken", "@finanzia/authUser", "@finanzia/modulosHabilitados"].forEach(k => localStorage.removeItem(k));
          location.reload();
        }} style={{ display: "block", margin: "10px auto 0", background: "transparent", color: "#111", border: 0, textDecoration: "underline", cursor: "pointer", fontSize: 13 }}>
          {ingles ? "Sign out of this account" : "Salir de esta cuenta"}
        </button>
      </div>
    </div>
  );
}

iniciarAlmacen().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      {almacenBloqueado() ? <AlmacenNoDisponible /> : (
        <HashRouter>
          <App />
        </HashRouter>
      )}
    </React.StrictMode>
  );
});

// Instalar como app en el celular (solo en la web publicada; no en Electron ni en desarrollo)
if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
