import {test} from 'node:test';import assert from 'node:assert/strict';
import {calcNomina,calcRenta,calcHoras,tarifaHora,lineasAsientoPlanilla,TOTAL_OBRERO,TOTAL_PATRONO,TASAS_OBRERO,TASAS_PATRONO} from '../src/utils/planilla.js';

test('tasas CCSS 2026: 10,83% trabajador y 26,83% patrono, sin doble conteo',()=>{
 const suma=o=>Object.values(o).reduce((a,b)=>a+b,0);
 assert.equal(+suma(TASAS_OBRERO).toFixed(4),TOTAL_OBRERO);
 assert.equal(+suma(TASAS_PATRONO).toFixed(4),TOTAL_PATRONO);
 const c=calcNomina({salarioBruto:600000});
 assert.equal(c.ccssT+c.bpT,64980,'600.000 × 10,83%');       // antes: 11,67% = 70.020
 assert.equal(c.patTotal,160980,'600.000 × 26,83%');          // antes: ~38,4% = 230.520
 assert.equal(c.neto,535020);assert.equal(c.costoTotal,760980);
});

test('renta 2026 por tramos (Decreto 45333-H) y créditos fiscales',()=>{
 assert.equal(calcRenta(918000),0);
 assert.equal(calcRenta(1000000),8200);                        // (1.000.000−918.000)×10%
 assert.equal(calcRenta(1500000),42900+22950);                 // 429.000×10% + 153.000×15%
 assert.equal(calcRenta(5000000),42900+152550+472600+68250);   // tramos completos + 273.000×25%
 assert.equal(calcRenta(1000000,{hijos:2,conyuge:true}),8200-2*1710-2590);
 assert.equal(calcRenta(920000,{hijos:3}),0,'los créditos no dejan renta negativa');
 assert.equal(calcNomina({salarioBruto:1000000,aplicaRenta:true}).renta,8200);
 assert.equal(calcNomina({salarioBruto:1000000}).renta,0,'sin retención si no aplica');
});

test('empleados creados desde la pantalla Empleados (campo "salario") ya no salen en ₡0',()=>{
 assert.equal(calcNomina({salario:600000}).bruto,600000);
});

test('tarifa por hora: salario mensual ÷ 240 (antes ÷ 48) o la tarifa propia',()=>{
 assert.equal(tarifaHora({salarioBruto:480000}),2000);
 assert.equal(tarifaHora({salarioBruto:480000,tarifaHora:'1787.96'}),1787.96);
 const h=calcHoras({id:'e',salarioBruto:480000},'S1',{e_S1_normal:48,e_S1_tm:2,e_S1_doble:1});
 assert.equal(h.bruto,48*2000+2*3000+4000);
});

test('asiento de planilla cuadra y separa neto, CCSS y renta retenida',()=>{
 const emps=[{salarioBruto:600000},{salarioBruto:1500000,aplicaRenta:true}].map(calcNomina);
 const tot=Object.fromEntries(['bruto','ccssT','bpT','renta','neto','patTotal'].map(k=>[k,emps.reduce((s,c)=>s+c[k],0)]));
 const l=lineasAsientoPlanilla(tot);
 const debe=l.reduce((s,x)=>s+x.debe,0),haber=l.reduce((s,x)=>s+x.haber,0);
 assert.equal(debe,haber);
 assert.equal(l.find(x=>x.cuentaCodigo==='2101').haber,tot.neto,'a los empleados se les debe el neto, no el bruto');
 assert.equal(l.find(x=>x.cuentaCodigo==='2103').haber,tot.renta);
});
import {idAsientoPlanilla,asientoPlanillaExistente} from '../src/utils/planilla.js';
import {merge} from '../src/utils/syncMerge.mjs';
import {fechaDesplazada,parseFechaLocal} from '../src/utils/fmt.js';
test('asiento de planilla: uno por mes, incluidos los históricos y dos equipos sin sincronizar',()=>{
 assert.ok(asientoPlanillaExistente([{id:'x',descripcion:'Planilla septiembre de 2026 — 3 empleados',estado:'confirmado'}],'2026-09','septiembre de 2026'),'asiento viejo sin planillaMes');
 assert.equal(asientoPlanillaExistente([{id:'x',descripcion:'Planilla septiembre de 2026 — 3',estado:'anulado'}],'2026-09','septiembre de 2026'),undefined,'uno anulado no cuenta');
 assert.equal(asientoPlanillaExistente([{id:'y',descripcion:'Planilla agosto de 2026 — 3',estado:'confirmado'}],'2026-09','septiembre de 2026'),undefined);
 // Dos equipos confirman el mismo mes offline: mismo id → nunca quedan dos.
 const id=idAsientoPlanilla('2026-09');
 const igual={id,planillaMes:'2026-09',totalDebe:100};
 assert.equal(merge([],[igual],[{...igual}]).length,1,'idénticos: uno solo');
 // Con diferencias (otro número o fecha de creación) la sincronización lo marca como conflicto en vez de duplicarlo
 assert.throws(()=>merge([],[{...igual,numero:'AJ-00005'}],[{...igual,numero:'AJ-00007'}]),/Conflicto/);
});
test('fechas YYYY-MM-DD se leen en calendario local (recordatorio 3 días antes)',()=>{
 assert.equal(fechaDesplazada('2026-10-10',-3),'2026-10-07');
 assert.equal(fechaDesplazada('2026-03-01',-3),'2026-02-26');
 assert.equal(parseFechaLocal('2026-10-10').getDate(),10);
});
