import { getAutorSync } from "../utils/auth";
/**
 * CXPScreen — Cuentas por Pagar (desktop)
 * Idéntico a CXCScreen pero filtra tipo === "pagar"
 */
import React, { useState, useEffect, useCallback } from "react";
import ClienteAutocomplete from "../components/ClienteAutocomplete";
import { Plus, Trash2, Ban, HandCoins, AlertTriangle, CreditCard } from "lucide-react";
import { Modulo, Boton, BarraFiltros, Buscador, Vacio, Estado, Indicadores, Indicador, Modal, Campo, Entrada, Seleccion, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate, hoy, genId, fechaLocal, fechaDesplazada } from "../utils/fmt";
import { cancelarEventoCalendario, crearEvento } from "../utils/clienteUtils";

const ESTADO = (d) => {
  if (d.estado === "anulada") return { label: "Anulada", tono: "neutro" };
  const s = Math.max(0, d.total - (d.pagado || 0));
  if (s <= 0) return { label: "Pagada", tono: "exito" };
  if (d.fechaVencimiento && d.fechaVencimiento < hoy()) return { label: "Vencida", tono: "peligro" };
  if ((d.pagado || 0) > 0) return { label: "Parcial", tono: "alerta" };
  return { label: "Pendiente", tono: "neutro" };
};

function NuevaCXPModal({ onClose, onSave, settings }) {
  const [nombre, setNombre] = useState("");
  const [total,  setTotal]  = useState("");
  const [moneda, setMoneda] = useState(settings.moneda || "CRC");
  const [vence,  setVence]  = useState("");
  const [notas,  setNotas]  = useState("");

  const guardar = async () => {
    if (!nombre.trim() || !total) return;
    const todos = await db.getDebts();
    const nueva = {
      id: genId(), tipo: "pagar", nombre: nombre.trim(), total: parseFloat(total),
      pagado: 0, pagos: [], moneda, fechaVencimiento: vence || null,
      notas: notas.trim(), creadoEn: new Date().toISOString(), creadoPor: getAutorSync(),
    };
    await db.setDebts([nueva, ...todos]);

    // Crear evento en el calendario
    if (vence) {
      const { getToken } = await import("../utils/auth");
      const token = await getToken();
      const montoFmt = parseFloat(total).toLocaleString("es-CR", { style: "currency", currency: "CRC", minimumFractionDigits: 0 });
      await crearEvento({ token, titulo: `🧾 Pago: ${nombre.trim()}`, descripcion: `Vence por ${montoFmt}.`, fecha: vence, tipo: "recordatorio", color: "#ef4444" });
      // Recordatorio 3 días antes
      const antesStr = fechaDesplazada(vence, -3);
      if (antesStr > fechaLocal(new Date())) {
        await crearEvento({ token, titulo: `⏰ Pago próximo: ${nombre.trim()}`, descripcion: `Vence en 3 días (${vence}). ${montoFmt}`, fecha: antesStr, tipo: "recordatorio", color: "#f97316" });
      }
    }

    onSave(); onClose();
  };

  return (
    <Modal titulo="Nueva cuenta por pagar" subtitulo="Lo que le debés a un proveedor" onCerrar={onClose} ancho="max-w-md"
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton onClick={guardar}>Guardar</Boton></>}>
      <div className="space-y-4">
        <Campo etiqueta="Proveedor *">
          <ClienteAutocomplete
            value={nombre}
            onChange={(c, str) => {
              setNombre(str);
              if (c && c.dias_credito > 0) {
                const d = new Date();
                d.setDate(d.getDate() + c.dias_credito);
                setVence(fechaLocal(d));
              }
            }}
            tipo="proveedor"
            ringColor="focus:ring-monki-y"
          />
        </Campo>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Campo etiqueta="Monto *"><Entrada type="number" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0"/></Campo>
          <Campo etiqueta="Moneda"><Seleccion value={moneda} onChange={(e) => setMoneda(e.target.value)} opciones={[{value:"CRC",label:"₡ CRC"},{value:"USD",label:"$ USD"}]}/></Campo>
        </div>
        <Campo etiqueta="Fecha de vencimiento"><Entrada type="date" value={vence} onChange={(e) => setVence(e.target.value)}/></Campo>
        <Campo etiqueta="Referencia / notas"><Entrada value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Número de factura del proveedor…"/></Campo>
      </div>
    </Modal>
  );
}

function PagoCXPModal({ deuda, settings, token, onClose, onSave }) {
  const [monto,  setMonto]  = useState("");
  const [metodo, setMetodo] = useState("Transferencia");
  const [fecha,  setFecha]  = useState(hoy());
  const [notas,  setNotas]  = useState("");

  const saldo = Math.max(0, deuda.total - (deuda.pagado || 0));
  const mon   = deuda.moneda || settings.moneda || "CRC";

  const guardar = async () => {
    const m = parseFloat(monto);
    if (!m || m <= 0) return;
    const todos = await db.getDebts();
    const pago  = { id: genId(), fecha, monto: m, metodo, notas, creadoEn: new Date().toISOString(), creadoPor: getAutorSync() };
    const upd   = todos.map((x) =>
      x.id !== deuda.id ? x : { ...x, pagado: (x.pagado || 0) + m, pagos: [...(x.pagos || []), pago] }
    );
    await db.setDebts(upd);

    // Si queda saldada → eliminar eventos de calendario relacionados
    const nuevoPagado = (deuda.pagado || 0) + m;
    if (nuevoPagado >= deuda.total - 0.01 && token) {
      await cancelarEventoCalendario({ token, tituloMatch: `Pago: ${deuda.nombre}`, fecha: deuda.fechaVencimiento });
      await cancelarEventoCalendario({ token, tituloMatch: `Pago próximo: ${deuda.nombre}` });
    }

    onSave(); onClose();
  };

  return (
    <Modal titulo="Registrar pago a proveedor" subtitulo={`${deuda.nombre} — saldo ${fmtMoney(saldo, mon)}`} onCerrar={onClose} ancho="max-w-md"
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton icono={HandCoins} onClick={guardar}>Guardar pago</Boton></>}>
      <div className="space-y-4">
        <Campo etiqueta={`Monto (${mon})`}><Entrada type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0" max={saldo}/></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Método"><Seleccion value={metodo} onChange={e => setMetodo(e.target.value)} opciones={["Transferencia","SINPE Móvil","Efectivo","Tarjeta","Cheque"]}/></Campo>
          <Campo etiqueta="Fecha"><Entrada type="date" value={fecha} onChange={e => setFecha(e.target.value)}/></Campo>
        </div>
        <Campo etiqueta="Notas"><Entrada value={notas} onChange={e => setNotas(e.target.value)} placeholder="Referencia, comprobante…"/></Campo>
      </div>
    </Modal>
  );
}

export default function CXPScreen() {
  const [debts,    setDebts]    = useState([]);
  const [settings, setSettings] = useState({});
  const [busq,     setBusq]     = useState("");
  const [selected, setSelected] = useState(null);
  const [modal,    setModal]    = useState(null); // "nueva" | { deuda }
  const [filtro,   setFiltro]   = useState("todos");
  const [token,    setToken]    = useState(null);

  const cargar = useCallback(async () => {
    const [d, s] = await Promise.all([db.getDebts(), db.getSettings()]);
    setDebts(d.filter((x) => (x.tipo || "pagar") === "pagar"));
    setSettings(s);
    import("../utils/auth").then(m => m.getToken()).then(setToken);
  }, []);

  const { confirmar, dialogo } = useConfirmar();
  const anular = async () => {
    if (!sel) return;
    if (!(await confirmar("Anular cuenta por pagar", `¿Anular la CXP de ${sel.nombre}? Quedará marcada como anulada.`, { peligro: true, boton: "Anular" }))) return;
    const todos = await db.getDebts();
    await db.setDebts(todos.map(x => x.id === sel.id ? { ...x, estado: "anulada" } : x));
    cargar();
  };

  const eliminar = async (d) => {
    if (!(await confirmar("Eliminar cuenta por pagar", `¿Eliminar la CXP de ${d.nombre}? Esta acción no se puede deshacer.`, { peligro: true, boton: "Eliminar" }))) return;
    const todos = await db.getDebts();
    await db.setDebts(todos.filter((x) => x.id !== d.id));
    try {
      const { getToken } = await import("../utils/auth");
      const tkn = await getToken();
      if (tkn) {
        await cancelarEventoCalendario({ token: tkn, tituloMatch: `Pago: ${d.nombre}`, fecha: d.fechaVencimiento });
        await cancelarEventoCalendario({ token: tkn, tituloMatch: `Pago próximo: ${d.nombre}` });
      }
    } catch {}
    setSelected(null);
    cargar();
  };

  useEffect(() => { cargar(); }, [cargar]);

  const busqL = busq.trim().toLowerCase();
  const visibles = debts
    .filter((d) => {
      if (busqL && !d.nombre?.toLowerCase().includes(busqL) && !d.notas?.toLowerCase().includes(busqL)) return false;
      if (filtro === "pendientes") return Math.max(0, d.total - (d.pagado || 0)) > 0;
      if (filtro === "vencidas")  return d.fechaVencimiento && d.fechaVencimiento < hoy() && Math.max(0, d.total - (d.pagado || 0)) > 0;
      if (filtro === "pagadas")   return Math.max(0, d.total - (d.pagado || 0)) <= 0;
      return true;
    })
    .sort((a, b) => (b.creadoEn || "").localeCompare(a.creadoEn || ""));

  const totCRC = visibles.filter((d) => (d.moneda || "CRC") === "CRC").reduce((s, d) => s + Math.max(0, d.total - (d.pagado || 0)), 0);
  const totUSD = visibles.filter((d) => d.moneda === "USD").reduce((s, d) => s + Math.max(0, d.total - (d.pagado || 0)), 0);
  const sel = visibles.find((d) => d.id === selected);

  const vencidas = debts.filter(d => d.estado !== "anulada" && d.fechaVencimiento && d.fechaVencimiento < hoy() && Math.max(0, d.total - (d.pagado || 0)) > 0).length;
  const TH = "monki-tag text-monki-k/55 font-semibold px-4 py-3 border-b-2 border-black/10 text-left whitespace-nowrap";
  const saldoSel = sel ? Math.max(0, sel.total - (sel.pagado || 0)) : 0;

  return (
    <Modulo
      seccion="Contabilidad"
      titulo="Cuentas por pagar"
      descripcion="Lo que le debés a tus proveedores, con sus vencimientos y pagos."
      acciones={<Boton icono={Plus} onClick={() => setModal("nueva")}>Nueva cuenta</Boton>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Por pagar CRC" valor={fmtMoney(totCRC,"CRC")} icono={CreditCard} destacado delay={40}/>
          <Indicador etiqueta="Por pagar USD" valor={fmtMoney(totUSD,"USD")} delay={90}/>
          <Indicador etiqueta="Vencidas" valor={vencidas} icono={AlertTriangle} alerta={vencidas>0} delay={140} onClick={() => setFiltro("vencidas")}/>
          <Indicador etiqueta="Cuentas" valor={debts.length} detalle="Registradas" delay={190}/>
        </Indicadores>
      }
      pestanas={{ activa: filtro, onCambiar: setFiltro, items: [
        { key: "todos", label: "Todas" }, { key: "pendientes", label: "Pendientes" }, { key: "vencidas", label: "Vencidas" }, { key: "pagadas", label: "Pagadas" },
      ] }}
    >
      <BarraFiltros resumen={`${visibles.length} cuenta${visibles.length!==1?"s":""}`}>
        <Buscador valor={busq} onCambio={setBusq} placeholder="Buscar por proveedor o referencia…"/>
      </BarraFiltros>

      {sel && (
        <div className="animate-desplegar mb-3 flex flex-wrap items-center gap-3 bg-monki-k text-white rounded-2xl px-4 py-2.5 text-sm">
          <span className="monki-tag text-monki-y">Seleccionada</span>
          <b>{sel.nombre}</b>
          <span className="text-white/60">Saldo <b className="text-monki-y">{fmtMoney(saldoSel, sel.moneda||"CRC")}</b></span>
          <span className="text-white/60">Vence {fmtDate(sel.fechaVencimiento)}</span>
          <div className="flex-1"/>
          <Boton variante="amarillo" tamano="sm" icono={HandCoins} disabled={saldoSel <= 0} onClick={() => setModal({ deuda: sel })}>Pagar</Boton>
          <Boton variante="secundario" tamano="sm" icono={Ban} disabled={sel.estado === "anulada"} onClick={anular}>Anular</Boton>
          <Boton variante="peligro" tamano="sm" icono={Trash2} onClick={() => eliminar(sel)}>Eliminar</Boton>
        </div>
      )}

      <div className="ui-tarjeta flex-1 min-h-0 bg-white rounded-[18px] border-2 border-black/10 overflow-hidden flex flex-col">
        {/* Celular: tarjetas */}
        <div className="md:hidden flex-1 min-h-0 overflow-auto p-2 space-y-2">
          {visibles.length === 0 ? (
            <Vacio icono={CreditCard} titulo="Sin cuentas por pagar" texto={debts.length ? "Probá con otra búsqueda o filtro." : "Registrá lo que le debés a tus proveedores."}
              accion={!debts.length && <Boton icono={Plus} onClick={() => setModal("nueva")}>Nueva cuenta</Boton>}/>
          ) : visibles.map((d, i) => {
            const mon = d.moneda || settings.moneda || "CRC";
            const saldo = Math.max(0, d.total - (d.pagado || 0));
            const est = ESTADO(d);
            const isSel = selected === d.id;
            const vencida = d.fechaVencimiento && d.fechaVencimiento < hoy() && saldo > 0;
            return (
              <button key={d.id} onClick={() => setSelected(isSel ? null : d.id)} style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
                className={`animate-desplegar w-full text-left rounded-2xl border-2 p-3 ${isSel ? "bg-[#FFF4B8] border-monki-y" : "bg-white border-black/10"} ${d.estado === "anulada" ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <b className="block truncate text-monki-k">{d.nombre}</b>
                    <span className="text-[11px] text-monki-k/50">{d.notas || "—"}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <b className={`block tabular-nums ${saldo > 0 ? "text-red-600" : ""}`}>{fmtMoney(saldo, mon)}</b>
                    <span className="text-[10px] text-monki-k/45">de {fmtMoney(d.total, mon)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <Estado tono={est.tono}>{est.label}</Estado>
                  <span className={`text-[11px] ${vencida ? "text-red-600 font-bold" : "text-monki-k/50"}`}>Vence {fmtDate(d.fechaVencimiento) || "—"}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="hidden md:block flex-1 min-h-0 overflow-auto">
          <table className="ui-tabla w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>{["Proveedor","Referencia","Total","Pagado","Saldo","Vencimiento","Estado"].map(t => <th key={t} className={TH + (["Total","Pagado","Saldo"].includes(t) ? " !text-right" : "")}>{t}</th>)}</tr>
            </thead>
            <tbody>
              {visibles.length === 0 ? (
                <tr><td colSpan={7}><Vacio icono={CreditCard} titulo="Sin cuentas por pagar" texto={debts.length ? "Probá con otra búsqueda o filtro." : "Registrá lo que le debés a tus proveedores."}
                  accion={!debts.length && <Boton icono={Plus} onClick={() => setModal("nueva")}>Nueva cuenta</Boton>}/></td></tr>
              ) : visibles.map((d) => {
                const mon = d.moneda || settings.moneda || "CRC";
                const saldo = Math.max(0, d.total - (d.pagado || 0));
                const est = ESTADO(d);
                const isSel = selected === d.id;
                const esAnulada = d.estado === "anulada";
                return (
                  <React.Fragment key={d.id}>
                    <tr onClick={() => setSelected(isSel ? null : d.id)}
                      className={`ui-fila animate-desplegar cursor-pointer border-b border-black/5 transition-colors ${isSel ? "bg-[#FFF4B8]" : esAnulada ? "opacity-50 hover:bg-monki-cream/60" : "hover:bg-monki-cream/60"}`}>
                      <td className="px-4 py-2.5"><b className={esAnulada ? "line-through text-monki-k/35" : "text-monki-k"}>{d.nombre}</b>{d.creadoPor && <div className="text-[10px] text-monki-k/45">Por {d.creadoPor}</div>}</td>
                      <td className="px-4 py-2.5 text-monki-k/50 text-xs">{d.notas || "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(d.total, mon)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-monki-k/60">{fmtMoney(d.pagado || 0, mon)}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-black ${saldo > 0 ? "text-red-600" : ""}`}>{fmtMoney(saldo, mon)}</td>
                      <td className={`px-4 py-2.5 ${d.fechaVencimiento && d.fechaVencimiento < hoy() && saldo > 0 ? "text-red-600 font-bold" : "text-monki-k/55"}`}>{fmtDate(d.fechaVencimiento)}</td>
                      <td className="px-4 py-2.5"><Estado tono={est.tono}>{est.label}</Estado></td>
                    </tr>
                    {isSel && (
                      <tr className="animate-desplegar">
                        <td colSpan={7} className="bg-monki-cream/70 px-6 py-3">
                          <p className="monki-tag text-monki-k/55 mb-2">Pagos registrados</p>
                          {(d.pagos || []).length === 0 ? <p className="text-sm text-monki-k/40">Sin pagos registrados.</p> : (
                            <div className="space-y-1.5">
                              {(d.pagos || []).map((p, i) => (
                                <div key={p.id || i} className="flex flex-wrap items-center gap-3 bg-white rounded-xl px-3 py-2 text-sm">
                                  <span className="text-monki-k/55">{p.fecha}</span>
                                  <Estado>{p.metodo}</Estado>
                                  <b className="ml-auto">{fmtMoney(p.monto, mon)}</b>
                                  {p.notas && <span className="text-monki-k/40 text-xs w-full">{p.notas}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal === "nueva" && <NuevaCXPModal settings={settings} onClose={() => setModal(null)} onSave={cargar} />}
      {modal?.deuda && <PagoCXPModal deuda={modal.deuda} settings={settings} token={token} onClose={() => setModal(null)} onSave={cargar} />}
      {dialogo}
    </Modulo>
  );
}
