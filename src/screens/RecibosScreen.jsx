import { getAutorSync } from "../utils/auth";
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Ban, ChevronLeft, ChevronRight, Receipt, Wallet, Coins } from "lucide-react";
import { Modulo, Boton, BotonIcono, BarraFiltros, Buscador, Tabla, Vacio, Estado, Indicadores, Indicador, Modal, Campo, Entrada, Seleccion, Interruptor, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { useAccionInicial } from "../hooks/useAccionInicial";
import { fmtMoney, fmtDate, hoy, genId, mesLabel } from "../utils/fmt";
import { cancelarEventoCalendario } from "../utils/clienteUtils";

/* ─── Modal unificado de recibo ──────────────────────────────────────────── */
function NuevoReciboModal({ onClose, onSave, settings, contactos = [], facturas = [], debts = [], token }) {
  const mon = settings.moneda || "CRC";

  const [cliente,    setCliente]    = useState("");
  const [busqCli,    setBusqCli]    = useState("");
  const [showCli,    setShowCli]    = useState(false);
  const [monto,      setMonto]      = useState("");
  const [moneda,     setMoneda]     = useState(mon);
  const [metodo,     setMetodo]     = useState("Transferencia");
  const [fecha,      setFecha]      = useState(hoy());
  const [concepto,   setConcepto]   = useState("");
  const [esAdelanto, setEsAdelanto] = useState(false);
  const [facturaId,  setFacturaId]  = useState("");
  const [aplicado,   setAplicado]   = useState({}); // { cxcId: monto }

  // Autocompletar contactos
  const filtCli = contactos.filter((c) =>
    c.nombre?.toLowerCase().includes(busqCli.toLowerCase()) ||
    c.cedula?.includes(busqCli) ||
    c.codigoCliente?.toUpperCase().includes(busqCli.toUpperCase())
  ).slice(0, 6);

  // CXC pendientes del cliente seleccionado
  const cxcPendientes = debts.filter(d =>
    d.tipo !== "pagar" &&
    d.estado !== "anulada" &&
    cliente && d.nombre?.toLowerCase() === cliente.toLowerCase() &&
    Math.max(0, d.total - (d.pagado || 0)) > 0
  );

  const totalCXC = Object.values(aplicado).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const hayCXC   = cxcPendientes.length > 0;

  // Facturas del cliente seleccionado (vivas = no anuladas)
  const factSel = facturas.find(f => f.id === facturaId);
  const facturasCliente = cliente
    ? facturas.filter(f =>
        f.estado !== "anulada" &&
        (f.clienteNombre || "").toLowerCase().includes(cliente.toLowerCase())
      )
    : [];

  const seleccionarCliente = (nombre) => {
    setBusqCli(nombre); setCliente(nombre);
    setShowCli(false); setFacturaId(""); setAplicado({});
  };

  const canSave = () => {
    if (esAdelanto) return parseFloat(monto) > 0;
    if (hayCXC)     return totalCXC > 0;
    return parseFloat(monto) > 0 && !!facturaId;
  };

  const guardar = async () => {
    if (!canSave()) return;

    const todosRecibos  = await db.getRecibos();
    const num = `RC-${String(Date.now()).slice(-5)}`;

    if (!esAdelanto && hayCXC && totalCXC > 0) {
      // ── Flujo CXC: aplicar contra deudas ────────────────────────
      const lineas = cxcPendientes
        .map(d => ({ deuda: d, monto: parseFloat(aplicado[d.id]) || 0 }))
        .filter(l => l.monto > 0);

      const todosDebts   = await db.getDebts();
      const asientosAct  = await db.getAsientos();
      let updatedDebts   = [...todosDebts];
      const nuevosRecibos = [];
      let totalRecibo = 0;

      for (const { deuda, monto: m } of lineas) {
        const pago = { id: genId(), numero: num, fecha, monto: m, metodo, notas: concepto, creadoEn: new Date().toISOString(), creadoPor: getAutorSync() };
        updatedDebts = updatedDebts.map(x =>
          x.id !== deuda.id ? x : { ...x, pagado: (x.pagado || 0) + m, pagos: [...(x.pagos || []), pago] }
        );
        nuevosRecibos.push({
          id: genId(), numero: num, fecha, monto: m, metodo,
          concepto: concepto.trim() || `Cobro CXC — ${deuda.nombre}${deuda.facturaRef ? ` (${deuda.facturaRef})` : ""}`,
          clienteNombre: deuda.nombre, notas: concepto,
          facturaRef: deuda.facturaRef || null,
          facturaNumero: deuda.facturaRef || null,
          cxcId: deuda.id,
          moneda: deuda.moneda || mon,
          esAdelanto: false,
          creadoEn: new Date().toISOString(), creadoPor: getAutorSync(),
        });
        totalRecibo += m;

        const nuevoPagado = (deuda.pagado || 0) + m;
        if (nuevoPagado >= deuda.total - 0.01 && token) {
          cancelarEventoCalendario({ token, tituloMatch: `Cobro: ${deuda.nombre}`, fecha: deuda.fechaVencimiento }).catch(() => {});
          cancelarEventoCalendario({ token, tituloMatch: `Cobro próximo: ${deuda.nombre}` }).catch(() => {});
        }
      }

      await db.setDebts(updatedDebts);
      await db.setRecibos([...nuevosRecibos, ...todosRecibos]);

      // Asiento contable
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
      } catch (e) { console.warn("[Recibo] asiento:", e.message); }

    } else {
      // ── Flujo simple: adelanto o pago de factura ─────────────────
      const m = parseFloat(monto);
      const idx = todosRecibos.length;
      const numSimple = String(idx + 1).padStart(5, "0");
      const nuevo = {
        id: genId(), numero: numSimple, clienteNombre: cliente.trim(), monto: m,
        moneda, metodoPago: metodo, fecha, concepto: concepto.trim(),
        esAdelanto,
        facturaId:     esAdelanto ? null : (facturaId || null),
        facturaNumero: esAdelanto ? null : (factSel?.numero || null),
        creadoEn: new Date().toISOString(), creadoPor: getAutorSync(),
      };
      await db.setRecibos([nuevo, ...todosRecibos]);
    }

    onSave(); onClose();
  };

  return (
    <Modal titulo="Nuevo recibo" subtitulo={esAdelanto ? "Pago anticipado, sin factura" : "Cobro contra CXC o factura"} onCerrar={onClose}
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton onClick={guardar} disabled={!canSave()}>Guardar recibo</Boton></>}>
        <div className="space-y-4">

          <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-monki-y/40 border-2 border-monki-y">
            <div>
              <p className="text-sm font-extrabold text-monki-k">{esAdelanto ? "Recibo de adelanto" : "Recibo de pago"}</p>
              <p className="text-[11px] text-monki-k/60">{esAdelanto ? "Pago anticipado — sin factura requerida" : "Paga contra CXC o factura existente"}</p>
            </div>
            <Interruptor activo={esAdelanto} onCambio={() => { setEsAdelanto(!esAdelanto); setFacturaId(""); }} etiqueta="Adelanto" />
          </div>

          <div className="relative">
            <Campo etiqueta="Cliente">
              <Entrada value={busqCli}
                onChange={(e) => { setBusqCli(e.target.value); setCliente(e.target.value); setShowCli(true); setFacturaId(""); setAplicado({}); }}
                onFocus={() => setShowCli(true)}
                onBlur={() => setTimeout(() => setShowCli(false), 150)}
                placeholder="Nombre o código CLI-XXXX…" />
            </Campo>
            {showCli && filtCli.length > 0 && (
              <div className="animate-desplegar absolute top-full left-0 w-full mt-1 bg-white border-2 border-monki-k rounded-xl shadow-[4px_4px_0_#111] z-20 max-h-44 overflow-auto">
                {filtCli.map((c) => (
                  <button key={c.id} type="button" onMouseDown={() => seleccionarCliente(c.nombre)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-monki-y border-b border-black/5 last:border-0">
                    {c.codigoCliente && <span className="font-mono text-[10px] bg-monki-cream px-1.5 rounded mr-1.5">{c.codigoCliente}</span>}
                    <span className="font-semibold">{c.nombre}</span>
                    <span className="text-monki-k/40 ml-2 font-mono text-xs">{c.cedula}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* CXC pendientes — si hay y no es adelanto */}
          {!esAdelanto && hayCXC && (
            <div>
              <p className="monki-tag text-monki-k/60 mb-1.5">Deudas pendientes — monto a cobrar</p>
              <div className="border-2 border-black/10 rounded-2xl overflow-hidden">
                {cxcPendientes.map((d) => {
                  const saldo = d.total - (d.pagado || 0);
                  return (
                    <div key={d.id} className="flex items-center gap-2 px-3 py-2 border-b border-black/5 last:border-0 bg-white hover:bg-monki-cream/60">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-monki-k truncate">{d.facturaRef || d.descripcion || "CXC"}</p>
                        <p className="text-[11px] text-monki-k/50">Saldo <strong className="text-red-600">{fmtMoney(saldo, d.moneda || mon)}</strong></p>
                      </div>
                      <input
                        type="number" min="0" max={saldo} step="0.01"
                        placeholder="0"
                        value={aplicado[d.id] || ""}
                        onChange={(e) => setAplicado(p => ({ ...p, [d.id]: e.target.value }))}
                        className="w-28 border-2 border-black/10 rounded-xl px-2.5 py-1.5 text-sm text-right"
                      />
                    </div>
                  );
                })}
                <div className="flex justify-between items-center px-3 py-2 bg-monki-k text-white text-sm">
                  <span className="monki-tag text-monki-y">Total a cobrar</span><b>{fmtMoney(totalCXC, mon)}</b>
                </div>
              </div>
            </div>
          )}

          {/* Facturas vivas del cliente — auto-desplegadas */}
          {!esAdelanto && !hayCXC && (
            <div>
              <p className="monki-tag text-monki-k/60 mb-1.5">Factura *</p>
              {!cliente ? (
                <p className="text-sm text-monki-k/45 bg-monki-cream rounded-xl px-3 py-2.5">Elegí el cliente para ver sus facturas.</p>
              ) : facturasCliente.length === 0 ? (
                <p className="text-sm text-monki-k/45 bg-monki-cream rounded-xl px-3 py-2.5">Este cliente no tiene facturas activas.</p>
              ) : (
                <div className="border-2 border-black/10 rounded-2xl overflow-hidden max-h-52 overflow-y-auto">
                  {facturasCliente.map((f) => {
                    const isSel = facturaId === f.id;
                    return (
                      <button key={f.id} type="button"
                        onClick={() => setFacturaId(isSel ? "" : f.id)}
                        className={`w-full text-left flex items-center gap-2 px-3 py-2.5 border-b border-black/5 last:border-0 transition-colors
                          ${isSel ? "bg-monki-y" : "bg-white hover:bg-monki-cream/60"}`}>
                        <span className="font-mono font-bold text-sm text-monki-k">#{f.numero}</span>
                        <span className="text-xs text-monki-k/50 flex-1 truncate">{fmtDate(f.fecha)}</span>
                        <span className="text-sm font-bold text-monki-k">{fmtMoney(f.total, f.moneda)}</span>
                        {isSel && <span className="w-5 h-5 rounded-full bg-monki-k text-monki-y text-[11px] font-black flex items-center justify-center">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {(esAdelanto || !hayCXC) && (
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <Campo etiqueta="Monto *"><Entrada type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" /></Campo>
              <Campo etiqueta="Moneda"><Seleccion value={moneda} onChange={(e) => setMoneda(e.target.value)} opciones={[{ value: "CRC", label: "₡ CRC" }, { value: "USD", label: "$ USD" }]} /></Campo>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Método de pago"><Seleccion value={metodo} onChange={(e) => setMetodo(e.target.value)} opciones={["Transferencia","SINPE Móvil","Efectivo","Tarjeta","Cheque","Otro"]} /></Campo>
            <Campo etiqueta="Fecha"><Entrada type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Campo>
          </div>
          <Campo etiqueta="Concepto / notas"><Entrada value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Descripción del pago" /></Campo>
        </div>
    </Modal>
  );
}

/* ─── Pantalla principal ─────────────────────────────────────────────────── */
export default function RecibosScreen() {
  const [recibos,   setRecibos]   = useState([]);
  const [settings,  setSettings]  = useState({});
  const [contactos, setContactos] = useState([]);
  const [facturas,  setFacturas]  = useState([]);
  const [debts,     setDebts]     = useState([]);
  const [token,     setToken]     = useState(null);
  const [busq,      setBusq]      = useState("");
  const [mes,       setMes]       = useState(() => hoy().slice(0, 7));
  const [showModal, setShowModal] = useState(false);
  useAccionInicial({ accion: v => v === "nuevo" && setShowModal(true) });
  const [selected,  setSelected]  = useState(null);

  const cargar = useCallback(async () => {
    const [r, s, c, d, f] = await Promise.all([db.getRecibos(), db.getSettings(), db.getContactos(), db.getDebts(), db.getFacturas()]);
    setRecibos(r); setSettings(s); setContactos(c || []); setDebts(d || []); setFacturas(f || []);
    import("../utils/auth").then(m => m.getToken()).then(setToken);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useSyncRefresh(cargar);

  const { confirmar, dialogo } = useConfirmar();
  const anular = async () => {
    if (!sel) return;
    if (!(await confirmar("Anular recibo", `¿Anular el recibo #${sel.numero}? Quedará marcado como anulado.`, { peligro: true, boton: "Anular" }))) return;
    const todos = await db.getRecibos();
    await db.setRecibos(todos.map(x => x.id === sel.id ? { ...x, estado: "anulado" } : x));
    cargar();
  };

  const eliminar = async () => {
    if (!sel) return;
    if (!(await confirmar("Eliminar recibo", `¿Eliminar definitivamente el recibo #${sel.numero}? Esta acción no se puede deshacer.`, { peligro: true, boton: "Eliminar" }))) return;
    const todos = await db.getRecibos();
    await db.setRecibos(todos.filter(x => x.id !== sel.id));
    setSelected(null); cargar();
  };

  const mesesDisp = [...new Set(recibos.map((r) => (r.fecha || "").slice(0, 7)).filter(Boolean))].sort().reverse();
  const navMes = (dir) => {
    const idx = mesesDisp.indexOf(mes);
    const nx = idx + dir;
    if (nx >= 0 && nx < mesesDisp.length) setMes(mesesDisp[nx]);
  };

  const busqL = busq.trim().toLowerCase();
  const visibles = recibos.filter((r) => {
    const enMes  = (r.fecha || "").startsWith(mes);
    const match  = !busqL || (r.clienteNombre || "").toLowerCase().includes(busqL) || r.numero?.includes(busqL);
    return enMes && match;
  });

  const totCRC = visibles.filter(r => r.estado !== "anulado").reduce((s, r) => s + (r.monto || 0), 0);
  const sel = visibles.find(r => r.id === selected);

  const mon = settings.moneda || "CRC";
  const activosMes = visibles.filter(r => r.estado !== "anulado");
  const adelantos = activosMes.filter(r => r.esAdelanto).reduce((t, r) => t + (r.monto || 0), 0);
  const columnas = [
    { key: "numero", titulo: "N.° recibo", render: r => <span className={`font-mono font-bold ${r.estado === "anulado" ? "line-through text-monki-k/35" : ""}`}>#{r.numero}</span> },
    { key: "fecha", titulo: "Fecha", render: r => <div><div>{fmtDate(r.fecha)}</div>{r.creadoPor && <div className="text-[10px] text-monki-k/45">Por {r.creadoPor}</div>}</div> },
    { key: "cliente", titulo: "Cliente", principal: true, render: r => <b className={r.estado === "anulado" ? "line-through text-monki-k/35" : "text-monki-k"}>{r.clienteNombre || r.cliente || "Consumidor Final"}</b> },
    { key: "tipo", titulo: "Tipo", render: r => r.esAdelanto ? <Estado tono="alerta">Adelanto</Estado>
        : r.cxcId ? <Estado tono="oscuro">CXC</Estado>
        : r.facturaNumero ? <span className="font-mono text-xs font-bold bg-monki-cream px-2 py-0.5 rounded-md">Fact #{r.facturaNumero}</span>
        : <span className="text-monki-k/40">Pago</span> },
    { key: "metodo", titulo: "Método", render: r => <span className="text-monki-k/60">{r.metodoPago || r.metodo}</span> },
    { key: "monto", titulo: "Monto", alinear: "right", render: r => <b className={r.estado === "anulado" ? "line-through text-monki-k/35" : ""}>{fmtMoney(r.monto, r.moneda || mon)}</b> },
    { key: "concepto", titulo: "Concepto", render: r => <span className="text-monki-k/55 text-xs">{r.concepto || r.notas || "—"}</span> },
    { key: "estado", titulo: "Estado", render: r => r.estado === "anulado" ? <Estado>Anulado</Estado> : <Estado tono="exito">Activo</Estado> },
  ];

  return (
    <Modulo
      seccion="Contabilidad"
      titulo="Recibos de caja"
      descripcion="Cada pago que entra: abonos a facturas, cobros de CXC y adelantos."
      acciones={<Boton icono={Plus} onClick={() => setShowModal(true)}>Nuevo recibo</Boton>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Recibos del mes" valor={activosMes.length} detalle={mesLabel(mes)} icono={Receipt} delay={40} />
          <Indicador etiqueta="Cobrado" valor={fmtMoney(totCRC, mon)} detalle="Sin anulados" icono={Wallet} destacado delay={90} />
          <Indicador etiqueta="Adelantos" valor={fmtMoney(adelantos, mon)} detalle="Pagos anticipados" icono={Coins} delay={140} />
          <Indicador etiqueta="Anulados" valor={visibles.length - activosMes.length} detalle="En el mes" icono={Ban} delay={190} />
        </Indicadores>
      }
    >
      <BarraFiltros
        derecha={
          <div className="flex items-center gap-1 bg-white rounded-full border-2 border-black/10 p-1">
            <BotonIcono icono={ChevronLeft} titulo="Mes anterior" onClick={() => navMes(1)} />
            <span className="text-sm font-bold w-28 text-center capitalize">{mesLabel(mes)}</span>
            <BotonIcono icono={ChevronRight} titulo="Mes siguiente" onClick={() => navMes(-1)} />
          </div>
        }>
        <Buscador valor={busq} onCambio={setBusq} placeholder="Buscar por cliente o número…" />
      </BarraFiltros>
      <Tabla columnas={columnas} filas={visibles} seleccionada={selected}
        onFila={r => setSelected(selected === r.id ? null : r.id)}
        vacio={<Vacio icono={Receipt} titulo={`Sin recibos en ${mesLabel(mes)}`} texto="Registrá el primer pago del mes."
          accion={<Boton icono={Plus} onClick={() => setShowModal(true)}>Nuevo recibo</Boton>} />} />
      {sel && (
        <div className="animate-desplegar mt-3 flex flex-wrap items-center gap-3 bg-monki-k text-white rounded-2xl px-4 py-2.5 text-sm">
          <span className="monki-tag text-monki-y">Seleccionado</span>
          <b>#{sel.numero}</b><span className="text-white/60">{sel.clienteNombre || "Consumidor Final"}</span>
          <b className="text-monki-y">{fmtMoney(sel.monto, sel.moneda || mon)}</b>
          <div className="flex-1" />
          <Boton variante="amarillo" tamano="sm" icono={Ban} onClick={anular} disabled={sel.estado === "anulado"}>Anular</Boton>
          <Boton variante="peligro" tamano="sm" icono={Trash2} onClick={eliminar}>Eliminar</Boton>
        </div>
      )}
      {showModal && (
        <NuevoReciboModal
          settings={settings} contactos={contactos} facturas={facturas}
          debts={debts} token={token}
          onClose={() => setShowModal(false)} onSave={cargar}
        />
      )}
      {dialogo}
    </Modulo>
  );
}
