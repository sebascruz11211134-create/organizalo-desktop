/**
 * Kit de interfaz Monki — todas las pantallas se arman con estas piezas para
 * que cada módulo se vea y se use igual (mismo encabezado, filtros, tabla,
 * formularios y ventanas). Estilo de la web: amarillo #FFD600 + negro #111,
 * Archivo, píldoras, sombra sólida desplazada y curva .2,.8,.2,1.
 */
import React, { useEffect, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { useIdioma } from "../../utils/idioma";

const cx = (...c) => c.filter(Boolean).join(" ");

// ── Módulo: estructura común de cada pantalla ───────────────────────────────
// seccion: grupo del menú ("Ventas"), titulo, descripcion, acciones (botones),
// indicadores (<Indicadores>), pestanas ({ items, activa, onCambiar }).
export function Modulo({ seccion, titulo, descripcion, acciones, indicadores, pestanas, children, sinRelleno = false }) {
  const { tr } = useIdioma();
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="ui-modulo-cabecera shrink-0 px-4 md:px-6 pt-5 pb-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {seccion && <p className="monki-tag text-monki-k/55 mb-1">{tr(seccion)}</p>}
            <h1 className="text-[26px] md:text-[30px] font-black leading-none tracking-[-0.04em] text-monki-k">
              {tr(titulo)}<span className="text-monki-y" style={{ WebkitTextStroke: "1px #111" }}>.</span>
            </h1>
            {descripcion && <p className="text-sm text-monki-k/60 mt-1.5 max-w-2xl">{tr(descripcion)}</p>}
          </div>
          {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
        </div>
        {indicadores && <div className="mt-4">{indicadores}</div>}
        {pestanas && <Pestanas {...pestanas} className="mt-4" />}
      </div>
      <div className={cx("flex-1 min-h-0 flex flex-col", !sinRelleno && "px-4 md:px-6 pb-5")}>{children}</div>
    </div>
  );
}

// ── Botones ─────────────────────────────────────────────────────────────────
const VARIANTES = {
  primario:   "bg-monki-k text-monki-y hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#FFD600]",
  amarillo:   "bg-monki-y text-monki-k hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#111]",
  secundario: "bg-white text-monki-k shadow-[inset_0_0_0_2px_#111] hover:bg-monki-k hover:text-monki-y",
  fantasma:   "text-monki-k/70 hover:bg-black/5 hover:text-monki-k",
  peligro:    "bg-white text-red-600 shadow-[inset_0_0_0_2px_#dc2626] hover:bg-red-600 hover:text-white",
};
export function Boton({ variante = "primario", icono: Icono, cargando, children, className, tamano = "md", ...props }) {
  const { tr } = useIdioma();
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || cargando}
      className={cx(
        "ui-boton group inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap",
        "transition-all duration-300 ease-monki disabled:opacity-40 disabled:pointer-events-none",
        tamano === "sm" ? "text-[12px] px-3.5 py-1.5" : "text-[13px] px-5 py-2.5",
        VARIANTES[variante], className,
      )}
    >
      {cargando ? <Loader2 size={14} className="animate-spin" /> : Icono && <Icono size={tamano === "sm" ? 13 : 15} />}
      {tr(children)}
    </button>
  );
}

// Botón chico de ícono para acciones por fila (editar, eliminar…)
export function BotonIcono({ icono: Icono, titulo, tono = "neutro", ...props }) {
  const { tr } = useIdioma();
  return (
    <button type="button" title={tr(titulo)} aria-label={tr(titulo)} {...props}
      className={cx("ui-boton w-8 h-8 inline-flex items-center justify-center rounded-full transition-all duration-200",
        tono === "peligro" ? "text-red-500 hover:bg-red-500 hover:text-white" : "text-monki-k/50 hover:bg-monki-k hover:text-monki-y")}>
      <Icono size={14} />
    </button>
  );
}

// ── Filtros ─────────────────────────────────────────────────────────────────
export function BarraFiltros({ children, resumen, derecha }) {
  const { tr } = useIdioma();
  return (
    <div className="shrink-0 flex flex-wrap items-center gap-2 mb-3">
      {children}
      {(resumen || derecha) && <div className="ml-auto flex items-center gap-3">
        {resumen && <span className="monki-tag text-monki-k/55">{tr(resumen)}</span>}
        {derecha}
      </div>}
    </div>
  );
}

export function Buscador({ valor, onCambio, placeholder = "Buscar…", className }) {
  const { tr } = useIdioma();
  return (
    <label className={cx("group flex items-center gap-2 bg-white rounded-full pl-3.5 pr-2 py-2 border-2 border-black/10 focus-within:border-monki-k transition-colors min-w-[200px] flex-1 max-w-sm", className)}>
      <Search size={14} className="text-monki-k/40 group-focus-within:text-monki-k shrink-0" />
      <input value={valor} onChange={e => onCambio(e.target.value)} placeholder={tr(placeholder)}
        className="ui-sin-foco bg-transparent text-sm flex-1 outline-none min-w-0 text-monki-k placeholder:text-monki-k/40" />
      {valor && <button type="button" onClick={() => onCambio("")} className="text-monki-k/40 hover:text-monki-k" aria-label="Limpiar búsqueda"><X size={14} /></button>}
    </label>
  );
}

// opciones: ["Todos", …] o [{ value, label }]
export function Selector({ valor, onCambio, opciones, className, ...props }) {
  const { tr } = useIdioma();
  return (
    <select value={valor} onChange={e => onCambio(e.target.value)} {...props}
      className={cx("bg-white rounded-full border-2 border-black/10 hover:border-monki-k px-4 py-2 text-sm font-semibold text-monki-k cursor-pointer transition-colors", className)}>
      {opciones.map(o => typeof o === "string"
        ? <option key={o} value={o}>{tr(o)}</option>
        : <option key={o.value} value={o.value}>{tr(o.label)}</option>)}
    </select>
  );
}

// items: [{ key, label, cuenta? }]
export function Pestanas({ items, activa, onCambiar, className }) {
  const { tr } = useIdioma();
  return (
    <div className={cx("flex flex-wrap gap-1 p-1 bg-white rounded-full border-2 border-black/10 w-fit", className)} role="tablist">
      {items.map(t => (
        <button key={t.key} type="button" role="tab" aria-selected={activa === t.key} onClick={() => onCambiar(t.key)}
          className={cx("ui-boton flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-bold transition-all duration-300 ease-monki",
            activa === t.key ? "bg-monki-k text-monki-y" : "text-monki-k/60 hover:text-monki-k hover:bg-black/5")}>
          {tr(t.label)}
          {t.cuenta != null && <span className={cx("font-mono text-[10px] px-1.5 rounded-full", activa === t.key ? "bg-monki-y text-monki-k" : "bg-black/5")}>{t.cuenta}</span>}
        </button>
      ))}
    </div>
  );
}

// ── Tarjeta y tabla ─────────────────────────────────────────────────────────
// `cuerpo`: clases para envolver el contenido (relleno) sin afectar el título.
export function Tarjeta({ children, className, titulo, acciones, cuerpo }) {
  const { tr } = useIdioma();
  return (
    <section className={cx("ui-tarjeta bg-white rounded-[18px] border-2 border-black/10", className)}>
      {(titulo || acciones) && (
        <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
          {titulo && <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-monki-k">{tr(titulo)}</h2>}
          {acciones}
        </div>
      )}
      {cuerpo ? <div className={cuerpo}>{children}</div> : children}
    </section>
  );
}

// columnas: [{ key, titulo, alinear?: "right"|"center", render?(fila), className?, movil?: false, principal?: true }]
// En el celular cada fila se muestra como tarjeta: la columna `principal` (o la 1.ª) es el título,
// la última columna numérica (alineada a la derecha) va destacada arriba, el
// resto como pares etiqueta/valor y las columnas sin título (acciones) abajo.
function TarjetasMovil({ columnas, filas, claveFila, onFila, seleccionada, vacio, cargando }) {
  const { tr } = useIdioma();
  const visibles = columnas.filter(c => c.movil !== false);
  const principal = visibles.find(c => c.principal) || visibles[0];
  const resto = visibles.filter(c => c !== principal);
  const destacada = [...resto].reverse().find(c => c.alinear === "right" && c.titulo);
  const acciones = resto.filter(c => !c.titulo);
  const datos = resto.filter(c => c.titulo && c !== destacada);
  const valor = (c, f) => (c.render ? c.render(f) : f[c.key]);
  if (cargando) return <div className="py-16 text-center text-monki-k/50"><Loader2 size={20} className="animate-spin inline" /></div>;
  if (!filas.length) return vacio || <Vacio titulo="Sin resultados" />;
  return (
    <div className="p-2 space-y-2">
      {filas.map((f, i) => {
        const clave = claveFila(f);
        const activa = seleccionada != null && seleccionada === clave;
        return (
          <div key={clave} onClick={onFila ? () => onFila(f) : undefined}
            style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
            className={cx("animate-desplegar rounded-2xl border-2 p-3 transition-colors",
              onFila && "cursor-pointer active:border-monki-k", activa ? "bg-[#FFF4B8] border-monki-y" : "bg-white border-black/10")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-sm text-monki-k">{principal && valor(principal, f)}</div>
              {destacada && <div className="shrink-0 text-right text-sm font-bold tabular-nums text-monki-k">{valor(destacada, f)}</div>}
            </div>
            {datos.length > 0 && (
              <dl className="ui-rejilla grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2.5 pt-2.5 border-t border-black/5">
                {datos.map(c => (
                  <div key={c.key} className="min-w-0">
                    <dt className="monki-tag text-[9px] text-monki-k/45 truncate">{tr(c.titulo)}</dt>
                    <dd className="text-xs text-monki-k/85 truncate [&>*]:truncate">{valor(c, f)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {acciones.length > 0 && (
              <div className="flex justify-end gap-1 mt-2 -mb-1" onClick={e => e.stopPropagation()}>
                {acciones.map(c => <React.Fragment key={c.key}>{valor(c, f)}</React.Fragment>)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Tabla({ columnas, filas, claveFila = f => f.id, onFila, seleccionada, vacio, cargando, pie, className }) {
  const { tr } = useIdioma();
  return (
    <div className={cx("ui-tarjeta flex-1 min-h-0 bg-white rounded-[18px] border-2 border-black/10 overflow-hidden flex flex-col", className)}>
      <div className="md:hidden flex-1 min-h-0 overflow-auto">
        <TarjetasMovil columnas={columnas} filas={filas} claveFila={claveFila} onFila={onFila} seleccionada={seleccionada} vacio={vacio} cargando={cargando} />
      </div>
      <div className="hidden md:block flex-1 min-h-0 overflow-auto">
        <table className="ui-tabla w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              {columnas.map(c => (
                <th key={c.key} className={cx("monki-tag text-monki-k/55 font-semibold px-4 py-3 border-b-2 border-black/10 whitespace-nowrap",
                  c.alinear === "right" ? "text-right" : c.alinear === "center" ? "text-center" : "text-left")}>{tr(c.titulo)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={columnas.length} className="py-16 text-center text-monki-k/50"><Loader2 size={20} className="animate-spin inline" /></td></tr>
            ) : filas.length === 0 ? (
              <tr><td colSpan={columnas.length}>{vacio || <Vacio titulo="Sin resultados" />}</td></tr>
            ) : filas.map((f, i) => {
              const clave = claveFila(f);
              const activa = seleccionada != null && seleccionada === clave;
              return (
                <tr key={clave} onClick={onFila ? () => onFila(f) : undefined}
                  style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
                  className={cx("ui-fila animate-desplegar border-b border-black/5 last:border-0 transition-colors duration-150",
                    onFila && "cursor-pointer", activa ? "bg-[#FFF4B8]" : "hover:bg-monki-cream/60")}>
                  {columnas.map(c => (
                    <td key={c.key} className={cx("px-4 py-2.5 text-monki-k/85", c.alinear === "right" && "text-right tabular-nums", c.alinear === "center" && "text-center", c.className)}>
                      {c.render ? c.render(f) : f[c.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pie && <div className="shrink-0 border-t-2 border-black/10 px-4 py-2.5 bg-monki-cream/40">{pie}</div>}
    </div>
  );
}

export function Vacio({ icono: Icono, titulo = "Nada por aquí todavía", texto, accion }) {
  const { tr } = useIdioma();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-monki-y flex items-center justify-center animate-flotar shadow-[4px_4px_0_#111]">
        {Icono ? <Icono size={26} className="text-monki-k" /> : <img src="/MK_Logo2.png" alt="" className="w-10 h-10 object-contain" />}
      </div>
      <p className="text-[16px] font-extrabold tracking-[-0.02em] text-monki-k">{tr(titulo)}</p>
      {texto && <p className="text-sm text-monki-k/55 max-w-sm">{tr(texto)}</p>}
      {accion}
    </div>
  );
}

// ── Estados (insignias) ─────────────────────────────────────────────────────
const TONOS = {
  exito:   "bg-[#dcfce7] text-[#166534]",
  alerta:  "bg-monki-y text-monki-k",
  peligro: "bg-red-100 text-red-700",
  neutro:  "bg-black/5 text-monki-k/70",
  oscuro:  "bg-monki-k text-monki-y",
};
export function Estado({ tono = "neutro", children, punto = true }) {
  const { tr } = useIdioma();
  return (
    <span className={cx("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap", TONOS[tono])}>
      {punto && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {tr(children)}
    </span>
  );
}

// ── Indicadores (como los del Inicio) ───────────────────────────────────────
export function Indicadores({ children }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 kpi-grid">{children}</div>;
}
export function Indicador({ etiqueta, valor, detalle, icono: Icono, destacado, alerta, onClick, delay = 0 }) {
  const oscuro = destacado && !alerta;
  const { tr } = useIdioma();
  return (
    <button type="button" onClick={onClick} style={{ animationDelay: `${delay}ms` }}
      className={cx("group animate-entrar text-left rounded-[18px] border-2 p-3.5 transition-all duration-300 ease-monki",
        onClick ? "hover:-translate-x-[3px] hover:-translate-y-[3px] cursor-pointer" : "cursor-default",
        oscuro ? "bg-monki-k border-monki-k hover:shadow-[5px_5px_0_#FFD600]"
          : alerta ? "bg-white border-red-400 hover:shadow-[5px_5px_0_#ef4444]"
          : "bg-white border-black/10 hover:border-monki-k hover:shadow-[5px_5px_0_#111]")}>
      <div className="flex items-center justify-between gap-2">
        <span className={cx("monki-tag", oscuro ? "text-monki-y/70" : "text-monki-k/55")}>{tr(etiqueta)}</span>
        {Icono && <span className={cx("w-7 h-7 rounded-full flex items-center justify-center transition-transform duration-500 ease-monki group-hover:rotate-[-12deg]",
          alerta ? "bg-red-500 text-white" : "bg-monki-y text-monki-k")}><Icono size={13} /></span>}
      </div>
      <p className={cx("mt-2 text-[21px] font-black tracking-[-0.03em] leading-none tabular-nums", oscuro ? "text-monki-y" : alerta ? "text-red-600" : "text-monki-k")}>{valor}</p>
      {detalle && <p className={cx("mt-1.5 text-[11px]", oscuro ? "text-white/60" : "text-monki-k/55")}>{tr(detalle)}</p>}
    </button>
  );
}

// ── Ventana emergente ───────────────────────────────────────────────────────
export function Modal({ abierto = true, titulo, subtitulo, onCerrar, pie, children, ancho = "max-w-lg" }) {
  const panel = useRef(null);
  const { tr } = useIdioma();
  useEffect(() => {
    if (!abierto) return;
    const tecla = e => { if (e.key === "Escape") onCerrar?.(); };
    document.addEventListener("keydown", tecla);
    panel.current?.querySelector("input,select,textarea")?.focus();
    return () => document.removeEventListener("keydown", tecla);
  }, [abierto, onCerrar]);
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-monki-k/50 backdrop-blur-sm animate-[entrar_.2s_ease]" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar?.(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={tr(titulo)}
        className={cx("modal-responsive w-full bg-white rounded-[22px] border-2 border-monki-k shadow-[8px_8px_0_#111] max-h-[90vh] flex flex-col animate-entrar", ancho)}>
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3">
          <div>
            <h2 className="text-[20px] font-black tracking-[-0.03em] text-monki-k">{tr(titulo)}</h2>
            {subtitulo && <p className="text-sm text-monki-k/55 mt-0.5">{tr(subtitulo)}</p>}
          </div>
          {onCerrar && <BotonIcono icono={X} titulo="Cerrar" onClick={onCerrar} />}
        </div>
        <div className="px-6 pb-5 overflow-y-auto">{children}</div>
        {pie && <div className="flex flex-wrap justify-end gap-2 px-6 py-4 border-t-2 border-black/10 bg-monki-cream/50 rounded-b-[20px]">{pie}</div>}
      </div>
    </div>
  );
}

// ── Formularios ─────────────────────────────────────────────────────────────
export function Campo({ etiqueta, ayuda, error, children, className }) {
  const { tr } = useIdioma();
  return (
    <label className={cx("block", className)}>
      {etiqueta && <span className="monki-tag text-monki-k/60 block mb-1.5">{tr(etiqueta)}</span>}
      {children}
      {error ? <span className="block text-[11px] text-red-600 mt-1">{tr(error)}</span>
        : ayuda ? <span className="block text-[11px] text-monki-k/45 mt-1">{tr(ayuda)}</span> : null}
    </label>
  );
}
const ENTRADA = "w-full bg-white border-2 border-black/10 hover:border-black/25 rounded-xl px-3.5 py-2.5 text-sm text-monki-k placeholder:text-monki-k/35 transition-colors";
export const Entrada = React.forwardRef(function Entrada({ className, placeholder, ...props }, ref) {
  const { tr } = useIdioma();
  return <input ref={ref} {...props} placeholder={tr(placeholder)} className={cx(ENTRADA, className)} />;
});
export function Seleccion({ className, opciones, children, ...props }) {
  const { tr } = useIdioma();
  return (
    <select {...props} className={cx(ENTRADA, "cursor-pointer", className)}>
      {opciones ? opciones.map(o => typeof o === "string" ? <option key={o} value={o}>{tr(o)}</option> : <option key={o.value} value={o.value}>{tr(o.label)}</option>) : children}
    </select>
  );
}
export function AreaTexto({ className, placeholder, ...props }) {
  const { tr } = useIdioma();
  return <textarea {...props} placeholder={tr(placeholder)} className={cx(ENTRADA, "min-h-[80px] resize-y", className)} />;
}
export function Interruptor({ activo, onCambio, etiqueta }) {
  const { tr } = useIdioma();
  return (
    <button type="button" role="switch" aria-checked={activo} onClick={() => onCambio(!activo)} className="inline-flex items-center gap-2.5 group">
      <span className={cx("w-10 h-6 rounded-full p-0.5 transition-colors duration-300 ease-monki", activo ? "bg-monki-k" : "bg-black/15")}>
        <span className={cx("block w-5 h-5 rounded-full transition-transform duration-300 ease-monki", activo ? "translate-x-4 bg-monki-y" : "bg-white")} />
      </span>
      {etiqueta && <span className="text-sm font-semibold text-monki-k">{tr(etiqueta)}</span>}
    </button>
  );
}

// Confirmación en la misma línea de estilo (reemplaza confirm() nativo cuando se quiera)
function TextoConfirmacion({ texto }) {
  const { tr } = useIdioma();
  return <p className="text-sm text-monki-k/70">{tr(texto)}</p>;
}
export function useConfirmar() {
  const [pedido, setPedido] = useState(null);
  const confirmar = (titulo, texto, { peligro = false, boton = "Confirmar" } = {}) =>
    new Promise(resolve => setPedido({ titulo, texto, peligro, boton, resolve }));
  const cerrar = valor => { pedido?.resolve(valor); setPedido(null); };
  const dialogo = pedido && (
    <Modal titulo={pedido.titulo} onCerrar={() => cerrar(false)} ancho="max-w-md"
      pie={<><Boton variante="fantasma" onClick={() => cerrar(false)}>Cancelar</Boton>
        <Boton variante={pedido.peligro ? "peligro" : "primario"} onClick={() => cerrar(true)}>{pedido.boton}</Boton></>}>
      <TextoConfirmacion texto={pedido.texto} />
    </Modal>
  );
  return { confirmar, dialogo };
}
