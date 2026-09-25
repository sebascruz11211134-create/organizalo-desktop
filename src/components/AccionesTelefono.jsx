import React from "react";
import { Phone, MessageCircle } from "lucide-react";
import { enlaceLlamada, enlaceWhatsApp } from "../utils/contacto";
import { useIdioma } from "../utils/idioma";

// Botones redondos para llamar o escribir por WhatsApp a un número.
export default function AccionesTelefono({ tel, className = "" }) {
  const { tr } = useIdioma();
  const llamar = enlaceLlamada(tel);
  if (!llamar) return null;
  const base = "w-7 h-7 shrink-0 rounded-full flex items-center justify-center transition-all duration-200 ease-monki hover:-translate-y-0.5";
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} onClick={e => e.stopPropagation()}>
      <a href={llamar} title={tr("Llamar")} aria-label={tr("Llamar")} className={`${base} bg-monki-k text-monki-y`}><Phone size={13} /></a>
      <a href={enlaceWhatsApp(tel)} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="WhatsApp" className={`${base} bg-[#25D366] text-white`}><MessageCircle size={13} /></a>
    </span>
  );
}
