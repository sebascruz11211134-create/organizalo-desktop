/**
 * PlanillasScreen — Nómina mensual (CCSS/INS) + Horas semanales + Préstamos a colaboradores
 *
 * Tab 1 "Nómina":      salario fijo, deducciones CCSS, renta
 * Tab 2 "Horas (sem)": horas Normal / T.M. / Doble por semana por empleado
 * Tab 3 "Préstamos":   créditos internos con cuota fija y saldo decreciente
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, ChevronLeft, ChevronRight, X, Edit2, Trash2,
  AlertCircle, CheckCircle2, TrendingDown
} from "lucide-react";
import db from "../utils/db";
import { fmtMoney, genId, hoy } from "../utils/fmt";

// ── Tasas CCSS 2024 ──────────────────────────────────────────────────────────
const TASA_TRAB_CCSS = 0.1067;
const TASA_TRAB_BP   = 0.01;
const TASA_PAT_CCSS  = 0.2667;
const TASA_PAT_INS   = 0.01;
const TASA_PAT_ASIGN = 0.05;
const TASA_PAT_IMAS  = 0.005;
const TASA_PAT_INA   = 0.015;
const TASA_PAT_BP    = 0.0025;
const TASA_PAT_FOD   = 0.005;
const TASA_PAT_FCL   = 0.03;

const BRACKETS_RENTA = [
  { hasta: 929000,   tasa: 0.00 },
  { hasta: 1363000,  tasa: 0.10 },
  { hasta: 2394000,  tasa: 0.15 },
  { hasta: 4788000,  tasa: 0.20 },
  { hasta: Infinity, tasa: 0.25 },
];

function calcRenta(bruto) {
  let imp = 0, resto = bruto, prev = 0;
  for (const b of BRACKETS_RENTA) {
    const tramo = Math.min(resto, b.hasta - prev);
    if (tramo <= 0) break;
    imp += tramo * b.tasa;
    resto -= tramo;
    prev = b.hasta;
    if (resto <= 0) break;
  }
  return Math.round(imp);
}

function calcNomina(emp) {
  const bruto   = parseFloat(emp.salarioBruto) || 0;
  const ccssT   = Math.round(bruto * TASA_TRAB_CCSS);
  const bpT     = Math.round(bruto * TASA_TRAB_BP);
  const renta   = emp.aplicaRenta ? calcRenta(bruto) : 0;
  const dedTotal = ccssT + bpT + renta;
  const neto    = bruto - dedTotal;
  const ccssP   = Math.round(bruto * TASA_PAT_CCSS);
  const insP    = Math.round(bruto * TASA_PAT_INS);
  const asignP  = Math.round(bruto * TASA_PAT_ASIGN);
  const imasP   = Math.round(bruto * TASA_PAT_IMAS);
  const inaP    = Math.round(bruto * TASA_PAT_INA);
  const bpP     = Math.round(bruto * TASA_PAT_BP);
  const fodP    = Math.round(bruto * TASA_PAT_FOD);
  const fclP    = Math.round(bruto * TASA_PAT_FCL);
  const patTotal = ccssP + insP + asignP + imasP + inaP + bpP + fodP + fclP;
  return { bruto, ccssT, bpT, renta, dedTotal, neto, ccssP, insP, asignP, imasP, inaP, bpP, fodP, fclP, patTotal, costoTotal: bruto + patTotal, aguinaldo: Math.round(bruto / 12) };
}

function calcHoras(emp, semKey, semanasData) {
  const tarifa = (parseFloat(emp.salarioBruto) || 0) / 48;
  const get = (tipo) => Number(semanasData[`${emp.id}_${semKey}_${tipo}`] || 0);
  const hN = get("normal"), hTM = get("tm"), hD = get("doble");
  const bruto = Math.round(hN * tarifa + hTM * tarifa * 1.5 + hD * tarifa * 2);
  return { hN, hTM, hD, tarifa, bruto };
}

// ── Helpers fecha ─────────────────────────────────────────────────────────────
function ymHoy() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function prevMes(ym) { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function nextMes(ym) { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function mesLabel(ym) { const [y, m] = ym.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("es-CR", { month: "long", year: "numeric" }); }

function semanasDelMes(ym) {
  const [y, m] = ym.split("-").map(Number);
  const sems = [];
  let d = new Date(y, m - 1, 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  for (let i = 0; i < 5; i++) {
    const ini = new Date(d);
    const fin = new Date(d); fin.setDate(fin.getDate() + 6);
    sems.push({ key: `${ym}_S${i + 1}`, label: `Sem ${i + 1}: ${ini.toLocaleDateString("es-CR", { day: "2-digit", month: "2-digit" })} – ${fin.toLocaleDateString("es-CR", { day: "2-digit", month: "2-digit" })}` });
    d.setDate(d.getDate() + 7);
    if (d.getMonth() !== m - 1 && i > 2) break;
  }
  return sems;
}

// ── Modal empleado ────────────────────────────────────────────────────────────
function EmpleadoModal({ emp, onClose, onSave }) {
  const [form, setForm] = useState(emp || { nombre: "", puesto: "", cedula: "", salarioBruto: "", aplicaRenta: false, activo: true });
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const guardar = async () => {
    if (!form.nombre || !form.salarioBruto) return alert("Nombre y salario requeridos.");
    const todos = await db.getEmpleados();
    const item = { ...form, salarioBruto: parseFloat(form.salarioBruto) || 0 };
    if (!item.id) { item.id = genId(); item.creadoEn = new Date().toISOString(); await db.setEmpleados([...todos, item]); }
    else await db.setEmpleados(todos.map(x => x.id === item.id ? item : x));
    onSave(); onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-slate-900">{emp?.id ? "Editar empleado" : "Nuevo empleado"}</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[["Nombre *", "nombre", "text", "col-span-2"], ["Puesto", "puesto", "text", ""], ["Cédula", "cedula", "text", ""], ["Salario bruto (₡) *", "salarioBruto", "number", ""]].map(([lbl, key, type, cls]) => (
            <label key={key} className={`block ${cls}`}>
              <span className="text-xs font-semibold text-slate-500 uppercase">{lbl}</span>
              <input type={type} value={form[key] || ""} onChange={e => u(key, e.target.value)} className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
            </label>
          ))}
          <label className="flex items-center gap-2 col-span-2"><input type="checkbox" checked={form.aplicaRenta} onChange={e => u("aplicaRenta", e.target.checked)} className="rounded" /><span className="text-sm">Aplica retención de renta</span></label>
          <label className="flex items-center gap-2 col-span-2"><input type="checkbox" checked={form.activo} onChange={e => u("activo", e.target.checked)} className="rounded" /><span className="text-sm">Activo</span></label>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-semibold">Cancelar</button>
          <button onClick={guardar} className="flex-1 bg-brand-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-600">Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal préstamo ────────────────────────────────────────────────────────────
function PrestamoModal({ empleados, onClose, onSave }) {
  const [form, setForm] = useState({ empleadoId: empleados[0]?.id || "", monto: "", cuota: "", descripcion: "" });
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const guardar = () => {
    if (!form.empleadoId || !form.monto || !form.cuota) return alert("Completa todos los campos");
    onSave({
      id: genId(),
      ...form,
      monto: Number(form.monto),
      cuota: Number(form.cuota),
      saldo: Number(form.monto),
      fecha: new Date().toISOString().slice(0, 10),
      activo: true,
    });
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900">Nuevo préstamo</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <label className="block mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase">Colaborador</span>
          <select className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.empleadoId} onChange={e => u("empleadoId", e.target.value)}>
            {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </label>
        {[["Monto total (₡)", "monto"], ["Cuota semanal (₡)", "cuota"], ["Descripción / motivo", "descripcion"]].map(([lbl, key]) => (
          <label key={key} className="block mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase">{lbl}</span>
            <input type={key !== "descripcion" ? "number" : "text"} value={form[key]} onChange={e => u(key, e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </label>
        ))}
        <div className="flex gap-3 mt-2">
          <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 py-2 rounded-lg text-sm font-semibold">Cancelar</button>
          <button onClick={guardar} className="flex-1 bg-brand-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-600">Registrar</button>
        </div>
      </div>
    </div>
  );
}

// ── Fila desglose nómina ──────────────────────────────────────────────────────
function DetalleRow({ emp }) {
  const c = calcNomina(emp);
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(o => !o)}>
        <td className="font-semibold text-slate-900">{emp.nombre}</td>
        <td className="text-slate-500 text-xs">{emp.puesto || "—"}</td>
        <td>{fmtMoney(c.bruto, "CRC")}</td>
        <td className="text-red-600">-{fmtMoney(c.dedTotal, "CRC")}</td>
        <td className="font-bold text-green-700">{fmtMoney(c.neto, "CRC")}</td>
        <td className="text-amber-700">{fmtMoney(c.patTotal, "CRC")}</td>
        <td className="font-bold text-slate-800">{fmtMoney(c.costoTotal, "CRC")}</td>
        <td className="text-slate-400">{fmtMoney(c.aguinaldo, "CRC")}</td>
      </tr>
      {open && (
        <tr className="bg-slate-50">
          <td colSpan={8} className="px-6 py-3">
            <div className="grid grid-cols-2 gap-x-10 gap-y-1 text-xs">
              <div className="font-semibold text-slate-600 col-span-2 mb-1">Deducciones trabajador</div>
              <span className="text-slate-500">CCSS (10.67%)</span><span className="font-semibold text-red-600">-{fmtMoney(c.ccssT, "CRC")}</span>
              <span className="text-slate-500">Banco Popular (1%)</span><span className="font-semibold text-red-600">-{fmtMoney(c.bpT, "CRC")}</span>
              {emp.aplicaRenta && <><span className="text-slate-500">Renta</span><span className="font-semibold text-red-600">-{fmtMoney(c.renta, "CRC")}</span></>}
              <div className="font-semibold text-slate-600 col-span-2 mt-2 mb-1">Cargas patronales</div>
              <span className="text-slate-500">CCSS patrono (26.67%)</span><span>{fmtMoney(c.ccssP, "CRC")}</span>
              <span className="text-slate-500">INS (1%)</span><span>{fmtMoney(c.insP, "CRC")}</span>
              <span className="text-slate-500">Asignaciones (5%)</span><span>{fmtMoney(c.asignP, "CRC")}</span>
              <span className="text-slate-500">IMAS (0.5%)</span><span>{fmtMoney(c.imasP, "CRC")}</span>
              <span className="text-slate-500">INA (1.5%)</span><span>{fmtMoney(c.inaP, "CRC")}</span>
              <span className="text-slate-500">BP patrono (0.25%)</span><span>{fmtMoney(c.bpP, "CRC")}</span>
              <span className="text-slate-500">FODESAF (0.5%)</span><span>{fmtMoney(c.fodP, "CRC")}</span>
              <span className="text-slate-500">FCL (3%)</span><span>{fmtMoney(c.fclP, "CRC")}</span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const fmt = (n) => "₡" + (Number(n) || 0).toLocaleString("es-CR", { minimumFractionDigits: 0 });
const TABS = ["Nómina mensual", "Horas (semanal)", "Préstamos"];

// ── Screen ────────────────────────────────────────────────────────────────────
export default function PlanillasScreen() {
  const [tab, setTab] = useState(0);
  const [mes, setMes] = useState(ymHoy());
  const [empleados, setEmpleados] = useState([]);
  const [prestamos, setPrestamos] = useState([]);
  const [semanasData, setSemanasData] = useState({});
  const [semSel, setSemSel] = useState(0);
  const [modalEmp, setModalEmp] = useState(null);
  const [modalPrest, setModalPrest] = useState(false);

  const sems = semanasDelMes(mes);

  const cargar = useCallback(async () => {
    const [emps, pres, sems] = await Promise.all([
      db.getEmpleados(),
      db.getPlanillaPrestamos(),
      db.getPlanillaSemanas(),
    ]);
    setEmpleados(emps.filter(e => e.activo !== false));
    setPrestamos(pres);
    setSemanasData(sems);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Guardar horas ──
  async function setHoras(empId, semKey, tipo, valor) {
    const key = `${empId}_${semKey}_${tipo}`;
    const nueva = { ...semanasData, [key]: Number(valor) || 0 };
    setSemanasData(nueva);
    await db.setPlanillaSemanas(nueva);
  }

  // ── Pagar cuota ──
  async function pagarCuota(prestId) {
    const lista = prestamos.map(p => {
      if (p.id !== prestId) return p;
      const nuevoSaldo = Math.max(0, p.saldo - p.cuota);
      return { ...p, saldo: nuevoSaldo, activo: nuevoSaldo > 0 };
    });
    setPrestamos(lista);
    await db.setPlanillaPrestamos(lista);
  }

  async function eliminarPrestamo(id) {
    if (!confirm("¿Eliminar este préstamo?")) return;
    const lista = prestamos.filter(p => p.id !== id);
    setPrestamos(lista);
    await db.setPlanillaPrestamos(lista);
  }

  async function agregarPrestamo(p) {
    const lista = [...prestamos, p];
    setPrestamos(lista);
    await db.setPlanillaPrestamos(lista);
  }

  // ── Totales nómina ──
  const totNomina = empleados.reduce((acc, emp) => {
    const c = calcNomina(emp);
    return { bruto: acc.bruto + c.bruto, dedTotal: acc.dedTotal + c.dedTotal, neto: acc.neto + c.neto, patTotal: acc.patTotal + c.patTotal, costoTotal: acc.costoTotal + c.costoTotal, aguinaldo: acc.aguinaldo + c.aguinaldo };
  }, { bruto: 0, dedTotal: 0, neto: 0, patTotal: 0, costoTotal: 0, aguinaldo: 0 });

  // ── Totales horas semana seleccionada ──
  const semActual = sems[semSel];
  const totHoras = semActual ? empleados.reduce((acc, emp) => {
    const h = calcHoras(emp, semActual.key, semanasData);
    return { bruto: acc.bruto + h.bruto };
  }, { bruto: 0 }) : { bruto: 0 };

  const prestActivos = prestamos.filter(p => p.activo);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-slate-200">
        <button onClick={() => setMes(prevMes(mes))} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft size={16} className="text-slate-600" /></button>
        <span className="text-sm font-semibold text-slate-800 min-w-[160px] text-center capitalize">{mesLabel(mes)}</span>
        <button onClick={() => setMes(nextMes(mes))} className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight size={16} className="text-slate-600" /></button>
        <span className="flex-1" />
        {tab === 2 && <button onClick={() => setModalPrest(true)} className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600"><Plus size={14} /> Nuevo préstamo</button>}
        <button onClick={() => setModalEmp({})} className="flex items-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600"><Plus size={14} /> Empleado</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-6">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors relative ${tab === i ? "border-brand-500 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t}
            {i === 2 && prestActivos.length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{prestActivos.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══ Tab 0: Nómina mensual ══ */}
      {tab === 0 && (
        <>
          <div className="grid grid-cols-5 gap-0 border-b border-slate-200 bg-white text-center">
            {[["Salario bruto", fmtMoney(totNomina.bruto, "CRC"), "text-slate-900"],
              ["Deducciones", fmtMoney(totNomina.dedTotal, "CRC"), "text-red-600"],
              ["A pagar", fmtMoney(totNomina.neto, "CRC"), "text-green-700 font-bold"],
              ["Cargas patronales", fmtMoney(totNomina.patTotal, "CRC"), "text-amber-700"],
              ["Costo total empresa", fmtMoney(totNomina.costoTotal, "CRC"), "text-slate-900 font-black"],
            ].map(([lbl, val, cls]) => (
              <div key={lbl} className="py-3 px-4 border-r border-slate-100 last:border-r-0">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">{lbl}</p>
                <p className={`text-sm mt-0.5 ${cls}`}>{val}</p>
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-auto">
            {empleados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <p className="text-lg font-semibold">Sin empleados registrados</p>
                <button onClick={() => setModalEmp({})} className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm">+ Agregar empleado</button>
              </div>
            ) : (
              <table className="table-base">
                <thead><tr>
                  <th>Empleado</th><th>Puesto</th><th>Salario bruto</th><th>Deducciones</th>
                  <th>Salario neto</th><th>Carga patronal</th><th>Costo total</th><th>Aguinaldo prov.</th>
                </tr></thead>
                <tbody>
                  {empleados.map(emp => <DetalleRow key={emp.id} emp={emp} />)}
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                    <td colSpan={2} className="text-slate-700">TOTALES ({empleados.length})</td>
                    <td>{fmtMoney(totNomina.bruto, "CRC")}</td>
                    <td className="text-red-600">-{fmtMoney(totNomina.dedTotal, "CRC")}</td>
                    <td className="text-green-700">{fmtMoney(totNomina.neto, "CRC")}</td>
                    <td className="text-amber-700">{fmtMoney(totNomina.patTotal, "CRC")}</td>
                    <td className="text-slate-900 font-black">{fmtMoney(totNomina.costoTotal, "CRC")}</td>
                    <td>{fmtMoney(totNomina.aguinaldo, "CRC")}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
          <div className="px-6 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Tasas CCSS 2024 · Clic en empleado para ver desglose</span>
            {empleados.length > 0 && (
              <button
                onClick={async () => {
                  if (!confirm(`¿Confirmar planilla de ${mesLabel(mes)}? Se creará un asiento contable automático.`)) return;
                  try {
                    const asientos = await db.getAsientos();
                    const seq = String(asientos.length + 1).padStart(5, "0");
                    const bruto = totNomina.bruto;
                    const cargas = totNomina.patTotal;

                    const lineas = [
                      { cuentaCodigo:"5101", cuentaNombre:"Gasto salarios",          debe: bruto,  haber: 0 },
                      { cuentaCodigo:"5102", cuentaNombre:"Cargas sociales patronales", debe: cargas, haber: 0 },
                      { cuentaCodigo:"2101", cuentaNombre:"CxP nómina — empleados",  debe: 0, haber: bruto },
                      { cuentaCodigo:"2102", cuentaNombre:"CxP CCSS patronal",       debe: 0, haber: cargas },
                    ];
                    const totalDebe  = lineas.reduce((s, l) => s + l.debe, 0);
                    const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);

                    const asiento = {
                      id: genId(), numero: `AJ-${seq}`,
                      descripcion: `Planilla ${mesLabel(mes)} — ${empleados.length} empleados`,
                      fecha: hoy(), totalDebe, totalHaber,
                      estado: "confirmado", lineas,
                      creadoEn: new Date().toISOString(), autoGenerado: true,
                    };
                    await db.setAsientos([asiento, ...asientos]);
                    alert(`✓ Asiento ${asiento.numero} creado en Contabilidad`);
                  } catch (e) {
                    alert("Error al crear asiento: " + e.message);
                  }
                }}
                className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700"
              >
                ✓ Confirmar planilla → Asiento contable
              </button>
            )}
          </div>
        </>
      )}

      {/* ══ Tab 1: Horas semanales ══ */}
      {tab === 1 && (
        <>
          {/* Selector de semana */}
          <div className="flex items-center gap-2 px-6 py-2 bg-white border-b border-slate-100">
            <button onClick={() => setSemSel(s => Math.max(0, s - 1))} className="p-1 rounded hover:bg-gray-100"><ChevronLeft size={15} /></button>
            <select className="text-sm border border-slate-200 rounded px-2 py-1" value={semSel} onChange={e => setSemSel(Number(e.target.value))}>
              {sems.map((s, i) => <option key={s.key} value={i}>{s.label}</option>)}
            </select>
            <button onClick={() => setSemSel(s => Math.min(sems.length - 1, s + 1))} className="p-1 rounded hover:bg-gray-100"><ChevronRight size={15} /></button>
            <span className="ml-auto text-sm font-semibold text-slate-700">Total bruto semana: <span className="text-brand-600">{fmt(totHoras.bruto)}</span></span>
          </div>
          <div className="flex-1 overflow-auto">
            {empleados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400"><p>Sin empleados registrados</p></div>
            ) : (
              <table className="table-base">
                <thead><tr>
                  <th>Colaborador</th><th>Tarifa/h</th>
                  <th>H. Normal</th><th>H. T.M. (×1.5)</th><th>H. Doble (×2)</th>
                  <th>Bruto sem.</th>
                </tr></thead>
                <tbody>
                  {empleados.map(emp => {
                    const sk = semActual?.key || "";
                    const h = calcHoras(emp, sk, semanasData);
                    const cuotas = prestamos.filter(p => p.empleadoId === emp.id && p.activo).reduce((s, p) => s + p.cuota, 0);
                    const aPagar = h.bruto - cuotas;
                    return (
                      <tr key={emp.id}>
                        <td>
                          <div className="font-semibold text-slate-900">{emp.nombre}</div>
                          {cuotas > 0 && <div className="text-xs text-amber-600">Cuota préstamo: -{fmt(cuotas)}</div>}
                        </td>
                        <td className="text-slate-500 text-xs">{fmt(Math.round(h.tarifa))}/h</td>
                        {["normal", "tm", "doble"].map(tipo => (
                          <td key={tipo}>
                            <input type="number" min="0" step="0.5"
                              value={semanasData[`${emp.id}_${sk}_${tipo}`] || ""}
                              onChange={e => setHoras(emp.id, sk, tipo, e.target.value)}
                              className="w-20 border border-slate-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-brand-400" />
                          </td>
                        ))}
                        <td>
                          <div className="font-bold text-green-700">{fmt(h.bruto)}</div>
                          {cuotas > 0 && <div className="text-xs font-bold text-brand-600">A pagar: {fmt(aPagar)}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="px-6 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-400">
            Mano de obra externa · sin deducción CCSS · cuotas de préstamo se descuentan del bruto semanal
          </div>
        </>
      )}

      {/* ══ Tab 2: Préstamos ══ */}
      {tab === 2 && (
        <div className="flex-1 overflow-auto p-6">
          {prestamos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
              <TrendingDown size={40} />
              <p className="font-semibold">Sin préstamos registrados</p>
              <button onClick={() => setModalPrest(true)} className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm">+ Nuevo préstamo</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {prestamos.map(p => {
                const emp = empleados.find(e => e.id === p.empleadoId);
                const pct = Math.round((1 - p.saldo / p.monto) * 100);
                return (
                  <div key={p.id} className={`bg-white rounded-xl border p-4 ${!p.activo ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{emp?.nombre || "Empleado"}</span>
                          {p.activo
                            ? <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">Activo</span>
                            : <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={10} />Cancelado</span>
                          }
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">{p.descripcion || "Sin descripción"} · desde {p.fecha}</p>
                      </div>
                      <button onClick={() => eliminarPrestamo(p.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button>
                    </div>
                    {/* Barra progreso */}
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex gap-4">
                        <span className="text-slate-500">Monto: <strong>{fmt(p.monto)}</strong></span>
                        <span className="text-slate-500">Saldo: <strong className="text-red-600">{fmt(p.saldo)}</strong></span>
                        <span className="text-slate-500">Cuota sem.: <strong className="text-amber-600">{fmt(p.cuota)}</strong></span>
                      </div>
                      <span className="text-xs text-slate-400">{pct}% pagado</span>
                    </div>
                    {p.activo && (
                      <button onClick={() => pagarCuota(p.id)}
                        className="mt-3 w-full bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold py-1.5 rounded-lg text-sm border border-brand-200 transition-colors">
                        Aplicar cuota ({fmt(p.cuota)})
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {modalEmp !== null && <EmpleadoModal emp={Object.keys(modalEmp).length > 0 ? modalEmp : null} onClose={() => setModalEmp(null)} onSave={cargar} />}
      {modalPrest && <PrestamoModal empleados={empleados} onClose={() => setModalPrest(false)} onSave={agregarPrestamo} />}
    </div>
  );
}
