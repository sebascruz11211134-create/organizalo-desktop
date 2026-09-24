/**
 * Escáner de código de barras / QR con la cámara del teléfono (o webcam).
 * La librería ZXing se carga solo al abrirlo para no pesar en el resto del ERP.
 */
import React, { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { Modal, Boton } from "./ui";
import { useIdioma } from "../utils/idioma";

export default function EscanerCodigo({ onDetectado, onCerrar, titulo = "Escanear código" }) {
  const { tr } = useIdioma();
  const video = useRef(null);
  const [error, setError] = useState("");
  const avisar = useRef(onDetectado);
  avisar.current = onDetectado;

  useEffect(() => {
    let controles = null;
    let cancelado = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelado) return;
        const lector = new BrowserMultiFormatReader();
        controles = await lector.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          video.current,
          (resultado) => {
            if (!resultado || cancelado) return;
            cancelado = true;
            controles?.stop();
            navigator.vibrate?.(60);
            avisar.current(resultado.getText());
          },
        );
        if (cancelado) controles.stop();
      } catch (e) {
        setError(e?.name === "NotAllowedError"
          ? "Necesitás permitir el acceso a la cámara para escanear."
          : "No se pudo abrir la cámara en este dispositivo.");
      }
    })();
    return () => { cancelado = true; controles?.stop(); };
  }, []);

  return (
    <Modal titulo={titulo} subtitulo="Apuntá la cámara al código de barras o QR" onCerrar={onCerrar} ancho="max-w-md"
      pie={<Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>}>
      {error ? (
        <p className="text-sm text-red-600 bg-red-50 border-2 border-red-200 rounded-2xl px-4 py-3">{tr(error)}</p>
      ) : (
        <div className="relative rounded-[18px] overflow-hidden bg-monki-k aspect-[4/3]">
          <video ref={video} className="w-full h-full object-cover" muted playsInline />
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-24 border-2 border-monki-y rounded-2xl pointer-events-none">
            <ScanLine className="absolute inset-0 m-auto text-monki-y/70 animate-pulse" size={40} />
          </div>
        </div>
      )}
    </Modal>
  );
}
