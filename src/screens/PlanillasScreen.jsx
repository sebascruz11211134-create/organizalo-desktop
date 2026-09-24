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
import { fmtMoney, genId, hoy, fechaLocal } from "../utils/fmt";
import { calcNomina, calcHoras, lineasAsientoPlanilla, idAsientoPlanilla, asientoPlanillaExistente } from "../utils/planilla";
import { Modulo, Boton, BotonIcono, Tarjeta, Vacio, Estado, Indicadores, Indicador, Modal, Campo, Entrada, Seleccion, Interruptor, Selector, useConfirmar } from "../components/ui";

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
  const [form, setForm] = useState(emp ? { ...emp, salarioBruto: emp.salarioBruto ?? emp.salario ?? "" } : { nombre: "", puesto: "", cedula: "", salarioBruto: "", aplicaRenta: false, activo: true });
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const guardar = async () => {
    if (!form.nombre || !form.salarioBruto) return alert("Nombre y salario requeridos.");
    const todos = await db.getEmpleados();
    const salario = parseFloat(form.salarioBruto) || 0;
    const item = { ...form, salarioBruto: salario, salario }; // mismo dato para Empleados y Planillas
    if (!item.id) { item.id = genId(); item.creadoEn = new Date().toISOString(); await db.setEmpleados([...todos, item]); }
    else await db.setEmpleados(todos.map(x => x.id === item.id ? item : x));
    onSave(); onClose();
  };
  return (
    <Modal titulo={emp?.id ? "Editar empleado" : "Nuevo empleado"} subtitulo="Datos para calcular la planilla" onCerrar={onClose} ancho="max-w-md"
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton onClick={guardar}>Guardar</Boton></>}>
      <div className="grid grid-cols-2 gap-3">
        {[["Nombre *", "nombre", "text", "col-span-2"], ["Puesto", "puesto", "text", ""], ["Cédula", "cedula", "text", ""], ["Salario bruto (₡) *", "salarioBruto", "number", "col-span-2"]].map(([lbl, key, type, cls]) => (
          <Campo key={key} etiqueta={lbl} className={cls}><Entrada type={type} value={form[key] || ""} onChange={e => u(key, e.target.value)}/></Campo>
        ))}
        <div className="col-span-2"><Interruptor activo={!!form.aplicaRenta} onCambio={v => u("aplicaRenta", v)} etiqueta="Aplica retención de renta"/></div>
        {form.aplicaRenta && (<>
          <Campo etiqueta="Hijos (crédito fiscal)"><Entrada type="number" min="0" value={form.hijos || ""} onChange={e => u("hijos", e.target.value)}/></Campo>
          <div className="flex items-end pb-2"><Interruptor activo={!!form.conyuge} onCambio={v => u("conyuge", v)} etiqueta="Cónyuge (crédito fiscal)"/></div>
        </>)}
        <Campo etiqueta="Tarifa por hora (₡, opcional)" className="col-span-2"><Entrada type="number" min="0" value={form.tarifaHora || ""} onChange={e => u("tarifaHora", e.target.value)} placeholder="Vacío = salario ÷ 240"/></Campo>
        <div className="col-span-2"><Interruptor activo={!!form.activo} onCambio={v => u("activo", v)} etiqueta="Activo"/></div>
      </div>
    </Modal>
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
      fecha: fechaLocal(new Date()),
      activo: true,
    });
    onClose();
  };
  return (
    <Modal titulo="Nuevo préstamo" subtitulo="Crédito interno que se rebaja por cuota semanal" onCerrar={onClose} ancho="max-w-md"
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton onClick={guardar}>Registrar</Boton></>}>
      <div className="space-y-3">
        <Campo etiqueta="Colaborador"><Seleccion value={form.empleadoId} onChange={e => u("empleadoId", e.target.value)} opciones={empleados.map(e => ({ value: e.id, label: e.nombre }))}/></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Monto total (₡)"><Entrada type="number" value={form.monto} onChange={e => u("monto", e.target.value)}/></Campo>
          <Campo etiqueta="Cuota semanal (₡)"><Entrada type="number" value={form.cuota} onChange={e => u("cuota", e.target.value)}/></Campo>
        </div>
        <Campo etiqueta="Descripción / motivo"><Entrada value={form.descripcion} onChange={e => u("descripcion", e.target.value)}/></Campo>
      </div>
    </Modal>
  );
}

// ── Fila desglose nómina ──────────────────────────────────────────────────────
function DetalleRow({ emp }) {
  const c = calcNomina(emp);
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className={`cursor-pointer border-b border-black/5 transition-colors ${open ? "bg-[#FFF4B8]" : "hover:bg-monki-cream/60"}`} onClick={() => setOpen(o => !o)}>
        <td className="px-4 py-2.5"><b className="text-monki-k">{emp.nombre}</b></td>
        <td className="px-4 py-2.5 text-monki-k/55 text-xs">{emp.puesto || "—"}</td>
        <td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(c.bruto, "CRC")}</td>
        <td className="px-4 py-2.5 text-right tabular-nums text-red-600">−{fmtMoney(c.dedTotal, "CRC")}</td>
        <td className="px-4 py-2.5 text-right tabular-nums font-black">{fmtMoney(c.neto, "CRC")}</td>
        <td className="px-4 py-2.5 text-right tabular-nums text-monki-k/65">{fmtMoney(c.patTotal, "CRC")}</td>
        <td className="px-4 py-2.5 text-right tabular-nums font-bold">{fmtMoney(c.costoTotal, "CRC")}</td>
        <td className="px-4 py-2.5 text-right tabular-nums text-monki-k/45">{fmtMoney(c.aguinaldo, "CRC")}</td>
      </tr>
      {open && (
        <tr className="animate-desplegar bg-monki-cream/70">
          <td colSpan={8} className="px-6 py-3">
            <div className="grid grid-cols-2 gap-x-10 gap-y-1 text-xs [&_span:nth-child(even)]:text-right [&_span:nth-child(even)]:font-bold">
              <div className="monki-tag text-monki-k/55 col-span-2 mb-1">Deducciones del trabajador</div>
              <span className="text-monki-k/60">CCSS (SEM 5.5% + IVM 4.33%)</span><span className="text-red-600">-{fmtMoney(c.ccssT, "CRC")}</span>
              <span className="text-monki-k/60">Banco Popular (1%)</span><span className="text-red-600">-{fmtMoney(c.bpT, "CRC")}</span>
              {emp.aplicaRenta && <><span className="text-monki-k/60">Renta</span><span className="text-red-600">-{fmtMoney(c.renta, "CRC")}</span></>}
              <div className="monki-tag text-monki-k/55 col-span-2 mt-2 mb-1">Cargas patronales</div>
              <span className="text-monki-k/60">CCSS (SEM 9.25% + IVM 5.58% + BP 0.25%)</span><span>{fmtMoney(c.ccssP, "CRC")}</span>
              <span className="text-monki-k/60">Asignaciones Familiares (5%)</span><span>{fmtMoney(c.asignP, "CRC")}</span>
              <span className="text-monki-k/60">IMAS (0.5%)</span><span>{fmtMoney(c.imasP, "CRC")}</span>
              <span className="text-monki-k/60">INA (1.5%)</span><span>{fmtMoney(c.inaP, "CRC")}</span>
              <span className="text-monki-k/60">Aporte Banco Popular (0.25%)</span><span>{fmtMoney(c.bpP, "CRC")}</span>
              <span className="text-monki-k/60">FCL (1.5%)</span><span>{fmtMoney(c.fclP, "CRC")}</span>
              <span className="text-monki-k/60">OPC (2%)</span><span>{fmtMoney(c.opcP, "CRC")}</span>
              <span className="text-monki-k/60">INS (1%)</span><span>{fmtMoney(c.insP, "CRC")}</span>
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
// Tabla con el estilo del kit (definida fuera para no perder el foco al escribir horas)
const TH = "monki-tag text-monki-k/55 font-semibold px-4 py-3 border-b-2 border-black/10 whitespace-nowrap";
const TablaSimple = ({ children }) => (
  <div className="ui-tarjeta flex-1 min-h-0 bg-white rounded-[18px] border-2 border-black/10 overflow-hidden flex flex-col">
    <div className="flex-1 min-h-0 overflow-auto"><table className="ui-tabla w-full text-sm">{children}</table></div>
  </div>
);

export default function PlanillasScreen() {
  const { confirmar, dialogo } = useConfirmar();
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
    if (!(await confirmar("Eliminar préstamo", "¿Eliminar este préstamo? Esta acción no se puede deshacer.", { peligro: true, boton: "Eliminar" }))) return;
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
    const campos = ["bruto", "ccssT", "bpT", "renta", "dedTotal", "neto", "patTotal", "costoTotal", "aguinaldo"];
    return Object.fromEntries(campos.map(k => [k, acc[k] + c[k]]));
  }, { bruto: 0, ccssT: 0, bpT: 0, renta: 0, dedTotal: 0, neto: 0, patTotal: 0, costoTotal: 0, aguinaldo: 0 });

  // ── Totales horas semana seleccionada ──
  const semActual = sems[semSel];
  const totHoras = semActual ? empleados.reduce((acc, emp) => {
    const h = calcHoras(emp, semActual.key, semanasData);
    return { bruto: acc.bruto + h.bruto };
  }, { bruto: 0 }) : { bruto: 0 };

  const prestActivos = prestamos.filter(p => p.activo);

  const confirmarPlanilla = async () => {
    if (!(await confirmar("Confirmar planilla", `¿Confirmar la planilla de ${mesLabel(mes)}? Se creará un asiento contable automático.`, { boton: "Confirmar" }))) return;
    try {
      const asientos = await db.getAsientos();
      if (asientoPlanillaExistente(asientos, mes, mesLabel(mes))) {
        return alert(`La planilla de ${mesLabel(mes)} ya tiene su asiento contable.`);
      }
      const seq = String(asientos.length + 1).padStart(5, "0");
      const lineas = lineasAsientoPlanilla(totNomina);
      const totalDebe  = lineas.reduce((s, l) => s + l.debe, 0);
      const totalHaber = lineas.reduce((s, l) => s + l.haber, 0);
      const asiento = {
        id: idAsientoPlanilla(mes), numero: `AJ-${seq}`,
        descripcion: `Planilla ${mesLabel(mes)} — ${empleados.length} empleados`, planillaMes: mes,
        fecha: hoy(), totalDebe, totalHaber,
        estado: "confirmado", lineas,
        creadoEn: new Date().toISOString(), autoGenerado: true,
      };
      await db.setAsientos([asiento, ...asientos]);
      alert(`✓ Asiento ${asiento.numero} creado en Contabilidad`);
    } catch (e) {
      alert("Error al crear asiento: " + e.message);
    }
  };

  return (
    <Modulo
      seccion="RRHH"
      titulo="Planillas"
      descripcion="Nómina mensual con CCSS y renta, horas semanales y préstamos a colaboradores."
      acciones={<>
        <div className="flex items-center gap-1 bg-white rounded-full border-2 border-black/10 p-1">
          <BotonIcono icono={ChevronLeft} titulo="Mes anterior" onClick={() => setMes(prevMes(mes))}/>
          <span className="text-sm font-bold min-w-[150px] text-center capitalize">{mesLabel(mes)}</span>
          <BotonIcono icono={ChevronRight} titulo="Mes siguiente" onClick={() => setMes(nextMes(mes))}/>
        </div>
        {tab === 2 && <Boton variante="secundario" icono={Plus} onClick={() => setModalPrest(true)}>Nuevo préstamo</Boton>}
        <Boton icono={Plus} onClick={() => setModalEmp({})}>Empleado</Boton>
      </>}
      indicadores={tab === 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Indicador etiqueta="Salario bruto" valor={fmtMoney(totNomina.bruto, "CRC")} delay={40}/>
          <Indicador etiqueta="Deducciones" valor={fmtMoney(totNomina.dedTotal, "CRC")} delay={80}/>
          <Indicador etiqueta="A pagar" valor={fmtMoney(totNomina.neto, "CRC")} destacado delay={120}/>
          <Indicador etiqueta="Cargas patronales" valor={fmtMoney(totNomina.patTotal, "CRC")} delay={160}/>
          <Indicador etiqueta="Costo total empresa" valor={fmtMoney(totNomina.costoTotal, "CRC")} delay={200}/>
        </div>
      )}
      pestanas={{ activa: tab, onCambiar: setTab, items: TABS.map((t, i) => ({ key: i, label: t, cuenta: i === 2 && prestActivos.length > 0 ? prestActivos.length : undefined })) }}
    >
      {tab === 0 && (<>
        {empleados.length === 0 ? (
          <Tarjeta className="flex-1 flex items-center justify-center">
            <Vacio titulo="Sin empleados registrados" texto="Agregá a tu equipo para calcular la planilla." accion={<Boton icono={Plus} onClick={() => setModalEmp({})}>Agregar empleado</Boton>}/>
          </Tarjeta>
        ) : (
          <TablaSimple>
            <thead className="sticky top-0 z-10 bg-white"><tr>
              <th className={TH+" text-left"}>Empleado</th><th className={TH+" text-left"}>Puesto</th>
              {["Salario bruto","Deducciones","Salario neto","Carga patronal","Costo total","Aguinaldo prov."].map(t => <th key={t} className={TH+" text-right"}>{t}</th>)}
            </tr></thead>
            <tbody>
              {empleados.map(emp => <DetalleRow key={emp.id} emp={emp} />)}
              <tr className="bg-monki-k text-white font-black">
                <td colSpan={2} className="px-4 py-3 monki-tag text-monki-y">Totales ({empleados.length})</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(totNomina.bruto, "CRC")}</td>
                <td className="px-4 py-3 text-right tabular-nums text-red-300">−{fmtMoney(totNomina.dedTotal, "CRC")}</td>
                <td className="px-4 py-3 text-right tabular-nums text-monki-y">{fmtMoney(totNomina.neto, "CRC")}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(totNomina.patTotal, "CRC")}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(totNomina.costoTotal, "CRC")}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(totNomina.aguinaldo, "CRC")}</td>
              </tr>
            </tbody>
          </TablaSimple>
        )}
        <div className="shrink-0 mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-monki-k/45">Tasas CCSS y renta 2026 · tocá un empleado para ver el desglose</span>
          {empleados.length > 0 && <Boton icono={CheckCircle2} onClick={confirmarPlanilla}>Confirmar planilla → asiento contable</Boton>}
        </div>
      </>)}

      {tab === 1 && (<>
        <div className="shrink-0 flex flex-wrap items-center gap-2 mb-3">
          <BotonIcono icono={ChevronLeft} titulo="Semana anterior" onClick={() => setSemSel(s => Math.max(0, s - 1))}/>
          <Selector valor={semSel} onCambio={v => setSemSel(Number(v))} opciones={sems.map((s, i) => ({ value: i, label: s.label }))}/>
          <BotonIcono icono={ChevronRight} titulo="Semana siguiente" onClick={() => setSemSel(s => Math.min(sems.length - 1, s + 1))}/>
          <span className="ml-auto bg-monki-k text-white rounded-full px-4 py-1.5 text-sm">Bruto de la semana <b className="text-monki-y">{fmt(totHoras.bruto)}</b></span>
        </div>
        {empleados.length === 0 ? (
          <Tarjeta className="flex-1 flex items-center justify-center"><Vacio titulo="Sin empleados registrados"/></Tarjeta>
        ) : (
          <TablaSimple>
            <thead className="sticky top-0 z-10 bg-white"><tr>
              <th className={TH+" text-left"}>Colaborador</th><th className={TH+" text-left"}>Tarifa/h</th>
              <th className={TH+" text-center"}>H. normal</th><th className={TH+" text-center"}>H. T.M. (×1.5)</th><th className={TH+" text-center"}>H. doble (×2)</th>
              <th className={TH+" text-right"}>Bruto sem.</th>
            </tr></thead>
            <tbody>
              {empleados.map(emp => {
                const sk = semActual?.key || "";
                const h = calcHoras(emp, sk, semanasData);
                const cuotas = prestamos.filter(p => p.empleadoId === emp.id && p.activo).reduce((s, p) => s + p.cuota, 0);
                const aPagar = h.bruto - cuotas;
                return (
                  <tr key={emp.id} className="border-b border-black/5 hover:bg-monki-cream/60 transition-colors">
                    <td className="px-4 py-2.5"><b className="text-monki-k">{emp.nombre}</b>{cuotas > 0 && <div className="text-xs text-red-600">Cuota de préstamo −{fmt(cuotas)}</div>}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-monki-k/55">{fmt(Math.round(h.tarifa))}/h</td>
                    {["normal", "tm", "doble"].map(tipo => (
                      <td key={tipo} className="px-2 py-2 text-center">
                        <input type="number" min="0" step="0.5" value={semanasData[`${emp.id}_${sk}_${tipo}`] || ""}
                          onChange={e => setHoras(emp.id, sk, tipo, e.target.value)}
                          className="w-20 bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-2 py-1 text-sm text-center"/>
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right"><b className="tabular-nums">{fmt(h.bruto)}</b>{cuotas > 0 && <div className="text-xs font-bold">A pagar {fmt(aPagar)}</div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </TablaSimple>
        )}
        <p className="shrink-0 mt-3 text-xs text-monki-k/45">Mano de obra por horas · sin deducción CCSS · las cuotas de préstamo se rebajan del bruto semanal</p>
      </>)}

      {tab === 2 && (
        <div className="flex-1 overflow-auto -mx-1 px-1 pb-1">
          {prestamos.length === 0 ? (
            <Tarjeta className="h-full flex items-center justify-center">
              <Vacio icono={TrendingDown} titulo="Sin préstamos registrados" texto="Registrá adelantos o préstamos y rebajalos por cuota semanal."
                accion={<Boton icono={Plus} onClick={() => setModalPrest(true)}>Nuevo préstamo</Boton>}/>
            </Tarjeta>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {prestamos.map((p, i) => {
                const emp = empleados.find(e => e.id === p.empleadoId);
                const pct = Math.round((1 - p.saldo / p.monto) * 100);
                return (
                  <div key={p.id} style={{ animationDelay: `${Math.min(i,8)*40}ms` }}
                    className={`animate-entrar bg-white rounded-[18px] border-2 border-black/10 p-4 ${!p.activo ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <b className="text-monki-k">{emp?.nombre || "Empleado"}</b>
                          {p.activo ? <Estado tono="alerta">Activo</Estado> : <Estado tono="exito">Pagado</Estado>}
                        </div>
                        <p className="text-sm text-monki-k/55 mt-0.5">{p.descripcion || "Sin descripción"} · desde {p.fecha}</p>
                      </div>
                      <BotonIcono icono={Trash2} titulo="Eliminar" tono="peligro" onClick={() => eliminarPrestamo(p.id)}/>
                    </div>
                    <div className="h-2 bg-black/10 rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-monki-k rounded-full transition-all duration-700 ease-monki" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div className="flex flex-wrap gap-4 text-monki-k/60">
                        <span>Monto <b className="text-monki-k">{fmt(p.monto)}</b></span>
                        <span>Saldo <b className="text-red-600">{fmt(p.saldo)}</b></span>
                        <span>Cuota <b className="text-monki-k">{fmt(p.cuota)}</b></span>
                      </div>
                      <span className="font-mono text-xs text-monki-k/45">{pct}% pagado</span>
                    </div>
                    {p.activo && <Boton variante="amarillo" className="mt-3 w-full" onClick={() => pagarCuota(p.id)}>Aplicar cuota ({fmt(p.cuota)})</Boton>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {modalEmp !== null && <EmpleadoModal emp={Object.keys(modalEmp).length > 0 ? modalEmp : null} onClose={() => setModalEmp(null)} onSave={cargar} />}
      {modalPrest && <PrestamoModal empleados={empleados} onClose={() => setModalPrest(false)} onSave={agregarPrestamo} />}
      {dialogo}
    </Modulo>
  );
}
