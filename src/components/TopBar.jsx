import React, { useState } from "react";
import { RefreshCw, LogOut, ChevronDown, Menu, Users } from "lucide-react";

export default function TopBar({ title, syncStatus, onSync, user, onLogout, onMobileMenu }) {
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
    : "bg-amber-400";

  const label = {
    idle:     "Sincronizado",
    syncing:  "Sincronizando…",
    error:    "Error de sync",
    offline:  "Sin conexión",
  }[syncStatus] ?? "";

  return (
    <header className="drag-region flex items-center justify-between h-11 px-4 bg-white border-b border-slate-200 shrink-0">
      {/* Hamburger en móvil | Espacio semáforos macOS en desktop */}
      <div className="flex items-center">
        {/* Hamburger — hidden: bottom tab bar handles mobile nav */}
        <div className="hidden lg:block w-[70px]" />
      </div>

      <h1 className="text-[13px] font-semibold text-slate-700 tracking-tight truncate max-w-[160px] sm:max-w-none">{title}</h1>

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
          <span className="sync-label">{label}</span>
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
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full
                        ${user.plan==="activo" ? "bg-brand-100 text-brand-700" : "bg-amber-100 text-amber-700"}`}>
                        {user.plan === "activo" ? "Plan Activo" : "Prueba gratis"}
                      </span>
                      {(user.rol === "admin" || user.rol === "superadmin") && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                          {user.rol}
                        </span>
                      )}
                    </div>
                  </div>

                  {(user.rol === "admin" || user.rol === "superadmin") && (
                    <a
                      href="#/configuracion"
                      onClick={() => setMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <Users size={12} />
                      Gestionar usuarios
                    </a>
                  )}

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
