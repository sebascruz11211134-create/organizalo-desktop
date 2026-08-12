import React, { useState } from "react";
import { RefreshCw, LogOut, ChevronDown, User } from "lucide-react";

export default function TopBar({ title, syncStatus, onSync, user, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const isSyncing = syncStatus === "syncing";
  const isError   = syncStatus === "error";
  const isOffline = syncStatus === "offline";

  const dotColor = isError
    ? "bg-red-400"
    : isSyncing
    ? "bg-amber-400 animate-pulse"
    : isOffline
    ? "bg-slate-400"
    : "bg-emerald-400";

  const label = {
    idle:     "Sincronizado",
    syncing:  "Sincronizando…",
    error:    "Error de sync",
    offline:  "Sin conexión",
  }[syncStatus] ?? "";

  return (
    <header className="drag-region flex items-center justify-between h-11 px-5 bg-white border-b border-slate-200 shrink-0">
      {/* Espacio semáforos macOS */}
      <div className="w-[70px]" />

      <h1 className="text-[13px] font-semibold text-slate-700 tracking-tight">{title}</h1>

      <div className="no-drag flex items-center gap-4">
        {/* Sync indicator */}
        <button
          onClick={onSync}
          className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-700 transition-colors"
          title="Sincronizar ahora"
        >
          {isSyncing
            ? <RefreshCw size={11} className="animate-spin text-slate-400" />
            : <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
          <span>{label}</span>
        </button>

        {/* User menu */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-800 transition-colors"
            >
              <div className="w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center">
                <span className="text-white text-[9px] font-bold">{(user.nombre||"U").charAt(0).toUpperCase()}</span>
              </div>
              <span className="max-w-[120px] truncate font-medium">{user.nombre || user.email}</span>
              <ChevronDown size={10} />
            </button>

            {menuOpen && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                {/* Dropdown */}
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-modal border border-slate-200 py-1.5 z-40">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <p className="text-[11px] font-semibold text-slate-800 truncate">{user.nombre}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                    <span className={`inline-block mt-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full
                      ${user.plan==="activo" ? "bg-brand-100 text-brand-700" : "bg-amber-100 text-amber-700"}`}>
                      {user.plan === "activo" ? "Plan Activo" : "Prueba gratis"}
                    </span>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); onLogout && onLogout(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={12} />
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
