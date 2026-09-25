/**
 * NotasCreditoScreen — Gestión de Notas de Crédito (desktop)
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Printer, FileSpreadsheet, Trash2, Ban, Send, FileMinus } from "lucide-react";
import { Modulo, Boton, BarraFiltros, Buscador, Tabla, Vacio, Estado, Indicadores, Indicador, Modal, Campo, Entrada, Seleccion, useConfirmar } from "../components/ui";
import { getToken } from "../utils/auth";
import { emitir, reenviar, camposHacienda, etiquetaEstado, yaEnviada, referenciaDeFactura, payloadVigente } from "../utils/comprobantes";
import { useCurrency } from "../contexts/CurrencyContext";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, fmtDate, hoy, genId } from "../utils/fmt";
import { printHTML, exportExcel, htmlNotasCredito, sheetsNotasCredito } from "../utils/reportHelpers";
import { restaurarInventarioPorFactura } from "../utils/clienteUtils";

const MOTIVOS = ["Devolución de producto", "Descuento especial", "Error de facturación", "Servicio no prestado", "Otro"];

function NuevaNCtModal({ settings, facturas, contactos = [], onClose, onSave }) {
  const [form, setForm] = useState({
    cliente: "", facturaRef: "", motivo: MOTIVOS[0], monto: "",
    moneda: settings.moneda || "CRC", notas: "", fecha: hoy(),
  });
  const u = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const [busqCli,    setBusqCli]    = useState("");
  const [showCli,    setShowCli]    = useState(false);

  const filtCli = contactos.filter((c) =>
    c.nombre?.toLowerCase().includes(busqCli.toLowerCase()) ||
    c.cedula?.includes(busqCli) ||
    c.codigoCliente?.toUpperCase().includes(busqCli.toUpperCase())
  ).slice(0, 6);

  const guardar = async () => {
    if (!form.cliente || !form.monto) return alert("Cliente y monto requeridos.");
    const notas = await db.getNotasCredito();
    const seq   = (notas.length + 1).toString().padStart(5, "0");
    const nueva = { ...form, id: genId(), numero: `NC-${seq}`, monto: parseFloat(form.monto) || 0, creadoEn: new Date().toISOString() };
    await db.setNotasCredito([...notas, nueva]);

    // ── Vincular NC a la factura referenciada ────────────────────────────────
    if (form.facturaRef) {
      const facturas = await db.getFacturas();
      const upd = facturas.map(f =>
        f.numero === form.facturaRef.trim()
          ? { ...f, notasCredito: [...(f.notasCredito || []), { numero: nueva.numero, monto: nueva.monto, moneda: nueva.moneda, fecha: nueva.fecha, motivo: nueva.motivo }] }
          : f
      );
      await db.setFacturas(upd);
    }

    // Si es devolución de producto y hay factura de referencia → restaurar inventario
    if (form.motivo === "Devolución de producto" && form.facturaRef) {
      await restaurarInventarioPorFactura(form.facturaRef.trim());
    }

    // ── Asiento contable de reversión ────────────────────────────────────────
    try {
      const asientos = await db.getAsientos();
      const numAJ = `AJ-${String(asientos.length + 1).padStart(5, "0")}`;
      const monto = parseFloat(form.monto) || 0;
      await db.setAsientos([...asientos, {
        id: genId(), numero: numAJ, estado: "confirmado", autoGenerado: true,
        descripcion: `NC ${nueva.numero} — ${form.cliente} (${form.motivo})`,
        fecha: form.fecha, totalDebe: monto, totalHaber: monto,
        lineas: [
          { cuentaCodigo: "4101", cuentaNombre: "Ventas / Ingresos",    debe: monto, haber: 0 },
          { cuentaCodigo: "1201", cuentaNombre: "Cuentas por cobrar",   debe: 0, haber: monto },
        ],
        creadoEn: new Date().toISOString(),
      }]);
    } catch (e) { console.warn("[NC] asiento:", e.message); }

    onSave();
    onClose();
  };

  return (
    <Modal titulo="Nueva nota de crédito" subtitulo="Devolución, descuento o corrección de una factura" onCerrar={onClose} ancho="max-w-md"
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton onClick={guardar}>Crear nota</Boton></>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 relative">
          <Campo etiqueta="Cliente *">
            <Entrada value={busqCli}
              onChange={(e) => { setBusqCli(e.target.value); u("cliente", e.target.value); setShowCli(true); }}
              onFocus={() => setShowCli(true)} onBlur={() => setTimeout(() => setShowCli(false), 150)}
              placeholder="Nombre o código CLI-XXXX…"/>
          </Campo>
          {showCli && filtCli.length > 0 && (
            <div className="animate-desplegar absolute top-full left-0 w-full mt-1 bg-white border-2 border-monki-k rounded-xl shadow-[4px_4px_0_#111] z-20 max-h-40 overflow-auto">
              {filtCli.map((c) => (
                <button key={c.id} type="button" onMouseDown={() => { setBusqCli(c.nombre); u("cliente", c.nombre); setShowCli(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-monki-y border-b border-black/5 last:border-0">
                  {c.codigoCliente && <span className="font-mono text-[10px] bg-monki-cream px-1.5 rounded mr-1.5">{c.codigoCliente}</span>}
                  <span className="font-semibold">{c.nombre}</span>
                  <span className="text-monki-k/40 ml-2 font-mono text-xs">{c.cedula}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Campo etiqueta="Factura de referencia" ayuda="Número local o clave de 50 dígitos"><Entrada value={form.facturaRef} onChange={(e) => u("facturaRef", e.target.value)} placeholder="FE-00001" className="font-mono"/></Campo>
        <Campo etiqueta="Fecha"><Entrada type="date" value={form.fecha} onChange={(e) => u("fecha", e.target.value)}/></Campo>
        <Campo etiqueta="Motivo *" className="col-span-2"><Seleccion value={form.motivo} onChange={(e) => u("motivo", e.target.value)} opciones={MOTIVOS}/></Campo>
        <Campo etiqueta="Moneda"><Seleccion value={form.moneda} onChange={(e) => u("moneda", e.target.value)} opciones={[{value:"CRC",label:"₡ CRC"},{value:"USD",label:"$ USD"}]}/></Campo>
        <Campo etiqueta="Monto *"><Entrada type="number" value={form.monto} onChange={(e) => u("monto", e.target.value)} placeholder="0" min="0" step="any"/></Campo>
        <Campo etiqueta="Observaciones" className="col-span-2"><Entrada value={form.notas} onChange={(e) => u("notas", e.target.value)} placeholder="Detalles adicionales…"/></Campo>
      </div>
    </Modal>
  );
}

export default function NotasCreditoScreen() {
  const { tipoCambio, recargar: recargarTipoCambio } = useCurrency();
  const { confirmar, dialogo } = useConfirmar();
  const [notas,     setNotas]     = useState([]);
  const [settings,  setSettings]  = useState({});
  const [facturas,  setFacturas]  = useState([]);
  const [contactos, setContactos] = useState([]);
  const [busq,      setBusq]      = useState("");
  const [modal,     setModal]     = useState(false);
  const [selected,  setSelected]  = useState(null);
  const [enviando,  setEnviando]  = useState(false);

  const cargar = useCallback(async () => {
    const [n, s, f, c] = await Promise.all([db.getNotasCredito(), db.getSettings(), db.getFacturas(), db.getContactos()]);
    setNotas(n.sort((a, b) => (b.creadoEn || "").localeCompare(a.creadoEn || "")));
    setSettings(s);
    setFacturas(f);
    setContactos(c || []);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const anular = async () => {
    if (!sel) return;
    if (!(await confirmar("Anular nota de crédito", `¿Anular la nota de crédito ${sel.numero}? Quedará marcada como anulada.`, { peligro: true, boton: "Anular" }))) return;
    const todas = await db.getNotasCredito();
    await db.setNotasCredito(todas.map(x => x.id === sel.id ? { ...x, estado: "anulada" } : x));
    cargar();
  };

  const eliminar = async (n) => {
    if (!(await confirmar("Eliminar nota de crédito", `¿Eliminar la nota de crédito ${n.numero}? Esta acción no se puede deshacer.`, { peligro: true, boton: "Eliminar" }))) return;
    const todas = await db.getNotasCredito();
    await db.setNotasCredito(todas.filter(x => x.id !== n.id));
    // Desvincular de la factura si aplica
    if (n.facturaRef) {
      const facts = await db.getFacturas();
      await db.setFacturas(facts.map(f =>
        f.numero === n.facturaRef
          ? { ...f, notasCredito: (f.notasCredito || []).filter(nc => nc.numero !== n.numero) }
          : f
      ));
    }
    setSelected(null);
    cargar();
  };

  // ── Enviar NC a Hacienda ────────────────────────────────────────────────────
  const enviarHacienda = async (nota) => {
    if (!nota) return;
    setEnviando(true);
    try {
      // Buscar cedula del cliente en contactos
      const cLower = (nota.cliente || "").toLowerCase();
      const contacto = contactos.find(c => c.nombre?.toLowerCase() === cLower);

      const token = await getToken();
      // Si el backend ya tiene la nota (id guardado), siempre se retoma esa, nunca se crea otra.
      let r;
      if (nota.haciendaId) {
        r = await reenviar(`/api/emision/notas/${nota.haciendaId}/reenviar`, { token });
      } else {
        // Referencia válida (clave, fecha y tipo) o no se envía nada.
        const { error: errorRef, ...referencia } = referenciaDeFactura(await db.getFacturas(), nota.facturaRef);
        if (errorRef) { alert(errorRef); return; }
        // En dólares se exige la cotización oficial del BCCR de hoy, igual que en las facturas.
        const { payload, error, requiereCotizacion } = payloadVigente({
          cliente: {
            nombre: nota.cliente || "Consumidor Final",
            cedula: contacto?.cedula || undefined,
            correo: contacto?.email || contacto?.correo || undefined,
          },
          // Convertir el monto plano en una línea de detalle para el XML
          items: [{
            descripcion:    nota.motivo || "Nota de crédito",
            cantidad:       1,
            precioUnitario: nota.monto || 0,
            tarifaIva:      0, // NC se emiten por el monto bruto (IVA ya calculado en la FE)
            codigoCabys:    "8399000000000",
            unidadMedida:   "Servicio",
          }],
          moneda:           nota.moneda || "CRC",
          ...referencia,
          referenciaRazon:  nota.motivo || "Anulación de comprobante",
        }, tipoCambio);
        if (error) { if (requiereCotizacion) recargarTipoCambio?.(); alert(error); return; }
        r = await emitir("/api/emision/nota-credito", payload, { token, idempotencyKey: `nc-${nota.id}` });
      }

      // Persistir estado Hacienda en la nota local (también si falló: guarda el id para reenviar)
      const todas = await db.getNotasCredito();
      await db.setNotasCredito(todas.map(x => x.id === nota.id ? { ...x, ...camposHacienda(r, nota) } : x));
      await cargar();
      if (r.ok) alert(`✅ NC enviada a Hacienda\nEstado: ${r.comprobante.estado}\nClave: ${r.comprobante.clave}`);
      else alert(`❌ ${etiquetaEstado(r.comprobante?.estado || "sin_conexion")}\n${r.error}${r.comprobante ? "\n\nLa nota quedó guardada: usá \"Enviar\" de nuevo para reintentar con la misma clave." : ""}`);
    } catch (err) {
      alert(`❌ Error al enviar a Hacienda:\n${err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  const busqL   = busq.trim().toLowerCase();
  const visibles = notas.filter(n =>
    !busqL || n.cliente?.toLowerCase().includes(busqL) || n.numero?.toLowerCase().includes(busqL) || n.motivo?.toLowerCase().includes(busqL)
  );

  const totCRC = visibles.filter(n => n.moneda === "CRC").reduce((s, n) => s + (n.monto || 0), 0);
  const totUSD = visibles.filter(n => n.moneda === "USD").reduce((s, n) => s + (n.monto || 0), 0);
  const sel = visibles.find(n => n.id === selected);

  const TONO_HACIENDA = e => ["aceptado","enviado","simulado"].includes(e) ? "exito" : e === "rechazado" ? "peligro" : "alerta";
  const columnas = [
    { key: "numero", titulo: "N.°", render: n => <span className="font-mono text-xs font-bold">{n.numero}</span> },
    { key: "fecha", titulo: "Fecha", render: n => fmtDate(n.fecha) },
    { key: "cliente", titulo: "Cliente", principal: true, render: n => <b className="text-monki-k">{n.cliente}</b> },
    { key: "ref", titulo: "Factura ref.", render: n => <span className="font-mono text-xs text-monki-k/50">{n.facturaRef || "—"}</span> },
    { key: "motivo", titulo: "Motivo", render: n => <span className="text-monki-k/70">{n.motivo}</span> },
    { key: "monto", titulo: "Monto", alinear: "right", render: n => <b className="text-red-600">{fmtMoney(n.monto, n.moneda)}</b> },
    { key: "hacienda", titulo: "Hacienda", render: n => n.estado === "anulada" ? <Estado>Anulada</Estado> : n.haciendaEstado ? <Estado tono={TONO_HACIENDA(n.haciendaEstado)}>{etiquetaEstado(n.haciendaEstado)}</Estado> : <span className="text-monki-k/25">—</span> },
    { key: "obs", titulo: "Obs.", render: n => <span className="text-monki-k/45 text-xs">{n.notas || "—"}</span> },
  ];

  return (
    <Modulo
      seccion="Facturación"
      titulo="Notas de crédito"
      descripcion="Devoluciones, descuentos y correcciones sobre facturas ya emitidas."
      acciones={<>
        <Boton variante="secundario" icono={Printer} onClick={() => printHTML(htmlNotasCredito(visibles, settings))}>Imprimir</Boton>
        <Boton variante="secundario" icono={FileSpreadsheet} onClick={() => exportExcel(sheetsNotasCredito(visibles), "notas-credito")}>Excel</Boton>
        <Boton icono={Plus} onClick={() => setModal(true)}>Nueva nota</Boton>
      </>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Notas" valor={visibles.length} icono={FileMinus} delay={40}/>
          <Indicador etiqueta="Total CRC" valor={fmtMoney(totCRC, "CRC")} destacado delay={90}/>
          <Indicador etiqueta="Total USD" valor={fmtMoney(totUSD, "USD")} delay={140}/>
          <Indicador etiqueta="Sin enviar" valor={notas.filter(n => n.estado !== "anulada" && !yaEnviada(n)).length} detalle="A Hacienda" icono={Send} delay={190}/>
        </Indicadores>
      }
    >
      <BarraFiltros resumen={`${visibles.length} nota${visibles.length !== 1 ? "s" : ""}`}>
        <Buscador valor={busq} onCambio={setBusq} placeholder="Buscar por cliente, número o motivo…"/>
      </BarraFiltros>
      {sel && (
        <div className="animate-desplegar mb-3 flex flex-wrap items-center gap-3 bg-monki-k text-white rounded-2xl px-4 py-2.5 text-sm">
          <span className="monki-tag text-monki-y">Seleccionada</span>
          <b>{sel.numero}</b><span className="text-white/60">{sel.cliente}</span>
          {sel.facturaRef && <span className="font-mono text-xs text-white/50">→ {sel.facturaRef}</span>}
          <b className="text-monki-y">{fmtMoney(sel.monto, sel.moneda)}</b>
          <div className="flex-1"/>
          <Boton variante="amarillo" tamano="sm" icono={Send} cargando={enviando}
            disabled={enviando || sel.estado === "anulada" || yaEnviada(sel)}
            title={sel?.haciendaClave ? `Clave: ${sel.haciendaClave}` : "Enviar la nota a Hacienda"}
            onClick={() => enviarHacienda(sel)}>
            {!sel?.haciendaEstado ? "Enviar a Hacienda" : !yaEnviada(sel) ? "Reintentar envío" : `Hacienda: ${etiquetaEstado(sel.haciendaEstado)}`}
          </Boton>
          <Boton variante="secundario" tamano="sm" icono={Ban} disabled={sel.estado === "anulada"} onClick={anular}>Anular</Boton>
          <Boton variante="peligro" tamano="sm" icono={Trash2} onClick={() => eliminar(sel)}>Eliminar</Boton>
        </div>
      )}
      <Tabla columnas={columnas} filas={visibles} seleccionada={selected} onFila={n => setSelected(selected === n.id ? null : n.id)}
        vacio={<Vacio icono={FileMinus} titulo="Sin notas de crédito" texto="Creá una para devolver o corregir una factura emitida."
          accion={<Boton icono={Plus} onClick={() => setModal(true)}>Nueva nota</Boton>}/>}/>
      {modal && <NuevaNCtModal settings={settings} facturas={facturas} contactos={contactos} onClose={() => setModal(false)} onSave={cargar} />}
      {dialogo}
    </Modulo>
  );
}
