/**
 * Pantalla placeholder — se usa como base para módulos en construcción.
 * Importar y renombrar para cada módulo nuevo.
 */
import React from "react";
import { Construction } from "lucide-react";

export function Placeholder({ nombre, descripcion }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 fade-in">
      <Construction size={48} className="mb-4 text-gray-300" />
      <h2 className="text-lg font-bold text-slate-600 mb-2">{nombre}</h2>
      <p className="text-sm text-center max-w-xs">{descripcion || "Este módulo está disponible en el app móvil y se integrará próximamente en la versión desktop."}</p>
      <p className="text-xs text-gray-300 mt-6">Organízalo.AI Desktop · En desarrollo</p>
    </div>
  );
}
