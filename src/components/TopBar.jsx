import React, { useState } from "react";
import { RefreshCw, LogOut, ChevronDown, Menu, Users, Pencil, Check, X } from "lucide-react";
import { BACKEND } from "../utils/config.js";

export default function TopBar({ title, syncStatus, onSync, user, onLogout, onMobileMenu, onUserUpdate }) {
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [editando,    setEditando]    = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [saving,      setSaving]      = useState(false);

  const isSyncing = syncStatus === "syncing";
  const isError   = syncStatus === "error";
  const isOffline = syncStatus === "offline";

  const dotColor = isError
    ? "bg-red-400"
    : isSyncing
    ? "bg-yellow-400 animate-pulse"
    : isOffline
    ? "bg-slate-400"
    : "bg-yellow-400";

  const label = {
    idle:     "Sincronizado",
    syncing:  "Sincronizando…",
    error:    "Error de sync",
    offline:  "Sin conexión",
  }[syncStatus] ?? "";

  function abrirEdicion() {
    setNuevoNombre(user?.nombre || "");
    setEditando(true);
    setMenuOpen(false);
  }

  async function guardarPerfil() {
    if (!nuevoNombre.trim() || nuevoNombre.trim().length < 2) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BACKEND}/api/auth/perfil`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nombre: nuevoNombre.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUserUpdate && onUserUpdate(updated);
        setEditando(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="drag-region flex items-center justify-between h-11 px-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center">
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
                <div className="w-5 h-5 bg-brand-400 rounded-full flex items-center justify-center">
                  <span className="text-slate-900 text-[9px] font-bold">{(user.nombre||"U").charAt(0).toUpperCase()}</span>
                </div>
                <span className="max-w-[120px] truncate font-medium">{user.nombre || user.email}</span>
                <ChevronDown size={10} />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-modal border border-slate-200 py-1.5 z-40">
                    <div className="px-3 py-2 border-b border-slate-100 mb-1">
                      <p className="text-[11px] font-semibold text-slate-800 truncate">{user.nombre}</p>
                      <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full
                          ${user.plan==="activo" ? "bg-brand-100 text-brand-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {user.plan === "activo" ? "Plan Activo" : "Prueba gratis"}
                        </span>
                        {(user.rol === "admin" || user.rol === "superadmin") && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            {user.rol}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={abrirEdicion}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <Pencil size={12} />
                      Editar perfil
                    </button>

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

      {/* Modal editar perfil */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-80 p-6">
            <h2 className="text-[14px] font-semibold text-slate-800 mb-4">Editar perfil</h2>
            <label className="block text-[11px] text-slate-500 mb-1">Nombre visible</label>
            <input
              autoFocus
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") guardarPerfil(); if (e.key === "Escape") setEditando(false); }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 mb-4"
              placeholder="Tu nombre"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditando(false)}
                className="flex items-center gap-1 px-3 py-1.5 text-[12px] text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={12} /> Cancelar
              </button>
              <button
                onClick={guardarPerfil}
                disabled={saving || nuevoNombre.trim().length < 2}
                className="flex items-center gap-1 px-3 py-1.5 text-[12px] bg-brand-400 text-slate-900 font-semibold rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-colors"
              >
                <Check size={12} /> {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
