/**
 * NotaDebitoComercialScreen — Nota de Débito Electrónica (ND-01)
 *
 * Cargo adicional a una Factura Electrónica emitida previamente.
 * Flujo: llenar receptor + líneas → guardar local → Enviar a Hacienda (ND-01)
 *
 * ⚠️ No confundir con las Notas de Débito BANCARIAS del módulo Control Bancario.
 *    Las bancarias son internas; estas se envían a Hacienda.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Send, Ban, FilePlus2 } from "lucide-react";
import { Modulo, Boton, BotonIcono, BarraFiltros, Buscador, Tabla, Vacio, Estado, Indicadores, Indicador, Modal, Campo, Entrada, Seleccion, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, hoy, genId, fmtDate } from "../utils/fmt";
import { getToken, getAutorSync } from "../utils/auth";
import { emitir, reenviar, camposHacienda, etiquetaEstado, yaEnviada, referenciaDeFactura, payloadVigente } from "../utils/comprobantes";
import { useCurrency } from "../contexts/CurrencyContext";

// ── Constantes Hacienda ───────────────────────────────────────────────────────
const TIPOS_IVA = [
  { value: "01", label: "0% Exento",   pct: 0  },
  { value: "07", label: "8%",           pct: 8  },
  { value: "08", label: "13%",          pct: 13 },
];
const IVA_PCT = { "01": 0, "07": 8, "08": 13 };

function lineaVacia() {
  return { id: genId(), descripcion: "", cantidad: "1", unidad: "Unid", codigoCabys: "", precioUnit: "", codigoIVA: "08" };
}
function calcLinea(l) {
  const cant   = parseFloat(l.cantidad) || 0;
  const precio = parseFloat(l.precioUnit) || 0;
  const subTotal = cant * precio;
  const pctIVA  = IVA_PCT[l.codigoIVA] ?? 13;
  const montoIVA = (subTotal * pctIVA) / 100;
  return { ...l, subTotal, pctIVA, montoIVA, total: subTotal + montoIVA };
}

// ── Badge Hacienda ────────────────────────────────────────────────────────────
function BadgeHacienda({ estado }) {
  if (!estado) return <span className="text-monki-k/25">—</span>;
  const tono = ["enviado","simulado","aceptado"].includes(estado) ? "exito" : estado === "rechazado" ? "peligro" : "alerta";
  return <Estado tono={tono}>{etiquetaEstado(estado)}</Estado>;
}

export default function NotaDebitoComercialScreen() {
  const { tipoCambio, recargar: recargarTipoCambio } = useCurrency();
  const { confirmar, dialogo } = useConfirmar();
  const [notas,     setNotas]     = useState([]);
  const [contactos, setContactos] = useState([]);
  const [settings,  setSettings]  = useState({});
  const [busq,      setBusq]      = useState("");
  const [selected,  setSelected]  = useState(null);
  const [showForm,  setShowForm]  = useState(false);
  const [enviando,  setEnviando]  = useState(false);

  // ── Form state ───────────────────────────────────────────────────────────────
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteCedula, setClienteCedula] = useState("");
  const [clienteEmail,  setClienteEmail]  = useState("");
  const [busqCli,       setBusqCli]       = useState("");
  const [showCli,       setShowCli]       = useState(false);
  const [facturaRef,    setFacturaRef]    = useState("");
  const [motivo,        setMotivo]        = useState("Cargo adicional");
  const [fecha,         setFecha]         = useState(hoy());
  const [moneda,        setMoneda]        = useState("CRC");
  const [lineas,        setLineas]        = useState([lineaVacia()]);

  const cargar = useCallback(async () => {
    try {
      const raw = localStorage.getItem("@finanzia/notasDebitoComercial");
      const n = raw ? JSON.parse(raw) : [];
      setNotas(n.sort((a, b) => (b.creadoEn || "").localeCompare(a.creadoEn || "")));
    } catch { setNotas([]); }
    const [s, c] = await Promise.all([db.getSettings(), db.getContactos()]);
    setSettings(s);
    setContactos(c || []);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useSyncRefresh(cargar);

  const guardarNotasLocal = async (nuevaLista) => {
    localStorage.setItem("@finanzia/notasDebitoComercial", JSON.stringify(nuevaLista));
    if (typeof window.__orgPush === "function") window.__orgPush();
  };

  const resetForm = () => {
    setClienteNombre(""); setClienteCedula(""); setClienteEmail("");
    setBusqCli(""); setFacturaRef(""); setMotivo("Cargo adicional");
    setFecha(hoy()); setMoneda("CRC"); setLineas([lineaVacia()]);
  };

  const filtCli = contactos.filter(c =>
    c.nombre?.toLowerCase().includes(busqCli.toLowerCase()) ||
    c.cedula?.includes(busqCli)
  ).slice(0, 6);

  const selectCliente = (c) => {
    setClienteNombre(c.nombre); setBusqCli(c.nombre);
    setClienteCedula(c.cedula || "");
    setClienteEmail(c.email || c.correo || "");
    setShowCli(false);
  };

  const lineasCalc = lineas.map(calcLinea);
  const subtotal   = lineasCalc.reduce((s, l) => s + l.subTotal, 0);
  const totalIVA   = lineasCalc.reduce((s, l) => s + l.montoIVA, 0);
  const totalND    = lineasCalc.reduce((s, l) => s + l.total, 0);

  const guardarLocal = async () => {
    if (!clienteNombre.trim()) return alert("Ingresá el nombre del receptor.");
    if (!lineas.some(l => l.descripcion && parseFloat(l.precioUnit) > 0)) {
      return alert("Agregá al menos una línea con descripción y precio.");
    }
    const todas = JSON.parse(localStorage.getItem("@finanzia/notasDebitoComercial") || "[]");
    const seq   = String(todas.length + 1).padStart(5, "0");
    const nueva = {
      id: genId(),
      numero: `ND-${seq}`,
      fecha, facturaRef, motivo, moneda,
      cliente: { nombre: clienteNombre, cedula: clienteCedula, email: clienteEmail },
      lineas: lineasCalc,
      subtotal, totalIVA, total: totalND,
      haciendaEstado: null, haciendaClave: null,
      estado: "borrador",
      creadoEn: new Date().toISOString(), creadoPor: getAutorSync(),
    };
    await guardarNotasLocal([...todas, nueva]);
    setNotas(prev => [nueva, ...prev]);
    setShowForm(false);
    resetForm();
  };

  const anular = async () => {
    if (!sel) return;
    if (!(await confirmar("Anular nota de débito", `¿Anular la nota de débito ${sel.numero}?`, { peligro: true, boton: "Anular" }))) return;
    const todas = JSON.parse(localStorage.getItem("@finanzia/notasDebitoComercial") || "[]");
    await guardarNotasLocal(todas.map(x => x.id === sel.id ? { ...x, estado: "anulada" } : x));
    setNotas(prev => prev.map(x => x.id === sel.id ? { ...x, estado: "anulada" } : x));
    setSelected(null);
  };

  // ── Enviar ND a Hacienda ──────────────────────────────────────────────────
  const enviarHacienda = async (nota) => {
    if (!nota) return;
    setEnviando(true);
    try {
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
            nombre: nota.cliente?.nombre || "Consumidor Final",
            cedula: nota.cliente?.cedula || undefined,
            correo: nota.cliente?.email || nota.cliente?.correo || undefined,
          },
          items: nota.lineas.map(l => ({
            descripcion:    l.descripcion,
            cantidad:       parseFloat(l.cantidad) || 1,
            precioUnitario: parseFloat(l.precioUnit) || 0,
            tarifaIva:      l.pctIVA ?? 13,
            codigoCabys:    l.codigoCabys || "8399000000000",
            unidadMedida:   l.unidad || "Unid",
          })),
          moneda:           nota.moneda || "CRC",
          ...referencia,
          referenciaRazon:  nota.motivo || "Cargo adicional",
        }, tipoCambio);
        if (error) { if (requiereCotizacion) recargarTipoCambio?.(); alert(error); return; }
        r = await emitir("/api/emision/nota-debito", payload, { token, idempotencyKey: `nd-${nota.id}` });
      }

      // Guardar el resultado también si falló: conserva el id para reenviar.
      const campos = camposHacienda(r, nota);
      const todas = JSON.parse(localStorage.getItem("@finanzia/notasDebitoComercial") || "[]");
      await guardarNotasLocal(todas.map(x => x.id === nota.id ? { ...x, ...campos } : x));
      setNotas(prev => prev.map(x => x.id === nota.id ? { ...x, ...campos } : x));
      if (r.ok) alert(`✅ ND enviada a Hacienda\nEstado: ${r.comprobante.estado}\nClave: ${r.comprobante.clave}`);
      else alert(`❌ ${etiquetaEstado(r.comprobante?.estado || "sin_conexion")}\n${r.error}${r.comprobante ? "\n\nLa nota quedó guardada: usá \"Enviar\" de nuevo para reintentar con la misma clave." : ""}`);
    } catch (err) {
      alert(`❌ Error al enviar a Hacienda:\n${err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  const busqL   = busq.trim().toLowerCase();
  const visibles = notas.filter(n =>
    !busqL ||
    n.cliente?.nombre?.toLowerCase().includes(busqL) ||
    n.numero?.toLowerCase().includes(busqL) ||
    n.facturaRef?.toLowerCase().includes(busqL)
  );
  const sel = visibles.find(n => n.id === selected);

  const CELDA = "w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-2.5 py-1.5 text-sm transition-colors";
  const columnas = [
    { key: "numero", titulo: "N.°", render: n => <span className="font-mono text-xs font-bold">{n.numero}</span> },
    { key: "fecha", titulo: "Fecha", render: n => fmtDate(n.fecha) },
    { key: "cliente", titulo: "Receptor", render: n => <b className="text-monki-k">{n.cliente?.nombre || "—"}</b> },
    { key: "ref", titulo: "Factura ref.", render: n => <span className="font-mono text-xs text-monki-k/50">{n.facturaRef || "—"}</span> },
    { key: "motivo", titulo: "Motivo", render: n => <span className="text-monki-k/65 text-xs">{n.motivo || "—"}</span> },
    { key: "total", titulo: "Total", alinear: "right", render: n => <b>{fmtMoney(n.total, n.moneda)}</b> },
    { key: "hacienda", titulo: "Hacienda", render: n => <BadgeHacienda estado={n.haciendaEstado} /> },
    { key: "estado", titulo: "Estado", render: n => n.estado === "anulada" ? <Estado tono="peligro">Anulada</Estado> : <Estado>{n.estado || "borrador"}</Estado> },
  ];

  return (
    <Modulo
      seccion="Facturación"
      titulo="Notas de débito"
      descripcion="Cargos adicionales sobre una factura ya emitida (ND-01). Se envían a Hacienda."
      acciones={<Boton icono={Plus} onClick={() => setShowForm(true)}>Nueva nota</Boton>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Notas" valor={notas.length} icono={FilePlus2} delay={40}/>
          <Indicador etiqueta="Enviadas" valor={notas.filter(n => yaEnviada(n)).length} icono={Send} delay={90}/>
          <Indicador etiqueta="Sin enviar" valor={notas.filter(n => n.estado !== "anulada" && !yaEnviada(n)).length} destacado delay={140}/>
          <Indicador etiqueta="Anuladas" valor={notas.filter(n => n.estado === "anulada").length} icono={Ban} delay={190}/>
        </Indicadores>
      }
    >
      <BarraFiltros resumen={`${visibles.length} nota${visibles.length !== 1 ? "s" : ""}`}>
        <Buscador valor={busq} onCambio={setBusq} placeholder="Buscar por receptor, número o factura…"/>
      </BarraFiltros>
      {sel && (
        <div className="animate-desplegar mb-3 flex flex-wrap items-center gap-3 bg-monki-k text-white rounded-2xl px-4 py-2.5 text-sm">
          <span className="monki-tag text-monki-y">Seleccionada</span>
          <b>{sel.numero}</b><span className="text-white/60">{sel.cliente?.nombre}</span>
          {sel.facturaRef && <span className="font-mono text-xs text-white/50">→ {sel.facturaRef}</span>}
          <b className="text-monki-y">{fmtMoney(sel.total, sel.moneda)}</b>
          <div className="flex-1"/>
          <Boton variante="amarillo" tamano="sm" icono={Send} cargando={enviando}
            disabled={enviando || sel.estado === "anulada" || yaEnviada(sel)}
            title={sel?.haciendaClave ? `Clave: ${sel.haciendaClave}` : "Enviar la ND-01 a Hacienda"}
            onClick={() => enviarHacienda(sel)}>
            {!sel?.haciendaEstado ? "Enviar a Hacienda" : !yaEnviada(sel) ? "Reintentar envío" : `Hacienda: ${etiquetaEstado(sel.haciendaEstado)}`}
          </Boton>
          <Boton variante="secundario" tamano="sm" icono={Ban} disabled={sel.estado === "anulada"} onClick={anular}>Anular</Boton>
        </div>
      )}
      <Tabla columnas={columnas} filas={visibles} seleccionada={selected} onFila={n => setSelected(selected === n.id ? null : n.id)}
        vacio={<Vacio icono={FilePlus2} titulo="Sin notas de débito" texto="Creá una para cobrar un cargo adicional sobre una factura."
          accion={<Boton icono={Plus} onClick={() => setShowForm(true)}>Nueva nota</Boton>}/>}/>

      {showForm && (
        <Modal titulo="Nueva nota de débito (ND-01)" subtitulo="Guardala y después enviala a Hacienda desde la tabla" onCerrar={() => setShowForm(false)} ancho="max-w-2xl"
          pie={<><Boton variante="fantasma" onClick={() => setShowForm(false)}>Cancelar</Boton><Boton onClick={guardarLocal}>Guardar nota de débito</Boton></>}>
          <div className="space-y-4">
            <div className="relative">
              <Campo etiqueta="Receptor">
                <Entrada value={busqCli}
                  onChange={e => { setBusqCli(e.target.value); setClienteNombre(e.target.value); setShowCli(true); }}
                  onFocus={() => setShowCli(true)} onBlur={() => setTimeout(() => setShowCli(false), 150)}
                  placeholder="Nombre del cliente…"/>
              </Campo>
              {showCli && filtCli.length > 0 && (
                <div className="animate-desplegar absolute top-[72px] left-0 w-full bg-white border-2 border-monki-k rounded-xl shadow-[4px_4px_0_#111] z-20 max-h-40 overflow-auto">
                  {filtCli.map(c => (
                    <button key={c.id} type="button" onMouseDown={() => selectCliente(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-monki-y border-b border-black/5 last:border-0">
                      <span className="font-semibold">{c.nombre}</span>
                      <span className="text-monki-k/40 ml-2 font-mono text-xs">{c.cedula}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Cédula del receptor"><Entrada value={clienteCedula} onChange={e => setClienteCedula(e.target.value)} placeholder="Cédula" className="font-mono"/></Campo>
              <Campo etiqueta="Correo"><Entrada value={clienteEmail} onChange={e => setClienteEmail(e.target.value)} placeholder="Correo electrónico"/></Campo>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Campo etiqueta="Fecha"><Entrada type="date" value={fecha} onChange={e => setFecha(e.target.value)}/></Campo>
              <Campo etiqueta="Factura de referencia"><Entrada value={facturaRef} onChange={e => setFacturaRef(e.target.value)} placeholder="FE-00001 o clave" className="font-mono"/></Campo>
              <Campo etiqueta="Moneda"><Seleccion value={moneda} onChange={e => setMoneda(e.target.value)} opciones={[{value:"CRC",label:"₡ CRC"},{value:"USD",label:"$ USD"}]}/></Campo>
              <Campo etiqueta="Motivo / razón" className="col-span-3"><Entrada value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Cargo adicional, intereses…"/></Campo>
            </div>
            <div className="border-2 border-black/10 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b-2 border-black/10">
                <span className="monki-tag text-monki-k/55">Líneas de detalle</span>
                <Boton variante="secundario" tamano="sm" icono={Plus} onClick={() => setLineas(p => [...p, lineaVacia()])}>Agregar línea</Boton>
              </div>
              <div className="overflow-x-auto">
                <table className="ui-tabla w-full text-sm">
                  <thead><tr className="monki-tag text-[10px] text-monki-k/45">
                    <th className="text-left px-2 py-2 font-medium">Descripción</th><th className="text-center px-2 py-2 font-medium">Cant.</th>
                    <th className="text-right px-2 py-2 font-medium">Precio unit.</th><th className="text-center px-2 py-2 font-medium">IVA</th>
                    <th className="text-right px-2 py-2 font-medium">Total</th><th/>
                  </tr></thead>
                  <tbody>
                    {lineas.map((l, i) => {
                      const lc = calcLinea(l);
                      return (
                        <tr key={l.id} className="border-t border-black/5">
                          <td className="px-1.5 py-1.5"><input value={l.descripcion} onChange={e => setLineas(p => p.map((x, j) => j === i ? { ...x, descripcion: e.target.value } : x))} placeholder="Descripción…" className={CELDA + " min-w-[140px]"}/></td>
                          <td className="px-1.5 py-1.5"><input type="number" value={l.cantidad} onChange={e => setLineas(p => p.map((x, j) => j === i ? { ...x, cantidad: e.target.value } : x))} className={CELDA + " !w-16 text-center"}/></td>
                          <td className="px-1.5 py-1.5"><input type="number" value={l.precioUnit} onChange={e => setLineas(p => p.map((x, j) => j === i ? { ...x, precioUnit: e.target.value } : x))} placeholder="0" className={CELDA + " !w-28 text-right"}/></td>
                          <td className="px-1.5 py-1.5">
                            <select value={l.codigoIVA} onChange={e => setLineas(p => p.map((x, j) => j === i ? { ...x, codigoIVA: e.target.value } : x))} className={CELDA + " !w-24 cursor-pointer"}>
                              {TIPOS_IVA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5 text-right font-bold tabular-nums">{fmtMoney(lc.total, moneda)}</td>
                          <td className="px-1 py-1.5">{lineas.length > 1 && <BotonIcono icono={Trash2} titulo="Quitar línea" tono="peligro" onClick={() => setLineas(p => p.filter((_, j) => j !== i))}/>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="bg-monki-k text-white px-4 py-3 flex flex-wrap items-center justify-end gap-x-6 gap-y-1 text-sm">
                <span className="text-white/60">Subtotal <b className="text-white">{fmtMoney(subtotal, moneda)}</b></span>
                <span className="text-white/60">IVA <b className="text-white">{fmtMoney(totalIVA, moneda)}</b></span>
                <span className="text-monki-y text-lg font-black">{fmtMoney(totalND, moneda)}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
      {dialogo}
    </Modulo>
  );
}
