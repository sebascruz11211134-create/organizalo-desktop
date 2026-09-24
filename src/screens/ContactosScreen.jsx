import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, Users, Briefcase, Trash2, Loader2, Edit2, Contact } from "lucide-react";
import { Modulo, Boton, BotonIcono, BarraFiltros, Buscador, Tabla, Vacio, Estado, Indicadores, Indicador, Modal, Campo, Entrada, Seleccion, AreaTexto, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { useAccionInicial } from "../hooks/useAccionInicial";
import { genId } from "../utils/fmt";
import { generarCodigoCliente } from "../utils/clienteUtils";

function ContactoModal({ contacto, onClose, onSave }) {
  const [nombre,        setNombre]        = useState(contacto?.nombre        || "");
  const [cedula,        setCedula]        = useState(contacto?.cedula        || "");
  const [tipoCedula,    setTipoCedula]    = useState(contacto?.tipoCedula    || "01");
  const [tipo,          setTipo]          = useState(contacto?.tipo          || "cliente");
  const [email,         setEmail]         = useState(contacto?.email         || "");
  const [tel,           setTel]           = useState(contacto?.tel           || "");
  const [notas,         setNotas]         = useState(contacto?.notas         || "");
  const [codigoCli,     setCodigoCli]     = useState(contacto?.codigoCliente || "");
  const [diasCredito,   setDiasCredito]   = useState(contacto?.dias_credito  ?? "");
  const [buscando,      setBuscando]      = useState(false);
  const [cedulaError,   setCedulaError]   = useState("");
  const [situacion,     setSituacion]     = useState(null); // { moroso, omiso, estado }

  // Buscar en API pública de Hacienda CR
  const buscarEnHacienda = async () => {
    const num = cedula.trim().replace(/\D/g, "");
    if (!num) return;
    setCedulaError("");
    setSituacion(null);
    setBuscando(true);
    try {
      const res  = await fetch(`https://api.hacienda.go.cr/fe/ae?identificacion=${num}`, { signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      if (data?.nombre) {
        const tCed = data.tipoIdentificacion || (num.length === 9 ? "01" : num.length === 10 ? "02" : "03");
        setNombre(data.nombre);
        setTipoCedula(tCed);
        const sit = data.situacion || {};
        setSituacion({
          moroso: sit.moroso ?? false,
          omiso:  sit.omiso  ?? false,
        });
      } else {
        setCedulaError("No encontrado en Hacienda");
      }
    } catch {
      setCedulaError("Sin conexión a Hacienda");
    } finally {
      setBuscando(false);
    }
  };

  const guardar = async () => {
    if (!nombre.trim()) return;
    const todos = await db.getContactos();
    const codigo = codigoCli.trim() || (contacto ? contacto.codigoCliente : generarCodigoCliente(todos));
    const dias = diasCredito === "" ? 0 : parseInt(diasCredito) || 0;
    const esNuevo = !contacto;
    const newId = genId();
    const upd = contacto
      ? todos.map((c) => c.id === contacto.id ? { ...c, nombre, cedula, tipoCedula, tipo, email, tel, notas, codigoCliente: codigo, dias_credito: dias } : c)
      : [{ id: newId, nombre, cedula, tipoCedula, tipo, email, tel, notas, codigoCliente: codigo, dias_credito: dias, creadoEn: new Date().toISOString() }, ...todos];
    await db.setContactos(upd);

    // Si es nuevo contacto de tipo cliente/ambos → agregar al CRM como prospecto
    if (esNuevo && (tipo === "cliente" || tipo === "ambos")) {
      const contactosCRM = await db.getContactos();
      const yaExiste = contactosCRM.find(c => c.id === newId);
      if (yaExiste && !yaExiste.etapaCRM) {
        await db.setContactos(contactosCRM.map(c =>
          c.id === newId ? { ...c, etapaCRM: "prospecto", notas: notas, crmCreadoEn: new Date().toISOString() } : c
        ));
      }
    }

    onSave(); onClose();
  };

  const TIPO_CED_LABEL = { "01": "Física", "02": "Jurídica", "03": "DIMEX", "04": "NITE" };

  const alerta = situacion && (situacion.moroso === "SI" || situacion.omiso === "SI");
  return (
    <Modal titulo={contacto ? "Editar contacto" : "Nuevo contacto"} subtitulo={contacto ? contacto.nombre : "Cliente o proveedor"} onCerrar={onClose} ancho="max-w-md"
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton onClick={guardar} disabled={!nombre.trim()}>Guardar contacto</Boton></>}>
      <div className="space-y-4">
        <Campo etiqueta="Cédula" error={cedulaError} ayuda={buscando ? "Consultando Hacienda…" : "Enter o la lupa para traer el nombre desde Hacienda"}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Entrada value={cedula} onChange={(e) => { setCedula(e.target.value); setCedulaError(""); setSituacion(null); }}
                onKeyDown={(e) => e.key === "Enter" && buscarEnHacienda()} placeholder="Número de cédula" className="pr-11" />
              <button type="button" onClick={buscarEnHacienda} disabled={buscando || !cedula.trim()} title="Consultar Hacienda CR"
                className="ui-boton absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center bg-monki-y text-monki-k hover:scale-105 transition-transform disabled:opacity-30 disabled:hover:scale-100">
                {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              </button>
            </div>
            <Seleccion value={tipoCedula} onChange={(e) => setTipoCedula(e.target.value)} className="!w-32"
              opciones={[["01","Física"],["02","Jurídica"],["03","DIMEX"],["04","NITE"]].map(([v,l]) => ({ value: v, label: `${v} · ${l}` }))} />
          </div>
          {situacion && (
            <div className="mt-2">
              <Estado tono={alerta ? "peligro" : "exito"}>
                {situacion.moroso === "SI" && situacion.omiso === "SI" ? "Moroso + Omiso" :
                 situacion.moroso === "SI" ? "Moroso" : situacion.omiso === "SI" ? "Omiso" : "Al día con Hacienda"}
              </Estado>
            </div>
          )}
        </Campo>
        <div className="grid grid-cols-[1fr_7.5rem] gap-3">
          <Campo etiqueta="Nombre *"><Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} /></Campo>
          <Campo etiqueta="Código"><Entrada value={codigoCli} onChange={(e) => setCodigoCli(e.target.value.toUpperCase())} placeholder="CLI-0001" className="font-mono" /></Campo>
        </div>
        <Campo etiqueta="Tipo">
          <div className="grid grid-cols-3 gap-2">
            {[["cliente","Cliente"],["proveedor","Proveedor"],["ambos","Ambos"]].map(([v,l]) => (
              <button key={v} type="button" onClick={() => setTipo(v)}
                className={`ui-boton py-2 rounded-full text-sm font-bold transition-all duration-300 ease-monki ${tipo===v ? "bg-monki-k text-monki-y" : "bg-white shadow-[inset_0_0_0_2px_rgba(17,17,17,.12)] text-monki-k/60 hover:text-monki-k"}`}>{l}</button>
            ))}
          </div>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Correo"><Entrada type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
          <Campo etiqueta="Teléfono"><Entrada value={tel} onChange={(e) => setTel(e.target.value)} /></Campo>
        </div>
        <div className="grid grid-cols-[1fr_8rem] gap-3">
          <Campo etiqueta="Notas"><AreaTexto value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} /></Campo>
          <Campo etiqueta={tipo === "proveedor" ? "Días de pago" : "Días de crédito"} ayuda={tipo === "proveedor" ? "Plazo para pagarle" : "Plazo que le das"}>
            <Entrada type="number" min="0" max="365" value={diasCredito} onChange={(e) => setDiasCredito(e.target.value)} placeholder="0 = contado" className="text-right" />
          </Campo>
        </div>
      </div>
    </Modal>
  );
}


export default function ContactosScreen() {
  const [contactos, setContactos] = useState([]);
  const [busq,      setBusq]      = useState("");
  useAccionInicial({ accion: v => v === "nuevo" && setModal({}) });
  const [filtro,    setFiltro]    = useState("todos");
  const [modal,     setModal]     = useState(null);
  const [selected,  setSelected]  = useState(null); // id seleccionado

  const cargar = useCallback(async () => {
    const c = await db.getContactos();
    setContactos(c);
  }, []);

  const { confirmar, dialogo } = useConfirmar();
  const eliminar = async (c) => {
    if (!(await confirmar("Eliminar contacto", `¿Eliminar a "${c.nombre}"? Esta acción no se puede deshacer.`, { peligro: true, boton: "Eliminar" }))) return;
    const todos = await db.getContactos();
    await db.setContactos(todos.filter((x) => x.id !== c.id));
    setSelected(null);
    cargar();
  };

  useEffect(() => { cargar(); }, [cargar]);

  const busqL = busq.trim().toLowerCase();
  const visibles = contactos.filter((c) => {
    const match = !busqL ||
      c.nombre?.toLowerCase().includes(busqL) ||
      c.cedula?.includes(busqL) ||
      c.codigoCliente?.toLowerCase().includes(busqL);
    const tipo  = filtro === "todos" || c.tipo === filtro || (filtro !== "ambos" && c.tipo === "ambos");
    return match && tipo;
  });

  const sel = visibles.find(c => c.id === selected);
  const TONO_TIPO = { cliente: "exito", proveedor: "alerta", ambos: "oscuro" };
  const TIPO_LABEL = { cliente: "Cliente", proveedor: "Proveedor", ambos: "Ambos" };
  const nClientes = contactos.filter(c => c.tipo === "cliente" || c.tipo === "ambos").length;
  const nProv = contactos.filter(c => c.tipo === "proveedor" || c.tipo === "ambos").length;
  const nCredito = contactos.filter(c => c.dias_credito > 0).length;

  const columnas = [
    { key: "codigo", titulo: "Código", render: c => c.codigoCliente ? <span className="font-mono text-xs font-bold bg-monki-cream px-2 py-0.5 rounded-md">{c.codigoCliente}</span> : <span className="text-monki-k/25">—</span> },
    { key: "nombre", titulo: "Nombre", render: c => (
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-full bg-monki-y flex items-center justify-center shrink-0 text-[12px] font-black text-monki-k">{(c.nombre || "?").trim().charAt(0).toUpperCase()}</span>
        <span className="font-bold text-monki-k">{c.nombre}</span>
      </div>) },
    { key: "cedula", titulo: "Cédula", render: c => <span className="font-mono text-xs text-monki-k/55">{c.cedula || "—"}</span> },
    { key: "tipo", titulo: "Tipo", render: c => <Estado tono={TONO_TIPO[c.tipo] || "neutro"}>{TIPO_LABEL[c.tipo] || c.tipo}</Estado> },
    { key: "credito", titulo: "Crédito", render: c => c.dias_credito > 0 ? <b>{c.dias_credito} días</b> : <span className="text-monki-k/40">Contado</span> },
    { key: "email", titulo: "Correo", render: c => <span className="text-monki-k/60">{c.email || "—"}</span> },
    { key: "tel", titulo: "Teléfono", render: c => <span className="text-monki-k/60">{c.tel || "—"}</span> },
    { key: "acciones", titulo: "", alinear: "right", render: c => (
      <div className="flex justify-end gap-0.5" onClick={e => e.stopPropagation()}>
        <BotonIcono icono={Edit2} titulo="Editar" onClick={() => setModal(c)} />
        <BotonIcono icono={Trash2} titulo="Eliminar" tono="peligro" onClick={() => eliminar(c)} />
      </div>) },
  ];

  const FILTROS = [["todos","Todos"],["cliente","Clientes"],["proveedor","Proveedores"]];

  return (
    <Modulo
      seccion="Contactos"
      titulo="Contactos"
      descripcion="Clientes y proveedores, con su cédula validada en Hacienda."
      acciones={<Boton icono={Plus} onClick={() => setModal({})}>Nuevo contacto</Boton>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Contactos" valor={contactos.length} detalle="En total" icono={Contact} delay={40} onClick={() => setFiltro("todos")} />
          <Indicador etiqueta="Clientes" valor={nClientes} detalle="Incluye ‘ambos’" icono={Users} delay={90} onClick={() => setFiltro("cliente")} />
          <Indicador etiqueta="Proveedores" valor={nProv} detalle="Incluye ‘ambos’" icono={Briefcase} delay={140} onClick={() => setFiltro("proveedor")} />
          <Indicador etiqueta="Con crédito" valor={nCredito} detalle="Plazo mayor a 0 días" destacado delay={190} />
        </Indicadores>
      }
      pestanas={{ activa: filtro, onCambiar: setFiltro, items: FILTROS.map(([key,label]) => ({ key, label })) }}
    >
      <BarraFiltros resumen={`${visibles.length} de ${contactos.length}`}>
        <Buscador valor={busq} onCambio={setBusq} placeholder="Buscar por nombre, cédula o código…" />
      </BarraFiltros>
      <Tabla columnas={columnas} filas={visibles} seleccionada={selected}
        onFila={c => setSelected(c.id === selected ? null : c.id)}
        vacio={<Vacio icono={Users} titulo={contactos.length ? "Sin resultados" : "Todavía no hay contactos"}
          texto={contactos.length ? "Probá con otra búsqueda o filtro." : "Agregá tu primer cliente o proveedor."}
          accion={!contactos.length && <Boton icono={Plus} onClick={() => setModal({})}>Nuevo contacto</Boton>} />} />
      {sel && (
        <div className="animate-desplegar mt-3 flex flex-wrap items-center gap-3 bg-monki-k text-white rounded-2xl px-4 py-2.5 text-sm">
          <span className="monki-tag text-monki-y">Seleccionado</span>
          <b>{sel.nombre}</b><span className="text-white/60 font-mono text-xs">{sel.cedula || "Sin cédula"}</span>
          <div className="flex-1" />
          <Boton variante="amarillo" tamano="sm" icono={Edit2} onClick={() => setModal(sel)}>Editar</Boton>
          <Boton variante="peligro" tamano="sm" icono={Trash2} onClick={() => eliminar(sel)}>Eliminar</Boton>
        </div>
      )}
      {modal && <ContactoModal contacto={modal.id ? modal : null} onClose={() => setModal(null)} onSave={cargar} />}
      {dialogo}
    </Modulo>
  );
}
