/**
 * NotasCreditoScreen — Gestión de Notas de Crédito (desktop)
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, Printer, FileSpreadsheet, X } from "lucide-react";
import db from "../utils/db";
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

    // Si es devolución de producto y hay factura de referencia → restaurar inventario
    if (form.motivo === "Devolución de producto" && form.facturaRef) {
      await restaurarInventarioPorFactura(form.facturaRef.trim());
    }

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
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
                {showCli && filtCli.length > 0 && (
                  <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-md shadow-lg z-10 max-h-36 overflow-auto">
                    {filtCli.map((c) => (
                      <button key={c.id} onMouseDown={() => { setBusqCli(c.nombre); u("cliente", c.nombre); setShowCli(false); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 border-b last:border-0">
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
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase">Fecha</span>
              <input type="date" value={form.fecha} onChange={(e) => u("fecha", e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
            </label>
            <label className="block col-span-2">
              <span className="text-xs font-semibold text-slate-500 uppercase">Motivo *</span>
              <select value={form.motivo} onChange={(e) => u("motivo", e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
                {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase">Moneda</span>
              <select value={form.moneda} onChange={(e) => u("moneda", e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
                <option value="CRC">₡ CRC</option>
                <option value="USD">$ USD</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase">Monto *</span>
              <input type="number" value={form.monto} onChange={(e) => u("monto", e.target.value)}
                placeholder="0" min="0" step="any"
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
            </label>
            <label className="block col-span-2">
              <span className="text-xs font-semibold text-slate-500 uppercase">Observaciones</span>
              <input value={form.notas} onChange={(e) => u("notas", e.target.value)}
                placeholder="Detalles adicionales…"
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
            </label>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-slate-600 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50">Cancelar</button>
          <button onClick={guardar} className="flex-1 bg-brand-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-600">Crear nota</button>
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

  const cargar = useCallback(async () => {
    const [n, s, f, c] = await Promise.all([db.getNotasCredito(), db.getSettings(), db.getFacturas(), db.getContactos()]);
    setNotas(n.sort((a, b) => (b.creadoEn || "").localeCompare(a.creadoEn || "")));
    setSettings(s);
    setFacturas(f);
    setContactos(c || []);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const busqL   = busq.trim().toLowerCase();
  const visibles = notas.filter((n) =>
    !busqL || n.cliente?.toLowerCase().includes(busqL) || n.numero?.toLowerCase().includes(busqL) || n.motivo?.toLowerCase().includes(busqL)
  );

  const totCRC = visibles.filter((n) => n.moneda === "CRC").reduce((s, n) => s + (n.monto || 0), 0);
  const totUSD = visibles.filter((n) => n.moneda === "USD").reduce((s, n) => s + (n.monto || 0), 0);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 flex-1 bg-gray-100 rounded-lg px-3 py-2">
          <Search size={14} className="text-slate-400" />
          <input value={busq} onChange={(e) => setBusq(e.target.value)}
            placeholder="Buscar por cliente, N° o motivo…" className="bg-transparent text-sm flex-1 outline-none" />
        </div>
        <button onClick={() => printHTML(htmlNotasCredito(visibles, settings))}
          className="flex items-center gap-2 border border-gray-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">
          <Printer size={14} /> Imprimir
        </button>
        <button onClick={() => exportExcel(sheetsNotasCredito(visibles), "notas-credito")}
          className="flex items-center gap-2 border border-gray-200 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">
          <FileSpreadsheet size={14} /> Excel
        </button>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
          <Plus size={15} /> Nueva NC
        </button>
      </div>

      {/* Totales */}
      {visibles.length > 0 && (
        <div className="flex gap-4 px-6 py-2 bg-red-50 border-b border-red-100 text-sm">
          <span className="text-red-800 font-semibold">Total notas:</span>
          {totCRC > 0 && <span className="font-black text-red-900">{fmtMoney(totCRC, "CRC")}</span>}
          {totUSD > 0 && <span className="font-black text-red-900">{fmtMoney(totUSD, "USD")}</span>}
          <span className="ml-auto text-red-600">{visibles.length} nota{visibles.length !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>N°</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Factura ref.</th>
              <th>Motivo</th>
              <th>Moneda</th>
              <th>Monto</th>
              <th>Obs.</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16 text-slate-400">Sin notas de crédito</td></tr>
            ) : visibles.map((n) => (
              <tr key={n.id}>
                <td className="font-mono text-xs text-green-700 font-bold">{n.numero}</td>
                <td className="text-slate-500">{fmtDate(n.fecha)}</td>
                <td className="font-semibold text-slate-900">{n.cliente}</td>
                <td className="text-slate-400 text-xs">{n.facturaRef || "—"}</td>
                <td className="text-slate-700">{n.motivo}</td>
                <td className="text-slate-500">{n.moneda}</td>
                <td className="font-bold text-red-600">{fmtMoney(n.monto, n.moneda)}</td>
                <td className="text-slate-400 text-xs">{n.notas || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && <NuevaNCtModal settings={settings} facturas={facturas} contactos={contactos} onClose={() => setModal(false)} onSave={cargar} />}
    </div>
  );
}
