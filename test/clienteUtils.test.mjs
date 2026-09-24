import {test,beforeEach} from 'node:test';import assert from 'node:assert/strict';
import db from '../src/utils/db.js';
import {reducirInventario,limpiarVentaAplicada,crearCXC,crearCXP} from '../src/utils/clienteUtils.js';
beforeEach(()=>{localStorage.clear();globalThis.fetch=async()=>({ok:true,json:async()=>({})});});

test('reintentar la misma venta no descuenta dos veces, aunque haya 60 ventas en medio',async()=>{
 await db.setProductos([{id:'p',nombre:'Hilo',stock:1000}]);
 await reducirInventario([{productoId:'p',cantidad:1}],'venta-0');
 for(let i=1;i<=60;i++)await reducirInventario([{productoId:'p',cantidad:1}],`venta-${i}`);
 assert.equal((await db.getProductos())[0].stock,939);
 await reducirInventario([{productoId:'p',cantidad:1}],'venta-0'); // reanudación tardía
 assert.equal((await db.getProductos())[0].stock,939,'no se vuelve a descontar');
 await limpiarVentaAplicada('venta-0');
 assert.equal((await db.getProductos())[0].ventasAplicadas.includes('venta-0'),false,'la marca se limpia tras confirmar');
 for(let i=1;i<=60;i++)await limpiarVentaAplicada(`venta-${i}`);
 assert.equal('ventasAplicadas' in (await db.getProductos())[0],false,'no crece sin límite');
});

test('una sola CxC por factura',async()=>{
 await crearCXC({cliente:{nombre:'Ana'},total:100,plazo:30,facturaRef:'FE-1',facturaId:'f1'});
 await crearCXC({cliente:{nombre:'Ana'},total:100,plazo:30,facturaRef:'FE-1',facturaId:'f1'});
 assert.equal((await db.getDebts()).length,1);
});

test('crear CxP de una compra a crédito sigue funcionando',async()=>{
 await crearCXP({proveedor:{nombre:'Proveedor'},total:500,moneda:'CRC',fechaVence:'2026-10-30',facturaRef:'C-1'});
 const d=await db.getDebts();assert.equal(d.length,1);assert.equal(d[0].tipo,'pagar');
});
