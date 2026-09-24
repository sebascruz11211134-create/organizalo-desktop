import { getAutorSync } from "../utils/auth";
/**
 * CXCScreen — Cuentas por Cobrar (desktop)
 * Tabla con todas las CXC, modal de pago, historial de recibos.
 */
import React, { useState, useEffect, useCallback } from "react";
import ClienteAutocomplete from "../components/ClienteAutocomplete";
import { Plus, Printer, FileSpreadsheet, Trash2, Ban, Wallet, AlertTriangle, Receipt } from "lucide-react";
import { Modulo, Boton, BarraFiltros, Buscador, Vacio, Estado, Indicadores, Indicador, Modal, Campo, Entrada, Seleccion, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate, hoy, genId, fechaLocal, fechaDesplazada } from "../utils/fmt";
import { printHTML, exportExcel, htmlReporteCXC, sheetsReporteCXC } from "../utils/reportHelpers";
import { cancelarEventoCalendario, crearEvento } from "../utils/clienteUtils";

const ESTADO = (d) => {
  if (d.estado === "anulada") return { label: "Anulada", tono: "neutro" };
  const s = Math.max(0, d.total - (d.pagado || 0));
  if (s <= 0) return { label: "Saldada", tono: "exito" };
  if (d.fechaVencimiento && d.fechaVencimiento < hoy()) return { label: "Vencida", tono: "peligro" };
  if ((d.pagado || 0) > 0) return { label: "Parcial", tono: "alerta" };
  return { label: "Pendiente", tono: "neutro" };
};

/**
 * ReciboCXCModal — estilo BOS
 * Seleccionás el cliente → salen todas sus facturas pendientes en la grilla
 * → ingresás el monto aplicado por factura → guardás un solo recibo.
 */
export function ReciboCXCModal({ clienteInicial, allDebts, onClose, onSave, settings, token }) {
  const [cliente,  setCliente]  = useState(clienteInicial?.nombre || "");
  const [metodo,   setMetodo]   = useState("Transferencia");
  const [fecha,    setFecha]    = useState(hoy());
  const [notas,    setNotas]    = useState("");
  const [aplicado, setAplicado] = useState({}); // { cxcId: monto }

  const mon = settings.moneda || "CRC";

  // Facturas pendientes del cliente seleccionado
  const pendientes = allDebts.filter(d =>
    d.tipo !== "pagar" &&
    d.estado !== "anulada" &&
    d.nombre?.toLowerCase() === cliente.toLowerCase() &&
    Math.max(0, d.total - (d.pagado || 0)) > 0
  );

  const totalAplicado = Object.values(aplicado).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  const setLinea = (id, val) => setAplicado(p => ({ ...p, [id]: val }));

  // Cuando cambia el cliente, resetear aplicados
  const handleClienteChange = (nombre) => {
    setCliente(nombre);
    setAplicado({});
  };

  const guardar = async () => {
    if (!cliente.trim()) return;
    const lineas = pendientes
      .map(d => ({ deuda: d, monto: parseFloat(aplicado[d.id]) || 0 }))
      .filter(l => l.monto > 0);
    if (lineas.length === 0) return;

    const todos  = await db.getDebts();
    const num    = `RC-${String(Date.now()).slice(-5)}`;
    const recibosAct = await db.getRecibos();
    const asientosAct = await db.getAsientos();

    // Actualizar cada deuda y generar los recibos individuales
    let updatedDebts = [...todos];
    const nuevosRecibos = [];
    let totalRecibo = 0;

    for (const { deuda, monto } of lineas) {
      const pago = { id: genId(), numero: num, fecha, monto, metodo, notas, creadoEn: new Date().toISOString(), creadoPor: getAutorSync() };
      updatedDebts = updatedDebts.map(x =>
        x.id !== deuda.id ? x : { ...x, pagado: (x.pagado || 0) + monto, pagos: [...(x.pagos || []), pago] }
      );
      nuevosRecibos.push({
        id: genId(), numero: num, fecha, monto, metodo,
        concepto: `Cobro CXC — ${deuda.nombre}${deuda.facturaRef ? ` (${deuda.facturaRef})` : ""}`,
        cliente: deuda.nombre, notas,
        facturaRef: deuda.facturaRef || null,
        cxcId: deuda.id,
        moneda: deuda.moneda || mon,
        creadoEn: new Date().toISOString(), creadoPor: getAutorSync(),
      });
      totalRecibo += monto;

      // Cancelar evento si queda saldado
      const nuevoPagado = (deuda.pagado || 0) + monto;
      if (nuevoPagado >= deuda.total - 0.01 && token) {
        cancelarEventoCalendario({ token, tituloMatch: `Cobro: ${deuda.nombre}`, fecha: deuda.fechaVencimiento }).catch(()=>{});
        cancelarEventoCalendario({ token, tituloMatch: `Cobro próximo: ${deuda.nombre}` }).catch(()=>{});
      }
    }

    await db.setDebts(updatedDebts);
    await db.setRecibos([...nuevosRecibos, ...recibosAct]);

    // Asiento contable de cobro total
    try {
      const numAJ = `AJ-${String(asientosAct.length + 1).padStart(5, "0")}`;
      await db.setAsientos([...asientosAct, {
        id: genId(), numero: numAJ, estado: "confirmado", autoGenerado: true,
        descripcion: `Cobro CXC — ${cliente} (${num})`,
        fecha, totalDebe: totalRecibo, totalHaber: totalRecibo,
        lineas: [
          { cuentaCodigo: "1101", cuentaNombre: "Caja / Efectivo",    debe: totalRecibo, haber: 0 },
          { cuentaCodigo: "1201", cuentaNombre: "Cuentas por cobrar", debe: 0, haber: totalRecibo },
        ],
        creadoEn: new Date().toISOString(), creadoPor: getAutorSync(),
      }]);
    } catch (e) { console.warn("[CXC] asiento:", e.message); }

    onSave();
    onClose();
  };

  const METODOS = ["Transferencia","SINPE Móvil","Efectivo","Tarjeta","Cheque","Otro"];

  // Clientes únicos para el autocomplete
  const clientesUnicos = [...new Set(allDebts.filter(d => d.tipo !== "pagar" && d.estado !== "anulada").map(d => d.nombre).filter(Boolean))].sort();

  const saldoCliente = pendientes.reduce((s,d) => s + Math.max(0, d.total-(d.pagado||0)), 0);
  const TH = "monki-tag text-[10px] text-monki-k/50 font-medium px-3 py-2.5 border-b-2 border-black/10";
  return (
    <Modal titulo="Recibo de cobro" subtitulo="Elegí el cliente y aplicá el pago a sus facturas pendientes" onCerrar={onClose} ancho="max-w-3xl"
      pie={<>
        <div className="mr-auto flex flex-wrap gap-2 text-sm">
          <span className="bg-white rounded-full px-3 py-1">Saldo del cliente <b className="text-red-600">{fmtMoney(saldoCliente, mon)}</b></span>
          <span className="bg-monki-k text-monki-y rounded-full px-3 py-1 font-black">Aplicado {fmtMoney(totalAplicado, mon)}</span>
        </div>
        <Boton variante="fantasma" onClick={onClose}>Cancelar</Boton>
        <Boton icono={Receipt} disabled={totalAplicado <= 0} onClick={guardar}>Guardar recibo</Boton>
      </>}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Campo etiqueta="Cliente *" className="col-span-2">
          <Entrada list="cxc-clientes" value={cliente} onChange={e => handleClienteChange(e.target.value)} placeholder="Nombre del cliente…"/>
          <datalist id="cxc-clientes">{clientesUnicos.map(c => <option key={c} value={c}/>)}</datalist>
        </Campo>
        <Campo etiqueta="Fecha"><Entrada type="date" value={fecha} onChange={e => setFecha(e.target.value)}/></Campo>
        <Campo etiqueta="Método"><Seleccion value={metodo} onChange={e => setMetodo(e.target.value)} opciones={METODOS}/></Campo>
        <Campo etiqueta="Observación" className="col-span-2 md:col-span-4"><Entrada value={notas} onChange={e => setNotas(e.target.value)} placeholder="N.° de transferencia, comprobante…"/></Campo>
      </div>
      <div className="border-2 border-black/10 rounded-2xl overflow-hidden">
        {cliente.trim() === "" ? (
          <p className="text-center text-monki-k/45 py-10 text-sm">Escribí el nombre del cliente para ver sus facturas pendientes.</p>
        ) : pendientes.length === 0 ? (
          <p className="text-center text-monki-k/45 py-10 text-sm">Este cliente no tiene facturas pendientes.</p>
        ) : (
          <div className="max-h-[40vh] overflow-auto">
            <table className="ui-tabla w-full text-sm">
              <thead className="sticky top-0 bg-white z-10"><tr>
                <th className={TH+" text-left"}>Factura / ref.</th><th className={TH+" text-left"}>Fecha</th><th className={TH+" text-left"}>Vence</th>
                <th className={TH+" text-right"}>Saldo ant.</th><th className={TH+" text-center w-32"}>Aplicado</th><th className={TH+" text-right"}>Saldo post.</th>
              </tr></thead>
              <tbody>
                {pendientes.map(d => {
                  const saldoAnt  = Math.max(0, d.total - (d.pagado || 0));
                  const aplic     = parseFloat(aplicado[d.id]) || 0;
                  const saldoPost = Math.max(0, saldoAnt - aplic);
                  const vencida   = d.fechaVencimiento && d.fechaVencimiento < hoy();
                  const dmon      = d.moneda || mon;
                  return (
                    <tr key={d.id} className={`border-t border-black/5 transition-colors ${aplic > 0 ? "bg-[#FFF4B8]" : vencida ? "bg-red-50" : ""}`}>
                      <td className="px-3 py-2 font-mono text-xs font-bold">{d.facturaRef || d.notas || "—"}</td>
                      <td className="px-3 py-2 text-monki-k/55"><div>{fmtDate(d.creadoEn?.slice(0,10))}</div>{d.creadoPor && <div className="text-[10px] text-monki-k/40">Por {d.creadoPor}</div>}</td>
                      <td className={`px-3 py-2 ${vencida ? "text-red-600 font-bold" : "text-monki-k/55"}`}>{fmtDate(d.fechaVencimiento)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtMoney(saldoAnt, dmon)}</td>
                      <td className="px-3 py-2 text-center">
                        <input type="number" min="0" max={saldoAnt} value={aplicado[d.id] ?? ""} onChange={e => setLinea(d.id, e.target.value)} placeholder="0"
                          className="w-full bg-white border-2 border-monki-k/20 hover:border-monki-k rounded-xl px-2 py-1 text-center text-sm font-bold"/>
                      </td>
                      <td className={`px-3 py-2 text-right font-black tabular-nums ${saldoPost > 0 ? "text-red-600" : ""}`}>{fmtMoney(saldoPost, dmon)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

function NuevaCXCModal({ onClose, onSave, settings }) {
  const [nombre,   setNombre]   = useState("");
  const [total,    setTotal]    = useState("");
  const [moneda,   setMoneda]   = useState(settings.moneda || "CRC");
  const [vence,    setVence]    = useState("");
  const [notas,    setNotas]    = useState("");

  const guardar = async () => {
    if (!nombre.trim() || !total) return;
    const todos = await db.getDebts();
    const nueva = {
      id: genId(), tipo: "cobrar", nombre: nombre.trim(), total: parseFloat(total),
      pagado: 0, pagos: [], moneda, fechaVencimiento: vence || null,
      notas: notas.trim(), creadoEn: new Date().toISOString(), creadoPor: getAutorSync(),
    };
    await db.setDebts([nueva, ...todos]);

    // Crear evento en el calendario
    if (vence) {
      const { getToken } = await import("../utils/auth");
      const token = await getToken();
      const montoFmt = parseFloat(total).toLocaleString("es-CR", { style: "currency", currency: "CRC", minimumFractionDigits: 0 });
      await crearEvento({ token, titulo: `💰 Cobro: ${nombre.trim()}`, descripcion: `Vence por ${montoFmt}.`, fecha: vence, tipo: "recordatorio", color: "#10b981" });
      // Recordatorio 3 días antes
      const antesStr = fechaDesplazada(vence, -3);
      if (antesStr > fechaLocal(new Date())) {
        await crearEvento({ token, titulo: `⏰ Cobro próximo: ${nombre.trim()}`, descripcion: `Vence en 3 días (${vence}). ${montoFmt}`, fecha: antesStr, tipo: "recordatorio", color: "#f59e0b" });
      }
    }

    onSave(); onClose();
  };

  return (
    <Modal titulo="Nueva cuenta por cobrar" subtitulo="Lo que un cliente te debe" onCerrar={onClose} ancho="max-w-md"
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton onClick={guardar}>Guardar</Boton></>}>
      <div className="space-y-4">
        <Campo etiqueta="Cliente *">
          <ClienteAutocomplete
            value={nombre}
            onChange={(c, str) => {
              setNombre(str);
              if (c && c.dias_credito > 0) {
                // auto-sugerir fecha de vencimiento según plazo del cliente
                const d = new Date();
                d.setDate(d.getDate() + c.dias_credito);
                setVence(fechaLocal(d));
              }
            }}
            tipo="cliente"
          />
        </Campo>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Campo etiqueta="Monto *"><Entrada type="number" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0"/></Campo>
          <Campo etiqueta="Moneda"><Seleccion value={moneda} onChange={(e) => setMoneda(e.target.value)} opciones={[{value:"CRC",label:"₡ CRC"},{value:"USD",label:"$ USD"}]}/></Campo>
        </div>
        <Campo etiqueta="Fecha de vencimiento"><Entrada type="date" value={vence} onChange={(e) => setVence(e.target.value)}/></Campo>
        <Campo etiqueta="Referencia / notas"><Entrada value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Número de factura, descripción…"/></Campo>
      </div>
    </Modal>
  );
}

export default function CXCScreen() {
  const [debts,       setDebts]       = useState([]);
  const [settings,    setSettings]    = useState({});
  const [contactoMap, setContactoMap] = useState({}); // nombre → dias_credito
  const [busq,        setBusq]        = useState("");
  const [selected,    setSelected]    = useState(null);
  const [modal,       setModal]       = useState(null);
  const [filtro,      setFiltro]      = useState("todos");
  const [token,       setToken]       = useState(null);

  const cargar = useCallback(async () => {
    const [d, s, c] = await Promise.all([db.getDebts(), db.getSettings(), db.getContactos()]);
    setDebts(d.filter((x) => (x.tipo || "pagar") === "cobrar"));
    setSettings(s);
    // Mapa nombre→dias_credito para calcular plazo por cliente
    const map = {};
    (c || []).forEach(x => { if (x.nombre) map[x.nombre.toLowerCase()] = x.dias_credito || 0; });
    setContactoMap(map);
    import("../utils/auth").then(m => m.getToken()).then(setToken);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const { confirmar, dialogo } = useConfirmar();
  const anular = async () => {
    if (!sel) return;
    if (!(await confirmar("Anular cuenta por cobrar", `¿Anular la CXC de ${sel.nombre}? Quedará marcada como anulada.`, { peligro: true, boton: "Anular" }))) return;
    const todos = await db.getDebts();
    await db.setDebts(todos.map(x => x.id === sel.id ? { ...x, estado: "anulada" } : x));
    cargar();
  };

  const eliminar = async (d) => {
    if (!(await confirmar("Eliminar cuenta por cobrar", `¿Eliminar la CXC de ${d.nombre}? Esta acción no se puede deshacer.`, { peligro: true, boton: "Eliminar" }))) return;
    const todos = await db.getDebts();
    await db.setDebts(todos.filter((x) => x.id !== d.id));
    // Cancelar eventos de calendario — obtener token fresco para no depender del state
    try {
      const { getToken } = await import("../utils/auth");
      const tkn = await getToken();
      if (tkn) {
        await cancelarEventoCalendario({ token: tkn, tituloMatch: `Cobro: ${d.nombre}`, fecha: d.fechaVencimiento });
        await cancelarEventoCalendario({ token: tkn, tituloMatch: `Cobro próximo: ${d.nombre}` });
      }
    } catch {}
    setSelected(null);
    cargar();
  };

  const busqL = busq.trim().toLowerCase();
  const visibles = debts
    .filter((d) => {
      if (busqL && !d.nombre?.toLowerCase().includes(busqL) && !d.notas?.toLowerCase().includes(busqL)) return false;
      if (filtro === "pendientes") return Math.max(0, d.total - (d.pagado || 0)) > 0;
      if (filtro === "vencidas")  return d.fechaVencimiento && d.fechaVencimiento < hoy() && Math.max(0, d.total - (d.pagado || 0)) > 0;
      if (filtro === "saldadas")  return Math.max(0, d.total - (d.pagado || 0)) <= 0;
      return true;
    })
    .sort((a, b) => (b.creadoEn || "").localeCompare(a.creadoEn || ""));

  const totCRC = visibles.filter((d) => (d.moneda || "CRC") === "CRC").reduce((s, d) => s + Math.max(0, d.total - (d.pagado || 0)), 0);
  const totUSD = visibles.filter((d) => d.moneda === "USD").reduce((s, d) => s + Math.max(0, d.total - (d.pagado || 0)), 0);
  const sel = visibles.find((d) => d.id === selected);

  const vencidas = debts.filter(d => d.estado !== "anulada" && d.fechaVencimiento && d.fechaVencimiento < hoy() && Math.max(0, d.total - (d.pagado || 0)) > 0).length;
  const reporte = accion => { const crc = debts.filter(d=>(d.moneda||"CRC")==="CRC"); const usd = debts.filter(d=>d.moneda==="USD"); accion(crc, usd); };
  const TH = "monki-tag text-monki-k/55 font-semibold px-4 py-3 border-b-2 border-black/10 text-left whitespace-nowrap";
  const saldoSel = sel ? Math.max(0, sel.total - (sel.pagado || 0)) : 0;

  return (
    <Modulo
      seccion="Contabilidad"
      titulo="Cuentas por cobrar"
      descripcion="Lo que te deben tus clientes, cuánto va de plazo y cuánto está vencido."
      acciones={<>
        <Boton variante="secundario" icono={Printer} onClick={() => reporte((crc, usd) => printHTML(htmlReporteCXC(crc, usd, settings)))}>Imprimir</Boton>
        <Boton variante="secundario" icono={FileSpreadsheet} onClick={() => reporte((crc, usd) => exportExcel(sheetsReporteCXC(crc, usd), "reporte-cxc"))}>Excel</Boton>
        <Boton icono={Plus} onClick={() => setModal("nueva")}>Nueva cuenta</Boton>
      </>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Por cobrar CRC" valor={fmtMoney(totCRC,"CRC")} icono={Wallet} destacado delay={40}/>
          <Indicador etiqueta="Por cobrar USD" valor={fmtMoney(totUSD,"USD")} delay={90}/>
          <Indicador etiqueta="Vencidas" valor={vencidas} icono={AlertTriangle} alerta={vencidas>0} delay={140} onClick={() => setFiltro("vencidas")}/>
          <Indicador etiqueta="Cuentas" valor={debts.length} detalle="Registradas" delay={190}/>
        </Indicadores>
      }
      pestanas={{ activa: filtro, onCambiar: setFiltro, items: [
        { key: "todos", label: "Todas" }, { key: "pendientes", label: "Pendientes" }, { key: "vencidas", label: "Vencidas" }, { key: "saldadas", label: "Saldadas" },
      ] }}
    >
      <BarraFiltros resumen={`${visibles.length} cuenta${visibles.length!==1?"s":""}`}>
        <Buscador valor={busq} onCambio={setBusq} placeholder="Buscar por cliente o referencia…"/>
      </BarraFiltros>

      {sel && (
        <div className="animate-desplegar mb-3 flex flex-wrap items-center gap-3 bg-monki-k text-white rounded-2xl px-4 py-2.5 text-sm">
          <span className="monki-tag text-monki-y">Seleccionada</span>
          <b>{sel.nombre}</b>
          <span className="text-white/60">Saldo <b className="text-monki-y">{fmtMoney(saldoSel, sel.moneda||"CRC")}</b></span>
          <span className="text-white/60">Vence {fmtDate(sel.fechaVencimiento)}</span>
          <div className="flex-1"/>
          <Boton variante="secundario" tamano="sm" icono={Ban} disabled={sel.estado === "anulada"} onClick={anular}>Anular</Boton>
          <Boton variante="peligro" tamano="sm" icono={Trash2} onClick={() => eliminar(sel)}>Eliminar</Boton>
        </div>
      )}

      <div className="ui-tarjeta flex-1 min-h-0 bg-white rounded-[18px] border-2 border-black/10 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="ui-tabla w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>{["Cliente","Referencia","Total","Saldo","Emisión","Vencimiento","Plazo","Antigüedad","Estado"].map(t => <th key={t} className={TH + (["Total","Saldo"].includes(t) ? " !text-right" : ["Plazo"].includes(t) ? " !text-center" : "")}>{t}</th>)}</tr>
            </thead>
            <tbody>
              {visibles.length === 0 ? (
                <tr><td colSpan={9}><Vacio icono={Wallet} titulo="Sin cuentas por cobrar" texto={debts.length ? "Probá con otra búsqueda o filtro." : "Se crean solas al facturar a crédito, o podés registrar una a mano."}
                  accion={!debts.length && <Boton icono={Plus} onClick={() => setModal("nueva")}>Nueva cuenta</Boton>}/></td></tr>
              ) : visibles.map((d) => {
                const mon      = d.moneda || settings.moneda || "CRC";
                const saldo    = Math.max(0, d.total - (d.pagado || 0));
                const estado   = ESTADO(d);
                const isSel     = selected === d.id;
                const esAnulada = d.estado === "anulada";
                const plazo = (() => {
                  const dc = contactoMap[d.nombre?.toLowerCase()];
                  if (dc > 0) return dc;
                  if (d.fecha && d.fechaVencimiento) {
                    const diff = Math.round((new Date(d.fechaVencimiento) - new Date(d.fecha)) / 86400000);
                    if (diff > 0) return diff;
                  }
                  return 0;
                })();
                const diasTranscurridos = d.fecha ? Math.floor((Date.now() - new Date(d.fecha)) / 86400000) : 0;
                const diasVenc = (() => {
                  if (!d.fechaVencimiento || saldo <= 0) return 0;
                  const diff = Math.floor((Date.now() - new Date(d.fechaVencimiento)) / 86400000);
                  return diff > 0 ? diff : 0;
                })();
                const barColor = diasVenc > 60 ? "bg-red-600" : diasVenc > 0 ? "bg-red-400" : "bg-monki-k";
                const barPct   = diasVenc > 0 ? 100 : (plazo > 0 ? Math.min(100, Math.round((diasTranscurridos / plazo) * 100)) : 0);
                return (
                  <React.Fragment key={d.id}>
                    <tr onClick={() => setSelected(isSel ? null : d.id)}
                      className={`ui-fila animate-desplegar cursor-pointer border-b border-black/5 transition-colors ${isSel ? "bg-[#FFF4B8]" : esAnulada ? "opacity-50 hover:bg-monki-cream/60" : "hover:bg-monki-cream/60"}`}>
                      <td className="px-4 py-2.5"><b className={esAnulada ? "line-through text-monki-k/35" : "text-monki-k"}>{d.nombre}</b>{d.creadoPor && <div className="text-[10px] text-monki-k/45">Por {d.creadoPor}</div>}</td>
                      <td className="px-4 py-2.5 text-monki-k/50 text-xs">{d.notas || "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(d.total, mon)}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-black ${saldo > 0 ? "text-red-600" : ""}`}>{fmtMoney(saldo, mon)}</td>
                      <td className="px-4 py-2.5 text-monki-k/50 text-xs">{fmtDate(d.fecha) || "—"}</td>
                      <td className={`px-4 py-2.5 ${d.fechaVencimiento && d.fechaVencimiento < hoy() && saldo > 0 ? "text-red-600 font-bold" : "text-monki-k/55"}`}>{fmtDate(d.fechaVencimiento) || "—"}</td>
                      <td className="px-4 py-2.5 text-center font-mono text-xs text-monki-k/55">{plazo > 0 ? `${plazo}d` : "—"}</td>
                      <td className="px-4 py-2.5 min-w-[130px]">
                        {saldo > 0 && d.fechaVencimiento ? (
                          <div>
                            <div className="flex justify-between text-[10px] mb-1">
                              <span className={diasVenc > 0 ? "font-bold text-red-600" : "text-monki-k/50"}>{diasVenc > 0 ? `Vencida ${diasVenc}d` : "Al día"}</span>
                              {plazo > 0 && <span className="font-mono text-monki-k/40">{diasTranscurridos}/{plazo}d</span>}
                            </div>
                            <div className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden"><div className={`h-full rounded-full ${barColor}`} style={{ width: `${barPct}%` }} /></div>
                          </div>
                        ) : <span className="text-xs text-monki-k/25">—</span>}
                      </td>
                      <td className="px-4 py-2.5"><Estado tono={estado.tono}>{estado.label}</Estado></td>
                    </tr>
                    {isSel && (
                      <tr className="animate-desplegar">
                        <td colSpan={9} className="bg-monki-cream/70 px-6 py-3">
                          <p className="monki-tag text-monki-k/55 mb-2">Recibos aplicados</p>
                          {(d.pagos || []).length === 0 ? <p className="text-sm text-monki-k/40">Sin pagos registrados.</p> : (
                            <div className="space-y-1.5">
                              {(d.pagos || []).map((p) => (
                                <div key={p.id} className="flex flex-wrap items-center gap-3 bg-white rounded-xl px-3 py-2 text-sm">
                                  <span className="font-mono font-bold text-xs">{p.numero}</span>
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
        {visibles.length > 0 && (() => {
          const monPrin = settings.moneda || "CRC";
          const deMoneda = visibles.filter(d => (d.moneda||"CRC") === monPrin);
          const totalFacturas = deMoneda.reduce((s,d) => s + (d.total || 0), 0);
          const totalSaldo    = deMoneda.reduce((s,d) => s + Math.max(0, d.total - (d.pagado||0)), 0);
          return (
            <div className="shrink-0 flex flex-wrap items-center gap-x-6 gap-y-1 border-t-2 border-black/10 px-4 py-2.5 bg-monki-cream/40 text-sm">
              <span className="monki-tag text-monki-k/55 mr-auto">{visibles.length} registro{visibles.length!==1?"s":""} · {monPrin}</span>
              <span>Facturado <b>{fmtMoney(totalFacturas, monPrin)}</b></span>
              <span className="text-red-600">Saldo <b>{fmtMoney(totalSaldo, monPrin)}</b></span>
            </div>
          );
        })()}
      </div>

      {modal === "nueva" && <NuevaCXCModal settings={settings} onClose={() => setModal(null)} onSave={cargar} />}
      {dialogo}
    </Modulo>
  );
}
