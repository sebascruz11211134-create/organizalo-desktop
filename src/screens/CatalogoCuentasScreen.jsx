/**
 * CatalogoCuentasScreen — Plan de cuentas contables (NIIF PYMES Costa Rica)
 * Permite ver, agregar y editar cuentas. Viene pre-cargado con el plan estándar CR.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, ChevronRight, RotateCcw, ListTree, FolderTree } from "lucide-react";
import { Modulo, Boton, BotonIcono, BarraFiltros, Buscador, Selector, Tabla, Vacio, Estado, Indicadores, Indicador, Modal, Campo, Entrada, Seleccion, Interruptor, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { PLAN_DEFAULT, TIPOS_CUENTA } from "../utils/planCuentas";
import { genId } from "../utils/fmt";

const TIPO_BADGE = {
  activo:     "oscuro",
  pasivo:     "peligro",
  patrimonio: "neutro",
  ingreso:    "exito",
  costo:      "alerta",
  gasto:      "neutro",
};
const capital = t => t.charAt(0).toUpperCase()+t.slice(1);

function CuentaModal({ cuenta, cuentas, onClose, onSave }) {
  const esNueva = !cuenta?.id;
  const [form, setForm] = useState(cuenta || { codigo:"", nombre:"", tipo:"activo", nivel:3, esGrupo:false, descripcion:"" });
  const u = (k,v) => setForm(p=>({...p,[k]:v}));

  const guardar = async () => {
    if (!form.codigo || !form.nombre) return alert("Código y nombre requeridos.");
    const todas = await db.getCuentasContables() || PLAN_DEFAULT;
    const item  = { ...form, nivel: parseInt(form.nivel)||3 };
    if (esNueva) {
      item.id = genId();
      await db.setCuentasContables([...todas, item].sort((a,b)=>a.codigo.localeCompare(b.codigo)));
    } else {
      await db.setCuentasContables(todas.map(x=>x.id===item.id||x.codigo===item.codigo?item:x).sort((a,b)=>a.codigo.localeCompare(b.codigo)));
    }
    onSave(); onClose();
  };

  return (
    <Modal titulo={esNueva?"Nueva cuenta":"Editar cuenta"} subtitulo="Plan de cuentas NIIF PYMES" onCerrar={onClose} ancho="max-w-md"
      pie={<><Boton variante="fantasma" onClick={onClose}>Cancelar</Boton><Boton onClick={guardar}>Guardar cuenta</Boton></>}>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Código *"><Entrada value={form.codigo||""} onChange={e=>u("codigo",e.target.value)} className="font-mono"/></Campo>
        <Campo etiqueta="Tipo"><Seleccion value={form.tipo} onChange={e=>u("tipo",e.target.value)} opciones={TIPOS_CUENTA.map(t=>({value:t,label:capital(t)}))}/></Campo>
        <Campo etiqueta="Nombre *" className="col-span-2"><Entrada value={form.nombre||""} onChange={e=>u("nombre",e.target.value)}/></Campo>
        <Campo etiqueta="Nivel" className="col-span-2">
          <Seleccion value={form.nivel} onChange={e=>u("nivel",parseInt(e.target.value))}
            opciones={[{value:1,label:"1 — Grupo mayor"},{value:2,label:"2 — Subgrupo"},{value:3,label:"3 — Cuenta de detalle"}]}/>
        </Campo>
        <div className="col-span-2"><Interruptor activo={form.esGrupo} onCambio={v=>u("esGrupo",v)} etiqueta="Cuenta de grupo (no recibe asientos directamente)"/></div>
      </div>
    </Modal>
  );
}

export default function CatalogoCuentasScreen() {
  const [cuentas, setCuentas] = useState([]);
  const [busq,    setBusq]    = useState("");
  const [tipo,    setTipo]    = useState("Todos");
  const [modal,   setModal]   = useState(null);

  const cargar = useCallback(async () => {
    const saved = await db.getCuentasContables();
    if (!saved) {
      // Primera vez: cargar plan por defecto
      const plan = PLAN_DEFAULT.map(c=>({...c, id: c.codigo}));
      await db.setCuentasContables(plan);
      setCuentas(plan);
    } else {
      setCuentas(saved);
    }
  }, []);

  useEffect(()=>{ cargar(); },[cargar]);

  const busqL    = busq.trim().toLowerCase();
  const visibles = cuentas.filter(c => {
    if (tipo !== "Todos" && c.tipo !== tipo) return false;
    if (busqL && !c.codigo?.toLowerCase().includes(busqL) && !c.nombre?.toLowerCase().includes(busqL)) return false;
    return true;
  });

  const { confirmar, dialogo } = useConfirmar();
  const resetPlan = async () => {
    if (!(await confirmar("Restaurar plan estándar", "¿Restaurar el plan de cuentas estándar de Costa Rica? Se borran las cuentas personalizadas.", { peligro: true, boton: "Restaurar" }))) return;
    const plan = PLAN_DEFAULT.map(c=>({...c,id:c.codigo}));
    await db.setCuentasContables(plan);
    setCuentas(plan);
  };

  const columnas = [
    { key: "codigo", titulo: "Código", render: c => <span className={`font-mono text-xs ${c.nivel===1?"font-black":c.nivel===2?"font-bold":"text-monki-k/55"}`} style={{ paddingLeft: `${(c.nivel-1)*14}px` }}>{c.codigo}</span> },
    { key: "nombre", titulo: "Nombre", render: c => (
      <span className={c.nivel===1?"font-black text-monki-k":c.nivel===2?"font-extrabold text-monki-k":"text-monki-k/80"} style={{ paddingLeft: `${(c.nivel-1)*14}px` }}>
        {c.nivel > 1 && <ChevronRight size={11} className="inline text-monki-k/30 mr-1"/>}{c.nombre}
      </span>) },
    { key: "tipo", titulo: "Tipo", render: c => <Estado tono={TIPO_BADGE[c.tipo]||"neutro"}>{capital(c.tipo||"")}</Estado> },
    { key: "nivel", titulo: "Nivel", alinear: "center", render: c => <span className="font-mono text-xs text-monki-k/45">{c.nivel}</span> },
    { key: "grupo", titulo: "Grupo", alinear: "center", render: c => c.esGrupo ? <span className="font-bold">Sí</span> : <span className="text-monki-k/30">—</span> },
    { key: "acciones", titulo: "", alinear: "right", render: c => !c.esGrupo && <span onClick={e=>e.stopPropagation()}><BotonIcono icono={Edit2} titulo="Editar" onClick={()=>setModal(c)}/></span> },
  ];

  return (
    <Modulo
      seccion="Contabilidad"
      titulo="Catálogo de cuentas"
      descripcion="Plan de cuentas NIIF PYMES para Costa Rica. Podés agregar las tuyas."
      acciones={<>
        <Boton variante="secundario" icono={RotateCcw} onClick={resetPlan}>Restaurar plan CR</Boton>
        <Boton icono={Plus} onClick={()=>setModal({})}>Nueva cuenta</Boton>
      </>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Cuentas de detalle" valor={cuentas.filter(c=>!c.esGrupo).length} icono={ListTree} delay={40}/>
          <Indicador etiqueta="Grupos" valor={cuentas.filter(c=>c.esGrupo).length} icono={FolderTree} delay={90}/>
          <Indicador etiqueta="Ingresos" valor={cuentas.filter(c=>c.tipo==="ingreso").length} delay={140} onClick={()=>setTipo("ingreso")}/>
          <Indicador etiqueta="Gastos" valor={cuentas.filter(c=>c.tipo==="gasto").length} destacado delay={190} onClick={()=>setTipo("gasto")}/>
        </Indicadores>
      }
    >
      <BarraFiltros resumen={`${visibles.length} de ${cuentas.length}`}>
        <Buscador valor={busq} onCambio={setBusq} placeholder="Buscar por código o nombre…"/>
        <Selector valor={tipo} onCambio={setTipo} opciones={[{value:"Todos",label:"Todos los tipos"}, ...TIPOS_CUENTA.map(t=>({value:t,label:capital(t)}))]}/>
      </BarraFiltros>
      <Tabla columnas={columnas} filas={visibles} claveFila={c=>c.id||c.codigo} onFila={c=>!c.esGrupo && setModal(c)}
        vacio={<Vacio icono={ListTree} titulo="Sin resultados" texto="Probá con otra búsqueda o tipo."/>}/>
      {modal !== null && (
        <CuentaModal cuenta={Object.keys(modal).length>0?modal:null} cuentas={cuentas} onClose={()=>setModal(null)} onSave={cargar}/>
      )}
      {dialogo}
    </Modulo>
  );
}
