import {test} from 'node:test';import assert from 'node:assert/strict';
import {guardarFacturaConEfectos} from '../src/utils/efectosFactura.js';
function entorno(inicial=[]){
 let facturas=inicial;const hechos=[];let fallarEn=null;
 const accion=n=>async()=>{if(fallarEn===n)throw new Error('app cerrada');hechos.push(n);};
 return {hechos,falla:n=>{fallarEn=n;},get facturas(){return facturas;},deps:{getFacturas:async()=>facturas,setFacturas:async v=>{facturas=v;},
  efectos:[['inventario',()=>true,accion('inventario')],['cxc',f=>f.condPago==='02',accion('cxc')],['asiento',()=>true,accion('asiento')]]}};
}
test('cierre entre efectos: al reanudar solo se aplican los que faltaban',async()=>{
 const e=entorno();const f={id:'f1',condPago:'02'};
 e.falla('cxc');
 await assert.rejects(guardarFacturaConEfectos(f,e.deps),/app cerrada/);
 assert.deepEqual(e.hechos,['inventario']);assert.equal(e.facturas.length,1);
 e.falla(null);
 await guardarFacturaConEfectos({...f,estado:'enviado'},e.deps);
 assert.deepEqual(e.hechos,['inventario','cxc','asiento'],'inventario no se repite');
 assert.equal(e.facturas.length,1);assert.equal(e.facturas[0].estado,'enviado');
 await guardarFacturaConEfectos({...f,estado:'aceptado'},e.deps);
 assert.deepEqual(e.hechos,['inventario','cxc','asiento'],'actualizar el estado no repite nada');
});
test('facturas viejas (sin registro de efectos) no se vuelven a aplicar al reintentar',async()=>{
 const e=entorno([{id:'vieja',condPago:'02',estado:'sin_conexion'}]);
 await guardarFacturaConEfectos({id:'vieja',estado:'enviado'},e.deps);
 assert.deepEqual(e.hechos,[]);
});
