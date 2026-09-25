import axios from 'axios';
import { io } from 'socket.io-client';
import db from './db';
import { getToken,getUser } from './auth';
import { BACKEND } from './config';
import {clean,merge} from './syncMerge.mjs';
import {leer,escribir,asegurarDueno} from './almacen';
let listeners=[],status='idle',socket=null,interval=null,timer=null,running=null,detenido=false;
function setStatus(value,error) { status=value; listeners.forEach(f=>f({status,error})); }
function notify() {
  const updatedAt=new Date().toISOString();
  listeners.forEach(f=>f({updatedAt,status}));
  window.dispatchEvent(new CustomEvent('organizalo:sync',{detail:{updatedAt}}));
}
export function subscribeSync(fn) { listeners.push(fn); return ()=>{listeners=listeners.filter(f=>f!==fn);}; }
export function getSyncStatus() { return status; }
async function perform() {
  if(detenido) return {ok:true,skipped:true};
  const token=await getToken(), user=await getUser();
  if(!token || !user) return {ok:true,skipped:true};
  const bucket=user.empresaId || user.empresa_id || user.id;
  if(!bucket) throw new Error('Sesión sin empresa');
  // Datos locales de otra empresa/cuenta: se borran antes de sincronizar
  if(!window.electronAPI?.store) await asegurarDueno(user);
  const key=`@finanzia/syncBaseline:${bucket}`;
  // Baselines never go through db.getAll/server sync.
  const base=leer(key,{}) || {};
  const headers={Authorization:`Bearer ${token}`};
  setStatus('syncing');
  const remote=(await axios.get(`${BACKEND}/api/clouddata/pull`,{headers,timeout:15000})).data;
  if(!remote.versions) throw new Error('Actualizá el servidor antes de usar la nueva sincronización.');
  const local=clean(await db.getAll());
  const merged=merge(base,local,clean(remote.data));
  const changed=Object.fromEntries(Object.entries(merged).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(remote.data[k])));
  // Explicit deletion is represented by null, never accidental omission.
  for(const k of Object.keys(remote.data)) if(!(k in merged)) changed[k]=null;
  let accepted=remote;
  if(Object.keys(changed).length) accepted=(await axios.post(`${BACKEND}/api/clouddata/push`,{data:changed,baseVersions:remote.versions},{headers,timeout:15000})).data;
  // Session switch or edits during the request must not be overwritten.
  if(detenido || (await getToken())!==token) return {ok:false,error:'La sesión cambió'};
  const current=clean(await db.getAll());
  const reconciled=merge(local,current,clean(accepted.data));
  // Lo que el merge dejó fuera fue borrado en el servidor: borrarlo también aquí
  // (si no, la copia vieja vuelve a subirse como si fuera nueva).
  const borradas=Object.fromEntries(Object.keys(current).filter(k=>!(k in reconciled)).map(k=>[k,null]));
  await db.setAll({...reconciled,...borradas});
  await escribir(key,clean(accepted.data));
  setStatus('idle'); notify();
  return {ok:true,synced:true};
}
export async function syncAll() {
  if(running) return running;
  running=perform().catch(e=>{
    const error=e.response?.data?.error || e.message;
    setStatus(navigator.onLine?'error':'offline',error);
    return {ok:false,error};
  }).finally(()=>{running=null;});
  return running;
}
// Cierre de sesión: frenar todo y esperar la sincronización en curso
export async function detenerSync() {
  detenido=true; stopAutoSync(); disconnectSocket();
  try { await running; } catch { /* ignorar */ }
}
export function reanudarSync() { detenido=false; }
window.__orgDetenerSync=detenerSync;
window.__orgReanudarSync=reanudarSync;
export function schedulePush() { clearTimeout(timer); timer=setTimeout(()=>syncAll(),1200); }
window.__orgPush=schedulePush;
export async function pushSync() { return (await syncAll()).ok; }
export async function pullSync() { return (await syncAll()).ok ? new Date().toISOString() : null; }
export async function processQueue() { return syncAll(); }
export async function connectSocket() {
  const token=await getToken(); if(!token) return;
  socket?.disconnect(); socket=io(BACKEND,{auth:{token},reconnection:true});
  socket.on('connect',()=>syncAll()); socket.on('data:changed',()=>syncAll());
}
export function startAutoSync(onSync) {
  stopAutoSync(); syncAll().then(onSync);
  interval=setInterval(()=>syncAll().then(onSync),30000);
}
export function stopAutoSync() { clearInterval(interval); interval=null; clearTimeout(timer); }
export function isSocketConnected() { return socket?.connected ?? false; }
export function disconnectSocket() { socket?.disconnect(); socket=null; }
export const onSync=subscribeSync;

export const onSyncUpdate=subscribeSync;
