/**
 * RecepcionScreen — Recepción masiva de facturas electrónicas XML
 *
 * 1. Zona drag & drop (o click) para subir hasta 500 XMLs de Hacienda
 * 2. Tabla de revisión con emisor, total, estado
 * 3. Botón "Aceptar" individual o "Aceptar todos" en masa
 * 4. Requiere certificado .p12 configurado en Configuración
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText, CheckCircle, Clock, Loader2,
  AlertCircle, RefreshCw, Inbox, Check, X, CloudOff
} from "lucide-react";
import { Modulo, Boton, BarraFiltros, Tabla, Vacio, Estado, Indicadores, Indicador, Campo, Entrada } from "../components/ui";
import { getToken } from "../utils/auth";

import { BACKEND } from "../utils/config";

const ESTADO_BADGE = {
  pendiente:        { label: "Pendiente",       tono: "alerta" },
  aceptada:         { label: "Aceptada",         tono: "exito" },
  rechazada:        { label: "Rechazada",        tono: "peligro" },
  aceptada_parcial: { label: "Parcial",          tono: "oscuro" },
  error_hacienda:   { label: "Error Hacienda",   tono: "peligro" },
};

function fmt(n) {
  return n != null ? Number(n).toLocaleString("es-CR", { minimumFractionDigits: 2 }) : "—";
}

export default function RecepcionScreen() {
  const [facturas,   setFacturas]   = useState([]);
  const [filtroEst,  setFiltroEst]  = useState("");
  const [cargando,   setCargando]   = useState(false);
  const [subiendo,   setSubiendo]   = useState(false);
  const [dragging,   setDragging]   = useState(false);
  const [errorConex, setErrorConex] = useState(false);
  const [msg,        setMsg]        = useState(null);   // { type, text }
  const [procesando, setProcesando] = useState({});     // { [id]: true }
  const [aceptTodos, setAceptTodos] = useState(false);
  const [haciendaToken, setHaciendaToken] = useState("");
  const fileRef = useRef(null);

  useEffect(() => { cargar(); }, [filtroEst]);

  async function cargar() {
    setCargando(true);
    setErrorConex(false);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000); // 5s timeout
    try {
      const token = await getToken();
      const url = `${BACKEND}/api/recepcion/lista${filtroEst ? `?estado=${filtroEst}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (res.ok) setFacturas(await res.json());
      else setErrorConex(true);
    } catch {
      setErrorConex(true);
    } finally {
      clearTimeout(timer);
      setCargando(false);
    }
  }

  // ── Subir XMLs ─────────────────────────────────────────────────────────────
  async function procesarArchivos(files) {
    if (!files?.length) return;
    const xmlFiles = Array.from(files).filter((f) =>
      f.name.endsWith(".xml") || f.type.includes("xml")
    );
    if (!xmlFiles.length) {
      setMsg({ type: "err", text: "Ningún archivo es un XML válido" });
      return;
    }
    setSubiendo(true);
    setMsg(null);
    try {
      const token = await getToken();
      const form = new FormData();
      xmlFiles.forEach((f) => form.append("xmls", f));
      const res = await fetch(`${BACKEND}/api/recepcion/procesar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "ok", text: `${data.procesadas} factura(s) importada(s)${data.errores ? ` · ${data.errores} con error` : ""}` });
        cargar();
      } else {
        setMsg({ type: "err", text: data.error || "Error al procesar los XMLs" });
      }
    } catch (e) {
      setMsg({ type: "err", text: e.message });
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // Drag & drop handlers
  const onDragOver  = useCallback((e) => { e.preventDefault(); setDragging(true);  }, []);
  const onDragLeave = useCallback((e) => { e.preventDefault(); setDragging(false); }, []);
  const onDrop      = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    procesarArchivos(e.dataTransfer.files);
  }, []);

  // ── Aceptar individual ────────────────────────────────────────────────────
  async function aceptar(id, mensajeTipo = 1) {
    setProcesando((p) => ({ ...p, [id]: true }));
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/recepcion/aceptar/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: mensajeTipo, haciendaToken }),
      });
      const data = await res.json();
      if (!res.ok) setMsg({ type: "err", text: data.error || "Error al enviar a Hacienda" });
      cargar();
    } catch (e) {
      setMsg({ type: "err", text: e.message });
    } finally {
      setProcesando((p) => { const n = { ...p }; delete n[id]; return n; });
    }
  }

  // ── Aceptar todos ─────────────────────────────────────────────────────────
  async function aceptarTodos() {
    setAceptTodos(true);
    setMsg(null);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/recepcion/aceptar-todos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ haciendaToken }),
      });
      const data = await res.json();
      const ok  = data.resultados?.filter((r) => r.ok).length || 0;
      const err = data.resultados?.filter((r) => !r.ok).length || 0;
      setMsg({ type: ok > 0 ? "ok" : "err", text: `${ok} aceptadas · ${err} con error` });
      cargar();
    } catch (e) {
      setMsg({ type: "err", text: e.message });
    } finally {
      setAceptTodos(false);
    }
  }

  const pendientes = facturas.filter((f) => f.estado === "pendiente").length;

  const columnas = [
    { key: "fecha", titulo: "Fecha", render: f => <span className="whitespace-nowrap">{f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString("es-CR") : "—"}</span> },
    { key: "emisor", titulo: "Emisor", render: f => <b className="text-monki-k block max-w-[220px] truncate">{f.emisor_nombre || "—"}</b> },
    { key: "cedula", titulo: "Cédula", render: f => <span className="font-mono text-xs text-monki-k/55">{f.emisor_cedula || "—"}</span> },
    { key: "total", titulo: "Total", alinear: "right", render: f => <b>{f.moneda === "USD" ? "$" : "₡"}{fmt(f.total_factura)}</b> },
    { key: "iva", titulo: "IVA", alinear: "right", render: f => <span className="text-monki-k/55">{fmt(f.total_iva)}</span> },
    { key: "estado", titulo: "Estado", alinear: "center", render: f => { const b = ESTADO_BADGE[f.estado] || { label: f.estado, tono: "neutro" }; return <Estado tono={b.tono}>{b.label}</Estado>; } },
    { key: "accion", titulo: "Acción", alinear: "right", render: f => f.estado === "pendiente" ? (
      <div className="flex items-center justify-end gap-1.5">
        <Boton tamano="sm" variante="amarillo" icono={Check} cargando={procesando[f.id]} disabled={procesando[f.id]} onClick={() => aceptar(f.id, 1)}>Aceptar</Boton>
        <Boton tamano="sm" variante="peligro" icono={X} disabled={procesando[f.id]} onClick={() => aceptar(f.id, 3)}>Rechazar</Boton>
      </div>) : <span className="text-monki-k/30">—</span> },
  ];
  const FILTROS = [["", "Todas"], ["pendiente", "Pendientes"], ["aceptada", "Aceptadas"], ["rechazada", "Rechazadas"], ["error_hacienda", "Error Hacienda"]];

  return (
    <Modulo
      seccion="Compras"
      titulo="Recepción de facturas"
      descripcion="Importá los XML que te mandan tus proveedores y respondé a Hacienda (Mensaje Receptor)."
      acciones={<>
        <Boton variante="secundario" icono={RefreshCw} onClick={cargar} cargando={cargando}>Actualizar</Boton>
        {pendientes > 0 && <Boton icono={Check} onClick={aceptarTodos} cargando={aceptTodos} disabled={aceptTodos}>Aceptar {pendientes} pendiente{pendientes > 1 ? "s" : ""}</Boton>}
      </>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Recibidas" valor={facturas.length} detalle={filtroEst ? "Con el filtro actual" : "En total"} icono={Inbox} delay={40}/>
          <Indicador etiqueta="Pendientes" valor={pendientes} detalle="Por responder a Hacienda" icono={Clock} destacado={pendientes>0} delay={90} onClick={()=>setFiltroEst("pendiente")}/>
          <Indicador etiqueta="Aceptadas" valor={facturas.filter(f=>f.estado==="aceptada").length} icono={CheckCircle} delay={140} onClick={()=>setFiltroEst("aceptada")}/>
          <Indicador etiqueta="Con problema" valor={facturas.filter(f=>f.estado==="rechazada"||f.estado==="error_hacienda").length} icono={AlertCircle} alerta={facturas.some(f=>f.estado==="error_hacienda")} delay={190} onClick={()=>setFiltroEst("error_hacienda")}/>
        </Indicadores>
      }
      pestanas={{ activa: filtroEst, onCambiar: setFiltroEst, items: FILTROS.map(([key,label]) => ({ key, label })) }}
    >
      <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3">
        <div
          onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`shrink-0 rounded-[18px] border-2 border-dashed px-6 py-6 text-center cursor-pointer transition-all duration-300 ease-monki
            ${dragging ? "border-monki-k bg-monki-y scale-[1.01]" : "border-black/20 bg-white hover:border-monki-k hover:bg-monki-y/30"}`}>
          {subiendo ? (
            <div className="flex flex-col items-center gap-2 text-monki-k">
              <Loader2 size={28} className="animate-spin" />
              <p className="text-sm font-bold">Procesando XML…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="w-12 h-12 rounded-full bg-monki-y flex items-center justify-center shadow-[3px_3px_0_#111]"><Inbox size={22} className="text-monki-k"/></span>
              <p className="text-sm font-bold text-monki-k">Arrastrá archivos <span className="font-mono">.xml</span> aquí o hacé clic para elegirlos</p>
              <p className="text-xs text-monki-k/50">Hasta 500 a la vez — facturas, tiquetes y notas de crédito.</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".xml,text/xml,application/xml" multiple className="hidden"
            onChange={(e) => procesarArchivos(e.target.files)} />
        </div>

        {msg && (
          <div className={`animate-desplegar flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold
            ${msg.type === "ok" ? "bg-[#dcfce7] text-[#166534]" : "bg-red-100 text-red-700"}`}>
            {msg.type === "ok" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {msg.text}
          </div>
        )}

        <BarraFiltros resumen={`${facturas.length} factura(s) · requiere la llave .p12 en Configuración`}>
          <Campo etiqueta="Token de Hacienda (opcional)" className="flex-1 max-w-md">
            <Entrada type="password" value={haciendaToken} onChange={(e) => setHaciendaToken(e.target.value)}
              placeholder="Dejalo vacío si está configurado en el servidor" autoComplete="new-password" />
          </Campo>
        </BarraFiltros>

        {errorConex && !cargando ? (
          <div className="ui-tarjeta flex-1 bg-white rounded-[18px] border-2 border-black/10 flex items-center justify-center">
            <Vacio icono={CloudOff} titulo="No se pudo conectar al servidor" texto="La recepción necesita el servidor en línea. Revisá tu conexión e intentá de nuevo."
              accion={<Boton variante="secundario" icono={RefreshCw} onClick={cargar}>Reintentar</Boton>}/>
          </div>
        ) : (
          <Tabla columnas={columnas} filas={facturas} cargando={cargando} className="min-h-[240px]"
            vacio={<Vacio icono={FileText} titulo="No hay facturas recibidas" texto={filtroEst ? "Nada con este estado." : "Subí los XML de tus proveedores para empezar."}/>}/>
        )}
      </div>
    </Modulo>
  );
}
