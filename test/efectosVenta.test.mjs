import {test,beforeEach} from 'node:test';import assert from 'node:assert/strict';
import db from '../src/utils/db.js';
import {guardarFacturaVenta} from '../src/utils/efectosVenta.js';
beforeEach(()=>{localStorage.clear();globalThis.fetch=async()=>({ok:true,json:async()=>({})});});
const factura={id:'f1',numero:'FE-1',condPago:'02',plazo:30,cliente:{nombre:'Ana'},total:1130,subtotal:1000,totalIVA:130,moneda:'CRC',
 lineas:[{productoId:'p',descripcion:'Hilo',cantidad:2}],estado:'sin_conexion'};

test('corte al crear el asiento y recuperación desde el historial: completa solo lo que faltaba',async()=>{
 await db.setProductos([{id:'p',nombre:'Hilo',stock:10}]);
 const original=db.setAsientos;db.setAsientos=async()=>{throw new Error('app cerrada');};
 await assert.rejects(guardarFacturaVenta(factura,'t'),/app cerrada/);
 db.setAsientos=original;
 let f=(await db.getFacturas())[0];
 assert.deepEqual(f.efectos,{inventario:true,cxc:true},'el asiento NO quedó marcado');
 // Reintento desde el historial (ya enviada)
 await guardarFacturaVenta({...factura,estado:'enviado',haciendaId:'srv1'},'t');
 f=(await db.getFacturas())[0];
 assert.equal(f.estado,'enviado');assert.deepEqual(f.efectos,{inventario:true,cxc:true,asiento:true});
 assert.equal((await db.getProductos())[0].stock,8,'inventario descontado una sola vez');
 assert.equal((await db.getDebts()).length,1,'una sola CxC');
 assert.equal((await db.getAsientos()).length,1,'el asiento se creó al recuperar');
 await guardarFacturaVenta({...f,estado:'aceptado'},'t');
 assert.equal((await db.getAsientos()).length,1);assert.equal((await db.getDebts()).length,1);
});
import {efectosPendientes} from '../src/utils/efectosVenta.js';
import {facturaReintentable} from '../src/utils/comprobantes.js';
test('factura ya enviada con asiento pendiente: el historial ofrece completarla sin reenviar',async()=>{
 await db.setProductos([{id:'p',nombre:'Hilo',stock:10}]);
 const original=db.setAsientos;db.setAsientos=async()=>{throw new Error('fallo al guardar asiento');};
 await assert.rejects(guardarFacturaVenta({...factura,estado:'enviado',haciendaId:'srv1'},'t'));
 db.setAsientos=original;
 const f=(await db.getFacturas())[0];
 assert.equal(facturaReintentable(f),false,'no hay nada que reenviar a Hacienda');
 assert.equal(efectosPendientes(f),true,'pero el botón queda habilitado para completar el registro');
 await guardarFacturaVenta(f,'t');
 const g=(await db.getFacturas())[0];
 assert.equal(efectosPendientes(g),false);assert.equal((await db.getAsientos()).length,1);
 assert.equal((await db.getProductos())[0].stock,8);assert.equal((await db.getDebts()).length,1);
 assert.equal(efectosPendientes({id:'vieja',estado:'enviado'}),false,'facturas viejas no aparecen como pendientes');
});
test('dos recuperaciones simultáneas de la misma factura descuentan inventario una sola vez',async()=>{
 await db.setProductos([{id:'p',nombre:'Hilo',stock:10}]);
 // Fuerza el intercalado peligroso: la 2a lectura de productos espera a que la
 // 1a recuperación ya haya descontado, marcado y limpiado su marca de venta.
 const getP=db.getProductos;let n=0;db.getProductos=async()=>{if(++n===2)await new Promise(r=>setTimeout(r,60));return getP();};
 await Promise.all([guardarFacturaVenta({...factura,estado:'enviado'},'t'),guardarFacturaVenta({...factura,estado:'enviado'},'t')]);
 db.getProductos=getP;
 assert.equal((await db.getProductos())[0].stock,8);
 assert.equal((await db.getDebts()).length,1);assert.equal((await db.getAsientos()).length,1);
 assert.equal((await db.getFacturas()).length,1);
});
test('dos ventas distintas en paralelo no se pisan (ambas facturas y ambos descuentos)',async()=>{
 await db.setProductos([{id:'p',nombre:'Hilo',stock:10}]);
 const getF=db.getFacturas;db.getFacturas=async()=>{const v=await getF();await new Promise(r=>setTimeout(r,15));return v;};
 await Promise.all([guardarFacturaVenta({...factura,id:'fa',numero:'FE-A'},'t'),guardarFacturaVenta({...factura,id:'fb',numero:'FE-B'},'t')]);
 db.getFacturas=getF;
 assert.deepEqual((await db.getFacturas()).map(f=>f.id).sort(),['fa','fb']);
 assert.equal((await db.getProductos())[0].stock,6);
 assert.equal((await db.getDebts()).length,2);assert.equal((await db.getAsientos()).length,2);
});
test('si el calendario del servidor no responde, las ventas se siguen registrando',async()=>{
 await db.setProductos([{id:'p',nombre:'Hilo',stock:10}]);
 globalThis.fetch=()=>new Promise(()=>{}); // nunca responde
 const conTiempo=(p,ms)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('bloqueada')),ms))]);
 await conTiempo(guardarFacturaVenta({...factura,id:'c1',numero:'FE-C1',condPago:'02'},'t'),1000);
 await conTiempo(guardarFacturaVenta({...factura,id:'c2',numero:'FE-C2',condPago:'01'},'t'),1000);
 assert.deepEqual((await db.getFacturas()).map(f=>f.id).sort(),['c1','c2']);
 assert.equal((await db.getDebts()).length,1,'la CxC se guardó sin esperar al calendario');
});
