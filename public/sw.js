// Monki ERP — service worker mínimo.
// Permite instalar el ERP en el celular. No guarda versiones viejas: siempre
// pide la última a la red, así cada publicación le llega sola a todos. Solo si
// no hay conexión abre la última página cargada para no quedar en blanco.
const CACHE = "monki-inicio";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || req.mode !== "navigate") return; // API y archivos: directo a la red
  e.respondWith(
    fetch(req)
      .then(res => {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put("/", copia)).catch(() => {});
        return res;
      })
      .catch(() => caches.match("/"))
  );
});
