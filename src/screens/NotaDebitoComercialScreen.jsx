/**
 * NotaDebitoComercialScreen — Nota de Débito Electrónica (ND-01)
 *
 * Cargo adicional a una Factura Electrónica emitida previamente.
 * Flujo: llenar receptor + líneas → guardar local → Enviar a Hacienda (ND-01)
 *
 * ⚠️ No confundir con las Notas de Débito BANCARIAS del módulo Control Bancario.
 *    Las bancarias son internas; estas se envían a Hacienda.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Send, Loader2, Search, X, Ban } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, hoy, genId, fmtDate } from "../utils/fmt";
import { BACKEND } from "../utils/config.js";
import { getToken, getAutorSync } from "../utils/auth";

// ── Constantes Hacienda ───────────────────────────────────────────────────────
const TIPOS_IVA = [
  { value: "01", label: "0% Exento",   pct: 0  },
  { value: "07", label: "8%",           pct: 8  },
  { value: "08", label: "13%",          pct: 13 },
];
const IVA_PCT = { "01": 0, "07": 8, "08": 13 };

function lineaVacia() {
  return { id: genId(), descripcion: "", cantidad: "1", unidad: "Unid", codigoCabys: "", precioUnit: "", codigoIVA: "08" };
}
function calcLinea(l) {
  const cant   = parseFloat(l.cantidad) || 0;
  const precio = parseFloat(l.precioUnit) || 0;
  const subTotal = cant * precio;
  const pctIVA  = IVA_PCT[l.codigoIVA] ?? 13;
  const montoIVA = (subTotal * pctIVA) / 100;
  return { ...l, subTotal, pctIVA, montoIVA, total: subTotal + montoIVA };
}

// ── Badge Hacienda ────────────────────────────────────────────────────────────
function BadgeHacienda({ estado }) {
  if (!estado) return <span className="text-slate-300 text-[10px]">—</span>;
  const cls = estado === "enviado" || estado === "simulado" || estado === "aceptado"
    ? "bg-green-100 text-green-700"
    : estado === "rechazado" ? "bg-red-100 text-red-700"
    : "bg-yellow-100 text-yellow-700";
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${cls}`}>{estado}</span>;
}

export default function NotaDebitoComercialScreen() {
  const [notas,     setNotas]     = useState([]);
  const [contactos, setContactos] = useState([]);
  const [settings,  setSettings]  = useState({});
  const [busq,      setBusq]      = useState("");
  const [selected,  setSelected]  = useState(null);
  const [showForm,  setShowForm]  = useState(false);
  const [enviando,  setEnviando]  = useState(false);

  // ── Form state ───────────────────────────────────────────────────────────────
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteCedula, setClienteCedula] = useState("");
  const [clienteEmail,  setClienteEmail]  = useState("");
  const [busqCli,       setBusqCli]       = useState("");
  const [showCli,       setShowCli]       = useState(false);
  const [facturaRef,    setFacturaRef]    = useState("");
  const [motivo,        setMotivo]        = useState("Cargo adicional");
  const [fecha,         setFecha]         = useState(hoy());
  const [moneda,        setMoneda]        = useState("CRC");
  const [lineas,        setLineas]        = useState([lineaVacia()]);

  const cargar = useCallback(async () => {
    try {
      const raw = localStorage.getItem("@finanzia/notasDebitoComercial");
      const n = raw ? JSON.parse(raw) : [];
      setNotas(n.sort((a, b) => (b.creadoEn || "").localeCompare(a.creadoEn || "")));
    } catch { setNotas([]); }
    const [s, c] = await Promise.all([db.getSettings(), db.getContactos()]);
    setSettings(s);
    setContactos(c || []);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useSyncRefresh(cargar);

  const guardarNotasLocal = async (nuevaLista) => {
    localStorage.setItem("@finanzia/notasDebitoComercial", JSON.stringify(nuevaLista));
    if (typeof window.__orgPush === "function") window.__orgPush();
  };

  const resetForm = () => {
    setClienteNombre(""); setClienteCedula(""); setClienteEmail("");
    setBusqCli(""); setFacturaRef(""); setMotivo("Cargo adicional");
    setFecha(hoy()); setMoneda("CRC"); setLineas([lineaVacia()]);
  };

  const filtCli = contactos.filter(c =>
    c.nombre?.toLowerCase().includes(busqCli.toLowerCase()) ||
    c.cedula?.includes(busqCli)
  ).slice(0, 6);

  const selectCliente = (c) => {
    setClienteNombre(c.nombre); setBusqCli(c.nombre);
    setClienteCedula(c.cedula || "");
    setClienteEmail(c.email || c.correo || "");
    setShowCli(false);
  };

  const lineasCalc = lineas.map(calcLinea);
  const subtotal   = lineasCalc.reduce((s, l) => s + l.subTotal, 0);
  const totalIVA   = lineasCalc.reduce((s, l) => s + l.montoIVA, 0);
  const totalND    = lineasCalc.reduce((s, l) => s + l.total, 0);

  const guardarLocal = async () => {
    if (!clienteNombre.trim()) return alert("Ingresá el nombre del receptor.");
    if (!lineas.some(l => l.descripcion && parseFloat(l.precioUnit) > 0)) {
      return alert("Agregá al menos una línea con descripción y precio.");
    }
    const todas = JSON.parse(localStorage.getItem("@finanzia/notasDebitoComercial") || "[]");
    const seq   = String(todas.length + 1).padStart(5, "0");
    const nueva = {
      id: genId(),
      numero: `ND-${seq}`,
      fecha, facturaRef, motivo, moneda,
      cliente: { nombre: clienteNombre, cedula: clienteCedula, email: clienteEmail },
      lineas: lineasCalc,
      subtotal, totalIVA, total: totalND,
      haciendaEstado: null, haciendaClave: null,
      estado: "borrador",
      creadoEn: new Date().toISOString(), creadoPor: getAutorSync(),
    };
    await guardarNotasLocal([...todas, nueva]);
    setNotas(prev => [nueva, ...prev]);
    setShowForm(false);
    resetForm();
  };

  const anular = async () => {
    if (!sel) return;
    if (!confirm(`¿Anular la nota de débito ${sel.numero}?`)) return;
    const todas = JSON.parse(localStorage.getItem("@finanzia/notasDebitoComercial") || "[]");
    await guardarNotasLocal(todas.map(x => x.id === sel.id ? { ...x, estado: "anulada" } : x));
    setNotas(prev => prev.map(x => x.id === sel.id ? { ...x, estado: "anulada" } : x));
    setSelected(null);
  };

  // ── Enviar ND a Hacienda ──────────────────────────────────────────────────
  const enviarHacienda = async (nota) => {
    if (!nota) return;
    setEnviando(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/emision/nota-debito`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          cliente: {
            nombre: nota.cliente?.nombre || "Consumidor Final",
            cedula: nota.cliente?.cedula || undefined,
            correo: nota.cliente?.email || nota.cliente?.correo || undefined,
          },
          items: nota.lineas.map(l => ({
            descripcion:    l.descripcion,
            cantidad:       parseFloat(l.cantidad) || 1,
            precioUnitario: parseFloat(l.precioUnit) || 0,
            tarifaIva:      l.pctIVA ?? 13,
            codigoCabys:    l.codigoCabys || "8399000000000",
            unidadMedida:   l.unidad || "Unid",
          })),
          moneda:           nota.moneda || "CRC",
          referenciaNumero: nota.facturaRef || undefined,
          referenciaRazon:  nota.motivo || "Cargo adicional",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);

      const todas = JSON.parse(localStorage.getItem("@finanzia/notasDebitoComercial") || "[]");
      await guardarNotasLocal(todas.map(x => x.id === nota.id
        ? { ...x, haciendaEstado: json.estado, haciendaClave: json.clave, haciendaConsecutivo: json.numeroConsecutivo }
        : x
      ));
      setNotas(prev => prev.map(x => x.id === nota.id
        ? { ...x, haciendaEstado: json.estado, haciendaClave: json.clave }
        : x
      ));
      alert(`✅ ND enviada a Hacienda\nEstado: ${json.estado}\nClave: ${json.clave}`);
    } catch (err) {
      alert(`❌ Error al enviar a Hacienda:\n${err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  const busqL   = busq.trim().toLowerCase();
  const visibles = notas.filter(n =>
    !busqL ||
    n.cliente?.nombre?.toLowerCase().includes(busqL) ||
    n.numero?.toLowerCase().includes(busqL) ||
    n.facturaRef?.toLowerCase().includes(busqL)
  );
  const sel = visibles.find(n => n.id === selected);

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-700 border-b border-slate-600">
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          <Plus size={13} /> Nueva ND
        </button>
        <div className="w-px h-5 bg-slate-500 mx-1" />
        <button disabled={!sel || sel.estado === "anulada"} onClick={anular}
          className="flex items-center gap-1.5 border border-yellow-400 text-yellow-300 hover:bg-yellow-500/20 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          <Ban size={13} /> Anular
        </button>
        <div className="w-px h-5 bg-slate-500 mx-1" />
        <button
          disabled={!sel || enviando || sel.estado === "anulada"}
          onClick={() => sel && enviarHacienda(sel)}
          title={sel?.haciendaClave ? `Clave: ${sel.haciendaClave}` : "Enviar ND-01 a Hacienda"}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors">
          {enviando ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          {sel?.haciendaEstado ? `Hacienda: ${sel.haciendaEstado}` : "Enviar Hacienda"}
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 bg-slate-600 rounded px-2 py-1.5">
          <Search size={12} className="text-slate-300" />
          <input value={busq} onChange={e => setBusq(e.target.value)}
            placeholder="Buscar…" className="bg-transparent text-white text-xs outline-none w-36 placeholder-slate-400" />
        </div>
      </div>

      {/* ── Info bar ── */}
      {sel ? (
        <div className="flex items-center gap-4 px-4 py-1.5 bg-orange-50 border-b border-orange-200 text-xs">
          <span className="text-orange-700 font-semibold">Seleccionada:</span>
          <span className="font-bold">{sel.numero}</span>
          <span className="text-slate-500">{sel.cliente?.nombre}</span>
          {sel.facturaRef && <span className="text-slate-400">→ {sel.facturaRef}</span>}
          <span className="font-bold text-orange-700">{fmtMoney(sel.total, sel.moneda)}</span>
          <button onClick={() => setSelected(null)} className="ml-auto text-slate-400 hover:text-slate-600">✕</button>
        </div>
      ) : (
        <div className="px-4 py-1.5 bg-orange-50 border-b border-orange-100 text-xs text-slate-500">
          {visibles.length} nota{visibles.length !== 1 ? "s" : ""} de débito comercial — clic en fila para seleccionar
        </div>
      )}

      {/* ── Tabla ── */}
      <div className="flex-1 overflow-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>N°</th><th>Fecha</th><th>Receptor</th><th>Factura ref.</th>
              <th>Motivo</th><th>Moneda</th><th>Total</th><th>Hacienda</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-16 text-slate-400">Sin notas de débito comerciales</td></tr>
            ) : visibles.map(n => {
              const isSel = selected === n.id;
              return (
                <tr key={n.id}
                  className={`cursor-pointer transition-colors ${isSel ? "bg-orange-100 border-l-4 border-orange-500" : "hover:bg-slate-50"}`}
                  onClick={() => setSelected(isSel ? null : n.id)}>
                  <td className="font-mono text-xs text-orange-700 font-bold">{n.numero}</td>
                  <td className="text-slate-500">{fmtDate(n.fecha)}</td>
                  <td className="font-semibold text-slate-900">{n.cliente?.nombre || "—"}</td>
                  <td className="text-slate-400 text-xs font-mono">{n.facturaRef || "—"}</td>
                  <td className="text-slate-700 text-xs">{n.motivo || "—"}</td>
                  <td className="text-slate-500">{n.moneda}</td>
                  <td className="font-bold text-orange-700">{fmtMoney(n.total, n.moneda)}</td>
                  <td><BadgeHacienda estado={n.haciendaEstado} /></td>
                  <td>
                    {n.estado === "anulada"
                      ? <span className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded font-bold">Anulada</span>
                      : <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded">{n.estado || "borrador"}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Modal nueva ND ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-slate-900">Nueva nota de débito comercial (ND-01)</h2>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-slate-400 hover:text-slate-700" /></button>
            </div>

            {/* Receptor */}
            <div className="mb-4">
              <span className="text-xs font-semibold text-slate-500 uppercase">Receptor</span>
              <div className="relative mt-1">
                <input value={busqCli}
                  onChange={e => { setBusqCli(e.target.value); setClienteNombre(e.target.value); setShowCli(true); }}
                  onFocus={() => setShowCli(true)}
                  onBlur={() => setTimeout(() => setShowCli(false), 150)}
                  placeholder="Nombre del cliente…"
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                {showCli && filtCli.length > 0 && (
                  <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-md shadow-lg z-10 max-h-36 overflow-auto">
                    {filtCli.map(c => (
                      <button key={c.id} onMouseDown={() => selectCliente(c)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-yellow-50 border-b last:border-0">
                        <span className="font-semibold">{c.nombre}</span>
                        <span className="text-slate-400 ml-2">{c.cedula}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input value={clienteCedula} onChange={e => setClienteCedula(e.target.value)}
                  placeholder="Cédula del receptor"
                  className="border border-slate-200 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                <input value={clienteEmail} onChange={e => setClienteEmail(e.target.value)}
                  placeholder="Correo electrónico"
                  className="border border-slate-200 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400" />
              </div>
            </div>

            {/* Encabezado */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500 uppercase">Fecha</span>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500 uppercase">Factura referencia</span>
                <input value={facturaRef} onChange={e => setFacturaRef(e.target.value)}
                  placeholder="FE-00001 o clave"
                  className="mt-1 w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500 uppercase">Moneda</span>
                <select value={moneda} onChange={e => setMoneda(e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400">
                  <option value="CRC">₡ CRC</option>
                  <option value="USD">$ USD</option>
                </select>
              </label>
              <label className="block col-span-3">
                <span className="text-xs font-semibold text-slate-500 uppercase">Motivo / razón</span>
                <input value={motivo} onChange={e => setMotivo(e.target.value)}
                  placeholder="Cargo adicional, intereses, etc."
                  className="mt-1 w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400" />
              </label>
            </div>

            {/* Líneas de detalle */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">Líneas de detalle</span>
                <button onClick={() => setLineas(p => [...p, lineaVacia()])}
                  className="text-xs text-yellow-700 hover:text-yellow-900 font-semibold flex items-center gap-1">
                  <Plus size={12} /> Agregar línea
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="text-left px-2 py-1 border-b border-slate-200">Descripción</th>
                      <th className="text-center px-2 py-1 border-b border-slate-200">Cant.</th>
                      <th className="text-right px-2 py-1 border-b border-slate-200">Precio unit.</th>
                      <th className="text-center px-2 py-1 border-b border-slate-200">IVA</th>
                      <th className="text-right px-2 py-1 border-b border-slate-200">Total</th>
                      <th className="px-1 py-1 border-b border-slate-200"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l, i) => {
                      const lc = calcLinea(l);
                      return (
                        <tr key={l.id} className="border-b border-slate-100">
                          <td className="px-1 py-1">
                            <input value={l.descripcion} onChange={e => setLineas(p => p.map((x, j) => j === i ? { ...x, descripcion: e.target.value } : x))}
                              placeholder="Descripción…"
                              className="w-full min-w-[140px] border-0 bg-slate-50 rounded px-2 py-1 outline-none focus:bg-yellow-50 text-xs" />
                          </td>
                          <td className="px-1 py-1">
                            <input type="number" value={l.cantidad} onChange={e => setLineas(p => p.map((x, j) => j === i ? { ...x, cantidad: e.target.value } : x))}
                              className="w-14 border-0 bg-slate-50 rounded px-2 py-1 outline-none focus:bg-yellow-50 text-center text-xs" />
                          </td>
                          <td className="px-1 py-1">
                            <input type="number" value={l.precioUnit} onChange={e => setLineas(p => p.map((x, j) => j === i ? { ...x, precioUnit: e.target.value } : x))}
                              placeholder="0"
                              className="w-24 border-0 bg-slate-50 rounded px-2 py-1 outline-none focus:bg-yellow-50 text-right text-xs" />
                          </td>
                          <td className="px-1 py-1">
                            <select value={l.codigoIVA} onChange={e => setLineas(p => p.map((x, j) => j === i ? { ...x, codigoIVA: e.target.value } : x))}
                              className="border-0 bg-slate-50 rounded px-1 py-1 outline-none focus:bg-yellow-50 text-xs">
                              {TIPOS_IVA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1 text-right font-semibold">{fmtMoney(lc.total, moneda)}</td>
                          <td className="px-1 py-1">
                            {lineas.length > 1 && (
                              <button onClick={() => setLineas(p => p.filter((_, j) => j !== i))}
                                className="p-0.5 rounded hover:bg-red-50 text-red-400">
                                <Trash2 size={11} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totales */}
              <div className="flex flex-col items-end gap-1 mt-3 text-sm">
                <div className="text-slate-500">Subtotal: <strong>{fmtMoney(subtotal, moneda)}</strong></div>
                <div className="text-slate-500">IVA: <strong>{fmtMoney(totalIVA, moneda)}</strong></div>
                <div className="text-lg font-extrabold text-orange-700">Total: {fmtMoney(totalND, moneda)}</div>
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 text-slate-600 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={guardarLocal}
                className="flex-1 bg-yellow-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-yellow-700">
                Guardar nota de débito
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              Guardá primero, luego seleccioná en la tabla y hacé clic en "Enviar Hacienda"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
