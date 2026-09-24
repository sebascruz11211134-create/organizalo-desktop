/**
 * AsistenciaScreen — Control de asistencia de empleados
 * Reloj entrada/salida, horas trabajadas, resumen mensual
 */
import React, { useState, useEffect, useCallback } from "react";
import { Clock, UserCheck, FileSpreadsheet, LogIn, LogOut, Plus, Users, Timer } from "lucide-react";
import { Modulo, Boton, BarraFiltros, Selector, Tabla, Tarjeta, Vacio, Estado, Indicadores, Indicador, Modal, Campo, Entrada, Seleccion } from "../components/ui";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtDate, genId, hoy, fechaLocal, mesLocal } from "../utils/fmt";
import { exportExcel } from "../utils/reportHelpers";

function mesActual() { return mesLocal(new Date()); }
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
  const hasta = (() => { const [y,m]=mes.split("-").map(Number); return fechaLocal(new Date(y,m,0)); })();

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

  const trabajandoAhora = resumen.filter(r => r.abierto).length;
  const horasMes = resumen.reduce((t, r) => t + r.horasTotales, 0);
  const columnasResumen = [
    { key: "nombre", titulo: "Empleado", render: r => <b className="text-monki-k">{r.emp.nombre}</b> },
    { key: "cargo", titulo: "Cargo", render: r => <span className="text-monki-k/55 text-xs">{r.emp.cargo || r.emp.puesto || "—"}</span> },
    { key: "dias", titulo: "Días trabajados", alinear: "center", render: r => r.diasTrabajados },
    { key: "horas", titulo: "Horas", alinear: "center", render: r => <b>{fmtHoras(r.horasTotales)}</b> },
    { key: "hoy", titulo: "Hoy", alinear: "center", render: r => r.abierto ? <Estado tono="exito">Trabajando</Estado> : <Estado>Fuera</Estado> },
  ];
  const columnasRegistros = [
    { key: "emp", titulo: "Empleado", render: r => <b className="text-monki-k">{empleados.find(e => e.id === r.empleadoId)?.nombre || "—"}</b> },
    { key: "fecha", titulo: "Fecha", render: r => fmtDate(r.fecha) },
    { key: "entrada", titulo: "Entrada", render: r => <span className="font-mono text-xs">{r.entrada}</span> },
    { key: "salida", titulo: "Salida", render: r => r.salida ? <span className="font-mono text-xs">{r.salida}</span> : <Estado tono="alerta">Abierto</Estado> },
    { key: "horas", titulo: "Horas", alinear: "right", render: r => { const h = diffHoras(r.entrada, r.salida); return h ? fmtHoras(h) : "—"; } },
    { key: "notas", titulo: "Notas", render: r => <span className="text-monki-k/45 text-xs">{r.notas || ""}</span> },
  ];
  const registrosOrdenados = [...regFiltrados].sort((a,b) => (b.fecha+b.entrada).localeCompare(a.fecha+a.entrada));

  return (
    <Modulo
      seccion="RRHH"
      titulo="Control de asistencia"
      descripcion="Marcá entradas y salidas, y mirá las horas trabajadas de cada persona en el mes."
      acciones={<Boton variante="secundario" icono={FileSpreadsheet} onClick={exportar}>Excel</Boton>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Empleados" valor={empleados.length} icono={Users} delay={40}/>
          <Indicador etiqueta="Trabajando ahora" valor={trabajandoAhora} icono={Clock} destacado delay={90}/>
          <Indicador etiqueta="Horas del mes" valor={fmtHoras(horasMes)} icono={Timer} delay={140}/>
          <Indicador etiqueta="Registros" valor={regFiltrados.length} detalle="En el período" delay={190}/>
        </Indicadores>
      }
    >
      <div className="flex-1 overflow-auto -mx-1 px-1 pb-1 space-y-4">
        <div>
          <p className="monki-tag text-monki-k/55 mb-2">Reloj de hoy — {fmtDate(hoy())}</p>
          {empleados.length === 0 ? (
            <Tarjeta><Vacio icono={Users} titulo="No hay empleados" texto="Agregá tu equipo en RRHH → Empleados para marcar asistencia."/></Tarjeta>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {resumen.map(({ emp, abierto }, i) => (
                <div key={emp.id} style={{ animationDelay: `${Math.min(i,9)*40}ms` }}
                  className={`animate-entrar rounded-[18px] border-2 p-4 flex items-center justify-between gap-3 transition-all duration-300 ease-monki ${abierto ? "bg-monki-y border-monki-k shadow-[4px_4px_0_#111]" : "bg-white border-black/10"}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black ${abierto ? "bg-monki-k text-monki-y" : "bg-monki-cream text-monki-k"}`}>{(emp.nombre||"?").charAt(0).toUpperCase()}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-monki-k truncate">{emp.nombre}</p>
                      <p className="text-xs text-monki-k/55">{emp.cargo || emp.puesto || "Empleado"}</p>
                      {abierto && <p className="font-mono text-[10px] font-bold mt-0.5 flex items-center gap-1"><span className="monki-pulse"/>Entró {abierto.entrada}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {!abierto
                      ? <Boton tamano="sm" icono={LogIn} onClick={() => marcarEntrada(emp.id)}>Entrada</Boton>
                      : <Boton tamano="sm" variante="peligro" icono={LogOut} onClick={() => marcarSalida(emp.id)}>Salida</Boton>}
                    <Boton tamano="sm" variante="fantasma" icono={Plus} onClick={() => { setModal({ empleadoId: emp.id }); setFormFecha(hoy()); setFormHora(horaActual()); }}>Manual</Boton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <BarraFiltros>
          <Selector valor={empSel} onCambio={setEmpSel} opciones={[{ value: "todos", label: "Todos los empleados" }, ...empleados.map(e => ({ value: e.id, label: e.nombre }))]}/>
          <label className="flex items-center gap-2 monki-tag text-monki-k/55">Mes <Entrada type="month" value={mes} onChange={e=>setMes(e.target.value)} className="!w-auto !py-1.5"/></label>
        </BarraFiltros>

        <div>
          <p className="monki-tag text-monki-k/55 mb-2">Resumen — {mes}</p>
          <Tabla columnas={columnasResumen} filas={resumen} claveFila={r => r.emp.id} className="!flex-none"
            vacio={<p className="text-center py-8 text-monki-k/40 text-sm">Sin empleados</p>}/>
        </div>
        <div>
          <p className="monki-tag text-monki-k/55 mb-2">Registros del período</p>
          <Tabla columnas={columnasRegistros} filas={registrosOrdenados} className="!flex-none"
            vacio={<p className="text-center py-8 text-monki-k/40 text-sm">Sin registros en este período</p>}/>
        </div>
      </div>

      {modal && (
        <Modal titulo="Registrar entrada manual" subtitulo="Para cuando alguien olvidó marcar" onCerrar={()=>setModal(null)} ancho="max-w-sm"
          pie={<><Boton variante="fantasma" onClick={()=>setModal(null)}>Cancelar</Boton><Boton icono={UserCheck} onClick={guardarManual}>Guardar</Boton></>}>
          <div className="space-y-3">
            <Campo etiqueta="Empleado"><Seleccion value={modal.empleadoId} onChange={e=>setModal({...modal, empleadoId:e.target.value})} opciones={empleados.map(e => ({ value: e.id, label: e.nombre }))}/></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Fecha"><Entrada type="date" value={formFecha} onChange={e=>setFormFecha(e.target.value)}/></Campo>
              <Campo etiqueta="Hora de entrada"><Entrada type="time" value={formHora} onChange={e=>setFormHora(e.target.value)}/></Campo>
            </div>
            <Campo etiqueta="Notas"><Entrada value={formNotas} onChange={e=>setFormNotas(e.target.value)} placeholder="Opcional"/></Campo>
          </div>
        </Modal>
      )}
    </Modulo>
  );
}
