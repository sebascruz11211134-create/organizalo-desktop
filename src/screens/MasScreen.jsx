/**
 * "Más": todas las herramientas del ERP como apps, agrupadas por sección,
 * con buscador y edición de los favoritos de la barra inferior.
 */
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, MessageSquare, Shield, Smartphone, Check } from "lucide-react";
import { Modulo, Boton, Buscador, Vacio } from "../components/ui";
import { navegacionVisible, herramientas } from "../navegacion";
import { useFavoritos, guardarFavoritos, MAX_FAVORITOS, nombreCorto } from "../components/NavegacionMovil";
import { useIdioma } from "../utils/idioma";

const EXTRAS = [{ path: "/chat", label: "Chat interno", icon: MessageSquare, grupo: "General" }];
const ADMIN  = { path: "/admin", label: "Panel admin", icon: Shield, grupo: "General" };

const sinTildes = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Icono({ h, favorito, editando, onClick, delay }) {
  const { tr } = useIdioma();
  return (
    <button onClick={onClick} style={{ animationDelay: `${delay}ms` }}
      className="animate-entrar relative flex flex-col items-center gap-1.5 p-1.5 rounded-2xl active:bg-black/5 group">
      <span className={`relative w-14 h-14 rounded-[18px] flex items-center justify-center border-2 transition-all duration-300 ease-monki
        ${favorito ? "bg-monki-y border-monki-k" : "bg-white border-black/10 group-hover:border-monki-k group-hover:-translate-y-0.5 group-hover:shadow-[3px_3px_0_#111]"}`}>
        <h.icon size={22} className="text-monki-k" />
        {editando && (
          <span className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full border-2 border-monki-k flex items-center justify-center ${favorito ? "bg-monki-k text-monki-y" : "bg-white text-monki-k/40"}`}>
            <Star size={12} fill={favorito ? "currentColor" : "none"} />
          </span>
        )}
      </span>
      <span className="text-[11px] leading-tight font-semibold text-monki-k text-center line-clamp-2">{tr(h.label)}</span>
    </button>
  );
}

export default function MasScreen({ modulosHabilitados = null, esSuperAdmin = false }) {
  const { tr } = useIdioma();
  const navigate = useNavigate();
  const favoritos = useFavoritos();
  const [busq, setBusq] = useState("");
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState("");

  const nav = navegacionVisible(modulosHabilitados);
  const todas = useMemo(() => [...herramientas(nav), ...EXTRAS, ...(esSuperAdmin ? [ADMIN] : [])], [nav, esSuperAdmin]);

  // Secciones: los ítems sueltos (Inicio, Calendario, Configuración) van en "General"
  const secciones = useMemo(() => {
    const generales = [...nav.filter(i => i.single).map(i => ({ path: i.path, label: i.label, icon: i.icon })), ...EXTRAS, ...(esSuperAdmin ? [ADMIN] : [])];
    return [{ titulo: "General", items: generales }, ...nav.filter(i => !i.single).map(i => ({ titulo: i.label, items: i.children }))];
  }, [nav, esSuperAdmin]);

  const q = sinTildes(busq.trim());
  const resultados = q ? todas.filter(h => sinTildes(h.label).includes(q) || sinTildes(tr(h.label)).includes(q) || sinTildes(h.grupo).includes(q)) : null;

  const tocar = h => {
    if (!editando) return navigate(h.path);
    setAviso("");
    if (favoritos.includes(h.path)) return guardarFavoritos(favoritos.filter(p => p !== h.path));
    if (favoritos.length >= MAX_FAVORITOS) return setAviso(`Máximo ${MAX_FAVORITOS} en la barra: tocá una estrella para quitarla primero.`);
    guardarFavoritos([...favoritos, h.path]);
  };

  const instalada = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone);
  const favActuales = favoritos.map(p => todas.find(h => h.path === p)).filter(Boolean);

  return (
    <Modulo
      seccion="Monki"
      titulo="Todas las herramientas"
      descripcion="Todo el ERP en tu mano. Tocá una herramienta para abrirla o elegí tus favoritas para la barra de abajo."
      acciones={<Boton variante={editando ? "primario" : "secundario"} icono={editando ? Check : Star} onClick={() => { setEditando(e => !e); setAviso(""); }}>
        {editando ? "Listo" : "Editar barra"}
      </Boton>}
    >
      <div className="flex-1 overflow-auto -mx-1 px-1 pb-4">
        <Buscador valor={busq} onCambio={setBusq} placeholder="Buscar herramienta… (ej. planilla, IVA, bancos)" className="!max-w-none mb-4" />

        {editando && (
          <div className="animate-entrar mb-4 bg-monki-k text-white rounded-[18px] p-4">
            <p className="monki-tag text-monki-y mb-2">{tr("Tu barra de abajo")}</p>
            <div className="flex flex-wrap items-center gap-2">
              {favActuales.map(h => (
                <span key={h.path} className="flex items-center gap-1.5 bg-monki-y text-monki-k rounded-full pl-2.5 pr-3 py-1 text-xs font-bold">
                  <h.icon size={13} /> {tr(nombreCorto(h))}
                </span>
              ))}
              {Array.from({ length: MAX_FAVORITOS - favActuales.length }).map((_, i) => (
                <span key={i} className="rounded-full border-2 border-dashed border-white/30 px-3 py-1 text-xs text-white/50">{tr("libre")}</span>
              ))}
            </div>
            <p className="text-xs text-white/65 mt-2">{tr(aviso || "Tocá la estrella de una herramienta para ponerla o quitarla de la barra.")}</p>
          </div>
        )}

        {resultados ? (
          resultados.length ? (
            <div className="ui-rejilla grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-1">
              {resultados.map((h, i) => <Icono key={h.path + h.label} h={h} favorito={favoritos.includes(h.path)} editando={editando} onClick={() => tocar(h)} delay={Math.min(i, 12) * 20} />)}
            </div>
          ) : <Vacio titulo="No encontramos esa herramienta" texto="Probá con otra palabra." />
        ) : (
          <div className="space-y-5">
            {secciones.map((sec, si) => (
              <section key={sec.titulo}>
                <h2 className="monki-tag text-monki-k/55 mb-1.5 px-1">{tr(sec.titulo)}</h2>
                <div className="ui-rejilla grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-1">
                  {sec.items.map((h, i) => <Icono key={h.path + h.label} h={h} favorito={favoritos.includes(h.path)} editando={editando} onClick={() => tocar(h)} delay={Math.min(si * 2 + i, 14) * 20} />)}
                </div>
              </section>
            ))}
          </div>
        )}

        {!instalada && (
          <div className="mt-6 flex gap-3 items-start bg-white border-2 border-black/10 rounded-[18px] p-4">
            <span className="w-10 h-10 shrink-0 rounded-full bg-monki-y flex items-center justify-center"><Smartphone size={18} className="text-monki-k" /></span>
            <div className="text-sm">
              <b className="text-monki-k">{tr("Instalá Monki en tu teléfono")}</b>
              <p className="text-monki-k/60 mt-0.5">{tr("iPhone: tocá Compartir → «Agregar a inicio». Android: menú ⋮ → «Instalar app». Se abre como una app y se actualiza sola.")}</p>
            </div>
          </div>
        )}
      </div>
    </Modulo>
  );
}
