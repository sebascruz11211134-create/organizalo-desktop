import { useState, useEffect, useCallback } from "react";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fechaLocal } from "../utils/fmt";
import { Plus, Landmark, ArrowUpFromLine, ArrowDownToLine, Pencil, Trash2, Ban } from "lucide-react";
import { Modulo, Boton, BotonIcono, BarraFiltros, Buscador, Selector, Tarjeta, Tabla, Vacio, Estado, Indicadores, Indicador, Modal, Campo, Entrada, Seleccion, AreaTexto, Interruptor, useConfirmar } from "../components/ui";

const hoy = () => fechaLocal(new Date());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmt = (n, mon = "CRC") => {
  if (!n && n !== 0) return "—";
  return (mon === "USD" ? "$ " : "₡ ") + Number(n).toLocaleString("es-CR", {
    minimumFractionDigits: mon === "USD" ? 2 : 0,
    maximumFractionDigits: mon === "USD" ? 2 : 0,
  });
};

const TIPOS_DEBITO = ["Débito bancario", "Transferencia saliente", "Comisión bancaria", "Cheque emitido", "Pago servicios", "Otro"];
const TIPOS_CREDITO = ["Depósito efectivo", "Depósito cheque", "Transferencia entrante", "SINPE recibido", "Nota crédito banco", "Otro"];

// Casillas de aprobación compartidas por débitos y créditos
function Aprobacion({ f, set }) {
  return (
    <div className="border-t-2 border-black/10 pt-4">
      <p className="monki-tag text-monki-k/55 mb-3">Flujo de aprobación</p>
      <div className="grid grid-cols-2 gap-3">
        {[["hechoPor","Hecho por"],["revisadoPor","Revisado por"],["autorizadoPor","Autorizado por"],["fechaAutorizacion","Fecha autorización"],["numeroAsiento","N° Asiento"],["asientoAnulacion","Asiento Anulación"]].map(([k,l]) => (
          <Campo key={k} etiqueta={l}><Entrada type={k==="fechaAutorizacion"?"date":"text"} value={f[k]} onChange={e => set(k, e.target.value)}/></Campo>
        ))}
      </div>
      <div className="flex flex-wrap gap-6 mt-4">
        {[["conciliable","Conciliable"],["contabilizado","Contabilizado"],["anulado","Anulado"]].map(([k,l]) => (
          <Interruptor key={k} activo={!!f[k]} onCambio={v => set(k, v)} etiqueta={l}/>
        ))}
      </div>
    </div>
  );
}
const opcionesCuentas = cuentas => cuentas.map(c => ({ value: c.id, label: `${c.numeroCuenta} — ${c.nombre}` }));

// ── Modal Cuentas ─────────────────────────────────────────────────────────────
function ModalCuenta({ cuenta, onSave, onClose }) {
  const [f, setF] = useState(cuenta || {
    nombre: "", numeroCuenta: "", banco: "", moneda: "CRC", saldoInicial: 0, activa: true,
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <Modal titulo={cuenta ? "Editar cuenta" : "Nueva cuenta bancaria"} onCerrar={onClose} ancho="max-w-md"
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton onClick={() => { if (!f.nombre) return; onSave(f); }}>Guardar</Boton></>}>
      <div className="space-y-3">
        <Campo etiqueta="Nombre de la cuenta"><Entrada value={f.nombre} onChange={e => set("nombre", e.target.value)} placeholder="Ej. Corriente Nacional CRC"/></Campo>
        <Campo etiqueta="Número de cuenta"><Entrada value={f.numeroCuenta} onChange={e => set("numeroCuenta", e.target.value)} placeholder="100-01-164-000481-8"/></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Banco"><Entrada value={f.banco} onChange={e => set("banco", e.target.value)} placeholder="Banco Nacional"/></Campo>
          <Campo etiqueta="Moneda"><Seleccion value={f.moneda} onChange={e => set("moneda", e.target.value)} opciones={[{ value: "CRC", label: "₡ Colones" }, { value: "USD", label: "$ Dólares" }]}/></Campo>
        </div>
        <Campo etiqueta="Saldo inicial"><Entrada type="number" value={f.saldoInicial} onChange={e => set("saldoInicial", parseFloat(e.target.value) || 0)}/></Campo>
        <Interruptor activo={!!f.activa} onCambio={v => set("activa", v)} etiqueta="Cuenta activa"/>
      </div>
    </Modal>
  );
}

// ── Modal Nota de Débito ──────────────────────────────────────────────────────
function ModalDebito({ nota, cuentas, usuarioActivo, onSave, onClose }) {
  const [f, setF] = useState(nota || {
    numero: "ND-" + Date.now().toString().slice(-6),
    fecha: hoy(), numeroBanco: "", tipo: "Débito bancario",
    numeroCheque: "", monto: 0, tipoCambioDolar: 0, tipoCambioMoneda3: 0,
    giradoPor: "", banco: "", descripcion: "", descripcion2: "", descripcion3: "",
    hechoPor: usuarioActivo || "", revisadoPor: "", autorizadoPor: "", fechaAutorizacion: "",
    numeroAsiento: "", asientoAnulacion: "",
    conciliable: true, contabilizado: false, anulado: false,
    cuentaId: cuentas[0]?.id || "",
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const cuenta = cuentas.find(c => c.id === f.cuentaId);

  return (
    <Modal titulo="Nota de Débito" subtitulo={cuenta ? `${cuenta.numeroCuenta} — ${cuenta.banco?.toUpperCase() || ""}` : undefined} onCerrar={onClose} ancho="max-w-2xl"
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton onClick={() => { if (!f.monto || !f.cuentaId) return; onSave(f); }}>Guardar nota de débito</Boton></>}>
      <div className="space-y-3">
        <Campo etiqueta="Cuenta"><Seleccion value={f.cuentaId} onChange={e => set("cuentaId", e.target.value)} opciones={opcionesCuentas(cuentas)}/></Campo>
        <div className="grid grid-cols-3 gap-3">
          <Campo etiqueta="N° Nota de Débito"><Entrada value={f.numero} onChange={e => set("numero", e.target.value)}/></Campo>
          <Campo etiqueta="N° Según Banco"><Entrada value={f.numeroBanco} onChange={e => set("numeroBanco", e.target.value)}/></Campo>
          <Campo etiqueta="Fecha de Emisión"><Entrada type="date" value={f.fecha} onChange={e => set("fecha", e.target.value)}/></Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Tipo"><Seleccion value={f.tipo} onChange={e => set("tipo", e.target.value)} opciones={TIPOS_DEBITO}/></Campo>
          <Campo etiqueta="N° Cheque"><Entrada value={f.numeroCheque} onChange={e => set("numeroCheque", e.target.value)}/></Campo>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Campo etiqueta={`Monto (${cuenta?.moneda || "CRC"})`}><Entrada type="number" value={f.monto} onChange={e => set("monto", parseFloat(e.target.value) || 0)}/></Campo>
          <Campo etiqueta="T.C. Dólar"><Entrada type="number" value={f.tipoCambioDolar} onChange={e => set("tipoCambioDolar", parseFloat(e.target.value) || 0)}/></Campo>
          <Campo etiqueta="T.C. Moneda 3"><Entrada type="number" value={f.tipoCambioMoneda3} onChange={e => set("tipoCambioMoneda3", parseFloat(e.target.value) || 0)}/></Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Girado Por"><Entrada value={f.giradoPor} onChange={e => set("giradoPor", e.target.value)}/></Campo>
          <Campo etiqueta="Banco Destino"><Entrada value={f.banco} onChange={e => set("banco", e.target.value)}/></Campo>
        </div>
        <Campo etiqueta="Descripción">
          <div className="space-y-2">
            {["descripcion", "descripcion2", "descripcion3"].map((k, i) => (
              <Entrada key={k} value={f[k]} onChange={e => set(k, e.target.value)} placeholder={i === 0 ? "Concepto del débito..." : ""}/>
            ))}
          </div>
        </Campo>
        <Aprobacion f={f} set={set}/>
      </div>
    </Modal>
  );
}

// ── Modal Nota de Crédito ─────────────────────────────────────────────────────
function ModalCredito({ nota, cuentas, usuarioActivo, onSave, onClose }) {
  const [f, setF] = useState(nota || {
    numero: "NC-" + Date.now().toString().slice(-6),
    fecha: hoy(), numeroBanco: "", tipo: "Depósito efectivo",
    montoEfectivo: 0, totalCheques: 0,
    tipoCambioDolar: 0, tipoCambioMoneda3: 0,
    depositante: "", observaciones: "",
    cheques: [],
    hechoPor: usuarioActivo || "", revisadoPor: "", autorizadoPor: "", fechaAutorizacion: "",
    numeroAsiento: "", asientoAnulacion: "",
    conciliable: true, contabilizado: false, anulado: false,
    cuentaId: cuentas[0]?.id || "",
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const cuenta = cuentas.find(c => c.id === f.cuentaId);
  const montoTotal = (f.montoEfectivo || 0) + (f.totalCheques || 0);

  const addCheque = () => setF(p => ({ ...p, cheques: [...(p.cheques||[]), { numero: "", monto: 0, banco: "" }] }));
  const setCheque = (i, k, v) => setF(p => {
    const ch = [...(p.cheques||[])]; ch[i] = { ...ch[i], [k]: v };
    const totCh = ch.reduce((s, c) => s + (parseFloat(c.monto)||0), 0);
    return { ...p, cheques: ch, totalCheques: totCh };
  });
  const delCheque = (i) => setF(p => {
    const ch = p.cheques.filter((_,j)=>j!==i);
    return { ...p, cheques: ch, totalCheques: ch.reduce((s,c)=>s+(parseFloat(c.monto)||0),0) };
  });
  const celda = "w-full bg-transparent border-2 border-transparent hover:border-black/10 focus:border-monki-k rounded-lg px-2 py-1 text-xs outline-none";

  return (
    <Modal titulo="Nota de Crédito" subtitulo={cuenta ? `${cuenta.numeroCuenta} — ${cuenta.banco?.toUpperCase() || ""}` : undefined} onCerrar={onClose} ancho="max-w-2xl"
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton onClick={() => { if (!f.cuentaId) return; onSave({ ...f, montoTotal }); }}>Guardar nota de crédito</Boton></>}>
      <div className="space-y-3">
        <Campo etiqueta="Cuenta"><Seleccion value={f.cuentaId} onChange={e => set("cuentaId", e.target.value)} opciones={opcionesCuentas(cuentas)}/></Campo>
        <div className="grid grid-cols-3 gap-3">
          <Campo etiqueta="N° Nota de Crédito"><Entrada value={f.numero} onChange={e => set("numero", e.target.value)}/></Campo>
          <Campo etiqueta="N° Según Banco"><Entrada value={f.numeroBanco} onChange={e => set("numeroBanco", e.target.value)}/></Campo>
          <Campo etiqueta="Fecha de Emisión"><Entrada type="date" value={f.fecha} onChange={e => set("fecha", e.target.value)}/></Campo>
        </div>
        <Campo etiqueta="Tipo"><Seleccion value={f.tipo} onChange={e => set("tipo", e.target.value)} opciones={TIPOS_CREDITO}/></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta={`Monto Efectivo (${cuenta?.moneda || "CRC"})`}><Entrada type="number" value={f.montoEfectivo} onChange={e => set("montoEfectivo", parseFloat(e.target.value)||0)}/></Campo>
          <Campo etiqueta="Total Cheques"><Entrada type="number" value={f.totalCheques} readOnly className="bg-monki-cream/60 text-monki-k/60"/></Campo>
        </div>
        <div className="bg-monki-k text-white rounded-2xl px-4 py-3 flex justify-between items-center">
          <span className="monki-tag text-white/70">Monto total</span>
          <span className="text-lg font-black text-monki-y tabular-nums">{fmt(montoTotal, cuenta?.moneda)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="T.C. Dólar"><Entrada type="number" value={f.tipoCambioDolar} onChange={e => set("tipoCambioDolar", parseFloat(e.target.value)||0)}/></Campo>
          <Campo etiqueta="T.C. Moneda 3"><Entrada type="number" value={f.tipoCambioMoneda3} onChange={e => set("tipoCambioMoneda3", parseFloat(e.target.value)||0)}/></Campo>
        </div>
        <Campo etiqueta="Depositante"><Entrada value={f.depositante} onChange={e => set("depositante", e.target.value)}/></Campo>
        <Campo etiqueta="Observaciones"><AreaTexto value={f.observaciones} onChange={e => set("observaciones", e.target.value)} rows={2}/></Campo>
        <div className="rounded-2xl border-2 border-black/10 overflow-hidden">
          <div className="bg-monki-cream/60 px-4 py-2 flex justify-between items-center">
            <span className="monki-tag text-monki-k/55">Cheques depositados</span>
            <Boton variante="fantasma" tamano="sm" icono={Plus} onClick={addCheque}>Agregar cheque</Boton>
          </div>
          {(f.cheques||[]).length === 0 ? (
            <p className="text-xs text-monki-k/45 text-center py-3">Sin cheques</p>
          ) : (
            <table className="w-full text-xs">
              <thead><tr className="monki-tag text-monki-k/55">
                <th className="px-3 py-2 text-left">Número</th>
                <th className="px-3 py-2 text-right">Monto</th>
                <th className="px-3 py-2 text-left">Banco</th>
                <th className="px-3 py-2 w-10"></th>
              </tr></thead>
              <tbody>{(f.cheques||[]).map((ch, i) => (
                <tr key={i} className="border-t border-black/5">
                  <td className="px-2 py-1"><input value={ch.numero} onChange={e => setCheque(i,"numero",e.target.value)} className={celda}/></td>
                  <td className="px-2 py-1"><input type="number" value={ch.monto} onChange={e => setCheque(i,"monto",e.target.value)} className={celda + " text-right"}/></td>
                  <td className="px-2 py-1"><input value={ch.banco} onChange={e => setCheque(i,"banco",e.target.value)} className={celda}/></td>
                  <td className="px-2 py-1 text-center"><BotonIcono icono={Trash2} titulo="Quitar cheque" tono="peligro" onClick={() => delCheque(i)}/></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
        <Aprobacion f={f} set={set}/>
      </div>
    </Modal>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function ControlBancarioScreen() {
  const [tab, setTab] = useState("cuentas");
  const [cuentas, setCuentas] = useState([]);
  const [debitos, setDebitos] = useState([]);
  const [creditos, setCreditos] = useState([]);
  const [usuario, setUsuario] = useState("");
  const [modal, setModal] = useState(null); // { tipo, data }
  const [buscar, setBuscar] = useState("");
  const [filtroCuenta, setFiltroCuenta] = useState("todas");
  const { confirmar, dialogo } = useConfirmar();

  const cargar = useCallback(async () => {
    const [c, d, cr, u] = await Promise.all([
      db.getCuentasBancarias(),
      db.getNotasDebitoBanco(),
      db.getNotasCreditoBanco(),
      db.getUsuarioActivo(),
    ]);
    setCuentas(c || []);
    setDebitos(d || []);
    setCreditos(cr || []);
    setUsuario(u?.nombre || u?.username || "");
  }, []);

  useSyncRefresh(cargar);
  useEffect(() => { cargar(); }, [cargar]);

  // Saldo calculado por cuenta
  const saldoCuenta = (cuentaId) => {
    const c = cuentas.find(x => x.id === cuentaId);
    if (!c) return 0;
    const entradas = creditos.filter(n => n.cuentaId === cuentaId && !n.anulado).reduce((s,n)=>s+(n.montoTotal||0),0);
    const salidas  = debitos.filter(n => n.cuentaId === cuentaId && !n.anulado).reduce((s,n)=>s+(n.monto||0),0);
    return (c.saldoInicial || 0) + entradas - salidas;
  };

  // CRUD Cuentas
  const guardarCuenta = async (f) => {
    const lista = [...cuentas];
    if (f.id) { const i = lista.findIndex(x=>x.id===f.id); lista[i]=f; }
    else lista.push({ ...f, id: uid(), creadoEn: new Date().toISOString() });
    await db.setCuentasBancarias(lista);
    setModal(null); cargar();
  };
  const eliminarCuenta = async (id) => {
    if (!(await confirmar("Eliminar cuenta", "¿Eliminar esta cuenta?", { peligro: true, boton: "Eliminar" }))) return;
    await db.setCuentasBancarias(cuentas.filter(x=>x.id!==id));
    cargar();
  };

  // CRUD Débitos
  const guardarDebito = async (f) => {
    const lista = [...debitos];
    if (f.id) { const i = lista.findIndex(x=>x.id===f.id); lista[i]=f; }
    else lista.push({ ...f, id: uid(), creadoEn: new Date().toISOString() });
    await db.setNotasDebitoBanco(lista);
    setModal(null); cargar();
  };
  const eliminarDebito = async (id) => {
    if (!(await confirmar("Anular débito", "¿Anular este débito?", { peligro: true, boton: "Anular" }))) return;
    const lista = debitos.map(x => x.id===id ? {...x, anulado:true} : x);
    await db.setNotasDebitoBanco(lista);
    cargar();
  };

  // CRUD Créditos
  const guardarCredito = async (f) => {
    const lista = [...creditos];
    if (f.id) { const i = lista.findIndex(x=>x.id===f.id); lista[i]=f; }
    else lista.push({ ...f, id: uid(), creadoEn: new Date().toISOString() });
    await db.setNotasCreditoBanco(lista);
    setModal(null); cargar();
  };
  const eliminarCredito = async (id) => {
    if (!(await confirmar("Anular nota de crédito", "¿Anular esta nota de crédito?", { peligro: true, boton: "Anular" }))) return;
    const lista = creditos.map(x => x.id===id ? {...x, anulado:true} : x);
    await db.setNotasCreditoBanco(lista);
    cargar();
  };

  const cuentasActivas = cuentas.filter(c => c.activa !== false);

  const filtrar = (lista) => lista.filter(n => {
    const cuentaOk = filtroCuenta === "todas" || n.cuentaId === filtroCuenta;
    const busOk = !buscar || JSON.stringify(n).toLowerCase().includes(buscar.toLowerCase());
    return cuentaOk && busOk;
  });

  const estadoNota = n => (
    <div className="flex gap-1 flex-wrap">
      {n.anulado && <Estado tono="peligro">Anulado</Estado>}
      {n.conciliable && !n.anulado && <Estado tono="neutro">Conciliable</Estado>}
      {n.contabilizado && <Estado tono="exito">Contabilizado</Estado>}
    </div>
  );
  const columnasNota = (tipo) => [
    { key: "numero", titulo: "N° Nota", render: n => <span className={`font-mono text-xs ${n.anulado ? "opacity-50" : ""}`}>{n.numero}</span> },
    { key: "cuenta", titulo: "Cuenta", render: n => <b className="text-monki-k">{cuentas.find(x=>x.id===n.cuentaId)?.nombre || "—"}</b> },
    { key: "fecha", titulo: "Fecha", render: n => <span className="font-mono text-xs text-monki-k/60">{n.fecha}</span> },
    { key: "tipo", titulo: "Tipo" },
    tipo === "debito"
      ? { key: "giradoPor", titulo: "Girado Por", render: n => n.giradoPor || "—" }
      : { key: "depositante", titulo: "Depositante", render: n => n.depositante || "—" },
    { key: "monto", titulo: tipo === "debito" ? "Monto" : "Monto Total", alinear: "right", render: n => {
      const c = cuentas.find(x=>x.id===n.cuentaId);
      return tipo === "debito"
        ? <b className={`text-red-600 ${n.anulado ? "line-through opacity-50" : ""}`}>−{fmt(n.monto, c?.moneda)}</b>
        : <b className={`text-emerald-700 ${n.anulado ? "line-through opacity-50" : ""}`}>+{fmt(n.montoTotal, c?.moneda)}</b>;
    } },
    { key: "estado", titulo: "Estado", render: estadoNota },
    { key: "acc", titulo: "", alinear: "right", render: n => (
      <div className="flex justify-end gap-1">
        <BotonIcono icono={Pencil} titulo="Editar" onClick={() => setModal({ tipo, data:n })}/>
        {!n.anulado && <BotonIcono icono={Ban} titulo="Anular" tono="peligro" onClick={() => tipo === "debito" ? eliminarDebito(n.id) : eliminarCredito(n.id)}/>}
      </div>
    ) },
  ];
  const saldoTotal = mon => cuentas.filter(c => c.activa !== false && (c.moneda || "CRC") === mon).reduce((s, c) => s + saldoCuenta(c.id), 0);

  return (
    <Modulo
      seccion="Finanzas"
      titulo="Control Bancario"
      descripcion="Cuentas bancarias, notas de débito y notas de crédito con su flujo de aprobación."
      acciones={<>
        {tab === "cuentas" && <Boton icono={Plus} onClick={() => setModal({ tipo:"cuenta", data:null })}>Nueva cuenta</Boton>}
        {tab === "debitos" && <Boton icono={Plus} disabled={cuentasActivas.length===0} onClick={() => setModal({ tipo:"debito", data:null })}>Nota de débito</Boton>}
        {tab === "creditos" && <Boton icono={Plus} disabled={cuentasActivas.length===0} onClick={() => setModal({ tipo:"credito", data:null })}>Nota de crédito</Boton>}
      </>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Saldo en colones" valor={fmt(saldoTotal("CRC"), "CRC")} icono={Landmark} destacado delay={40}/>
          <Indicador etiqueta="Saldo en dólares" valor={fmt(saldoTotal("USD"), "USD")} delay={80}/>
          <Indicador etiqueta="Débitos vigentes" valor={debitos.filter(n => !n.anulado).length} icono={ArrowUpFromLine} delay={120}/>
          <Indicador etiqueta="Créditos vigentes" valor={creditos.filter(n => !n.anulado).length} icono={ArrowDownToLine} delay={160}/>
        </Indicadores>
      }
      pestanas={{ activa: tab, onCambiar: setTab, items: [
        { key: "cuentas", label: "Cuentas", cuenta: cuentas.length },
        { key: "debitos", label: "Notas de débito", cuenta: debitos.length },
        { key: "creditos", label: "Notas de crédito", cuenta: creditos.length },
      ] }}
    >
      {tab !== "cuentas" && (
        <BarraFiltros>
          <Buscador valor={buscar} onCambio={setBuscar}/>
          <Selector valor={filtroCuenta} onCambio={setFiltroCuenta} opciones={[{ value: "todas", label: "Todas las cuentas" }, ...cuentas.map(c => ({ value: c.id, label: c.nombre }))]}/>
        </BarraFiltros>
      )}

      {tab === "cuentas" && (
        <div className="flex-1 overflow-auto -mx-1 px-1 pb-1">
          {cuentas.length === 0 ? (
            <Tarjeta className="h-full flex items-center justify-center">
              <Vacio icono={Landmark} titulo="Sin cuentas bancarias" texto="Agregá tu primera cuenta para empezar."
                accion={<Boton icono={Plus} onClick={() => setModal({ tipo:"cuenta", data:null })}>Nueva cuenta</Boton>}/>
            </Tarjeta>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {cuentas.map((c, i) => {
                const saldo = saldoCuenta(c.id);
                const negativo = saldo < 0;
                return (
                  <div key={c.id} style={{ animationDelay: `${Math.min(i,8)*40}ms` }}
                    className={`animate-entrar bg-white rounded-[18px] border-2 border-black/10 p-5 transition-all duration-300 ease-monki hover:border-monki-k hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#111] ${c.activa===false ? "opacity-60" : ""}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="min-w-0">
                        <b className="text-monki-k">{c.nombre}</b>
                        <p className="text-xs text-monki-k/50 font-mono mt-0.5">{c.numeroCuenta}</p>
                      </div>
                      <Estado tono={c.moneda==="USD" ? "oscuro" : "alerta"} punto={false}>{c.moneda}</Estado>
                    </div>
                    <p className="monki-tag text-monki-k/45 mb-1">{c.banco || "—"}</p>
                    <p className={`text-[26px] font-black tracking-[-0.03em] tabular-nums ${negativo ? "text-red-600" : "text-monki-k"}`}>{fmt(saldo, c.moneda)}</p>
                    <p className="text-xs text-monki-k/45 mt-1">Saldo inicial: {fmt(c.saldoInicial, c.moneda)}</p>
                    <div className="flex gap-2 mt-4 pt-3 border-t-2 border-black/5">
                      <Boton variante="secundario" tamano="sm" icono={Pencil} className="flex-1" onClick={() => setModal({ tipo:"cuenta", data:c })}>Editar</Boton>
                      <Boton variante="peligro" tamano="sm" icono={Trash2} className="flex-1" onClick={() => eliminarCuenta(c.id)}>Eliminar</Boton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "debitos" && (
        <Tabla columnas={columnasNota("debito")} filas={filtrar(debitos).sort((a,b)=>b.fecha.localeCompare(a.fecha))}
          vacio={<Vacio icono={ArrowUpFromLine} titulo="Sin notas de débito"/>}/>
      )}
      {tab === "creditos" && (
        <Tabla columnas={columnasNota("credito")} filas={filtrar(creditos).sort((a,b)=>b.fecha.localeCompare(a.fecha))}
          vacio={<Vacio icono={ArrowDownToLine} titulo="Sin notas de crédito"/>}/>
      )}

      {modal?.tipo === "cuenta" && (
        <ModalCuenta cuenta={modal.data} onSave={guardarCuenta} onClose={() => setModal(null)} />
      )}
      {modal?.tipo === "debito" && (
        <ModalDebito nota={modal.data} cuentas={cuentasActivas} usuarioActivo={usuario}
          onSave={guardarDebito} onClose={() => setModal(null)} />
      )}
      {modal?.tipo === "credito" && (
        <ModalCredito nota={modal.data} cuentas={cuentasActivas} usuarioActivo={usuario}
          onSave={guardarCredito} onClose={() => setModal(null)} />
      )}
      {dialogo}
    </Modulo>
  );
}
