/**
 * NotasCreditoScreen — Gestión de Notas de Crédito (desktop)
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, Printer, FileSpreadsheet, X, Trash2, Ban, Send, Loader2 } from "lucide-react";
import { BACKEND } from "../utils/config.js";
import { getToken } from "../utils/auth";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate, hoy, genId } from "../utils/fmt";
import { printHTML, exportExcel, htmlNotasCredito, sheetsNotasCredito } from "../utils/reportHelpers";
import { restaurarInventarioPorFactura } from "../utils/clienteUtils";

const MOTIVOS = ["Devolución de producto", "Descuento especial", "Error de facturación", "Servicio no prestado", "Otro"];

function NuevaNCtModal({ settings, facturas, contactos = [], onClose, onSave }) {
  const [form, setForm] = useState({
    cliente: "", facturaRef: "", motivo: MOTIVOS[0], monto: "",
    moneda: settings.moneda || "CRC", notas: "", fecha: hoy(),
  });
  const u = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const [busqCli,    setBusqCli]    = useState("");
  const [showCli,    setShowCli]    = useState(false);

  const filtCli = contactos.filter((c) =>
    c.nombre?.toLowerCase().includes(busqCli.toLowerCase()) ||
    c.cedula?.includes(busqCli) ||
    c.codigoCliente?.toUpperCase().includes(busqCli.toUpperCase())
  ).slice(0, 6);

  const guardar = async () => {
    if (!form.cliente || !form.monto) return alert("Cliente y monto requeridos.");
    const notas = await db.getNotasCredito();
    const seq   = (notas.length + 1).toString().padStart(5, "0");
    const nueva = { ...form, id: genId(), numero: `NC-${seq}`, monto: parseFloat(form.monto) || 0, creadoEn: new Date().toISOString() };
    await db.setNotasCredito([...notas, nueva]);

    // ── Vincular NC a la factura referenciada ────────────────────────────────
    if (form.facturaRef) {
      const facturas = await db.getFacturas();
      const upd = facturas.map(f =>
        f.numero === form.facturaRef.trim()
          ? { ...f, notasCredito: [...(f.notasCredito || []), { numero: nueva.numero, monto: nueva.monto, moneda: nueva.moneda, fecha: nueva.fecha, motivo: nueva.motivo }] }
          : f
      );
      await db.setFacturas(upd);
    }

    // Si es devolución de producto y hay factura de referencia → restaurar inventario
    if (form.motivo === "Devolución de producto" && form.facturaRef) {
      await restaurarInventarioPorFactura(form.facturaRef.trim());
    }

    // ── Asiento contable de reversión ────────────────────────────────────────
    try {
      const asientos = await db.getAsientos();
      const numAJ = `AJ-${String(asientos.length + 1).padStart(5, "0")}`;
      const monto = parseFloat(form.monto) || 0;
      await db.setAsientos([...asientos, {
        id: genId(), numero: numAJ, estado: "confirmado", autoGenerado: true,
        descripcion: `NC ${nueva.numero} — ${form.cliente} (${form.motivo})`,
        fecha: form.fecha, totalDebe: monto, totalHaber: monto,
        lineas: [
          { cuentaCodigo: "4101", cuentaNombre: "Ventas / Ingresos",    debe: monto, haber: 0 },
          { cuentaCodigo: "1201", cuentaNombre: "Cuentas por cobrar",   debe: 0, haber: monto },
        ],
        creadoEn: new Date().toISOString(),
      }]);
    } catch (e) { console.warn("[NC] asiento:", e.message); }

    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-slate-900">Nueva nota de crédito</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-700" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <span className="text-xs font-semibold text-slate-500 uppercase">Cliente *</span>
              <div className="relative mt-1">
                <input value={busqCli}
                  onChange={(e) => { setBusqCli(e.target.value); u("cliente", e.target.value); setShowCli(true); }}
                  onFocus={() => setShowCli(true)}
                  onBlur={() => setTimeout(() => setShowCli(false), 150)}
                  placeholder="Nombre o código CLI-XXXX…"
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                {showCli && filtCli.length > 0 && (
                  <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-md shadow-lg z-10 max-h-36 overflow-auto">
                    {filtCli.map((c) => (
                      <button key={c.id} onMouseDown={() => { setBusqCli(c.nombre); u("cliente", c.nombre); setShowCli(false); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-yellow-50 border-b last:border-0">
                        {c.codigoCliente && <span className="font-mono text-[10px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded mr-1.5">{c.codigoCliente}</span>}
                        <span className="font-semibold">{c.nombre}</span>
                        <span className="text-slate-400 ml-2">{c.cedula}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase">Factura ref.</span>
              <input value={form.facturaRef} onChange={(e) => u("facturaRef", e.target.value)}
                placeholder="FE-00001"
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase">Fecha</span>
              <input type="date" value={form.fecha} onChange={(e) => u("fecha", e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400" />
            </label>
            <label className="block col-span-2">
              <span className="text-xs font-semibold text-slate-500 uppercase">Motivo *</span>
              <select value={form.motivo} onChange={(e) => u("motivo", e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400">
                {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase">Moneda</span>
              <select value={form.moneda} onChange={(e) => u("moneda", e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400">
                <option value="CRC">₡ CRC</option>
                <option value="USD">$ USD</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase">Monto *</span>
              <input type="number" value={form.monto} onChange={(e) => u("monto", e.target.value)}
                placeholder="0" min="0" step="any"
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400" />
            </label>
            <label className="block col-span-2">
              <span className="text-xs font-semibold text-slate-500 uppercase">Observaciones</span>
              <input value={form.notas} onChange={(e) => u("notas", e.target.value)}
                placeholder="Detalles adicionales…"
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400" />
            </label>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-slate-600 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} className="flex-1 bg-yellow-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-yellow-700">Crear nota</button>
        </div>
      </div>
    </div>
  );
}

export default function NotasCreditoScreen() {
  const [notas,     setNotas]     = useState([]);
  const [settings,  setSettings]  = useState({});
  const [facturas,  setFacturas]  = useState([]);
  const [contactos, setContactos] = useState([]);
  const [busq,      setBusq]      = useState("");
  const [modal,     setModal]     = useState(false);
  const [selected,  setSelected]  = useState(null);
  const [enviando,  setEnviando]  = useState(false);

  const cargar = useCallback(async () => {
    const [n, s, f, c] = await Promise.all([db.getNotasCredito(), db.getSettings(), db.getFacturas(), db.getContactos()]);
    setNotas(n.sort((a, b) => (b.creadoEn || "").localeCompare(a.creadoEn || "")));
    setSettings(s);
    setFacturas(f);
    setContactos(c || []);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const anular = async () => {
    if (!sel) return;
    if (!confirm(`¿Anular la nota de crédito ${sel.numero}? Quedará marcada como anulada.`)) return;
    const todas = await db.getNotasCredito();
    await db.setNotasCredito(todas.map(x => x.id === sel.id ? { ...x, estado: "anulada" } : x));
    cargar();
  };

  const eliminar = async (n) => {
    if (!confirm(`¿Eliminar la nota de crédito ${n.numero}? Esta acción no se puede deshacer.`)) return;
    const todas = await db.getNotasCredito();
    await db.setNotasCredito(todas.filter(x => x.id !== n.id));
    // Desvincular de la factura si aplica
    if (n.facturaRef) {
      const facts = await db.getFacturas();
      await db.setFacturas(facts.map(f =>
        f.numero === n.facturaRef
          ? { ...f, notasCredito: (f.notasCredito || []).filter(nc => nc.numero !== n.numero) }
          : f
      ));
    }
    setSelected(null);
    cargar();
  };

  // ── Enviar NC a Hacienda ────────────────────────────────────────────────────
  const enviarHacienda = async (nota) => {
    if (!nota) return;
    setEnviando(true);
    try {
      // Buscar cedula del cliente en contactos
      const cLower = (nota.cliente || "").toLowerCase();
      const contacto = contactos.find(c => c.nombre?.toLowerCase() === cLower);

      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/emision/nota-credito`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          cliente: {
            nombre: nota.cliente || "Consumidor Final",
            cedula: contacto?.cedula || undefined,
            correo: contacto?.email || contacto?.correo || undefined,
          },
          // Convertir el monto plano en una línea de detalle para el XML
          items: [{
            descripcion:    nota.motivo || "Nota de crédito",
            cantidad:       1,
            precioUnitario: nota.monto || 0,
            tarifaIva:      0, // NC se emiten por el monto bruto (IVA ya calculado en la FE)
            codigoCabys:    "8399000000000",
            unidadMedida:   "Servicio",
          }],
          moneda:           nota.moneda || "CRC",
          referenciaNumero: nota.facturaRef || undefined,
          referenciaRazon:  nota.motivo || "Anulación de comprobante",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);

      // Persistir estado Hacienda en la nota local
      const todas = await db.getNotasCredito();
      await db.setNotasCredito(todas.map(x => x.id === nota.id
        ? { ...x, haciendaEstado: json.estado, haciendaClave: json.clave, haciendaConsecutivo: json.numeroConsecutivo }
        : x
      ));
      await cargar();
      alert(`✅ NC enviada a Hacienda\nEstado: ${json.estado}\nClave: ${json.clave}`);
    } catch (err) {
      alert(`❌ Error al enviar a Hacienda:\n${err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  const busqL   = busq.trim().toLowerCase();
  const visibles = notas.filter(n =>
    !busqL || n.cliente?.toLowerCase().includes(busqL) || n.numero?.toLowerCase().includes(busqL) || n.motivo?.toLowerCase().includes(busqL)
  );

  const totCRC = visibles.filter(n => n.moneda === "CRC").reduce((s, n) => s + (n.monto || 0), 0);
  const totUSD = visibles.filter(n => n.moneda === "USD").reduce((s, n) => s + (n.monto || 0), 0);
  const sel = visibles.find(n => n.id === selected);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar oscuro estilo TecApro */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-700 border-b border-slate-600">
        <button onClick={() => setModal(true)}
          className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          <Plus size={13} /> Nueva NC
        </button>
        <div className="w-px h-5 bg-slate-500 mx-1" />
        <button
          disabled={!sel || sel.estado === "anulada"}
          onClick={anular}
          className="flex items-center gap-1.5 border border-yellow-400 text-yellow-300 hover:bg-yellow-500/20 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          <Ban size={13} /> Anular
        </button>
        <button
          disabled={!sel}
          onClick={() => sel && eliminar(sel)}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          <Trash2 size={13} /> Eliminar
        </button>
        <div className="w-px h-5 bg-slate-500 mx-1" />
        <button
          disabled={!sel || enviando || sel.estado === "anulada"}
          onClick={() => sel && enviarHacienda(sel)}
          title={sel?.haciendaClave ? `Clave: ${sel.haciendaClave}` : "Enviar NC-01 a Hacienda"}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          {enviando ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          {sel?.haciendaEstado ? `Hacienda: ${sel.haciendaEstado}` : "Enviar Hacienda"}
        </button>
        <div className="w-px h-5 bg-slate-500 mx-1" />
        <button onClick={() => printHTML(htmlNotasCredito(visibles, settings))}
          className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          <Printer size={13} /> Imprimir
        </button>
        <button onClick={() => exportExcel(sheetsNotasCredito(visibles), "notas-credito")}
          className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          <FileSpreadsheet size={13} /> Excel
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 bg-slate-600 rounded px-2 py-1.5">
          <Search size={12} className="text-slate-300" />
          <input value={busq} onChange={e => setBusq(e.target.value)}
            placeholder="Buscar…" className="bg-transparent text-white text-xs outline-none w-36 placeholder-slate-400" />
        </div>
      </div>

      {/* Barra de registro seleccionado / totales */}
      {sel ? (
        <div className="flex items-center gap-4 px-4 py-1.5 bg-red-50 border-b border-red-200 text-xs">
          <span className="text-red-700 font-semibold">Seleccionada:</span>
          <span className="font-bold text-slate-800">{sel.numero}</span>
          <span className="text-slate-500">{sel.cliente}</span>
          {sel.facturaRef && <span className="text-slate-400">→ {sel.facturaRef}</span>}
          <span className="font-bold text-red-600">{fmtMoney(sel.monto, sel.moneda)}</span>
          <button onClick={() => setSelected(null)} className="ml-auto text-slate-400 hover:text-slate-600">✕ Deseleccionar</button>
        </div>
      ) : (
        <div className="flex gap-4 px-4 py-1.5 bg-red-50 border-b border-red-100 text-xs text-slate-500">
          {totCRC > 0 && <span>CRC: <strong className="text-red-800">{fmtMoney(totCRC, "CRC")}</strong></span>}
          {totUSD > 0 && <span>USD: <strong className="text-red-800">{fmtMoney(totUSD, "USD")}</strong></span>}
          <span className="ml-auto">{visibles.length} nota{visibles.length !== 1 ? "s" : ""} — clic en fila para seleccionar</span>
        </div>
      )}

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>N°</th><th>Fecha</th><th>Cliente</th><th>Factura ref.</th>
              <th>Motivo</th><th>Moneda</th><th>Monto</th><th>Hacienda</th><th>Obs.</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-16 text-slate-400">Sin notas de crédito</td></tr>
            ) : visibles.map(n => {
              const isSel = selected === n.id;
              return (
                <tr key={n.id}
                  className={`cursor-pointer transition-colors ${isSel ? "bg-red-100 border-l-4 border-red-500" : "hover:bg-slate-50"}`}
                  onClick={() => setSelected(isSel ? null : n.id)}>
                  <td className="font-mono text-xs text-red-700 font-bold">{n.numero}</td>
                  <td className="text-slate-500">{fmtDate(n.fecha)}</td>
                  <td className="font-semibold text-slate-900">{n.cliente}</td>
                  <td className="text-slate-400 text-xs font-mono">{n.facturaRef || "—"}</td>
                  <td className="text-slate-700">{n.motivo}</td>
                  <td className="text-slate-500">{n.moneda}</td>
                  <td className="font-bold text-red-600">{fmtMoney(n.monto, n.moneda)}</td>
                  <td>
                    {n.haciendaEstado
                      ? <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${n.haciendaEstado === "aceptado" || n.haciendaEstado === "enviado" || n.haciendaEstado === "simulado" ? "bg-green-100 text-green-700" : n.haciendaEstado === "rechazado" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{n.haciendaEstado}</span>
                      : <span className="text-slate-300 text-[10px]">—</span>}
                  </td>
                  <td className="text-slate-400 text-xs">{n.notas || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && <NuevaNCtModal settings={settings} facturas={facturas} contactos={contactos} onClose={() => setModal(false)} onSave={cargar} />}
    </div>
  );
}
