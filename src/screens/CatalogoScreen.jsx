import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Check, Package, Edit2, LayoutGrid, List, AlertTriangle, Tags } from "lucide-react";
import { Modulo, Boton, BotonIcono, BarraFiltros, Buscador, Selector, Tabla, Vacio, Estado, Indicadores, Indicador, Tarjeta, Modal, Campo, Entrada, Seleccion, AreaTexto, Interruptor, useConfirmar } from "../components/ui";
import db from "../utils/db";
import { useSyncRefresh } from "../hooks/useSyncRefresh";
import { fmtMoney, genId } from "../utils/fmt";

const CATEGORIAS = ["General","Alimentos","Bebidas","Ropa","Electrónica","Herramientas","Servicios","Otro"];
const UNIDADES   = ["Unid","Kg","g","L","mL","m","h","Caja","Par","Docena","Servicio"];

function FormProducto({ prod, onGuardar, onCancelar }) {
  const [f, setF] = useState({
    nombre:       prod?.nombre || "",
    descripcion:  prod?.descripcion || "",
    categoria:    prod?.categoria || "General",
    codigoInterno:prod?.codigoInterno || "",
    codigoBarras: prod?.codigoBarras || "",
    codigoCabys:  prod?.codigoCabys || "",
    precio:       prod?.precio || "",
    precioCompra: prod?.precioCompra || "",
    unidad:       prod?.unidad || "Unid",
    pctIVA:       prod?.pctIVA ?? 13,
    stock:        prod?.stock ?? "",
    stockMin:     prod?.stockMin ?? "",
    activo:       prod?.activo ?? true,
  });
  const u = k => e => setF(p=>({...p,[k]: e.target.type==="checkbox"?e.target.checked:e.target.value}));

  const margen = f.precio && f.precioCompra
    ? (((parseFloat(f.precio)-parseFloat(f.precioCompra))/parseFloat(f.precioCompra))*100).toFixed(1)
    : null;

  const Seccion = ({ titulo, children }) => (
    <div><p className="monki-tag text-monki-k/45 mb-2">{titulo}</p>{children}</div>
  );
  return (
    <Modal titulo={prod ? "Editar producto" : "Nuevo producto"} subtitulo="Producto o servicio que vendés" onCerrar={onCancelar}
      pie={<><Boton variante="fantasma" onClick={onCancelar}>Cancelar</Boton>
        <Boton icono={Check} onClick={()=>onGuardar({ id:prod?.id||genId(), ...f, precio:parseFloat(f.precio)||0, precioCompra:parseFloat(f.precioCompra)||0, stock:f.stock!==""?Number(f.stock):null, stockMin:f.stockMin!==""?Number(f.stockMin):null })}>Guardar producto</Boton></>}>
      <div className="space-y-5">
        <div className="space-y-3">
          <Campo etiqueta="Nombre *"><Entrada value={f.nombre} onChange={u("nombre")} placeholder="Nombre del producto o servicio"/></Campo>
          <Campo etiqueta="Descripción"><AreaTexto value={f.descripcion} onChange={u("descripcion")} rows={2} placeholder="Descripción detallada…"/></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Categoría"><Seleccion value={f.categoria} onChange={u("categoria")} opciones={CATEGORIAS}/></Campo>
            <Campo etiqueta="Unidad de medida"><Seleccion value={f.unidad} onChange={u("unidad")} opciones={UNIDADES}/></Campo>
          </div>
        </div>
        <Seccion titulo="Códigos">
          <div className="grid grid-cols-3 gap-2">
            <Campo etiqueta="Interno"><Entrada value={f.codigoInterno} onChange={u("codigoInterno")} placeholder="SKU-001" className="font-mono"/></Campo>
            <Campo etiqueta="Barras"><Entrada value={f.codigoBarras} onChange={u("codigoBarras")} placeholder="7XXXXXXXXXX" className="font-mono"/></Campo>
            <Campo etiqueta="CABYS"><Entrada value={f.codigoCabys} onChange={u("codigoCabys")} placeholder="Hacienda" className="font-mono"/></Campo>
          </div>
        </Seccion>
        <Seccion titulo="Precios">
          <div className="grid grid-cols-3 gap-2">
            <Campo etiqueta="Venta *"><Entrada type="number" value={f.precio} onChange={u("precio")} min="0" step="any" placeholder="0" className="text-right"/></Campo>
            <Campo etiqueta="Compra"><Entrada type="number" value={f.precioCompra} onChange={u("precioCompra")} min="0" step="any" placeholder="0" className="text-right"/></Campo>
            <Campo etiqueta="IVA">
              <Seleccion value={f.pctIVA} onChange={e=>setF(p=>({...p,pctIVA:Number(e.target.value)}))}
                opciones={[{value:0,label:"0% Exento"},{value:4,label:"4%"},{value:8,label:"8%"},{value:13,label:"13%"}]}/>
            </Campo>
          </div>
          {margen && (
            <div className="animate-desplegar mt-2 flex flex-wrap gap-2">
              <Estado tono="oscuro">Margen {margen}%</Estado>
              <Estado tono="alerta">Con IVA {fmtMoney(parseFloat(f.precio)*(1+f.pctIVA/100),"CRC")}</Estado>
            </div>
          )}
        </Seccion>
        <Seccion titulo="Inventario">
          <div className="grid grid-cols-3 gap-2 items-end">
            <Campo etiqueta="Stock actual"><Entrada type="number" value={f.stock} onChange={u("stock")} min="0" placeholder="—" className="text-center"/></Campo>
            <Campo etiqueta="Stock mínimo"><Entrada type="number" value={f.stockMin} onChange={u("stockMin")} min="0" placeholder="—" className="text-center"/></Campo>
            <div className="pb-2"><Interruptor activo={f.activo} onCambio={v=>setF(p=>({...p,activo:v}))} etiqueta="Activo"/></div>
          </div>
        </Seccion>
      </div>
    </Modal>
  );
}

export default function CatalogoScreen() {
  const [productos, setProductos] = useState([]);
  const [form,      setForm]      = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [busq,      setBusq]      = useState("");
  const [catFiltro, setCatFiltro] = useState("Todos");
  const [vista,     setVista]     = useState("grid"); // "grid" | "tabla"

  const cargar = useCallback(async () => {
    setProductos(await db.getProductos() || []);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (p) => {
    const all = await db.getProductos();
    const idx = all.findIndex(x=>x.id===p.id);
    await db.setProductos(idx>=0 ? all.map((x,i)=>i===idx?p:x) : [...all,p]);
    cargar(); setForm(false); setEditando(null);
  };

  const { confirmar, dialogo } = useConfirmar();
  const eliminar = async (id) => {
    if (!(await confirmar("Eliminar producto", "¿Eliminar este producto del catálogo? Esta acción no se puede deshacer.", { peligro: true, boton: "Eliminar" }))) return;
    const all = await db.getProductos();
    await db.setProductos(all.filter(x=>x.id!==id));
    cargar();
  };

  const filtrados = productos.filter(p =>
    (catFiltro==="Todos" || p.categoria===catFiltro) &&
    (p.nombre?.toLowerCase().includes(busq.toLowerCase()) ||
     p.codigoBarras?.includes(busq) || p.codigoInterno?.includes(busq))
  );

  const stockBajo = productos.filter(p => p.stock!=null && p.stockMin!=null && p.stock<=p.stockMin).length;

  const bajo = p => p.stock!=null && p.stockMin!=null && p.stock<=p.stockMin;
  const nuevo = () => { setEditando(null); setForm(true); };
  const editar = p => { setEditando(p); setForm(true); };
  const categoriasUsadas = new Set(productos.map(p=>p.categoria).filter(Boolean)).size;
  const columnas = [
    { key: "nombre", titulo: "Producto", render: p => (
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-full bg-monki-y flex items-center justify-center shrink-0 text-[12px] font-black">{(p.nombre||"?").charAt(0).toUpperCase()}</span>
        <b className="text-monki-k">{p.nombre}</b>
      </div>) },
    { key: "categoria", titulo: "Categoría", render: p => <span className="text-monki-k/60">{p.categoria||"—"}</span> },
    { key: "codigo", titulo: "Código", render: p => <span className="font-mono text-xs text-monki-k/50">{p.codigoInterno||p.codigoBarras||"—"}</span> },
    { key: "precio", titulo: "Precio", alinear: "right", render: p => <b>{fmtMoney(p.precio||0,"CRC")}</b> },
    { key: "iva", titulo: "IVA", alinear: "center", render: p => <span className="text-monki-k/55">{p.pctIVA ?? 13}%</span> },
    { key: "stock", titulo: "Stock", alinear: "center", render: p => p.stock!=null ? (bajo(p) ? <Estado tono="peligro">{p.stock} · bajo</Estado> : <b>{p.stock}</b>) : <span className="text-monki-k/30">—</span> },
    { key: "acciones", titulo: "", alinear: "right", render: p => (
      <div className="flex justify-end gap-0.5" onClick={e=>e.stopPropagation()}>
        <BotonIcono icono={Edit2} titulo="Editar" onClick={()=>editar(p)}/>
        <BotonIcono icono={Trash2} titulo="Eliminar" tono="peligro" onClick={()=>eliminar(p.id)}/>
      </div>) },
  ];

  return (
    <Modulo
      seccion="Inventario"
      titulo="Catálogo"
      descripcion="Todo lo que vendés, con precios, códigos y margen."
      acciones={<Boton icono={Plus} onClick={nuevo}>Nuevo producto</Boton>}
      indicadores={
        <Indicadores>
          <Indicador etiqueta="Productos" valor={productos.length} detalle={`${productos.filter(p=>p.activo!==false).length} activos`} icono={Package} delay={40}/>
          <Indicador etiqueta="Categorías" valor={categoriasUsadas} icono={Tags} delay={90}/>
          <Indicador etiqueta="Stock bajo" valor={stockBajo} detalle={stockBajo ? "Revisá y reponé" : "Todo en orden"} icono={AlertTriangle} alerta={stockBajo>0} delay={140}/>
          <Indicador etiqueta="Precio promedio" valor={fmtMoney(productos.length ? productos.reduce((t,p)=>t+(parseFloat(p.precio)||0),0)/productos.length : 0,"CRC")} destacado delay={190}/>
        </Indicadores>
      }
    >
      <BarraFiltros resumen={`${filtrados.length} de ${productos.length}`}
        derecha={
          <div className="flex bg-white rounded-full border-2 border-black/10 p-0.5">
            {[["grid",LayoutGrid,"Tarjetas"],["tabla",List,"Tabla"]].map(([v,Icono,t])=>(
              <button key={v} type="button" title={t} onClick={()=>setVista(v)}
                className={`ui-boton w-8 h-8 rounded-full flex items-center justify-center transition-colors ${vista===v?"bg-monki-k text-monki-y":"text-monki-k/50 hover:text-monki-k"}`}><Icono size={14}/></button>
            ))}
          </div>
        }>
        <Buscador valor={busq} onCambio={setBusq} placeholder="Buscar producto o código…"/>
        <Selector valor={catFiltro} onCambio={setCatFiltro} opciones={["Todos", ...CATEGORIAS]}/>
      </BarraFiltros>

      {vista==="tabla" ? (
        <Tabla columnas={columnas} filas={filtrados} onFila={editar}
          vacio={<Vacio icono={Package} titulo="No hay productos" texto="Probá con otra búsqueda o agregá uno nuevo." accion={<Boton icono={Plus} onClick={nuevo}>Nuevo producto</Boton>}/>}/>
      ) : filtrados.length===0 ? (
        <Tarjeta className="flex-1 flex items-center justify-center">
          <Vacio icono={Package} titulo={productos.length ? "Sin resultados" : "El catálogo está vacío"} texto={productos.length ? "Probá con otra búsqueda o categoría." : "Agregá tu primer producto o servicio."}
            accion={!productos.length && <Boton icono={Plus} onClick={nuevo}>Nuevo producto</Boton>}/>
        </Tarjeta>
      ) : (
        <div className="flex-1 overflow-auto -mx-1 px-1 pb-1">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtrados.map((p,i) => (
              <div key={p.id} onClick={()=>editar(p)} style={{ animationDelay: `${Math.min(i,12)*30}ms` }}
                className="animate-entrar group cursor-pointer bg-white border-2 border-black/10 rounded-[18px] p-4 transition-all duration-300 ease-monki hover:border-monki-k hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#111]">
                <div className="flex items-start justify-between mb-3">
                  <span className="w-11 h-11 rounded-full bg-monki-y flex items-center justify-center text-monki-k font-black text-lg">{(p.nombre||"?").charAt(0).toUpperCase()}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e=>e.stopPropagation()}>
                    <BotonIcono icono={Edit2} titulo="Editar" onClick={()=>editar(p)}/>
                    <BotonIcono icono={Trash2} titulo="Eliminar" tono="peligro" onClick={()=>eliminar(p.id)}/>
                  </div>
                </div>
                <p className="font-extrabold text-[15px] text-monki-k truncate">{p.nombre}</p>
                <p className="text-xs text-monki-k/45 truncate mb-2">{p.categoria}{p.codigoInterno && ` · ${p.codigoInterno}`}</p>
                <div className="flex items-end justify-between">
                  <p className="text-[18px] font-black tracking-[-0.02em] text-monki-k">{fmtMoney(p.precio||0,"CRC")}</p>
                  {p.stock!=null && (bajo(p) ? <Estado tono="peligro">Stock {p.stock}</Estado> : <span className="font-mono text-[10px] text-monki-k/45">Stock {p.stock}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {form && <FormProducto prod={editando} onGuardar={guardar} onCancelar={()=>{setForm(false);setEditando(null);}} />}
      {dialogo}
    </Modulo>
  );
}
