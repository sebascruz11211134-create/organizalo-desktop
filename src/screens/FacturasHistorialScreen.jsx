/**
 * FacturasHistorialScreen — Historial de facturas emitidas (desktop)
 */
import React, { useState, useEffect, useCallback } from "react";
import { FileText, CheckCircle, Clock, XCircle, Trash2, Ban, Send, AlertTriangle, MessageCircle, FileDown, Mail } from "lucide-react";
import { Modulo, Boton, BarraFiltros, Buscador, Selector, Vacio, Estado, Indicadores, Indicador, Modal, Campo, Entrada, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate } from "../utils/fmt";
import { getToken, getCurrentUserSync } from "../utils/auth";
import { etiquetaEstado, facturaReintentable, reintentarFactura, pdfComprobante, enviarCorreoComprobante, estadoComprobante, etiquetaCorreo } from "../utils/comprobantes";
import { guardarFacturaVenta, efectosPendientes } from "../utils/efectosVenta";
import { useCurrency } from "../contexts/CurrencyContext";
import { compartirFactura } from "../utils/contacto";

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
  const [contactos, setContactos] = useState([]);
  const [busq,      setBusq]      = useState("");
  const [filtroEst, setFiltroEst] = useState("todos");
  const [selected,  setSelected]  = useState(null);

  const cargar = useCallback(async () => {
    const [f, s, r] = await Promise.all([db.getFacturas(), db.getSettings(), db.getRecibos()]);
    setFacturas(f.sort((a, b) => (b.creadoEn || "").localeCompare(a.creadoEn || "")));
    setSettings(s);
    setRecibos(r || []);
    setContactos(await db.getContactos() || []);
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

  // ── Comprobante en el servidor: estado en Hacienda, correo al cliente y PDF ──
  const [servidor, setServidor] = useState({});   // id local → { estado, correo }
  const [pdf, setPdf] = useState(null);           // { id, blob, url }
  const [correoModal, setCorreoModal] = useState(null); // { f, destino }
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const baseDe = () => "/api/invoices";
  useEffect(() => {
    const f = facturas.find(x => x.id === selected);
    if (!f?.haciendaId) return;
    let vigente = true;
    (async () => {
      const token = await getToken();
      try {
        const c = await estadoComprobante(baseDe(f), f.haciendaId, { token });
        if (!vigente) return;
        setServidor(prev => ({ ...prev, [f.id]: { estado: c.estado, correo: c.correo } }));
        // Aceptada o rechazada es definitivo: se anota en la factura local
        if (["aceptado", "rechazado"].includes(c.estado) && c.estado !== f.estado) {
          const todas = await db.getFacturas();
          await db.setFacturas(todas.map(x => x.id === f.id ? { ...x, estado: c.estado, haciendaRes: c.respuestaHacienda } : x));
          cargar();
        }
      } catch { /* sin conexión: se muestra lo guardado */ }
      try {
        const blob = await pdfComprobante(baseDe(f), f.haciendaId, { token });
        if (vigente) setPdf(prev => { if (prev?.url) URL.revokeObjectURL(prev.url); return { id: f.id, blob, url: URL.createObjectURL(blob) }; });
      } catch { /* aún sin firmar */ }
    })();
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const abrirPdf = (f) => {
    if (pdf?.id === f.id) return window.open(pdf.url, "_blank", "noopener");
    alert("El PDF todavía se está preparando. Probá de nuevo en un momento.");
  };
  // Solo administración puede mandar el comprobante a un correo distinto al del cliente
  const esAdmin = ["superadmin", "admin", "gerencia"].includes(getCurrentUserSync()?.rol);
  const enviarCorreo = async () => {
    const { f, destino, confirmarPrueba, solicitud } = correoModal;
    setEnviandoCorreo(true);
    try {
      const token = await getToken();
      const r = await enviarCorreoComprobante(baseDe(f), f.haciendaId, { token, destinatario: destino.trim() || undefined, confirmarPrueba, solicitud });
      setCorreoModal(null);
      alert(r.estado === "enviado" ? `✅ Enviada a ${r.destino}` : `⏳ Quedó en cola para ${r.destino}; se reintentará sola.`);
      const c = await estadoComprobante(baseDe(f), f.haciendaId, { token }).catch(() => null);
      if (c) setServidor(prev => ({ ...prev, [f.id]: { estado: c.estado, correo: c.correo } }));
    } catch (e) {
      alert(`❌ ${e.message}`);
    } finally {
      setEnviandoCorreo(false);
    }
  };
  // WhatsApp con PDF: advertir si el comprobante no tiene validez fiscal
  const compartirWhatsApp = async (f) => {
    const sinValidez = f.modoSimulacion || ["rechazado", "rechazada"].includes(f.estado) || ["rechazado"].includes(servidor[f.id]?.estado);
    if (sinValidez && !(await confirmar("Comprobante sin validez fiscal",
      f.modoSimulacion ? "Es un comprobante de PRUEBA: no tiene validez fiscal. ¿Compartirlo igual?" : "Hacienda RECHAZÓ este comprobante: no tiene validez fiscal. ¿Compartirlo igual?",
      { peligro: true, boton: "Compartir igual" }))) return;
    compartirFactura(f, { settings, contactos, fmtMoney, pdf: pdf?.id === f.id ? pdf.blob : null });
  };

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
          {(() => {
            const et = etiquetaCorreo(servidor[sel.id]?.correo);
            return et && <span className={`text-xs ${et.tono === "error" ? "text-red-300" : et.tono === "alerta" ? "text-amber-200" : "text-monki-y"}`}>✉ {et.texto}</span>;
          })()}
          <div className="flex-1"/>
          <Boton variante="amarillo" tamano="sm" icono={Send} cargando={reintentando}
            disabled={!(facturaReintentable(sel) || efectosPendientes(sel)) || reintentando}
            title={sel?.error || (facturaReintentable(sel) ? "Retomar el envío a Hacienda con la misma clave" : "Completar inventario, CxC y asiento pendientes")}
            onClick={() => reintentar(sel)}>
            {!facturaReintentable(sel) && efectosPendientes(sel) ? "Completar registro" : "Reintentar envío"}
          </Boton>
          {sel.haciendaId && <Boton variante="secundario" tamano="sm" icono={FileDown} onClick={() => abrirPdf(sel)}>PDF</Boton>}
          {sel.haciendaId && <Boton variante="secundario" tamano="sm" icono={Mail} onClick={() => { const original = sel.cliente?.email || sel.cliente?.correo || ""; setCorreoModal({ f: sel, destino: original, original, solicitud: `${sel.id}-${Date.now()}-${Math.random().toString(36).slice(2)}` }); }}>Correo</Boton>}
          <Boton variante="amarillo" tamano="sm" icono={MessageCircle} onClick={() => compartirWhatsApp(sel)}>WhatsApp</Boton>
          <Boton variante="secundario" tamano="sm" icono={Ban} disabled={sel.estado === "anulada"} onClick={() => anular(sel)}>Anular</Boton>
          <Boton variante="peligro" tamano="sm" icono={Trash2} onClick={() => eliminar(sel)}>Eliminar</Boton>
        </div>
      )}

      <div className="ui-tarjeta flex-1 min-h-0 bg-white rounded-[18px] border-2 border-black/10 overflow-hidden flex flex-col max-md:bg-transparent max-md:border-0 max-md:rounded-none max-md:overflow-visible">
        {/* Celular: tarjetas */}
        <div className="md:hidden space-y-2">
          {visibles.length === 0 ? (
            <Vacio icono={FileText} titulo="Sin facturas emitidas" texto={facturas.length ? "Probá con otra búsqueda o estado." : "Las facturas que emitas aparecen acá."}/>
          ) : visibles.map((f, i) => {
            const est = ESTADOS[f.estado] || ESTADOS.pendiente;
            const isSel = selected === f.id;
            const esAnulada = f.estado === "anulada";
            return (
              <div key={f.id} style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
                className={`animate-desplegar rounded-2xl border-2 overflow-hidden ${isSel ? "border-monki-y" : "border-black/10"} ${esAnulada ? "opacity-60" : ""}`}>
                <button onClick={() => setSelected(isSel ? null : f.id)} className={`w-full text-left p-3 ${isSel ? "bg-[#FFF4B8]" : "bg-white"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <b className={`block truncate text-monki-k ${esAnulada ? "line-through" : ""}`}>{f.cliente?.nombre || "Consumidor Final"}</b>
                      <span className="font-mono text-[11px] text-monki-k/50">{f.numero} · {f.tipoDoc === "04" ? "Tiquete" : "Factura"} · {fmtDate(f.fecha)}</span>
                    </div>
                    <b className={`shrink-0 tabular-nums ${esAnulada ? "line-through" : ""}`}>{fmtMoney(f.total, f.moneda)}</b>
                  </div>
                  <div className="mt-2"><Estado tono={est.tono}>{est.label}</Estado></div>
                </button>
                {isSel && <DetalleFact f={f} moneda={f.moneda} recibos={recibos} />}
              </div>
            );
          })}
        </div>
        <div className="hidden md:block flex-1 min-h-0 overflow-auto">
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
      {correoModal && (
        <Modal titulo="Enviar por correo" subtitulo={`${correoModal.f.numero} · PDF, XML firmado y respuesta de Hacienda`} onCerrar={() => setCorreoModal(null)} ancho="max-w-md"
          pie={<><Boton variante="fantasma" onClick={() => setCorreoModal(null)}>Cancelar</Boton><Boton icono={Send} cargando={enviandoCorreo} disabled={enviandoCorreo || !correoModal.destino.trim() || (correoModal.f.modoSimulacion && !correoModal.confirmarPrueba)} onClick={enviarCorreo}>Enviar</Boton></>}>
          <Campo etiqueta="Correo del cliente" ayuda={esAdmin
            ? "Se envía sola al cliente al emitirla y cuando Hacienda responde. Acá podés reenviarla o mandarla a otro correo."
            : "Se envía sola al cliente al emitirla y cuando Hacienda responde. Acá podés reenviarla (a otro correo solo administración)."}>
            <Entrada type="email" value={correoModal.destino} disabled={!esAdmin && !!correoModal.original}
              onChange={e => setCorreoModal(m => ({ ...m, destino: e.target.value, solicitud: `${m.f.id}-${Date.now()}-${Math.random().toString(36).slice(2)}` }))} placeholder="cliente@empresa.com"/>
          </Campo>
          {correoModal.f.modoSimulacion && (
            <label className="mt-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 border-2 border-red-200 rounded-2xl px-3 py-2 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={!!correoModal.confirmarPrueba} onChange={e => setCorreoModal(m => ({ ...m, confirmarPrueba: e.target.checked }))}/>
              <span>{"Entiendo que es un comprobante de PRUEBA y le llegará marcado \"sin validez fiscal\"."}</span>
            </label>
          )}
        </Modal>
      )}
      {dialogo}
    </Modulo>
  );
}
