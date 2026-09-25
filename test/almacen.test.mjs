// Almacén en IndexedDB con un espacio por empresa (src/utils/almacen.js).
// Cada caso usa una IndexedDB simulada nueva y una instancia nueva del módulo
// (como si fuera otra pestaña o un nuevo arranque de la app).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';

let n = 0;
const nuevaInstancia = () => import(`../src/utils/almacen.js?instancia=${++n}`);
const ls = (k, v) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
const sesion = (empresaId) => ls('@finanzia/authUser', { id: 'u-' + empresaId, empresaId });

beforeEach(() => { localStorage.clear(); globalThis.indexedDB = new IDBFactory(); });

test('migra los datos del negocio y solo libera lo que quedó copiado', async () => {
  sesion('E1');
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
  const b = await nuevaInstancia(); await b.iniciarAlmacen();            // otro arranque
  assert.deepEqual(b.leer('@finanzia/contactos'), [{ id: 'c1', nombre: 'Ana' }]);
});

test('segunda pestaña que migra después no borra lo que la primera copió', async () => {
  sesion('E1');
  ls('@finanzia/facturas', [{ id: 'f1' }]);
  const a = await nuevaInstancia(); await a.iniciarAlmacen();
  const b = await nuevaInstancia(); await b.iniciarAlmacen();
  assert.deepEqual(b.leer('@finanzia/facturas'), [{ id: 'f1' }]);
});

test('si el espacio ya existe y no abre, el almacén se bloquea: nada de trabajar sobre una copia vacía', async () => {
  sesion('E1');
  const a = await nuevaInstancia(); await a.iniciarAlmacen();
  await a.escribir('@finanzia/facturas', [{ id: 'f1' }]);
  a.cerrarEspacio();
  const real = globalThis.indexedDB;
  globalThis.indexedDB = { open() { throw new Error('IndexedDB roto'); }, deleteDatabase() { return {}; } };
  const b = await nuevaInstancia(); await b.iniciarAlmacen();
  assert.ok(b.almacenBloqueado());
  assert.equal(b.leer('@finanzia/facturas'), null);
  await assert.rejects(b.escribir('@finanzia/facturas', []));        // no escribe en otro lado
  assert.equal(localStorage.getItem('@finanzia/facturas'), null);
  globalThis.indexedDB = real;
  const c = await nuevaInstancia(); await c.iniciarAlmacen();         // al volver, todo intacto
  assert.equal(c.almacenBloqueado(), null);
  assert.deepEqual(c.leer('@finanzia/facturas'), [{ id: 'f1' }]);
});

test('IndexedDB presente pero no abre (aunque sea un espacio nuevo): se bloquea, nunca cae a localStorage', async () => {
  sesion('E1');
  ls('@finanzia/contactos', [{ id: 'c1' }]);                       // datos de la versión anterior
  globalThis.indexedDB = { open() { throw new Error('no disponible'); }, deleteDatabase() { return {}; } };
  const a = await nuevaInstancia(); await a.iniciarAlmacen();
  assert.ok(a.almacenBloqueado());
  assert.ok(localStorage.getItem('@finanzia/contactos'));          // no se tocó nada
});

test('navegador sin IndexedDB: usa localStorage y otra empresa no borra los datos, pide cerrar la cuenta', async () => {
  delete globalThis.indexedDB;
  sesion('E1');
  const a = await nuevaInstancia(); await a.iniciarAlmacen();
  await a.escribir('@finanzia/facturas', [{ id: 'f1' }]);
  assert.ok(localStorage.getItem('@finanzia/facturas'));
  await assert.rejects(a.abrirEspacio('E2'), /otra empresa/);
  assert.ok(localStorage.getItem('@finanzia/facturas'));           // intactas
});

test('si otra pestaña cambia la sesión, las escrituras de la sesión vieja se rechazan', async () => {
  sesion('E1');
  localStorage.setItem('monki:sesion', 'S1');
  const a = await nuevaInstancia(); await a.iniciarAlmacen();
  await a.escribir('@finanzia/facturas', [{ id: 'f1' }]);
  localStorage.setItem('monki:sesion', 'S2');                      // otra pestaña: login/logout
  await assert.rejects(a.escribir('@finanzia/facturas', []), /sesión cambió/);
  assert.deepEqual(a.leer('@finanzia/facturas'), [{ id: 'f1' }]);
});

test('datos en localStorage de OTRA empresa van a su espacio, no al de quien entra', async () => {
  ls('@finanzia/facturas', [{ id: 'deE1' }]);
  ls('@finanzia/syncBaseline:E1', {});          // la versión anterior deja este rastro de su dueño
  sesion('E2');
  const a = await nuevaInstancia(); await a.iniciarAlmacen();
  assert.equal(a.leer('@finanzia/facturas'), null);
  await a.abrirEspacio('E1');
  assert.deepEqual(a.leer('@finanzia/facturas'), [{ id: 'deE1' }]);
});

test('una copia vieja en localStorage no pisa datos más nuevos de IndexedDB', async () => {
  sesion('E1');
  const a = await nuevaInstancia(); await a.iniciarAlmacen();
  await a.escribir('@finanzia/contactos', [{ id: 'c1', nombre: 'Nuevo' }]);
  a.cerrarEspacio();
  ls('@finanzia/contactos', [{ id: 'c1', nombre: 'Viejo' }]); // resto de una migración a medias
  const b = await nuevaInstancia(); await b.iniciarAlmacen();
  assert.deepEqual(b.leer('@finanzia/contactos'), [{ id: 'c1', nombre: 'Nuevo' }]);
  assert.equal(localStorage.getItem('@finanzia/contactos'), null);
});

test('leer devuelve una copia: modificarla no cambia lo guardado', async () => {
  sesion('E1');
  const a = await nuevaInstancia(); await a.iniciarAlmacen();
  await a.escribir('@finanzia/productos', [{ id: 'p1', stock: 5 }]);
  const lista = a.leer('@finanzia/productos'); lista[0].stock = 999;
  assert.equal(a.leer('@finanzia/productos')[0].stock, 5);
});

test('cada empresa tiene su espacio: otra cuenta no ve ni borra los datos de la anterior', async () => {
  sesion('E1');
  const a = await nuevaInstancia(); await a.iniciarAlmacen();
  await a.escribir('@finanzia/facturas', [{ id: 'f1', pendienteDeSubir: true }]);
  // Entra otra empresa en el mismo equipo
  sesion('E2');
  await a.abrirEspacio({ id: 'u9', empresaId: 'E2' });
  assert.equal(a.espacioActual(), 'E2');
  assert.equal(a.leer('@finanzia/facturas'), null);
  await a.escribir('@finanzia/facturas', [{ id: 'g1' }]);
  // Vuelve la primera: todo intacto, incluso lo que no se había subido
  sesion('E1');
  await a.abrirEspacio({ id: 'u1', empresaId: 'E1' });
  assert.deepEqual(a.leer('@finanzia/facturas'), [{ id: 'f1', pendienteDeSubir: true }]);
});

test('cerrar sesión con todo subido elimina el espacio; con cambios pendientes lo conserva', async () => {
  sesion('E1');
  const a = await nuevaInstancia(); await a.iniciarAlmacen();
  await a.escribir('@finanzia/facturas', [{ id: 'f1' }]);
  a.cerrarEspacio();                                   // salir conservando
  await a.abrirEspacio('E1');
  assert.deepEqual(a.leer('@finanzia/facturas'), [{ id: 'f1' }]);
  await a.borrarEspacio();                             // salir con todo sincronizado
  await a.abrirEspacio('E1');
  assert.equal(a.leer('@finanzia/facturas'), null);
});
