/**
 * api.js — instancia de axios configurada con timeout global.
 * Importar `api` en lugar de `axios` directamente para garantizar
 * que todas las llamadas al backend tengan un timeout de 5 segundos.
 */
import axios from "axios";
import { BACKEND } from "./config";

const api = axios.create({
  baseURL: BACKEND,
  timeout: 5000,
});

export default api;
