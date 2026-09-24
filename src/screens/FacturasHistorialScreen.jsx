/**
 * FacturasHistorialScreen — Historial de facturas emitidas (desktop)
 */
import React, { useState, useEffect, useCallback } from "react";
import { FileText, CheckCircle, Clock, XCircle, Trash2, Ban, Send, AlertTriangle } from "lucide-react";
import { Modulo, Boton, BarraFiltros, Buscador, Selector, Vacio, Estado, Indicadores, Indicador, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate } from "../utils/fmt";
import { getToken } from "../utils/auth";
import { etiquetaEstado, facturaReintentable, reintentarFactura } from "../utils/comprobantes";
import { guardarFacturaVenta, efectosPendientes } from "../utils/efectosVenta";
import { useCurrency } from "../contexts/CurrencyContext";

const ESTADOS = {
  aceptada: { label: "Aceptada", tono: "exito", icon: CheckCircle },
  guardada: { label: "Borrador",  tono: "neutro", icon: FileText },
  pendiente: { label: "Pendiente", tono: "alerta", icon: Clock },
  rechazada: { label: "Rechazada", tono: "peligro", icon: XCircle },
  anulada:   { label: "Anulada",   tono: "neutro", icon: Ban },
  // Estados que devuelve el backend al emitir
  enviado:        { label: "Enviada",        tono: "exito", icon: CheckCircle },
  aceptado:       { label: "Aceptada",       tono: "exito", icon: CheckCircle },
  simulado:       { label: "Simulada",       tono: "oscuro", icon: CheckCircle },
  rechazado:      { label: "Rechazada",      tono: "peligro", icon: XCircle },
  error_firma:    { label: "Sin firmar",     tono: "peligro", icon: XCircle },
  error_envio:    { label: "Envío rechazado", tono: "peligro", icon: XCircle },
  envio_incierto: { label: "Sin confirmar",  tono: "alerta", icon: Clock },
  sin_conexion:   { label: "Sin conexión",   tono: "alerta", icon: Clock },
};

function DetalleFact({ f, moneda, recibos = [] }) {
  const recibosVinculados = recibos.filter(r => r.facturaId === f.id && r.estado !== "anulado");
  const TH = "monki-tag text-[10px] text-monki-k/45 font-medium pb-1.5";
  return (
    <div className="animate-desplegar bg-monki-cream/70 px-6 py-4 space-y-3">
      {(f.lineas || []).length > 0 && (
        <div className="bg-white rounded-2xl p-3">
          <p className="monki-tag text-monki-k/55 mb-2">Líneas de la factura</p>
          <table className="ui-tabla w-full text-sm">
            <thead><tr>
              <th className={TH+" text-left"}>Descripción</th><th className={TH+" text-center"}>Cant.</th>
              <th className={TH+" text-right"}>P. unit.</th><th className={TH+" text-right"}>IVA</th><th className={TH+" text-right"}>Total</th>
            </tr></thead>
            <tbody>
              {f.lineas.map((l, i) => (
                <tr key={i} className="border-t border-black/5">
                  <td className="py-1.5">{l.descripcion}</td>
                  <td className="py-1.5 text-center">{l.cantidad} {l.unidad}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtMoney(l.precioUnit, moneda)}</td>
                  <td className="py-1.5 text-right text-monki-k/45">{l.pctIVA}%</td>
                  <td className="py-1.5 text-right font-bold tabular-nums">{fmtMoney(l.total, moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="bg-white rounded-full px-3 py-1">Subtotal <b>{fmtMoney(f.subtotal, f.moneda)}</b></span>
        {(f.totalDescuento || 0) > 0 && <span className="bg-white rounded-full px-3 py-1 text-red-600">Descuento −{fmtMoney(f.totalDescuento, f.moneda)}</span>}
        <span className="bg-white rounded-full px-3 py-1">IVA <b>{fmtMoney(f.totalIVA, f.moneda)}</b></span>
        <span className="bg-monki-k text-monki-y rounded-full px-3 py-1 font-black">Total {fmtMoney(f.total, f.moneda)}</span>
      </div>
      {f.notas && <p className="text-xs text-monki-k/50 italic">{f.notas}</p>}
      {f.haciendaRes && <p className="font-mono text-[10px] text-monki-k/40 break-all">Hacienda: {JSON.stringify(f.haciendaRes).slice(0, 160)}</p>}
      {recibosVinculados.length > 0 && (
        <div className="bg-white rounded-2xl p-3">
          <p className="monki-tag text-monki-k/55 mb-2">Recibos de pago vinculados</p>
          {recibosVinculados.map(r => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 text-sm py-1 border-t border-black/5 first:border-0">
              <span className="font-mono font-bold text-xs">#{r.numero}</span>
              <span className="text-monki-k/50">{r.fecha}</span>
              <span className="text-monki-k/50">{r.metodoPago}</span>
              <b className="ml-auto">{fmtMoney(r.monto, r.moneda || moneda)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FacturasHistorialScreen() {
  const [facturas,  setFacturas]  = useState([]);
  const [recibos,   setRecibos]   = useState([]);
  const [settings,  setSettings]  = useState({});
  const [busq,      setBusq]      = useState("");
  const [filtroEst, setFiltroEst] = useState("todos");
  const [selected,  setSelected]  = useState(null);

  const cargar = useCallback(async () => {
    const [f, s, r] = await Promise.all([db.getFacturas(), db.getSettings(), db.getRecibos()]);
    setFacturas(f.sort((a, b) => (b.creadoEn || "").localeCompare(a.creadoEn || "")));
    setSettings(s);
    setRecibos(r || []);
  }, []);

  const { confirmar, dialogo } = useConfirmar();
  const anular = async (f) => {
    if (!(await confirmar("Anular factura", `¿Anular la factura ${f.numero}? Quedará marcada como anulada.`, { peligro: true, boton: "Anular" }))) return;
    const todas = await db.getFacturas();
    await db.setFacturas(todas.map((x) => x.id === f.id ? { ...x, estado: "anulada" } : x));
    cargar();
  };

  // Retoma una factura que quedó a medias, con la misma clave (nunca crea otra).
  const [reintentando, setReintentando] = useState(false);
  const { tipoCambio, recargar: recargarTipoCambio } = useCurrency();
  const reintentar = async (f) => {
    setReintentando(true);
    try {
      const token = await getToken();
      // Ya está en Hacienda pero le falta inventario/CxC/asiento: solo completar lo local.
      if (!facturaReintentable(f)) {
        await guardarFacturaVenta(f, token);
        cargar();
        alert("✅ Registro de la factura completado (inventario, CxC y asiento).");
        return;
      }
      const { r, campos, requiereCotizacion } = await reintentarFactura(f, token, tipoCambio);
      if (requiereCotizacion) recargarTipoCambio?.();
      // Además de los datos fiscales, completa inventario/CxC/asiento si
      // quedaron pendientes (sin repetir los ya aplicados).
      await guardarFacturaVenta({ ...f, ...campos }, token);
      cargar();
      alert(r.ok ? `✅ ${etiquetaEstado(campos.estado)}` : `❌ ${etiquetaEstado(campos.estado || f.estado)}\n${r.error}`);
    } finally {
      setReintentando(false);
    }
  };

  const eliminar = async (f) => {
    if (!(await confirmar("Eliminar factura", `¿Eliminar definitivamente la factura ${f.numero}? Esta acción no se puede deshacer.`, { peligro: true, boton: "Eliminar" }))) return;
    const todas = await db.getFacturas();
    await db.setFacturas(todas.filter((x) => x.id !== f.id));
    if (selected === f.id) setSelected(null);
    cargar();
  };

  useEffect(() => { cargar(); }, [cargar]);

  const busqL    = busq.trim().toLowerCase();
  const visibles = facturas.filter((f) => {
    if (filtroEst !== "todos" && f.estado !== filtroEst) return false;
    if (busqL && !f.numero?.toLowerCase().includes(busqL) && !f.cliente?.nombre?.toLowerCase().includes(busqL)) return false;
    return true;
  });

  const totCRC = visibles.filter(f=>f.moneda==="CRC").reduce((s,f)=>s+(f.total||0),0);
  const totUSD = visibles.filter(f=>f.moneda==="USD").reduce((s,f)=>s+(f.total||0),0);
  const sel = visibles.find((f) => f.id === selected);

  const conProblema = facturas.filter(f => facturaReintentable(f) || efectosPendientes(f)).length;
  const FILTROS = [
    { value: "todos", label: "Todos los estados" }, { value: "aceptada", label: "Aceptadas" }, { value: "pendiente", label: "Pendientes" },
    { value: "guardada", label: "Borradores" }, { value: "rechazada", label: "Rechazadas" }, { value: "envio_incierto", label: "Sin confirmar" },
    { value: "error_envio", label: "Envío rechazado" }, { value: "error_firma", label: "Sin firmar" }, { value: "sin_conexion", label: "Sin conexión" },
  ];
  const TH = "monki-tag text-monki-k/55 font-semibold px-4 py-3 border-b-2 border-black/10 text-left whitespace-nowrap";

  return (
    <Modulo
      seccion="Facturación"
      titulo="Historial de facturas"
      descripcion="Todo lo emitido. Tocá una factura para ver su detalle, reintentar el envío o anularla."
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Facturas" valor={visibles.length} detalle={filtroEst === "todos" ? "En total" : "Con el filtro"} icono={FileText} delay={40}/>
          <Indicador etiqueta="Total CRC" valor={fmtMoney(totCRC,"CRC")} destacado delay={90}/>
          <Indicador etiqueta="Total USD" valor={fmtMoney(totUSD,"USD")} delay={140}/>
          <Indicador etiqueta="Por resolver" valor={conProblema} detalle={conProblema ? "Envío o registro pendiente" : "Todo al día"} icono={AlertTriangle} alerta={conProblema>0} delay={190}/>
        </Indicadores>
      }
    >
      <BarraFiltros resumen={`${visibles.length} factura${visibles.length!==1?"s":""}`}>
        <Buscador valor={busq} onCambio={setBusq} placeholder="Buscar por número o cliente…"/>
        <Selector valor={filtroEst} onCambio={setFiltroEst} opciones={FILTROS}/>
      </BarraFiltros>

      {sel && (
        <div className="animate-desplegar mb-3 flex flex-wrap items-center gap-3 bg-monki-k text-white rounded-2xl px-4 py-2.5 text-sm">
          <span className="monki-tag text-monki-y">Seleccionada</span>
          <b>{sel.numero}</b><span className="text-white/60">{sel.cliente?.nombre || "Consumidor Final"}</span>
          <b className="text-monki-y">{fmtMoney(sel.total, sel.moneda)}</b>
          {sel.error && <span className="text-red-300 text-xs truncate max-w-md" title={sel.error}>{sel.error}</span>}
          <div className="flex-1"/>
          <Boton variante="amarillo" tamano="sm" icono={Send} cargando={reintentando}
            disabled={!(facturaReintentable(sel) || efectosPendientes(sel)) || reintentando}
            title={sel?.error || (facturaReintentable(sel) ? "Retomar el envío a Hacienda con la misma clave" : "Completar inventario, CxC y asiento pendientes")}
            onClick={() => reintentar(sel)}>
            {!facturaReintentable(sel) && efectosPendientes(sel) ? "Completar registro" : "Reintentar envío"}
          </Boton>
          <Boton variante="secundario" tamano="sm" icono={Ban} disabled={sel.estado === "anulada"} onClick={() => anular(sel)}>Anular</Boton>
          <Boton variante="peligro" tamano="sm" icono={Trash2} onClick={() => eliminar(sel)}>Eliminar</Boton>
        </div>
      )}

      <div className="ui-tarjeta flex-1 min-h-0 bg-white rounded-[18px] border-2 border-black/10 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="ui-tabla w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>{["N.°","Tipo","Fecha","Cliente","Cédula","Moneda","Total","Estado"].map(t => <th key={t} className={TH + (t==="Total" ? " !text-right" : "")}>{t}</th>)}</tr>
            </thead>
            <tbody>
              {visibles.length === 0 ? (
                <tr><td colSpan={8}><Vacio icono={FileText} titulo="Sin facturas emitidas" texto={facturas.length ? "Probá con otra búsqueda o estado." : "Las facturas que emitas aparecen acá."}/></td></tr>
              ) : visibles.map((f) => {
                const est       = ESTADOS[f.estado] || ESTADOS.pendiente;
                const isSel     = selected === f.id;
                const esAnulada = f.estado === "anulada";
                return (
                  <React.Fragment key={f.id}>
                    <tr onClick={() => setSelected(isSel ? null : f.id)}
                      className={`ui-fila animate-desplegar cursor-pointer border-b border-black/5 transition-colors ${isSel ? "bg-[#FFF4B8]" : esAnulada ? "opacity-50 hover:bg-monki-cream/60" : "hover:bg-monki-cream/60"}`}>
                      <td className={`px-4 py-2.5 font-mono text-xs font-bold ${esAnulada ? "line-through text-monki-k/35" : ""}`}>{f.numero}</td>
                      <td className="px-4 py-2.5"><span className="font-mono text-[11px] bg-monki-cream px-1.5 py-0.5 rounded-md">{f.tipoDoc === "04" ? "Tiquete" : "Factura"}</span></td>
                      <td className="px-4 py-2.5"><div>{fmtDate(f.fecha)}</div>{f.creadoPor && <div className="text-[10px] text-monki-k/45">Por {f.creadoPor}</div>}</td>
                      <td className={`px-4 py-2.5 font-bold ${esAnulada ? "line-through text-monki-k/35" : "text-monki-k"}`}>{f.cliente?.nombre || "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-monki-k/50">{f.cliente?.cedula || "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-monki-k/55">{f.moneda}</td>
                      <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${esAnulada ? "line-through text-monki-k/35" : ""}`}>{fmtMoney(f.total, f.moneda)}</td>
                      <td className="px-4 py-2.5"><Estado tono={est.tono}>{est.label}</Estado></td>
                    </tr>
                    {isSel && <tr><td colSpan={8} className="p-0"><DetalleFact f={f} moneda={f.moneda} recibos={recibos} /></td></tr>}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {dialogo}
    </Modulo>
  );
}
