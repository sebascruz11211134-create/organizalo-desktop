import {test} from 'node:test';import assert from 'node:assert/strict';
import {emitir,reenviar,camposHacienda,yaEnviada,REINTENTABLES} from '../src/utils/comprobantes.js';
const responder=(status,body)=>async(url,opts)=>{responder.ultima={url,opts};return {ok:status<300,status,json:async()=>body};};
test('un error del backend conserva el comprobante guardado para reenviar',async()=>{
 globalThis.fetch=responder(502,{error:'No sabemos si Hacienda recibió',comprobante:{id:'inv1',estado:'envio_incierto',clave:'506X',numeroConsecutivo:'00100001010000000001'}});
 const r=await emitir('/api/invoices',{a:1},{token:'t',idempotencyKey:'fe-1'});
 assert.equal(r.ok,false);assert.equal(r.comprobante.id,'inv1');
 assert.equal(responder.ultima.opts.headers['Idempotency-Key'],'fe-1');
 const campos=camposHacienda(r);assert.equal(campos.haciendaId,'inv1');assert.equal(campos.haciendaEstado,'envio_incierto');
 assert.ok(REINTENTABLES.has(campos.haciendaEstado));assert.equal(yaEnviada(campos),false);
});
test('sin conexión no inventa comprobante y se puede reintentar',async()=>{
 globalThis.fetch=async()=>{throw new Error('Failed to fetch');};
 const r=await emitir('/api/invoices',{},{token:'t',idempotencyKey:'fe-2'});
 assert.equal(r.comprobante,null);assert.match(r.error,/Sin conexión/);
 assert.equal(camposHacienda(r).haciendaEstado,'sin_conexion');assert.equal(yaEnviada(camposHacienda(r)),false);
});
test('una nota ya enviada no se vuelve a emitir',async()=>{
 globalThis.fetch=responder(200,{id:'n1',estado:'enviado',clave:'506Y'});
 const r=await reenviar('/api/emision/notas/n1/reenviar',{token:'t'});
 assert.equal(r.ok,true);assert.equal(yaEnviada(camposHacienda(r)),true);
 assert.match(responder.ultima.url,/\/api\/emision\/notas\/n1\/reenviar$/);
});
import {camposFactura,facturaReintentable,reintentarFactura,registrarEmision,quitarEmision,emisionesEnCurso} from '../src/utils/comprobantes.js';
test('error recuperable → corte de conexión → el reintento sigue usando reenviar',async()=>{
 const nota={id:'n1',haciendaId:'srv1',haciendaEstado:'error_firma'};
 globalThis.fetch=async()=>{throw new Error('Failed to fetch');};
 const r=await reenviar('/api/emision/notas/srv1/reenviar',{token:'t'});
 const campos=camposHacienda(r,nota);
 assert.equal(campos.haciendaEstado,undefined,'conserva el estado fiscal previo');assert.equal(campos.haciendaId,undefined,'no borra el id');
 const despues={...nota,...campos};
 assert.equal(despues.haciendaId,'srv1');assert.equal(despues.haciendaEstado,'error_firma');assert.equal(yaEnviada(despues),false);
});
test('reintentar una factura: con id usa reenviar; sin respuesta previa repite con la misma Idempotency-Key',async()=>{
 const llamadas=[];globalThis.fetch=async(url,opts)=>{llamadas.push({url,key:opts.headers['Idempotency-Key']});return {ok:true,status:200,json:async()=>({id:'srv9',estado:'enviado',clave:'506Z'})};};
 const conId={id:'f1',haciendaId:'srv9',estado:'envio_incierto'};
 assert.ok(facturaReintentable(conId));
 let {campos}=await reintentarFactura(conId,'t');
 assert.match(llamadas[0].url,/\/api\/invoices\/srv9\/reenviar$/);assert.equal(campos.estado,'enviado');
 const sinRespuesta={id:'f2',estado:'sin_conexion',payload:{a:1}};
 assert.ok(facturaReintentable(sinRespuesta));
 ({campos}=await reintentarFactura(sinRespuesta,'t'));
 assert.match(llamadas[1].url,/\/api\/invoices$/);assert.equal(llamadas[1].key,'fe-f2');assert.equal(campos.haciendaId,'srv9');
 assert.equal(facturaReintentable({id:'f3',estado:'enviado',haciendaId:'x'}),false);
 // Un corte durante el reintento de una factura con id no la devuelve a "sin_conexion"
 globalThis.fetch=async()=>{throw new Error('offline');};
 ({campos}=await reintentarFactura(conId,'t'));
 assert.equal(campos.estado,undefined);assert.match(campos.error,/Sin conexión/);
});
test('la emisión en curso se anota antes del envío y sobrevive a un reinicio',()=>{
 const mem={};globalThis.localStorage={getItem:k=>mem[k]??null,setItem:(k,v)=>{mem[k]=v;}};
 registrarEmision({id:'f9',payload:{x:1}},'e:u');registrarEmision({id:'f9',payload:{x:2}},'e:u');
 assert.deepEqual(emisionesEnCurso('e:u'),[{id:'f9',payload:{x:2},propietario:'e:u'}],'sin duplicados');
 quitarEmision('f9');assert.deepEqual(emisionesEnCurso('e:u'),[]);
});
import {propietarioDe} from '../src/utils/comprobantes.js';
test('la cola de emisiones es por cuenta: otra cuenta no ve ni reanuda ventas ajenas',()=>{
 const mem={};globalThis.localStorage={getItem:k=>mem[k]??null,setItem:(k,v)=>{mem[k]=v;}};
 const a=propietarioDe({id:'ua',empresaId:'ea'}),b=propietarioDe({id:'ub',empresaId:'eb'});
 registrarEmision({id:'fa',payload:{}},a);
 assert.equal(emisionesEnCurso(a).length,1);assert.deepEqual(emisionesEnCurso(b),[]);assert.deepEqual(emisionesEnCurso(null),[]);
 assert.throws(()=>registrarEmision({id:'x'},null),/sesión/);
});
test('si el almacenamiento local falla, registrarEmision lanza (y el envío no debe hacerse)',()=>{
 globalThis.localStorage={getItem:()=>'[]',setItem:()=>{throw new Error('QuotaExceededError');}};
 assert.throws(()=>registrarEmision({id:'f1',payload:{}},'e:u'),/Quota/);
});
test('un 200 con el cuerpo cortado no cuenta como éxito y se puede reintentar',async()=>{
 globalThis.fetch=async()=>({ok:true,status:200,json:async()=>{throw new SyntaxError('Unexpected end of JSON input');}});
 const r=await emitir('/api/invoices',{a:1},{token:'t',idempotencyKey:'fe-x'});
 assert.equal(r.ok,false);assert.equal(r.comprobante,null);assert.equal(r.status,undefined);
 const f={id:'x',payload:{a:1},...camposFactura(r,{})};
 assert.equal(f.estado,'sin_conexion');assert.ok(facturaReintentable(f),'queda reintentable con la misma clave');
 globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({})});
 assert.equal((await emitir('/api/invoices',{},{token:'t',idempotencyKey:'fe-y'})).ok,false,'200 sin id/estado tampoco');
});
import {referenciaDeFactura} from '../src/utils/comprobantes.js';
test('la nota referencia la CLAVE de la factura original, no el número local',()=>{
 const facturas=[{numero:'FE-00001',clave:'5'.repeat(50),fecha:'2026-08-30',fechaEmision:'2026-09-01T15:20:00-06:00',tipoDoc:'01'},{numero:'FE-00002',tipoDoc:'04'}];
 assert.deepEqual(referenciaDeFactura(facturas,'FE-00001'),{referenciaNumero:'5'.repeat(50),referenciaFecha:'2026-09-01T15:20:00-06:00',referenciaTipoDoc:'01'},'fecha fiscal, no la del selector');
 const pedir=(fecha,tipo)=>({fecha:()=>fecha,tipo:()=>tipo});
 assert.match(referenciaDeFactura(facturas,'FE-00002',pedir('2026-08-15','01')).error,/no fue emitida/,'factura local sin clave: se bloquea, no se manda FE-00002');
 assert.match(referenciaDeFactura(facturas,'FE-99999',pedir('2026-08-15','01')).error,/clave de 50 dígitos/,'externa sin clave');
 assert.deepEqual(referenciaDeFactura(facturas,'9'.repeat(50),pedir('2026-08-15','04')),{referenciaNumero:'9'.repeat(50),referenciaFecha:'2026-08-15',referenciaTipoDoc:'04'},'externa: fecha y tipo reales');
 assert.match(referenciaDeFactura(facturas,'9'.repeat(50),pedir('','01')).error,/fecha/,'sin fecha no se envía');
 assert.match(referenciaDeFactura(facturas,'9'.repeat(50),pedir('2026-08-15','')).error,/tipo/,'sin tipo no se envía');
 assert.deepEqual(referenciaDeFactura(facturas,''),{});
});

test('la fecha fiscal que devuelve el backend se guarda en la factura y no se pierde con un error de conexión',()=>{
 const c=camposFactura({ok:true,comprobante:{id:'s1',estado:'enviado',clave:'5'.repeat(50),fechaEmision:'2026-09-24T10:00:00-06:00'}},{});
 assert.equal(c.fechaEmision,'2026-09-24T10:00:00-06:00');
 const sin=camposFactura({ok:false,comprobante:null,error:'x'},{haciendaId:'s1',fechaEmision:'2026-09-24T10:00:00-06:00'});
 assert.equal(sin.fechaEmision,undefined,'sin respuesta no se pisa (queda la guardada)');
});
import {payloadVigente} from '../src/utils/comprobantes.js';
import {fechaLocal} from '../src/utils/fmt.js';
test('reintentar una factura en dólares al día siguiente usa la cotización vigente o se bloquea',async()=>{
 const hoy=fechaLocal();
 const ayer=fechaLocal(new Date(Date.now()-86400000));
 const payload={moneda:'USD',tipoCambio:500,tipoCambioFecha:ayer,items:[]};
 assert.equal(payloadVigente({...payload,tipoCambioFecha:hoy},null).requiereCotizacion,true,'aunque sea de hoy, sin cotización oficial no se envía');
 assert.equal(payloadVigente({moneda:'CRC'},null).payload.moneda,'CRC','colones: no aplica');
 const vigente=payloadVigente(payload,{venta:512,fecha:hoy,oficial:true});
 assert.match(payloadVigente(payload,{venta:508,fecha:hoy,oficial:false,referencia:true}).error,/oficial/,'la referencia de mercado no sirve');
 assert.equal(vigente.payload.tipoCambio,512);assert.equal(vigente.payload.tipoCambioFecha,hoy);
 assert.match(payloadVigente(payload,{venta:512,fecha:ayer}).error,/no es del día/);
 assert.match(payloadVigente(payload,{venta:517,fecha:hoy,fallback:true}).error,/no es del día/);
 // El reintento real manda la cotización nueva y la guarda en la factura
 let enviado;globalThis.fetch=async(url,opts)=>{enviado=JSON.parse(opts.body);return {ok:true,status:201,json:async()=>({id:'s9',estado:'simulado',clave:'5'.repeat(50)})};};
 const {campos}=await reintentarFactura({id:'fx',estado:'sin_conexion',payload},'t',{venta:512,fecha:hoy,oficial:true});
 assert.equal(enviado.tipoCambio,512);assert.equal(campos.payload.tipoCambio,512);
 enviado=null;await reintentarFactura({id:'fz',estado:'sin_conexion',payload},'t',{venta:508,fecha:hoy,oficial:false,referencia:true});
 assert.equal(enviado,null,'con referencia no oficial no se envía');
 // Sin cotización vigente no se envía nada
 enviado=null;const b=await reintentarFactura({id:'fy',estado:'sin_conexion',payload},'t',null);
 assert.equal(enviado,null);assert.equal(b.r.ok,false);
});

import {cotizacionOficialDeHoy} from '../src/utils/comprobantes.js';
test('facturar en dólares: solo cotización oficial del BCCR de hoy',()=>{
 const hoy=fechaLocal();
 assert.equal(cotizacionOficialDeHoy({venta:512,fecha:hoy,oficial:true}),true);
 assert.equal(cotizacionOficialDeHoy({venta:508,fecha:hoy,oficial:false,referencia:true}),false,'referencia de mercado');
 assert.equal(cotizacionOficialDeHoy({venta:527,fecha:hoy,fallback:true,oficial:false}),false,'aproximada');
 assert.equal(cotizacionOficialDeHoy({venta:512,fecha:'2020-01-01',oficial:true}),false,'de otro día');
 assert.equal(cotizacionOficialDeHoy(null),false);
 const pay={moneda:'USD',tipoCambio:500,tipoCambioFecha:'2020-01-01'};
 assert.equal(payloadVigente(pay,{venta:508,fecha:hoy,oficial:false,referencia:true}).requiereCotizacion,true);
});

test('lo emitido manda también en reintentos: tipo y total del comprobante del backend',()=>{
 const c=camposFactura({ok:true,comprobante:{id:'h1',estado:'enviado',clave:'5'.repeat(50),numeroConsecutivo:'00100001040000000001',total:5.537}},{total:5.54,tipoDoc:'01'});
 assert.equal(c.tipoDoc,'04');assert.equal(c.total,5.537);
 const sinRespuesta=camposFactura({ok:false,error:'red'},{total:10});
 assert.equal('total' in sinRespuesta,false,'sin comprobante no se toca el total');
});
