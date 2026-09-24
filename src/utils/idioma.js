// Idioma de la interfaz (es | en). El texto en español es la clave: tr("Guardar")
// devuelve "Save" en inglés y el mismo texto en español o si no hay traducción.
import { useTranslation } from "react-i18next";
import EN, { PATRONES_EN } from "../locales/en_textos";

export function traducir(texto, lang) {
  if (lang !== "en" || typeof texto !== "string") return texto;
  const limpio = texto.trim();
  if (EN[limpio]) return texto.replace(limpio, EN[limpio]);
  for (const [patron, reemplazo] of PATRONES_EN) {
    if (patron.test(limpio)) return limpio.replace(patron, reemplazo);
  }
  return texto;
}

export function useIdioma() {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage || i18n.language || "es").slice(0, 2);
  return {
    lang,
    tr: texto => traducir(texto, lang),
    cambiar: nuevo => { i18n.changeLanguage(nuevo); document.documentElement.lang = nuevo; },
  };
}
