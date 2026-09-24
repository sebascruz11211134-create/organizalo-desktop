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
