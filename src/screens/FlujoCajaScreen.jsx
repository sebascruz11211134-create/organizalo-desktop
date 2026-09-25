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
import { genId, fechaLocal } from "../utils/fmt";
import { Modulo, Boton, BotonIcono, Tabla, Tarjeta, Vacio, Estado, Indicadores, Indicador, Modal, Campo, Entrada, Seleccion } from "../components/ui";

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
    semanas.push({ inicio: fechaLocal(inicio), fin: fechaLocal(fin) });
    d.setDate(d.getDate() + 7);
    if (semanas.length >= 6) break;
  }
  return semanas;
}

function semanaActual(semanas) {
  const hoy = fechaLocal(new Date());
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
    <Modal titulo="Nuevo pago fijo" subtitulo="Un gasto que se repite: planilla, alquiler, préstamo…" onCerrar={onClose} ancho="max-w-md"
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton onClick={guardar}>Guardar</Boton></>}>
      <div className="space-y-3">
        <Campo etiqueta="Nombre"><Entrada value={form.nombre} onChange={e => u("nombre", e.target.value)}/></Campo>
        <Campo etiqueta="Monto (₡)"><Entrada type="number" value={form.monto} onChange={e => u("monto", e.target.value)}/></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Categoría"><Seleccion value={form.categoria} onChange={e => u("categoria", e.target.value)} opciones={CATEGORIAS}/></Campo>
          <Campo etiqueta="Frecuencia"><Seleccion value={form.frecuencia} onChange={e => u("frecuencia", e.target.value)} opciones={[{value:"semanal",label:"Semanal"},{value:"quincenal",label:"Quincenal"},{value:"mensual",label:"Mensual"}]}/></Campo>
        </div>
      </div>
    </Modal>
  );
}

// ── Modal: nuevo movimiento ──────────────────────────────────────────────────
function MovModal({ onClose, onSave }) {
  const [form, setForm] = useState({ tipo: "salida", monto: "", descripcion: "", categoria: "Otro", fecha: fechaLocal(new Date()) });
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const guardar = () => {
    if (!form.monto || !form.descripcion) return alert("Monto y descripción requeridos");
    onSave({ id: genId(), ...form, monto: Number(form.monto) });
    onClose();
  };
  return (
    <Modal titulo="Nuevo movimiento" subtitulo="Entrada o salida de dinero" onCerrar={onClose} ancho="max-w-md"
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton variante={form.tipo === "entrada" ? "primario" : "peligro"} onClick={guardar}>Registrar</Boton></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {["entrada", "salida"].map(t => (
            <button key={t} type="button" onClick={() => u("tipo", t)}
              className={`ui-boton py-2 rounded-full text-sm font-bold transition-all duration-300 ease-monki ${form.tipo === t ? (t === "entrada" ? "bg-monki-k text-monki-y" : "bg-red-600 text-white") : "bg-white shadow-[inset_0_0_0_2px_rgba(17,17,17,.12)] text-monki-k/60 hover:text-monki-k"}`}>
              {t === "entrada" ? "▼ Entrada" : "▲ Salida"}
            </button>
          ))}
        </div>
        <Campo etiqueta="Monto (₡)"><Entrada type="number" value={form.monto} onChange={e => u("monto", e.target.value)}/></Campo>
        <Campo etiqueta="Descripción"><Entrada value={form.descripcion} onChange={e => u("descripcion", e.target.value)}/></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Categoría"><Seleccion value={form.categoria} onChange={e => u("categoria", e.target.value)} opciones={CATEGORIAS}/></Campo>
          <Campo etiqueta="Fecha"><Entrada type="date" value={form.fecha} onChange={e => u("fecha", e.target.value)}/></Campo>
        </div>
      </div>
    </Modal>
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

  const columnasPagos = [
    { key: "nombre", titulo: "Nombre", render: p => <b className="text-monki-k">{p.nombre}</b> },
    { key: "cat", titulo: "Categoría", render: p => <Estado>{p.categoria}</Estado> },
    { key: "frec", titulo: "Frecuencia", render: p => <span className="capitalize text-monki-k/60">{p.frecuencia}</span> },
    { key: "monto", titulo: "Monto", alinear: "right", render: p => <b className="text-red-600">{fmt(p.monto)}</b> },
    { key: "acc", titulo: "", alinear: "right", render: p => <BotonIcono icono={Trash2} titulo="Eliminar" tono="peligro" onClick={() => eliminarPago(p.id)}/> },
  ];
  const columnasMovs = [
    { key: "fecha", titulo: "Fecha", render: mv => <span className="font-mono text-xs text-monki-k/55">{mv.fecha}</span> },
    { key: "desc", titulo: "Descripción", principal: true, render: mv => <b className="text-monki-k">{mv.descripcion}</b> },
    { key: "cat", titulo: "Categoría", render: mv => <Estado>{mv.categoria}</Estado> },
    { key: "tipo", titulo: "Tipo", render: mv => <Estado tono={mv.tipo === "entrada" ? "exito" : "peligro"}>{mv.tipo === "entrada" ? "Entrada" : "Salida"}</Estado> },
    { key: "monto", titulo: "Monto", alinear: "right", render: mv => <b className={mv.tipo === "entrada" ? "" : "text-red-600"}>{mv.tipo === "entrada" ? "+" : "−"}{fmt(mv.monto)}</b> },
    { key: "acc", titulo: "", alinear: "right", render: mv => <BotonIcono icono={Trash2} titulo="Eliminar" tono="peligro" onClick={() => eliminarMov(mv.id)}/> },
  ];

  return (
    <Modulo
      seccion="Tesorería"
      titulo="Flujo de caja"
      descripcion="Cuánto dinero tenés, cuánto sale cada semana y si alcanza."
      acciones={<>
        <div className="flex items-center gap-1 bg-white rounded-full border-2 border-black/10 p-1">
          <BotonIcono icono={ChevronLeft} titulo="Mes anterior" onClick={() => setMes(prevMes(mes))}/>
          <span className="text-sm font-bold min-w-[100px] text-center">{mesLabel(mes)}</span>
          <BotonIcono icono={ChevronRight} titulo="Mes siguiente" onClick={() => setMes(nextMes(mes))}/>
        </div>
        {tab === 1 && <Boton icono={Plus} onClick={() => setModalPago(true)}>Pago fijo</Boton>}
        {tab === 2 && <Boton icono={Plus} onClick={() => setModalMov(true)}>Movimiento</Boton>}
      </>}
      pestanas={{ activa: tab, onCambiar: setTab, items: TABS.map((t, i) => ({ key: i, label: t })) }}
    >
      <div className={`animate-entrar mb-3 rounded-[18px] border-2 p-4 ${alerta ? "bg-red-50 border-red-400" : "bg-monki-k border-monki-k text-white"}`}>
        {alerta && (
          <div className="flex items-center gap-2 text-red-700 text-sm font-bold mb-3">
            <AlertTriangle size={15} /> El saldo disponible no alcanza para los gastos de esta semana
          </div>
        )}
        <div className="flex items-end gap-6 flex-wrap">
          {[
            { label: "Banco ₡", key: "banco", display: fmt(saldo.banco) },
            { label: "Banco $", key: "bancoUSD", display: fmtUSD(saldo.bancoUSD) },
            { label: "Efectivo", key: "efectivo", display: fmt(saldo.efectivo) },
          ].map(({ label, key, display }) => (
            <div key={key} className="flex flex-col">
              <span className={`monki-tag text-[10px] ${alerta ? "text-monki-k/50" : "text-white/55"}`}>{label}</span>
              {editSaldo
                ? <input type="number" defaultValue={saldo[key]} onBlur={e => setSaldo(p => ({ ...p, [key]: Number(e.target.value) || 0 }))}
                    className="mt-1 bg-white text-monki-k border-2 border-black/10 rounded-xl px-2.5 py-1 text-sm w-32"/>
                : <span className="text-[17px] font-black">{display}</span>}
            </div>
          ))}
          <div className={`flex flex-col pl-5 border-l ${alerta ? "border-black/10" : "border-white/15"}`}>
            <span className={`monki-tag text-[10px] ${alerta ? "text-monki-k/50" : "text-white/55"}`}>Total disponible (est.)</span>
            <span className={`text-[22px] font-black ${alerta ? "text-red-600" : "text-monki-y"}`}>{fmt(totalDisponible)}</span>
          </div>
          <Boton tamano="sm" variante={alerta ? "secundario" : "amarillo"} icono={Edit3} className="ml-auto" onClick={() => editSaldo ? guardarSaldo(saldo) : setEditSaldo(true)}>
            {editSaldo ? "Guardar saldo" : "Editar saldo"}
          </Boton>
        </div>
      </div>

      {tab === 0 && (
        <div className="flex-1 overflow-auto -mx-1 px-1 pb-1 space-y-3">
          <Indicadores>
            <Indicador etiqueta="Entradas del mes" valor={fmt(totalEntradas)} icono={TrendingUp} delay={40}/>
            <Indicador etiqueta="Salidas del mes" valor={fmt(totalSalidas)} delay={90}/>
            <Indicador etiqueta="Flujo neto" valor={fmt(totalEntradas - totalSalidas)} destacado={totalEntradas >= totalSalidas} alerta={totalEntradas < totalSalidas} delay={140}/>
            <Indicador etiqueta="Pagos fijos" valor={pagosFijos.length} icono={DollarSign} delay={190} onClick={() => setTab(1)}/>
          </Indicadores>
          <div className="space-y-2">
            {semanas.map((sem, i) => {
              const gastos = gastosSemana(sem);
              const esActual = i === semActual;
              const deficit = gastos > totalDisponible;
              return (
                <div key={sem.inicio} style={{ animationDelay: `${i*50}ms` }}
                  className={`animate-entrar rounded-[18px] border-2 px-4 py-3.5 flex flex-wrap items-center gap-4 ${esActual ? "bg-monki-y border-monki-k shadow-[4px_4px_0_#111]" : "bg-white border-black/10"}`}>
                  <div className="flex-1 min-w-[160px]">
                    <p className="monki-tag text-monki-k/55">Semana {i + 1}{esActual && " · actual"}</p>
                    <p className="text-sm font-extrabold text-monki-k mt-0.5 font-mono">{sem.inicio} → {sem.fin}</p>
                  </div>
                  <div className="text-right">
                    <p className="monki-tag text-[10px] text-monki-k/45">Gastos estimados</p>
                    <p className={`text-[17px] font-black ${deficit ? "text-red-600" : "text-monki-k"}`}>{fmt(gastos)}</p>
                  </div>
                  {deficit ? <Estado tono="peligro">Déficit</Estado> : <Estado tono="exito">Alcanza</Estado>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 1 && (
        <Tabla columnas={columnasPagos} filas={pagosFijos}
          vacio={<Vacio icono={DollarSign} titulo="Sin pagos fijos" texto="Anotá planilla, alquiler, préstamos… para proyectar cada semana."
            accion={<Boton icono={Plus} onClick={() => setModalPago(true)}>Agregar pago fijo</Boton>}/>}/>
      )}

      {tab === 2 && (
        <Tabla columnas={columnasMovs} filas={movsDelMes}
          vacio={<Vacio icono={TrendingUp} titulo={`Sin movimientos en ${mesLabel(mes)}`} texto="Registrá entradas y salidas de dinero."
            accion={<Boton icono={Plus} onClick={() => setModalMov(true)}>Agregar movimiento</Boton>}/>}/>
      )}

      {modalPago && <PagoFijoModal onClose={() => setModalPago(false)} onSave={agregarPago} />}
      {modalMov  && <MovModal     onClose={() => setModalMov(false)}  onSave={agregarMov} />}
    </Modulo>
  );
}
