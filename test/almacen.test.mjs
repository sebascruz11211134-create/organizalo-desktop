// Migración de localStorage → IndexedDB (src/utils/almacen.js).
// Cada caso usa una IndexedDB simulada nueva y una instancia nueva del módulo
// (como si fuera otra pestaña o un nuevo arranque de la app).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';

let n = 0;
const nuevaInstancia = () => import(`../src/utils/almacen.js?instancia=${++n}`);
const ls = (k, v) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));

beforeEach(() => { localStorage.clear(); globalThis.indexedDB = new IDBFactory(); });

test('migra los datos del negocio y solo libera lo que quedó copiado', async () => {
  ls('@finanzia/contactos', [{ id: 'c1', nombre: 'Ana' }]);
  ls('@finanzia/rota', '{no es json');
  ls('@finanzia/authToken', 'tok');
  ls('@finanzia/onboarding_completado', '1');
  const a = await nuevaInstancia(); await a.iniciarAlmacen();
  assert.deepEqual(a.leer('@finanzia/contactos'), [{ id: 'c1', nombre: 'Ana' }]);
  assert.equal(localStorage.getItem('@finanzia/contactos'), null);       // liberado
  assert.equal(localStorage.getItem('@finanzia/rota'), '{no es json');   // no se tocó
  assert.equal(localStorage.getItem('@finanzia/authToken'), 'tok');       // sesión se queda
  assert.equal(localStorage.getItem('@finanzia/onboarding_completado'), '1');
  // Un arranque posterior lee lo mismo desde IndexedDB
  const b = await nuevaInstancia(); await b.iniciarAlmacen();
  assert.deepEqual(b.leer('@finanzia/contactos'), [{ id: 'c1', nombre: 'Ana' }]);
});

test('segunda pestaña que migra después no borra lo que la primera copió', async () => {
  ls('@finanzia/facturas', [{ id: 'f1' }]);
  const a = await nuevaInstancia(); await a.iniciarAlmacen();
  const b = await nuevaInstancia(); await b.iniciarAlmacen();
  assert.deepEqual(b.leer('@finanzia/facturas'), [{ id: 'f1' }]);
});

test('lo escrito sin IndexedDB (respaldo) se combina, no pisa ni se pierde', async () => {
  const a = await nuevaInstancia(); await a.iniciarAlmacen();
  await a.escribir('@finanzia/facturas', [{ id: 'f1', total: 100 }, { id: 'f2', total: 200 }]);
  // Simula un arranque sin IndexedDB que escribió en localStorage
  const sinIdb = globalThis.indexedDB; delete globalThis.indexedDB;
  const r = await nuevaInstancia(); await r.iniciarAlmacen();
  globalThis.indexedDB = sinIdb;
  await r.escribir('@finanzia/facturas', [{ id: 'f2', total: 250 }, { id: 'f3', total: 300 }]);
  localStorage.setItem('monki:datosEnRespaldo', new Date().toISOString()); // la marca la pone el respaldo con IndexedDB presente
  const b = await nuevaInstancia(); await b.iniciarAlmacen();
  const porId = Object.fromEntries(b.leer('@finanzia/facturas').map(f => [f.id, f.total]));
  assert.deepEqual(porId, { f1: 100, f2: 250, f3: 300 });
  assert.equal(localStorage.getItem('@finanzia/facturas'), null);
  assert.equal(localStorage.getItem('monki:datosEnRespaldo'), null);
});

test('una copia vieja en localStorage no pisa datos más nuevos de IndexedDB', async () => {
  const a = await nuevaInstancia(); await a.iniciarAlmacen();
  await a.escribir('@finanzia/contactos', [{ id: 'c1', nombre: 'Nuevo' }]);
  ls('@finanzia/contactos', [{ id: 'c1', nombre: 'Viejo' }]); // resto de una migración a medias
  const b = await nuevaInstancia(); await b.iniciarAlmacen();
  assert.deepEqual(b.leer('@finanzia/contactos'), [{ id: 'c1', nombre: 'Nuevo' }]);
  assert.equal(localStorage.getItem('@finanzia/contactos'), null);
});

test('leer devuelve una copia: modificarla no cambia lo guardado', async () => {
  const a = await nuevaInstancia(); await a.iniciarAlmacen();
  await a.escribir('@finanzia/productos', [{ id: 'p1', stock: 5 }]);
  const lista = a.leer('@finanzia/productos'); lista[0].stock = 999;
  assert.equal(a.leer('@finanzia/productos')[0].stock, 5);
});

test('otra empresa en el mismo equipo: se borran los datos anteriores', async () => {
  const a = await nuevaInstancia(); await a.iniciarAlmacen();
  await a.asegurarDueno({ id: 'u1', empresaId: 'E1' });
  await a.escribir('@finanzia/facturas', [{ id: 'f1' }]);
  await a.asegurarDueno({ id: 'u2', empresaId: 'E1' });            // misma empresa: se conservan
  assert.deepEqual(a.leer('@finanzia/facturas'), [{ id: 'f1' }]);
  ls('@finanzia/authToken', 'tok');
  await a.asegurarDueno({ id: 'u9', empresaId: 'E2' });            // otra empresa: se borran
  assert.equal(a.leer('@finanzia/facturas'), null);
  assert.equal(localStorage.getItem('@finanzia/authToken'), 'tok');
  const b = await nuevaInstancia(); await b.iniciarAlmacen();       // y no reaparecen al reiniciar
  assert.equal(b.leer('@finanzia/facturas'), null);
});
