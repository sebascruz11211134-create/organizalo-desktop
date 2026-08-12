# Organízalo.AI Desktop — Instrucciones de instalación

## Requisitos
- Node.js 18+ (https://nodejs.org)
- npm 9+

---

## 1. Instalar y correr en modo desarrollo

```bash
cd organizalo-desktop
npm install
npm run dev
```

Esto abre Electron con hot-reload. Cualquier cambio en `src/` se refleja al instante.

---

## 2. Agregar el sync al backend de Railway

Copiá `organizalo-backend-sync.js` a tu proyecto de Railway y agregá estas dos líneas en tu `server.js` / `app.js`:

```js
const syncRouter = require("./organizalo-backend-sync");
app.use("/api/sync", syncRouter);
```

Luego hacé deploy en Railway normalmente.

---

## 3. Activar sync en el app móvil

En tu `App.js` del proyecto Expo, agregá:

```js
import { syncAll, startAutoSync } from "./src/utils/syncService";

// Dentro del useEffect principal:
useEffect(() => {
  syncAll();                // sync al abrir
  startAutoSync();          // auto cada 3 min
}, []);
```

---

## 4. Cómo funciona el sync

```
Móvil (AsyncStorage)  ←→  Railway Backend  ←→  Desktop (electron-store)
```

- El backend guarda un snapshot JSON por empresa en `/tmp/organizalo-sync/`
- Al abrir cualquier app: compara timestamps → descarga si el servidor es más nuevo, sube si los locales son más nuevos
- Auto-sync cada 3 minutos en background
- Las claves son exactamente iguales entre móvil y desktop

---

## 5. Generar el instalador (.dmg para Mac)

```bash
npm run build:mac
```

El archivo `.dmg` aparece en `dist/`. Para Windows:

```bash
npm run build:win
```

---

## 6. Pantallas disponibles

| Pantalla | Estado |
|----------|--------|
| Dashboard | ✅ Completo |
| CXC — Cuentas por Cobrar | ✅ Completo |
| CXP — Cuentas por Pagar | ✅ Completo |
| Recibos de caja | ✅ Completo |
| Contactos | ✅ Completo |
| Configuración + Sync | ✅ Completo |
| Facturación electrónica (Hacienda v4.4) | ✅ Completo |
| Historial de facturas | ✅ Completo |
| Inventario / Productos | ✅ Completo |
| Estado de cuenta por cliente | ✅ Completo |
| Notas de crédito | ✅ Completo |
| Reporte CXC | ✅ Completo |
| Reporte de Recibos | ✅ Completo |
| Reporte Cobros Vencidos | ✅ Completo |
| Asistente IA (Claude) | ✅ Completo |
| POS, Pedidos, Cotizaciones | 🔄 En desarrollo |
| Compras, Conciliación | 🔄 En desarrollo |
| Empleados, Planilla | 🔄 En desarrollo |
