/**
 * FlujoCajaScreen — Flujo de Caja semanal para el desktop
 *
 * Tabs: Semanas | Pagos fijos | Movimientos
 * Saldo editable: Banco ₡ · Banco $ · Efectivo
 * Alerta roja si saldo disponible < gastos de la semana actual
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, Plus, Trash2, X, AlertTriangle, CheckCircle2,
  ChevronLeft, ChevronRight, DollarSign, Edit3
} from "lucide-react";
import db from "../utils/db";
import { genId } from "../utils/fmt";

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  "₡" + (Number(n) || 0).toLocaleString("es-CR", { minimumFractionDigits: 0 });
const fmtUSD = (n) =>
  "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const CATEGORIAS = ["Planilla","Servicios","Préstamo/deuda","Proveedor","Impuesto","Alquiler","Otro"];

function ymHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function prevMes(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMes(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function mesLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
}

function getSemanasDelMes(year, month) {
  const semanas = [];
  let d = new Date(year, month - 1, 1);
  // Avanzar al primer lunes
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  while (d.getMonth() === month - 1 || (d.getMonth() !== month - 1 && semanas.length === 0)) {
    const inicio = new Date(d);
    const fin = new Date(d);
    fin.setDate(fin.getDate() + 6);
    semanas.push({ inicio: inicio.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) });
    d.setDate(d.getDate() + 7);
    if (semanas.length >= 6) break;
  }
  return semanas;
}

function semanaActual(semanas) {
  const hoy = new Date().toISOString().slice(0, 10);
  return semanas.findIndex(s => hoy >= s.inicio && hoy <= s.fin);
}

// ── Modal: nuevo pago fijo ───────────────────────────────────────────────────
function PagoFijoModal({ onClose, onSave }) {
  const [form, setForm] = useState({ nombre: "", monto: "", frecuencia: "semanal", categoria: "Otro" });
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const guardar = () => {
    if (!form.nombre || !form.monto) return alert("Nombre y monto requeridos");
    onSave({ id: genId(), ...form, monto: Number(form.monto) });
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900">Nuevo pago fijo</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <label className="block mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase">Nombre</span>
          <input className="mt-1 w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm" value={form.nombre} onChange={e => u("nombre", e.target.value)} />
        </label>
        <label className="block mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase">Monto (₡)</span>
          <input className="mt-1 w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm" type="number" value={form.monto} onChange={e => u("monto", e.target.value)} />
        </label>
        <label className="block mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase">Categoría</span>
          <select className="mt-1 w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm" value={form.categoria} onChange={e => u("categoria", e.target.value)}>
            {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="block mb-4">
          <span className="text-xs font-semibold text-slate-500 uppercase">Frecuencia</span>
          <select className="mt-1 w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm" value={form.frecuencia} onChange={e => u("frecuencia", e.target.value)}>
            <option value="semanal">Semanal</option>
            <option value="quincenal">Quincenal</option>
            <option value="mensual">Mensual</option>
          </select>
        </label>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-semibold">Cancelar</button>
          <button onClick={guardar} className="flex-1 bg-amber-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-amber-700">Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: nuevo movimiento ──────────────────────────────────────────────────
function MovModal({ onClose, onSave }) {
  const [form, setForm] = useState({ tipo: "salida", monto: "", descripcion: "", categoria: "Otro", fecha: new Date().toISOString().slice(0, 10) });
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const guardar = () => {
    if (!form.monto || !form.descripcion) return alert("Monto y descripción requeridos");
    onSave({ id: genId(), ...form, monto: Number(form.monto) });
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900">Nuevo movimiento</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="flex gap-2 mb-4">
          {["entrada", "salida"].map(t => (
            <button key={t} onClick={() => u("tipo", t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border capitalize ${form.tipo === t ? (t === "entrada" ? "bg-amber-500 text-white border-amber-300" : "bg-red-500 text-white border-red-500") : "border-slate-200 text-slate-600"}`}>
              {t === "entrada" ? "▼ Entrada" : "▲ Salida"}
            </button>
          ))}
        </div>
        <label className="block mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase">Monto (₡)</span>
          <input className="mt-1 w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm" type="number" value={form.monto} onChange={e => u("monto", e.target.value)} />
        </label>
        <label className="block mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase">Descripción</span>
          <input className="mt-1 w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm" value={form.descripcion} onChange={e => u("descripcion", e.target.value)} />
        </label>
        <label className="block mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase">Categoría</span>
          <select className="mt-1 w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm" value={form.categoria} onChange={e => u("categoria", e.target.value)}>
            {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="block mb-4">
          <span className="text-xs font-semibold text-slate-500 uppercase">Fecha</span>
          <input className="mt-1 w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm" type="date" value={form.fecha} onChange={e => u("fecha", e.target.value)} />
        </label>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-semibold">Cancelar</button>
          <button onClick={guardar} className={`flex-1 ${form.tipo === "entrada" ? "bg-amber-500 hover:bg-amber-600" : "bg-red-500 hover:bg-red-600"} text-white py-2 rounded-lg text-sm font-semibold`}>
            Registrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Screen principal ─────────────────────────────────────────────────────────
const TABS = ["Semanas", "Pagos fijos", "Movimientos"];

export default function FlujoCajaScreen() {
  const [tab, setTab] = useState(0);
  const [mes, setMes] = useState(ymHoy());
  const [saldo, setSaldo] = useState({ banco: 0, bancoUSD: 0, efectivo: 0 });
  const [editSaldo, setEditSaldo] = useState(false);
  const [pagosFijos, setPagosFijos] = useState([]);
  const [movs, setMovs] = useState([]);
  const [modalPago, setModalPago] = useState(false);
  const [modalMov, setModalMov] = useState(false);

  const [y, m] = mes.split("-").map(Number);
  const semanas = getSemanasDelMes(y, m);
  const semActual = semanaActual(semanas);

  const cargar = useCallback(async () => {
    const [s, pf, mv] = await Promise.all([
      db.getFlujoCajaSaldo(),
      db.getFlujoCajaPagosFijos(),
      db.getFlujoCajaMovs(),
    ]);
    setSaldo(s);
    setPagosFijos(pf);
    setMovs(mv);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const totalDisponible = saldo.banco + saldo.bancoUSD * 500 + saldo.efectivo; // tipo de cambio estimado

  function gastosSemana(sem) {
    const pfSemana = pagosFijos.filter(p => p.frecuencia === "semanal").reduce((s, p) => s + p.monto, 0);
    const movsSemana = movs.filter(mv => mv.tipo === "salida" && mv.fecha >= sem.inicio && mv.fecha <= sem.fin).reduce((s, mv) => s + mv.monto, 0);
    return pfSemana + movsSemana;
  }

  async function guardarSaldo(nuevo) {
    await db.setFlujoCajaSaldo(nuevo);
    setSaldo(nuevo);
    setEditSaldo(false);
  }

  async function agregarPago(pago) {
    const lista = [...pagosFijos, pago];
    await db.setFlujoCajaPagosFijos(lista);
    setPagosFijos(lista);
  }

  async function eliminarPago(id) {
    const lista = pagosFijos.filter(p => p.id !== id);
    await db.setFlujoCajaPagosFijos(lista);
    setPagosFijos(lista);
  }

  async function agregarMov(mov) {
    const lista = [mov, ...movs];
    await db.setFlujoCajaMovs(lista);
    setMovs(lista);
  }

  async function eliminarMov(id) {
    const lista = movs.filter(m => m.id !== id);
    await db.setFlujoCajaMovs(lista);
    setMovs(lista);
  }

  const gastosSemActual = semActual >= 0 ? gastosSemana(semanas[semActual]) : 0;
  const alerta = gastosSemActual > totalDisponible;

  const movsDelMes = movs.filter(mv => mv.fecha && mv.fecha.startsWith(mes));
  const totalEntradas = movsDelMes.filter(m => m.tipo === "entrada").reduce((s, m) => s + m.monto, 0);
  const totalSalidas  = movsDelMes.filter(m => m.tipo === "salida").reduce((s, m) => s + m.monto, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-slate-200">
        <TrendingUp size={18} className="text-amber-600" />
        <button onClick={() => setMes(prevMes(mes))} className="p-1 rounded hover:bg-gray-100"><ChevronLeft size={16} /></button>
        <span className="text-sm font-semibold text-slate-800 min-w-[100px] text-center">{mesLabel(mes)}</span>
        <button onClick={() => setMes(nextMes(mes))} className="p-1 rounded hover:bg-gray-100"><ChevronRight size={16} /></button>
        <span className="flex-1" />
        {tab === 1 && <button onClick={() => setModalPago(true)} className="flex items-center gap-1 bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-700"><Plus size={14} /> Pago fijo</button>}
        {tab === 2 && <button onClick={() => setModalMov(true)} className="flex items-center gap-1 bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-700"><Plus size={14} /> Movimiento</button>}
      </div>

      {/* Saldo disponible */}
      <div className={`px-6 py-3 border-b ${alerta ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-100"}`}>
        {alerta && (
          <div className="flex items-center gap-2 text-red-700 text-xs font-semibold mb-2">
            <AlertTriangle size={14} />
            Saldo disponible insuficiente para cubrir los gastos de esta semana
          </div>
        )}
        <div className="flex items-center gap-6 flex-wrap">
          {[
            { label: "Banco ₡", key: "banco", display: fmt(saldo.banco) },
            { label: "Banco $", key: "bancoUSD", display: fmtUSD(saldo.bancoUSD) },
            { label: "Efectivo", key: "efectivo", display: fmt(saldo.efectivo) },
          ].map(({ label, key, display }) => (
            editSaldo ? (
              <label key={key} className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase">{label}</span>
                <input type="number" defaultValue={saldo[key]}
                  onBlur={e => setSaldo(p => ({ ...p, [key]: Number(e.target.value) || 0 }))}
                  className="border border-slate-300 rounded px-2 py-1 text-sm w-32" />
              </label>
            ) : (
              <div key={key} className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase">{label}</span>
                <span className="text-base font-bold text-slate-800">{display}</span>
              </div>
            )
          ))}
          <div className="flex flex-col border-l border-slate-200 pl-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Total disponible (est.)</span>
            <span className={`text-base font-black ${alerta ? "text-red-600" : "text-amber-700"}`}>{fmt(totalDisponible)}</span>
          </div>
          <button onClick={() => editSaldo ? guardarSaldo(saldo) : setEditSaldo(true)}
            className="ml-auto flex items-center gap-1 text-xs text-amber-700 hover:underline font-semibold">
            <Edit3 size={12} /> {editSaldo ? "Guardar saldo" : "Editar saldo"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-6">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === i ? "border-amber-600 text-amber-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Tab: Semanas ── */}
      {tab === 0 && (
        <div className="flex-1 overflow-auto p-6">
          {/* Resumen del mes */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              ["Entradas del mes", fmt(totalEntradas), "text-amber-700"],
              ["Salidas del mes", fmt(totalSalidas), "text-red-600"],
              ["Flujo neto", fmt(totalEntradas - totalSalidas), totalEntradas >= totalSalidas ? "text-amber-700" : "text-red-600"],
            ].map(([l, v, cls]) => (
              <div key={l} className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase">{l}</p>
                <p className={`text-xl font-black mt-1 ${cls}`}>{v}</p>
              </div>
            ))}
          </div>

          {/* Tarjetas de semanas */}
          <div className="grid grid-cols-1 gap-3">
            {semanas.map((sem, i) => {
              const gastos = gastosSemana(sem);
              const esActual = i === semActual;
              const deficit = gastos > totalDisponible;
              return (
                <div key={sem.inicio}
                  className={`rounded-xl border p-4 flex items-center gap-4 ${esActual ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-500 uppercase">Semana {i + 1} {esActual && "· Actual"}</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{sem.inicio} → {sem.fin}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase">Gastos estimados</p>
                    <p className={`text-base font-bold ${deficit ? "text-red-600" : "text-slate-800"}`}>{fmt(gastos)}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${deficit ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {deficit ? "Déficit" : "OK"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tab: Pagos fijos ── */}
      {tab === 1 && (
        <div className="flex-1 overflow-auto">
          {pagosFijos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <DollarSign size={40} />
              <p className="font-semibold">Sin pagos fijos registrados</p>
              <button onClick={() => setModalPago(true)} className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Agregar pago fijo</button>
            </div>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Frecuencia</th>
                  <th>Monto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagosFijos.map(p => (
                  <tr key={p.id}>
                    <td className="font-semibold text-slate-900">{p.nombre}</td>
                    <td><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-medium">{p.categoria}</span></td>
                    <td className="capitalize text-slate-500 text-sm">{p.frecuencia}</td>
                    <td className="font-bold text-red-600">{fmt(p.monto)}</td>
                    <td>
                      <button onClick={() => eliminarPago(p.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Tab: Movimientos ── */}
      {tab === 2 && (
        <div className="flex-1 overflow-auto">
          {movsDelMes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <TrendingUp size={40} />
              <p className="font-semibold">Sin movimientos en {mesLabel(mes)}</p>
              <button onClick={() => setModalMov(true)} className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Agregar movimiento</button>
            </div>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {movsDelMes.map(mv => (
                  <tr key={mv.id}>
                    <td className="text-slate-500 text-sm">{mv.fecha}</td>
                    <td className="font-semibold text-slate-900">{mv.descripcion}</td>
                    <td><span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">{mv.categoria}</span></td>
                    <td>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${mv.tipo === "entrada" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                        {mv.tipo === "entrada" ? "▼ Entrada" : "▲ Salida"}
                      </span>
                    </td>
                    <td className={`font-bold ${mv.tipo === "entrada" ? "text-amber-700" : "text-red-600"}`}>
                      {mv.tipo === "entrada" ? "+" : "-"}{fmt(mv.monto)}
                    </td>
                    <td>
                      <button onClick={() => eliminarMov(mv.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modalPago && <PagoFijoModal onClose={() => setModalPago(false)} onSave={agregarPago} />}
      {modalMov  && <MovModal     onClose={() => setModalMov(false)}  onSave={agregarMov} />}
    </div>
  );
}
