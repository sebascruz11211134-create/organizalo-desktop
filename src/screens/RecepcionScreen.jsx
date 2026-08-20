/**
 * RecepcionScreen — Recepción masiva de facturas electrónicas XML
 *
 * 1. Zona drag & drop (o click) para subir hasta 500 XMLs de Hacienda
 * 2. Tabla de revisión con emisor, total, estado
 * 3. Botón "Aceptar" individual o "Aceptar todos" en masa
 * 4. Requiere certificado .p12 configurado en Configuración
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload, FileText, CheckCircle, XCircle, Clock, Loader2,
  AlertCircle, RefreshCw, Inbox, Check, X
} from "lucide-react";
import { getToken } from "../utils/auth";

import { BACKEND } from "../utils/config";

const ESTADO_BADGE = {
  pendiente:        { label: "Pendiente",       cls: "bg-amber-100 text-amber-700" },
  aceptada:         { label: "Aceptada",         cls: "bg-green-100 text-amber-700" },
  rechazada:        { label: "Rechazada",        cls: "bg-red-100 text-red-700" },
  aceptada_parcial: { label: "Parcial",          cls: "bg-blue-100 text-blue-700" },
  error_hacienda:   { label: "Error Hacienda",   cls: "bg-red-100 text-red-700" },
};

function fmt(n) {
  return n != null ? Number(n).toLocaleString("es-CR", { minimumFractionDigits: 2 }) : "—";
}

export default function RecepcionScreen() {
  const [facturas,   setFacturas]   = useState([]);
  const [filtroEst,  setFiltroEst]  = useState("");
  const [cargando,   setCargando]   = useState(false);
  const [subiendo,   setSubiendo]   = useState(false);
  const [dragging,   setDragging]   = useState(false);
  const [errorConex, setErrorConex] = useState(false);
  const [msg,        setMsg]        = useState(null);   // { type, text }
  const [procesando, setProcesando] = useState({});     // { [id]: true }
  const [aceptTodos, setAceptTodos] = useState(false);
  const [haciendaToken, setHaciendaToken] = useState("");
  const fileRef = useRef(null);

  useEffect(() => { cargar(); }, [filtroEst]);

  async function cargar() {
    setCargando(true);
    setErrorConex(false);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000); // 5s timeout
    try {
      const token = await getToken();
      const url = `${BACKEND}/api/recepcion/lista${filtroEst ? `?estado=${filtroEst}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (res.ok) setFacturas(await res.json());
      else setErrorConex(true);
    } catch {
      setErrorConex(true);
    } finally {
      clearTimeout(timer);
      setCargando(false);
    }
  }

  // ── Subir XMLs ─────────────────────────────────────────────────────────────
  async function procesarArchivos(files) {
    if (!files?.length) return;
    const xmlFiles = Array.from(files).filter((f) =>
      f.name.endsWith(".xml") || f.type.includes("xml")
    );
    if (!xmlFiles.length) {
      setMsg({ type: "err", text: "Ningún archivo es un XML válido" });
      return;
    }
    setSubiendo(true);
    setMsg(null);
    try {
      const token = await getToken();
      const form = new FormData();
      xmlFiles.forEach((f) => form.append("xmls", f));
      const res = await fetch(`${BACKEND}/api/recepcion/procesar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "ok", text: `${data.procesadas} factura(s) importada(s)${data.errores ? ` · ${data.errores} con error` : ""}` });
        cargar();
      } else {
        setMsg({ type: "err", text: data.error || "Error al procesar los XMLs" });
      }
    } catch (e) {
      setMsg({ type: "err", text: e.message });
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // Drag & drop handlers
  const onDragOver  = useCallback((e) => { e.preventDefault(); setDragging(true);  }, []);
  const onDragLeave = useCallback((e) => { e.preventDefault(); setDragging(false); }, []);
  const onDrop      = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    procesarArchivos(e.dataTransfer.files);
  }, []);

  // ── Aceptar individual ────────────────────────────────────────────────────
  async function aceptar(id, mensajeTipo = 1) {
    setProcesando((p) => ({ ...p, [id]: true }));
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/recepcion/aceptar/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: mensajeTipo, haciendaToken }),
      });
      const data = await res.json();
      if (!res.ok) setMsg({ type: "err", text: data.error || "Error al enviar a Hacienda" });
      cargar();
    } catch (e) {
      setMsg({ type: "err", text: e.message });
    } finally {
      setProcesando((p) => { const n = { ...p }; delete n[id]; return n; });
    }
  }

  // ── Aceptar todos ─────────────────────────────────────────────────────────
  async function aceptarTodos() {
    setAceptTodos(true);
    setMsg(null);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/recepcion/aceptar-todos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ haciendaToken }),
      });
      const data = await res.json();
      const ok  = data.resultados?.filter((r) => r.ok).length || 0;
      const err = data.resultados?.filter((r) => !r.ok).length || 0;
      setMsg({ type: ok > 0 ? "ok" : "err", text: `${ok} aceptadas · ${err} con error` });
      cargar();
    } catch (e) {
      setMsg({ type: "err", text: e.message });
    } finally {
      setAceptTodos(false);
    }
  }

  const pendientes = facturas.filter((f) => f.estado === "pendiente").length;

  return (
    <div className="p-6 fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Recepción de Facturas</h1>
          <p className="text-sm text-slate-500">Importá XMLs de Hacienda y enviá el Mensaje Receptor</p>
        </div>
        <button onClick={cargar} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-slate-600 hover:bg-gray-50">
          <RefreshCw size={14} className={cargando ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      {/* ── Zona drag & drop ─────────────────────────────────────────────── */}
      <div
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`mb-5 border-2 border-dashed rounded-xl px-6 py-10 text-center cursor-pointer transition-colors
          ${dragging ? "border-amber-300 bg-green-50" : "border-gray-300 hover:border-amber-300 hover:bg-amber-50"}`}>
        {subiendo ? (
          <div className="flex flex-col items-center gap-2 text-amber-700">
            <Loader2 size={32} className="animate-spin" />
            <p className="text-sm font-medium">Procesando XMLs…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <Inbox size={36} />
            <p className="text-sm font-medium text-slate-600">
              Arrastrá archivos <span className="font-mono text-amber-700">.xml</span> aquí, o hacé click para seleccionarlos
            </p>
            <p className="text-xs text-slate-400">Hasta 500 XMLs a la vez — FacturaElectronica, Tiquete, Nota de Crédito…</p>
          </div>
        )}
        <input ref={fileRef} type="file" accept=".xml,text/xml,application/xml" multiple className="hidden"
          onChange={(e) => procesarArchivos(e.target.files)} />
      </div>

      {/* ── Mensaje resultado ─────────────────────────────────────────────── */}
      {msg && (
        <div className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm
          ${msg.type === "ok" ? "bg-green-50 border border-amber-300 text-amber-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {msg.type === "ok" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {msg.text}
        </div>
      )}

      {/* ── Token Hacienda (opcional si está en .env del VPS) ─────────────── */}
      <div className="mb-4 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Token Hacienda (Bearer)</label>
          <input type="password" value={haciendaToken} onChange={(e) => setHaciendaToken(e.target.value)}
            placeholder="Dejar vacío si está configurado en el servidor"
            className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" />
        </div>

        {/* Filtro estado */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filtrar</label>
          <select value={filtroEst} onChange={(e) => setFiltroEst(e.target.value)}
            className="border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none">
            <option value="">Todas</option>
            <option value="pendiente">Pendientes</option>
            <option value="aceptada">Aceptadas</option>
            <option value="rechazada">Rechazadas</option>
            <option value="error_hacienda">Error Hacienda</option>
          </select>
        </div>

        {/* Aceptar todos */}
        {pendientes > 0 && (
          <button onClick={aceptarTodos} disabled={aceptTodos}
            className="flex items-center gap-2 px-4 py-2 bg-amber-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50">
            {aceptTodos ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Aceptar {pendientes} pendiente{pendientes > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* ── Tabla ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {cargando ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 size={20} className="animate-spin" /> Cargando…
          </div>
        ) : errorConex ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <AlertCircle size={36} className="text-amber-400" />
            <p className="text-sm font-medium text-slate-600">No se pudo conectar al servidor</p>
            <p className="text-xs text-slate-400">El módulo de recepción requiere conexión al backend. Verificá que el servidor esté activo.</p>
            <button onClick={cargar} className="mt-2 text-xs text-amber-700 underline">Reintentar</button>
          </div>
        ) : facturas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <FileText size={36} />
            <p className="text-sm">No hay facturas recibidas{filtroEst ? ` con estado "${filtroEst}"` : ""}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Emisor</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Cédula</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Total</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">IVA</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase">Estado</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase">Acción</th>
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => {
                const badge = ESTADO_BADGE[f.estado] || { label: f.estado, cls: "bg-gray-100 text-gray-600" };
                const esPend = f.estado === "pendiente";
                const proc   = procesando[f.id];
                return (
                  <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString("es-CR") : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate">
                      {f.emisor_nombre || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{f.emisor_cedula || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {f.moneda === "USD" ? "$" : "₡"}{fmt(f.total_factura)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">{fmt(f.total_iva)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {esPend ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => aceptar(f.id, 1)}
                            disabled={proc}
                            title="Aceptar"
                            className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-amber-700 rounded-lg text-xs font-semibold hover:bg-green-200 disabled:opacity-50">
                            {proc ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                            Aceptar
                          </button>
                          <button
                            onClick={() => aceptar(f.id, 3)}
                            disabled={proc}
                            title="Rechazar"
                            className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 disabled:opacity-50">
                            <X size={11} /> Rechazar
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-slate-400 mt-3 text-right">{facturas.length} factura(s) · Requiere certificado .p12 en Configuración</p>
    </div>
  );
}
