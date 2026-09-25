import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import "./i18n";
import { iniciarAlmacen } from "./utils/almacen";

// Los datos del negocio se cargan (y migran a IndexedDB) antes de mostrar la app,
// así todas las pantallas los leen al instante como antes.
iniciarAlmacen().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>
  );
});

// Instalar como app en el celular (solo en la web publicada; no en Electron ni en desarrollo)
if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
