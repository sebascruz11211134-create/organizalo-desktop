/**
 * UsuariosScreen — Gestión de usuarios y roles
 * Roles: admin | contador | vendedor | solo_lectura
 * Cada usuario tiene un PIN de 4 dígitos para identificarse.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Shield, Eye, EyeOff, Trash2, Check, UserCheck } from "lucide-react";
import { Modulo, Boton, BotonIcono, Tabla, Vacio, Estado, Tarjeta, Modal, Campo, Entrada, Seleccion, Interruptor, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { genId, hoy } from "../utils/fmt";

const ROLES = [
  { id:"admin",        label:"Administrador",  desc:"Acceso completo a todas las funciones y configuraciones.",   tono:"oscuro" },
  { id:"contador",     label:"Contador",        desc:"Acceso a contabilidad, reportes y declaraciones. Sin facturar.", tono:"alerta" },
  { id:"vendedor",     label:"Vendedor",        desc:"Puede facturar, ver CXC y recibos. Sin acceso a contabilidad.", tono:"exito" },
  { id:"solo_lectura", label:"Solo lectura",    desc:"Ve reportes y datos pero no puede crear ni editar nada.",    tono:"neutro" },
];

const PERMISOS = {
  admin:        ["*"],
  contador:     ["contabilidad","reportes","d104","planillas","configuracion"],
  vendedor:     ["facturacion","cxc","recibos","inventario","contactos","cotizaciones","pos","pedidos"],
  solo_lectura: ["reportes","estado-cuenta","reporte-cxc","reporte-recibos","reporte-vencidos"],
};

function UsuarioModal({ usuario, onClose, onSave }) {
  const esNuevo = !usuario?.id;
  const [form, setForm] = useState(usuario || { nombre:"", correo:"", rol:"vendedor", pin:"", activo:true });
  const [showPin, setShowPin] = useState(false);
  const u = (k,v) => setForm(p=>({...p,[k]:v}));

  const guardar = async () => {
    if (!form.nombre) return alert("Nombre requerido.");
    if (!form.pin || form.pin.length !== 4 || !/^\d+$/.test(form.pin)) return alert("PIN debe ser exactamente 4 dígitos.");
    const todos = await db.getUsuarios();
    const item  = { ...form };
    if (esNuevo) {
      item.id       = genId();
      item.creadoEn = new Date().toISOString();
      await db.setUsuarios([...todos, item]);
    } else {
      await db.setUsuarios(todos.map(x=>x.id===item.id?item:x));
    }
    onSave(); onClose();
  };

  const rolInfo = ROLES.find(r=>r.id===form.rol);

  return (
    <Modal titulo={esNuevo?"Nuevo usuario":"Editar usuario"} subtitulo="Quién entra y qué puede hacer" onCerrar={onClose} ancho="max-w-md"
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton onClick={guardar}>Guardar usuario</Boton></>}>
      <div className="space-y-4">
        <Campo etiqueta="Nombre completo *"><Entrada value={form.nombre} onChange={e=>u("nombre",e.target.value)}/></Campo>
        <Campo etiqueta="Correo"><Entrada type="email" value={form.correo} onChange={e=>u("correo",e.target.value)} placeholder="usuario@empresa.com"/></Campo>
        <Campo etiqueta="Rol" ayuda={rolInfo?.desc}>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map(r=>(
              <button key={r.id} type="button" onClick={()=>u("rol",r.id)}
                className={`ui-boton py-2 rounded-full text-sm font-bold transition-all duration-300 ease-monki ${form.rol===r.id ? "bg-monki-k text-monki-y" : "bg-white shadow-[inset_0_0_0_2px_rgba(17,17,17,.12)] text-monki-k/60 hover:text-monki-k"}`}>{r.label}</button>
            ))}
          </div>
        </Campo>
        <Campo etiqueta="PIN de 4 dígitos *">
          <div className="relative">
            <Entrada type={showPin?"text":"password"} value={form.pin} onChange={e=>u("pin",e.target.value.slice(0,4))}
              maxLength={4} placeholder="••••" className="pr-11 font-mono tracking-[.4em]"/>
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2"><BotonIcono icono={showPin?EyeOff:Eye} titulo={showPin?"Ocultar":"Mostrar"} onClick={()=>setShowPin(p=>!p)}/></span>
          </div>
        </Campo>
        <Interruptor activo={form.activo} onCambio={v=>u("activo",v)} etiqueta="Usuario activo"/>
      </div>
    </Modal>
  );
}

export default function UsuariosScreen() {
  const [usuarios, setUsuarios] = useState([]);
  const [modal,    setModal]    = useState(null);
  const [usuActivo,setUsuActivo]= useState(null);

  const cargar = useCallback(async () => {
    const [u, ua] = await Promise.all([db.getUsuarios(), db.getUsuarioActivo()]);
    setUsuarios(u);
    setUsuActivo(ua);
  }, []);

  useEffect(()=>{ cargar(); },[cargar]);

  const { confirmar, dialogo } = useConfirmar();
  const eliminar = async (id) => {
    if (!(await confirmar("Eliminar usuario", "¿Eliminar este usuario? Ya no va a poder entrar con su PIN.", { peligro: true, boton: "Eliminar" }))) return;
    const todos = await db.getUsuarios();
    await db.setUsuarios(todos.filter(x=>x.id!==id));
    cargar();
  };

  const activar = async (usuario) => {
    await db.setUsuarioActivo(usuario);
    setUsuActivo(usuario);
  };

  const MODULOS = [
    ["Facturación electrónica","facturacion"], ["CXC / CXP","cxc"], ["Recibos de caja","recibos"], ["Inventario","inventario"],
    ["Reportes","reportes"], ["Planillas","planillas"], ["Declaración D-104","d104"], ["Contabilidad","contabilidad"],
    ["Usuarios","*"], ["Configuración","configuracion"],
  ];
  const columnas = [
    { key: "nombre", titulo: "Nombre", render: u => (
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-full bg-monki-y flex items-center justify-center shrink-0 text-[12px] font-black">{(u.nombre||"?").charAt(0).toUpperCase()}</span>
        <b className="text-monki-k">{u.nombre}</b>
      </div>) },
    { key: "correo", titulo: "Correo", render: u => <span className="text-monki-k/55">{u.correo||"—"}</span> },
    { key: "rol", titulo: "Rol", render: u => { const r = ROLES.find(x=>x.id===u.rol); return <Estado tono={r?.tono||"neutro"}>{r?.label||u.rol}</Estado>; } },
    { key: "sesion", titulo: "Sesión", render: u => usuActivo?.id===u.id
        ? <span className="inline-flex items-center gap-1.5 text-sm font-bold"><span className="monki-pulse"/>En uso</span>
        : <Boton variante="secundario" tamano="sm" icono={UserCheck} onClick={e=>{e.stopPropagation();activar(u);}}>Usar este</Boton> },
    { key: "estado", titulo: "Estado", render: u => u.activo ? <Estado tono="exito">Activo</Estado> : <Estado>Inactivo</Estado> },
    { key: "acciones", titulo: "", alinear: "right", render: u => (
      <div className="flex justify-end gap-0.5" onClick={e=>e.stopPropagation()}>
        <BotonIcono icono={Edit2} titulo="Editar" onClick={()=>setModal(u)}/>
        <BotonIcono icono={Trash2} titulo="Eliminar" tono="peligro" onClick={()=>eliminar(u.id)}/>
      </div>) },
  ];

  return (
    <Modulo
      seccion="Administración"
      titulo="Usuarios y roles"
      descripcion="Controlá quién entra al sistema y qué módulos puede usar cada uno."
      acciones={<Boton icono={Plus} onClick={()=>setModal({})}>Nuevo usuario</Boton>}
      indicadores={
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {ROLES.map((r,i)=>(
            <div key={r.id} style={{ animationDelay: `${40+i*50}ms` }} className="animate-entrar bg-white rounded-[18px] border-2 border-black/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <Estado tono={r.tono}>{r.label}</Estado>
                <span className="font-mono text-xs text-monki-k/45">{usuarios.filter(u=>u.rol===r.id).length}</span>
              </div>
              <p className="text-xs text-monki-k/55 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      }
    >
      <div className="flex-1 overflow-auto space-y-3 -mx-1 px-1 pb-1">
        {usuActivo && (
          <p className="text-sm text-monki-k/55">Sesión activa: <b className="text-monki-k">{usuActivo.nombre}</b></p>
        )}
        <Tabla columnas={columnas} filas={usuarios} onFila={u=>setModal(u)} className="!flex-none"
          vacio={<Vacio icono={Shield} titulo="Sin usuarios configurados" texto="Agregá usuarios para controlar el acceso al sistema."
            accion={<Boton icono={Plus} onClick={()=>setModal({})}>Crear el primero</Boton>}/>}/>

        <Tarjeta titulo="Permisos por rol" cuerpo="px-4 pb-4 overflow-x-auto" className="!flex-none">
          <table className="ui-tabla w-full text-sm">
            <thead>
              <tr className="monki-tag text-monki-k/50">
                <th className="text-left py-2.5 px-3 font-medium border-b-2 border-black/10">Módulo</th>
                {ROLES.map(r=><th key={r.id} className="py-2.5 px-3 font-medium border-b-2 border-black/10 text-center">{r.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {MODULOS.map(([label,perm])=>(
                <tr key={perm} className="border-b border-black/5 last:border-0 hover:bg-monki-cream/60 transition-colors">
                  <td className="py-2 px-3 font-semibold text-monki-k/80">{label}</td>
                  {ROLES.map(r=>{
                    const tiene = PERMISOS[r.id]?.includes("*") || PERMISOS[r.id]?.includes(perm);
                    return (
                      <td key={r.id} className="py-2 px-3 text-center">
                        {tiene
                          ? <span className="inline-flex w-6 h-6 rounded-full bg-monki-y items-center justify-center"><Check size={13} strokeWidth={3}/></span>
                          : <span className="text-monki-k/20">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      </div>

      {modal!==null && (
        <UsuarioModal usuario={Object.keys(modal).length>0?modal:null} onClose={()=>setModal(null)} onSave={cargar}/>
      )}
      {dialogo}
    </Modulo>
  );
}
