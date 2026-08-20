/**
 * AsistenciaScreen — Control de asistencia de empleados
 * Reloj entrada/salida, horas trabajadas, resumen mensual
 */
import React, { useState, useEffect, useCallback } from "react";
import { Clock, UserCheck, Printer, FileSpreadsheet, ChevronDown } from "lucide-react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtDate, genId, hoy } from "../utils/fmt";
import { exportExcel } from "../utils/reportHelpers";

function mesActual() { return new Date().toISOString().slice(0, 7); }
function horaActual() { return new Date().toTimeString().slice(0, 5); }
function diffHoras(entrada, salida) {
  if (!entrada || !salida) return 0;
  const [eh, em] = entrada.split(":").map(Number);
  const [sh, sm] = salida.split(":").map(Number);
  const mins = (sh * 60 + sm) - (eh * 60 + em);
  return Math.max(0, mins / 60);
}
function fmtHoras(h) {
  const horas = Math.floor(h);
  const mins  = Math.round((h - horas) * 60);
  return `${horas}h ${mins}m`;
}

export default function AsistenciaScreen() {
  const [empleados,  setEmpleados]  = useState([]);
  const [registros,  setRegistros]  = useState([]); // [{id, empleadoId, fecha, entrada, salida, notas}]
  const [mes,        setMes]        = useState(mesActual());
  const [empSel,     setEmpSel]     = useState("todos");
  const [modal,      setModal]      = useState(null); // {empleadoId, tipo:"entrada"|"salida"|"nuevo"}
  const [formHora,   setFormHora]   = useState(horaActual());
  const [formFecha,  setFormFecha]  = useState(hoy());
  const [formNotas,  setFormNotas]  = useState("");

  useSyncRefresh();

  const cargar = useCallback(async () => {
    const [e, r] = await Promise.all([
      db.getEmpleados(),
      db.getJSON ? db.getJSON("@finanzia/asistencia", []) : Promise.resolve([]),
    ]);
    setEmpleados(e);
    // Fallback si db.getJSON no existe
    try {
      const raw = localStorage.getItem("@finanzia/asistencia");
      setRegistros(raw ? JSON.parse(raw) : []);
    } catch { setRegistros([]); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function guardarRegistros(nuevos) {
    localStorage.setItem("@finanzia/asistencia", JSON.stringify(nuevos));
    setRegistros(nuevos);
    if (typeof window.__orgPush === "function") window.__orgPush();
  }

  // ── Marcar entrada / salida rápida ─────────────────────────────────────────
  async function marcarEntrada(empId) {
    const fecha = hoy();
    const yaHoy = registros.find(r => r.empleadoId === empId && r.fecha === fecha && !r.salida);
    if (yaHoy) return; // ya tiene entrada abierta
    const nuevo = { id: genId(), empleadoId: empId, fecha, entrada: horaActual(), salida: null, notas: "" };
    await guardarRegistros([...registros, nuevo]);
  }

  async function marcarSalida(empId) {
    const fecha = hoy();
    const abierto = registros.find(r => r.empleadoId === empId && r.fecha === fecha && !r.salida);
    if (!abierto) return;
    const upd = registros.map(r => r.id === abierto.id ? { ...r, salida: horaActual() } : r);
    await guardarRegistros(upd);
  }

  // ── Modal de registro manual ─────────────────────────────────────────────
  async function guardarManual() {
    if (!modal?.empleadoId) return;
    const nuevo = {
      id: genId(), empleadoId: modal.empleadoId,
      fecha: formFecha, entrada: formHora, salida: null, notas: formNotas,
    };
    await guardarRegistros([...registros, nuevo]);
    setModal(null); setFormHora(horaActual()); setFormFecha(hoy()); setFormNotas("");
  }

  // ── Filtros ───────────────────────────────────────────────────────────────
  const desde = mes + "-01";
  const hasta = (() => { const [y,m]=mes.split("-").map(Number); return new Date(y,m,0).toISOString().slice(0,10); })();

  const regFiltrados = registros.filter(r => {
    const enMes   = r.fecha >= desde && r.fecha <= hasta;
    const enEmp   = empSel === "todos" || r.empleadoId === empSel;
    return enMes && enEmp;
  });

  // ── Resumen por empleado ──────────────────────────────────────────────────
  const resumen = empleados.map(emp => {
    const regs = registros.filter(r => r.empleadoId === emp.id && r.fecha >= desde && r.fecha <= hasta);
    const diasTrabajados = new Set(regs.map(r => r.fecha)).size;
    const horasTotales   = regs.reduce((s, r) => s + diffHoras(r.entrada, r.salida), 0);
    const abierto        = registros.find(r => r.empleadoId === emp.id && r.fecha === hoy() && !r.salida);
    return { emp, diasTrabajados, horasTotales, abierto };
  });

  const exportar = () => {
    const rows = regFiltrados.map(r => {
      const emp = empleados.find(e => e.id === r.empleadoId);
      const horas = diffHoras(r.entrada, r.salida);
      return {
        Empleado: emp?.nombre || r.empleadoId,
        Fecha: fmtDate(r.fecha), Entrada: r.entrada || "—",
        Salida: r.salida || "—", Horas: horas ? fmtHoras(horas) : "Abierto",
        Notas: r.notas || "",
      };
    });
    exportExcel(rows, `asistencia-${mes}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-700 border-b border-slate-600">
        <Clock size={13} className="text-amber-400"/>
        <select value={empSel} onChange={e=>setEmpSel(e.target.value)}
          className="bg-slate-600 text-white text-xs border border-slate-500 rounded px-2 py-1.5">
          <option value="todos">Todos los empleados</option>
          {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <label className="text-slate-300 text-xs">Mes:</label>
        <input type="month" value={mes} onChange={e=>setMes(e.target.value)}
          className="bg-slate-600 text-white text-xs border border-slate-500 rounded px-2 py-1.5"/>
        <div className="flex-1"/>
        <button onClick={exportar}
          className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded text-xs font-semibold">
          <FileSpreadsheet size={13}/> Excel
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">

        {/* ── Tarjetas de empleados con reloj rápido ── */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Reloj de hoy — {fmtDate(hoy())}</h3>
          <div className="grid grid-cols-2 gap-3">
            {empleados.map(({ emp, abierto } = resumen.find(r => r.emp.id === empleados[0]?.id) || {}, idx) => {
              const info = resumen.find(r => r.emp.id === emp?.id);
              if (!emp || !info) return null;
              return (
                <div key={emp.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{emp.nombre}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{emp.cargo || emp.puesto || "Empleado"}</p>
                    {info.abierto && (
                      <p className="text-[10px] text-amber-600 font-semibold mt-1">
                        🟢 Entrada: {info.abierto.entrada}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {!info.abierto ? (
                      <button onClick={() => marcarEntrada(emp.id)}
                        className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">
                        <UserCheck size={12}/> Entrada
                      </button>
                    ) : (
                      <button onClick={() => marcarSalida(emp.id)}
                        className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">
                        <Clock size={12}/> Salida
                      </button>
                    )}
                    <button onClick={() => { setModal({ empleadoId: emp.id }); setFormFecha(hoy()); setFormHora(horaActual()); }}
                      className="text-[10px] text-slate-400 hover:text-slate-700 text-center">
                      + Manual
                    </button>
                  </div>
                </div>
              );
            })}
            {empleados.length === 0 && (
              <p className="col-span-2 text-center text-slate-400 text-sm py-6">
                No hay empleados registrados. Agregá empleados en la sección Empleados.
              </p>
            )}
          </div>
        </div>

        {/* ── Resumen del mes ── */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Resumen — {mes}</h3>
          <div className="overflow-x-auto">
            <table className="table-base w-full">
              <thead><tr>
                <th>Empleado</th><th>Cargo</th>
                <th className="text-center">Días trabajados</th>
                <th className="text-center">Horas totales</th>
                <th className="text-center">Estado hoy</th>
              </tr></thead>
              <tbody>
                {resumen.map(({ emp, diasTrabajados, horasTotales, abierto }) => (
                  <tr key={emp.id}>
                    <td className="font-semibold">{emp.nombre}</td>
                    <td className="text-slate-500 text-xs">{emp.cargo || emp.puesto || "—"}</td>
                    <td className="text-center">{diasTrabajados}</td>
                    <td className="text-center">{fmtHoras(horasTotales)}</td>
                    <td className="text-center">
                      {abierto
                        ? <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-semibold">Trabajando</span>
                        : <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-semibold">Fuera</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Detalle de registros ── */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Registros del período</h3>
          <div className="overflow-x-auto">
            <table className="table-base w-full">
              <thead><tr>
                <th>Empleado</th><th>Fecha</th><th>Entrada</th><th>Salida</th>
                <th className="text-right">Horas</th><th>Notas</th>
              </tr></thead>
              <tbody>
                {regFiltrados.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-slate-400 py-8">Sin registros en este período</td></tr>
                )}
                {regFiltrados
                  .sort((a,b) => (b.fecha+b.entrada).localeCompare(a.fecha+a.entrada))
                  .map(r => {
                    const emp = empleados.find(e => e.id === r.empleadoId);
                    const horas = diffHoras(r.entrada, r.salida);
                    return (
                      <tr key={r.id}>
                        <td className="font-semibold">{emp?.nombre || "—"}</td>
                        <td>{fmtDate(r.fecha)}</td>
                        <td className="text-amber-600 font-mono text-xs">{r.entrada}</td>
                        <td className={`font-mono text-xs ${r.salida ? "text-rose-600" : "text-amber-500"}`}>
                          {r.salida || "Abierto…"}
                        </td>
                        <td className="text-right">{horas ? fmtHoras(horas) : "—"}</td>
                        <td className="text-slate-400 text-xs">{r.notas || ""}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal registro manual */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={()=>setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="font-bold text-slate-900 mb-4">Registrar entrada manual</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Empleado</label>
                <select value={modal.empleadoId} onChange={e=>setModal({...modal, empleadoId:e.target.value})}
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm">
                  {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label>
                <input type="date" value={formFecha} onChange={e=>setFormFecha(e.target.value)}
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora de entrada</label>
                <input type="time" value={formHora} onChange={e=>setFormHora(e.target.value)}
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notas</label>
                <input value={formNotas} onChange={e=>setFormNotas(e.target.value)} placeholder="Opcional"
                  className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-sm"/>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setModal(null)} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700">Cancelar</button>
              <button onClick={guardarManual} className="flex-1 py-2.5 bg-amber-700 text-white rounded-lg text-sm font-semibold">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
