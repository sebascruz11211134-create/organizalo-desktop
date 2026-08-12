const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");

// Puerto 443 del VPS tiene cert autofirmado — aceptarlo mientras no haya Let's Encrypt
// Solo afecta conexiones a 31.97.141.124 (el proxy Vite ya lo maneja en dev via Node.js)
app.commandLine.appendSwitch("ignore-certificate-errors");
const path = require("path");
const Store = require("electron-store");
const XLSX = require("xlsx");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");


// ── Store (base de datos local) ───────────────────────────────────────────────
const store = new Store({ name: "organizalo-data" });

// ── Ventana principal ─────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  // Arranca en modo compacto (pantalla de login)
  mainWindow = new BrowserWindow({
    width: 360,
    height: 500,
    resizable: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: "#0d1829",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, "..", "assets",
      process.platform === "darwin" ? "icon.icns" :
      process.platform === "win32"  ? "icon.ico"  : "icon.png"),
    show: false,
  });

  const isDev = !app.isPackaged;

  // Ícono en el dock de macOS (dev mode)
  if (process.platform === "darwin") {
    const { nativeImage } = require("electron");
    const iconPath = path.join(__dirname, "..", "assets", "icon.png");
    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(nativeImage.createFromPath(iconPath));
    }
  }

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", () => mainWindow.show());
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // ── Auto-update (solo en producción) ────────────────────────────────────────
  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    // Revisar actualizaciones 5 segundos después de que carga la app
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {/* sin internet, ignorar */});
    }, 5000);

    autoUpdater.on("update-downloaded", () => {
      dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Actualización lista — Organízalo.AI",
        message: "Hay una nueva versión disponible.",
        detail: "La actualización ya se descargó. Reiniciá la app para instalarla.",
        buttons: ["Reiniciar ahora", "Más tarde"],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
    });

    autoUpdater.on("error", () => {/* silencioso */});
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ── IPC: Login / ventana ──────────────────────────────────────────────────────

// El renderer avisa que el login fue exitoso → expandir a ventana completa
ipcMain.on("login-success", () => {
  mainWindow.setResizable(true);
  mainWindow.setMinimumSize(900, 600);
  mainWindow.setSize(1280, 800, true);
  mainWindow.center();
});

// El renderer avisa que el usuario cerró sesión → volver a ventana compacta
ipcMain.on("logout", () => {
  mainWindow.setMinimumSize(0, 0);
  mainWindow.setSize(360, 500, true);
  mainWindow.setResizable(false);
  mainWindow.center();
});

// ── IPC: Storage ──────────────────────────────────────────────────────────────

ipcMain.handle("store:get", (_, key) => store.get(key));
ipcMain.handle("store:set", (_, key, value) => { store.set(key, value); return true; });
ipcMain.handle("store:delete", (_, key) => { store.delete(key); return true; });
ipcMain.handle("store:getAll", () => store.store);
ipcMain.handle("store:setAll", (_, data) => { Object.entries(data).forEach(([k, v]) => store.set(k, v)); return true; });
ipcMain.handle("store:clear", () => { store.clear(); return true; });

// ── IPC: Imprimir HTML ────────────────────────────────────────────────────────

ipcMain.handle("print:html", async (_, html) => {
  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  win.webContents.print({ silent: false, printBackground: true }, (success) => {
    win.close();
  });
  return true;
});

// ── IPC: Exportar Excel ───────────────────────────────────────────────────────

ipcMain.handle("excel:export", async (_, sheets, nombreArchivo) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `${nombreArchivo}.xlsx`,
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });
  if (canceled || !filePath) return false;

  const wb = XLSX.utils.book_new();
  sheets.forEach(({ nombre, columnas, filas }) => {
    const ws = XLSX.utils.aoa_to_sheet([columnas, ...filas]);
    const colWidths = columnas.map((c, i) => ({
      wch: Math.max(c.length, ...filas.map((r) => String(r[i] ?? "").length), 10),
    }));
    ws["!cols"] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, nombre.slice(0, 31));
  });
  XLSX.writeFile(wb, filePath);
  shell.showItemInFolder(filePath);
  return true;
});

// ── IPC: Abrir URL externa ────────────────────────────────────────────────────
ipcMain.handle("shell:openExternal", (_, url) => shell.openExternal(url));
