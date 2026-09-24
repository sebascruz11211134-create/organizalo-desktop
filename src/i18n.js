import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import es from "./locales/es.json";
import en from "./locales/en.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    fallbackLng: "es",
    supportedLngs: ["es", "en"],
    // Español por defecto: solo cambia si el usuario eligió otro idioma.
    detection: {
      order: ["localStorage"],
      caches: ["localStorage"],
      lookupLocalStorage: "monki_idioma", // clave nueva: la vieja guardaba el idioma del navegador sin que el usuario eligiera
    },
    interpolation: {
      escapeValue: false,
    },
  });

document.documentElement.lang = (i18n.resolvedLanguage || "es").slice(0, 2);

export default i18n;
