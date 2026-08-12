const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Storage
  store: {
    get:    (key)        => ipcRenderer.invoke("store:get", key),
    set:    (key, value) => ipcRenderer.invoke("store:set", key, value),
    delete: (key)        => ipcRenderer.invoke("store:delete", key),
    getAll: ()           => ipcRenderer.invoke("store:getAll"),
    setAll: (data)       => ipcRenderer.invoke("store:setAll", data),
    clear:  ()           => ipcRenderer.invoke("store:clear"),
  },
  // Imprimir
  print: {
    html: (html) => ipcRenderer.invoke("print:html", html),
  },
  // Excel
  excel: {
    export: (sheets, nombre) => ipcRenderer.invoke("excel:export", sheets, nombre),
  },
  // Shell
  shell: {
    openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
  },
  // Ventana / login
  window: {
    loginSuccess: () => ipcRenderer.send("login-success"),
    logout:       () => ipcRenderer.send("logout"),
  },
});
