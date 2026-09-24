import { register } from 'node:module';
register('./_resolver.mjs', import.meta.url);
// Entorno mínimo de navegador para db.js
const mem = new Map();
globalThis.window = globalThis;
globalThis.location = { hostname: 'test' };
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k), key: i => [...mem.keys()][i], get length() { return mem.size; }, clear: () => mem.clear(),
};
