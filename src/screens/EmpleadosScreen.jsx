import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Check, Users, Edit2, UserCheck, Wallet } from "lucide-react";
import { Modulo, Boton, BotonIcono, BarraFiltros, Buscador, Tabla, Vacio, Estado, Indicadores, Indicador, Modal, Campo, Entrada, Seleccion, Interruptor, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, genId } from "../utils/fmt";
import { TOTAL_OBRERO, TOTAL_PATRONO } from "../utils/planilla";

const PUESTOS = ["Gerente","Administrador","Vendedor","Técnico","Operario","Contador","Recepcionista","Repartidor","Otro"];
const TIPOS_JORNADA = ["Tiempo completo","Tiempo parcial","Por hora","Por proyecto"];

function FormEmpleado({ emp, onGuardar, onCancelar }) {
  const [f, setF] = useState({
    nombre:     emp?.nombre || "",
    cedula:     emp?.cedula || "",
    puesto:     emp?.puesto || "Vendedor",
    jornada:    emp?.jornada || "Tiempo completo",
    salario:    emp?.salario ?? emp?.salarioBruto ?? "",
    email:      emp?.email || "",
    telefono:   emp?.telefono || "",
    fechaIngreso:emp?.fechaIngreso || "",
    ccss:       emp?.ccss || "",
    activo:     emp?.activo ?? true,
    notas:      emp?.notas || "",
  });
  const u = k => e => setF(p=>({...p,[k]: e.target.type==="checkbox"?e.target.checked:e.target.value}));

  // Cálculos CCSS
  const salario  = parseFloat(f.salario)||0;
  const ccssObrero  = salario * TOTAL_OBRERO;
  const ccssPatrono = salario * TOTAL_PATRONO;
  const salarioNeto = salario - ccssObrero;

  const pct = n => `${(n * 100).toFixed(2)}%`;
  return (
    <Modal titulo={emp ? "Editar empleado" : "Nuevo empleado"} subtitulo="Datos laborales y cargas sociales" onCerrar={onCancelar}
      pie={<><Boton variante="fantasma" onClick={onCancelar}>Cancelar</Boton>
        <Boton icono={Check} onClick={()=>onGuardar({ id:emp?.id||genId(), ...emp, ...f, salario:parseFloat(f.salario)||0, salarioBruto:parseFloat(f.salario)||0, creadoEn:emp?.creadoEn||new Date().toISOString() })}>Guardar empleado</Boton></>}>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Nombre completo *"><Entrada value={f.nombre} onChange={u("nombre")} placeholder="Nombre del empleado"/></Campo>
        <Campo etiqueta="Cédula"><Entrada value={f.cedula} onChange={u("cedula")} placeholder="X-XXXX-XXXX" className="font-mono"/></Campo>
        <Campo etiqueta="Puesto"><Seleccion value={f.puesto} onChange={u("puesto")} opciones={PUESTOS}/></Campo>
        <Campo etiqueta="Jornada"><Seleccion value={f.jornada} onChange={u("jornada")} opciones={TIPOS_JORNADA}/></Campo>
        <Campo etiqueta="Salario bruto (₡/mes)"><Entrada type="number" value={f.salario} onChange={u("salario")} min="0" placeholder="0" className="text-right"/></Campo>
        <Campo etiqueta="N.º asegurado CCSS"><Entrada value={f.ccss} onChange={u("ccss")} placeholder="Número de asegurado"/></Campo>
        {salario>0 && (
          <div className="col-span-2 animate-desplegar bg-monki-k text-white rounded-2xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-white/65"><span>Carga obrera ({pct(TOTAL_OBRERO)})</span><span className="text-red-300">−{fmtMoney(ccssObrero,"CRC")}</span></div>
            <div className="flex justify-between text-white/65"><span>Carga patronal ({pct(TOTAL_PATRONO)})</span><span>{fmtMoney(ccssPatrono,"CRC")}</span></div>
            <div className="flex justify-between items-end border-t border-white/15 pt-2"><span className="monki-tag text-white/55">Salario neto</span><span className="text-[20px] font-black text-monki-y">{fmtMoney(salarioNeto,"CRC")}</span></div>
          </div>
        )}
        <Campo etiqueta="Correo"><Entrada value={f.email} onChange={u("email")} placeholder="correo@empresa.com"/></Campo>
        <Campo etiqueta="Teléfono"><Entrada value={f.telefono} onChange={u("telefono")} placeholder="8888-8888"/></Campo>
        <Campo etiqueta="Fecha de ingreso"><Entrada type="date" value={f.fechaIngreso} onChange={u("fechaIngreso")}/></Campo>
        <div className="flex items-end pb-2"><Interruptor activo={f.activo} onCambio={v=>setF(p=>({...p,activo:v}))} etiqueta="Empleado activo"/></div>
      </div>
    </Modal>
  );
}

export default function EmpleadosScreen() {
  const [empleados, setEmpleados] = useState([]);
  const [form,      setForm]      = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [busq,      setBusq]      = useState("");
  const [soloActivos, setSoloActivos] = useState(true);

  const cargar = useCallback(async () => {
    setEmpleados(await db.getEmpleados() || []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (e) => {
    const all = await db.getEmpleados();
    const idx = all.findIndex(x=>x.id===e.id);
    await db.setEmpleados(idx>=0?all.map((x,i)=>i===idx?e:x):[...all,e]);
    cargar(); setForm(false); setEditando(null);
  };

  const { confirmar, dialogo } = useConfirmar();
  const eliminar = async (id) => {
    if (!(await confirmar("Eliminar empleado", "¿Eliminar este empleado? Sus planillas anteriores no se borran.", { peligro: true, boton: "Eliminar" }))) return;
    const all = await db.getEmpleados();
    await db.setEmpleados(all.filter(x=>x.id!==id));
    cargar();
  };

  const filtrados = empleados.filter(e =>
    (!soloActivos || e.activo) &&
    (e.nombre?.toLowerCase().includes(busq.toLowerCase()) || e.puesto?.toLowerCase().includes(busq.toLowerCase()))
  );

  const totalPlanilla = filtrados.filter(e=>e.activo).reduce((s,e)=>s+(e.salario||0),0);

  const activos = empleados.filter(e => e.activo);
  const nuevo = () => { setEditando(null); setForm(true); };
  const editar = e => { setEditando(e); setForm(true); };
  const columnas = [
    { key: "nombre", titulo: "Empleado", render: e => (
      <div className="flex items-center gap-2.5">
        <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[12px] font-black ${e.activo ? "bg-monki-y text-monki-k" : "bg-black/10 text-monki-k/50"}`}>{(e.nombre||"?").charAt(0).toUpperCase()}</span>
        <div><p className="font-bold text-monki-k">{e.nombre}</p>{e.cedula && <p className="font-mono text-[10px] text-monki-k/45">{e.cedula}</p>}</div>
      </div>) },
    { key: "puesto", titulo: "Puesto", render: e => <span className="text-monki-k/65">{e.puesto}</span> },
    { key: "jornada", titulo: "Jornada", render: e => <span className="text-monki-k/55 text-xs">{e.jornada}</span> },
    { key: "estado", titulo: "Estado", render: e => e.activo ? <Estado tono="exito">Activo</Estado> : <Estado>Inactivo</Estado> },
    { key: "salario", titulo: "Salario bruto/mes", alinear: "right", render: e => <b>{fmtMoney(e.salario||0,"CRC")}</b> },
    { key: "acciones", titulo: "", alinear: "right", render: e => (
      <div className="flex justify-end gap-0.5" onClick={ev=>ev.stopPropagation()}>
        <BotonIcono icono={Edit2} titulo="Editar" onClick={()=>editar(e)}/>
        <BotonIcono icono={Trash2} titulo="Eliminar" tono="peligro" onClick={()=>eliminar(e.id)}/>
      </div>) },
  ];

  return (
    <Modulo
      seccion="RRHH"
      titulo="Empleados"
      descripcion="Tu equipo, con su salario y las cargas de la CCSS calculadas."
      acciones={<Boton icono={Plus} onClick={nuevo}>Agregar empleado</Boton>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Empleados" valor={empleados.length} icono={Users} delay={40}/>
          <Indicador etiqueta="Activos" valor={activos.length} icono={UserCheck} delay={90}/>
          <Indicador etiqueta="Planilla bruta" valor={fmtMoney(totalPlanilla,"CRC")} detalle="Por mes" icono={Wallet} destacado delay={140}/>
          <Indicador etiqueta="Carga patronal" valor={fmtMoney(totalPlanilla*TOTAL_PATRONO,"CRC")} detalle="Estimada por mes" delay={190}/>
        </Indicadores>
      }
    >
      <BarraFiltros resumen={`${filtrados.length} de ${empleados.length}`}>
        <Buscador valor={busq} onCambio={setBusq} placeholder="Buscar por nombre o puesto…"/>
        <div className="bg-white rounded-full border-2 border-black/10 px-3 py-1.5"><Interruptor activo={soloActivos} onCambio={setSoloActivos} etiqueta="Solo activos"/></div>
      </BarraFiltros>
      <Tabla columnas={columnas} filas={filtrados} onFila={editar}
        vacio={<Vacio icono={Users} titulo="Sin empleados registrados" texto="Agregá a tu equipo para calcular planillas y cargas sociales."
          accion={<Boton icono={Plus} onClick={nuevo}>Agregar empleado</Boton>}/>}/>
      {form && <FormEmpleado emp={editando} onGuardar={guardar} onCancelar={()=>{setForm(false);setEditando(null);}}/>}
      {dialogo}
    </Modulo>
  );
}
