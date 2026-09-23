import React,{useEffect,useState} from 'react';
import {getToken} from '../utils/auth';
import {BACKEND} from '../utils/config';
const names={pending:'En espera',processing:'Preparando',ready:'Lista para enviar',sent:'Enviada',review:'Requiere revisión',draft:'Borrador',resolved:'Atendido',sending:'Enviando'};
export default function RockyChannels(){
  const [inbox,setInbox]=useState(null),[gmail,setGmail]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function request(path,body){
    const token=await getToken();
    const res=await fetch(`${BACKEND}/api/rocky/channels${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    const data=await res.json();if(!res.ok)throw new Error(data.error||'No se pudo completar la operación');return data;
  }
  async function refresh(){
    try{const [i,g]=await Promise.all([request('/inbox'),request('/gmail/status')]);setInbox(i);setGmail(g);setError('');}
    catch(e){setError(e.message);}
  }
  useEffect(()=>{refresh();const t=setInterval(refresh,15000);return()=>clearInterval(t);},[]);
  async function action(path,body){setBusy(true);try{const result=await request(path,body);if(result.url){window.location.assign(result.url);return;}await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <section className="space-y-4 rounded-xl border border-slate-200 p-4">
    <h2 className="font-semibold text-slate-800">Canales y actividad de Rocky</h2>
    <p className="text-sm text-slate-600">Rocky trabaja desde el servidor, incluso con el ERP cerrado. Los mensajes que necesitan una decisión quedan para revisión.</p>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg bg-slate-50 p-3"><strong>WhatsApp</strong><p className="text-sm">{inbox?.cloudConfigured?'Conexión oficial configurada. Confirmá la recepción con un mensaje de prueba.':'Conexión oficial pendiente de configurar.'}</p></div>
      <div className="rounded-lg bg-slate-50 p-3"><strong>Gmail</strong><p className="text-sm break-all">{gmail?.account?.email||'Sin cuenta conectada'}</p>
        {gmail?.account?.error&&<p className="text-sm text-red-700">{gmail.account.error}</p>}
        {gmail?.account?.last_poll&&<p className="text-xs text-slate-500">Última revisión: {new Date(gmail.account.last_poll).toLocaleString('es-CR')}</p>}
        <button disabled={busy||!gmail?.configured} onClick={()=>action('/gmail/connect',{})} className="mt-2 rounded bg-yellow-400 px-3 py-2 text-sm disabled:opacity-40">{gmail?.account?'Reconectar Gmail':'Conectar Gmail'}</button>
        {!gmail?.configured&&<p className="text-xs mt-2">Falta completar la conexión de Google en el servidor.</p>}
      </div>
    </div>
    <div className="flex justify-between items-center"><h3 className="font-medium">Mensajes recientes</h3><button onClick={refresh} className="text-sm underline">Actualizar</button></div>
    {!inbox?.messages?.length&&<p className="text-sm text-slate-500">Todavía no hay mensajes registrados en esta bandeja.</p>}
    <div className="space-y-3 max-h-96 overflow-auto">{inbox?.messages?.map(m=><article key={m.id} className="border rounded-lg p-3 text-sm space-y-2">
      <div className="flex flex-wrap justify-between gap-2"><strong>{m.sender}</strong><span>{names[m.status]||m.status}</span></div>
      <p className="text-xs text-slate-500">{m.channel==='gmail'?'Correo':'WhatsApp'} · {new Date(m.created_at).toLocaleString('es-CR')}</p>
      {m.reply&&<p className="whitespace-pre-wrap">{m.reply}</p>}{m.error&&<p className="text-amber-800">{m.error}</p>}
      <div className="flex flex-wrap gap-3">
        <button disabled={busy} className="underline" onClick={()=>action('/pause',{channel:m.channel,sender:m.sender,minutes:60})}>Atender yo durante 1 hora</button>
        <button disabled={busy} className="underline" onClick={()=>action('/pause',{channel:m.channel,sender:m.sender,minutes:0})}>Reanudar Rocky</button>
        {['review','draft'].includes(m.status)&&<button disabled={busy} className="underline" onClick={()=>action(`/inbox/${m.id}/resolve`,{})}>Marcar atendido</button>}
      </div>
    </article>)}</div>
  </section>;
}
