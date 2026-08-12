/**
 * api.js — instancia de axios configurada con timeout global.
 * Importar `api` en lugar de `axios` directamente para garantizar
 * que todas las llamadas al backend tengan un timeout de 5 segundos.
 */
import axios from "axios";

const api = axios.create({
  baseURL: "http://31.97.141.124:3001",
  timeout: 5000,
});

export default api;
