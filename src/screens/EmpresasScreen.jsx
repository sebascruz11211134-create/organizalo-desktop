/**
 * EmpresasScreen — Multiempresa
 * Permite manejar múltiples RUCs/empresas desde una sola instalación.
 * Al cambiar de empresa, los datos están aislados por empresaId.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Building2, Check, Trash2 } from "lucide-react";
import { Modulo, Boton, BotonIcono, Tarjeta, Vacio, Estado, Modal, Campo, Entrada, Seleccion, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { genId } from "../utils/fmt";

const TIPOS_CEDULA = ["Jurídica (3-xxx-xxxxxx)","Física (x-xxxx-xxxx)","DIMEX","NITE"];
const REGIMENES    = ["Régimen Tradicional","Régimen Simplificado"];

function EmpresaModal({ empresa, onClose, onSave }) {
  const esNueva = !empresa?.id;
  const [form, setForm] = useState(empresa || {
    nombre:"", nombreComercial:"", cedula:"", tipoCedula:"Jurídica (3-xxx-xxxxxx)",
    correo:"", telefono:"", direccion:"", regimen:"Régimen Tradicional",
    logoUrl:"", actividadEconomica:"", moneda:"CRC",
  });
  const u = (k,v) => setForm(p=>({...p,[k]:v}));

  const guardar = async () => {
    if (!form.nombre || !form.cedula) return alert("Nombre legal y cédula requeridos.");
    const todas = await db.getEmpresas();
    const item  = { ...form };
    if (esNueva) {
      item.id       = genId();
      item.creadoEn = new Date().toISOString();
      await db.setEmpresas([...todas, item]);
    } else {
      await db.setEmpresas(todas.map(x=>x.id===item.id?item:x));
    }
    onSave(); onClose();
  };

  const campos = [
    ["Nombre legal / Razón social *","nombre","text","col-span-2"],
    ["Nombre comercial","nombreComercial","text","col-span-2"],
    ["Cédula jurídica / física *","cedula","text",""],
    ["Tipo de cédula","tipoCedula","select",""],
    ["Correo","correo","email",""],
    ["Teléfono","telefono","text",""],
    ["Actividad económica (CIIU)","actividadEconomica","text",""],
    ["Régimen tributario","regimen","select",""],
    ["Moneda principal","moneda","select",""],
    ["Dirección","direccion","text","col-span-2"],
  ];

  const OPCIONES = { tipoCedula: TIPOS_CEDULA, regimen: REGIMENES, moneda: ["CRC","USD"] };
  return (
    <Modal titulo={esNueva?"Nueva empresa":"Editar empresa"} subtitulo="Datos fiscales de la empresa" onCerrar={onClose}
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton onClick={guardar}>Guardar empresa</Boton></>}>
      <div className="grid grid-cols-2 gap-3">
        {campos.map(([lbl,key,type,cls])=>(
          <Campo key={key} etiqueta={lbl} className={cls}>
            {type==="select"
              ? <Seleccion value={form[key]||""} onChange={e=>u(key,e.target.value)} opciones={OPCIONES[key]}/>
              : <Entrada type={type} value={form[key]||""} onChange={e=>u(key,e.target.value)} className={key==="cedula"?"font-mono":""}/>}
          </Campo>
        ))}
      </div>
    </Modal>
  );
}

export default function EmpresasScreen() {
  const [empresas,   setEmpresas]   = useState([]);
  const [empresaId,  setEmpresaId]  = useState(null);
  const [modal,      setModal]      = useState(null);

  const cargar = useCallback(async () => {
    const [e, id] = await Promise.all([db.getEmpresas(), db.getEmpresaId()]);
    setEmpresas(e);
    setEmpresaId(id);
  }, []);

  useEffect(()=>{ cargar(); },[cargar]);

  const seleccionar = async (empresa) => {
    await db.setEmpresaId(empresa.id);
    setEmpresaId(empresa.id);
    // También actualiza el settings con los datos de la empresa seleccionada
    const s = await db.getSettings();
    await db.setSettings({
      ...s,
      nombreNegocio:    empresa.nombre,
      nombreComercial:  empresa.nombreComercial || empresa.nombre,
      cedula:           empresa.cedula,
      correo:           empresa.correo,
      telefono:         empresa.telefono,
      direccion:        empresa.direccion,
      moneda:           empresa.moneda || "CRC",
    });
  };

  const { confirmar, dialogo } = useConfirmar();
  const eliminar = async (id) => {
    if (!(await confirmar("Eliminar empresa", "¿Eliminar esta empresa? Sus datos locales se mantienen, pero ya no se podrá seleccionar.", { peligro: true, boton: "Eliminar" }))) return;
    const todas = await db.getEmpresas();
    await db.setEmpresas(todas.filter(x=>x.id!==id));
    cargar();
  };

  return (
    <Modulo
      seccion="Administración"
      titulo="Empresas"
      descripcion="Manejá varias empresas o cédulas desde la misma cuenta. La activa es la que factura."
      acciones={<Boton icono={Plus} onClick={()=>setModal({})}>Nueva empresa</Boton>}
    >
      <div className="flex-1 overflow-auto -mx-1 px-1 pb-1">
        {empresas.length === 0 ? (
          <Tarjeta className="h-full flex items-center justify-center">
            <Vacio icono={Building2} titulo="Sin empresas registradas" texto="Agregá tu primera empresa para empezar."
              accion={<Boton icono={Plus} onClick={()=>setModal({})}>Agregar empresa</Boton>}/>
          </Tarjeta>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {empresas.map((e,i)=>{
              const esActiva = empresaId === e.id;
              return (
                <div key={e.id} style={{ animationDelay: `${Math.min(i,8)*50}ms` }}
                  className={`animate-entrar rounded-[18px] border-2 p-5 flex flex-wrap items-center gap-4 transition-all duration-300 ease-monki
                    ${esActiva?"bg-monki-k text-white border-monki-k shadow-[6px_6px_0_#FFD600]":"bg-white border-black/10 hover:border-monki-k hover:-translate-y-0.5"}`}>
                  <span className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 text-xl font-black ${esActiva?"bg-monki-y text-monki-k":"bg-monki-cream text-monki-k"}`}>
                    {e.nombre?.charAt(0)?.toUpperCase()||"E"}
                  </span>
                  <div className="flex-1 min-w-[180px]">
                    <div className="flex items-center gap-2">
                      <p className="font-extrabold text-[16px] truncate">{e.nombre}</p>
                      {esActiva && <Estado tono="alerta">Activa</Estado>}
                    </div>
                    {e.nombreComercial && e.nombreComercial !== e.nombre && (
                      <p className={`text-sm ${esActiva?"text-white/60":"text-monki-k/55"}`}>{e.nombreComercial}</p>
                    )}
                    <div className={`flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 font-mono text-[11px] ${esActiva?"text-white/55":"text-monki-k/45"}`}>
                      {e.cedula && <span>Cédula {e.cedula}</span>}
                      {e.correo && <span>{e.correo}</span>}
                      {e.regimen && <span>{e.regimen}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!esActiva && <Boton variante="secundario" tamano="sm" icono={Check} onClick={()=>seleccionar(e)}>Activar</Boton>}
                    <span className={esActiva?"[&_button]:text-white/70 [&_button:hover]:text-monki-y":""}><BotonIcono icono={Edit2} titulo="Editar" onClick={()=>setModal(e)}/></span>
                    {!esActiva && <BotonIcono icono={Trash2} titulo="Eliminar" tono="peligro" onClick={()=>eliminar(e.id)}/>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal!==null && (
        <EmpresaModal empresa={Object.keys(modal).length>0?modal:null} onClose={()=>setModal(null)} onSave={cargar}/>
      )}
      {dialogo}
    </Modulo>
  );
}
