/**
 * ClienteAutocomplete — campo de búsqueda de cliente/proveedor con dropdown.
 * Busca por nombre, código CLI-XXXX y cédula.
 *
 * Props:
 *   value       {string}   texto actual del campo
 *   onChange    {fn}       (contactoObj | null, nombreStr) => void
 *   tipo        {string}   "cliente" | "proveedor" | "todos"  (default: "todos")
 *   placeholder {string}
 *   ringColor   {string}   clase Tailwind de focus:ring, ej. "focus:ring-red-500"
 *   className   {string}   clases extra para el input
 *   disabled    {bool}
 */
import React, { useState, useEffect } from "react";
import db from "../utils/db";

export default function ClienteAutocomplete({
  value       = "",
  onChange,
  tipo        = "todos",
  placeholder,
  ringColor   = "focus:ring-green-500",
  className   = "",
  disabled    = false,
}) {
  const [contactos, setContactos] = useState([]);
  const [show,      setShow]      = useState(false);

  // Cargar contactos al montar (o cuando cambia el tipo)
  useEffect(() => {
    db.getContactos().then((cs) => {
      if (!cs) return;
      const filtro =
        tipo === "cliente"   ? cs.filter((c) => c.tipo === "cliente"   || c.tipo === "ambos") :
        tipo === "proveedor" ? cs.filter((c) => c.tipo === "proveedor" || c.tipo === "ambos") :
        cs;
      setContactos(filtro);
    });
  }, [tipo]);

  const q = (value || "").toLowerCase().trim();
  const filtrados = contactos
    .filter((c) =>
      !q ||
      c.nombre?.toLowerCase().includes(q) ||
      c.codigoCliente?.toLowerCase().includes(q) ||
      c.cedula?.includes(q)
    )
    .slice(0, 8);

  const handleSelect = (c) => {
    onChange && onChange(c, c.nombre);
    setShow(false);
  };

  const defaultPlaceholder =
    tipo === "proveedor" ? "Nombre o código del proveedor…" :
    tipo === "cliente"   ? "Nombre o código del cliente…" :
                           "Nombre, código o cédula…";

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => { onChange && onChange(null, e.target.value); setShow(true); }}
        onFocus={() => setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 150)}
        placeholder={placeholder ?? defaultPlaceholder}
        disabled={disabled}
        className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
          focus:outline-none focus:ring-2 ${ringColor}
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}`}
      />

      {show && filtrados.length > 0 && (
        <div className="absolute top-full left-0 w-full bg-white border border-slate-200
          rounded-lg shadow-xl z-30 max-h-48 overflow-auto">
          {filtrados.map((c) => (
            <button
              key={c.id}
              onMouseDown={() => handleSelect(c)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-green-50
                border-b border-slate-50 last:border-0 flex items-center gap-2"
            >
              {/* Código CLI */}
              {c.codigoCliente && (
                <span className="font-mono text-[10px] bg-blue-50 text-blue-700
                  px-1.5 py-0.5 rounded font-bold shrink-0">
                  {c.codigoCliente}
                </span>
              )}

              {/* Nombre */}
              <span className="font-semibold truncate flex-1">{c.nombre}</span>

              {/* Cédula */}
              {c.cedula && (
                <span className="text-slate-400 shrink-0 text-[10px]">{c.cedula}</span>
              )}

              {/* Plazo de crédito */}
              {c.dias_credito > 0 && (
                <span className="text-[10px] text-emerald-600 font-bold shrink-0">
                  {c.dias_credito}d
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
