const ignored = new Set(['authToken','refreshToken','authUser','empresaId','lastSync','usuarioActivo','modulosHabilitados']);
export const syncable = k => k.startsWith('@finanzia/') && !k.startsWith('@finanzia/syncBaseline:') && !ignored.has(k.slice(10));
export const clean = data => Object.fromEntries(Object.entries(data || {}).filter(([k])=>syncable(k)));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Only apply edits made relative to the last acknowledged snapshot.
// Same-field concurrent edits stop; neither side is silently overwritten.
export function merge(base,local,remote) {
  if (equal(local,base)) return remote;
  if (equal(remote,base) || equal(local,remote)) return local;
  if (Array.isArray(local) && Array.isArray(remote) && (base===undefined || Array.isArray(base))) {
    const arrays=[base || [],local,remote];
    if (arrays.every(a=>a.every(x=>x && typeof x==='object' && x.id) && new Set(a.map(x=>x.id)).size===a.length)) {
      const [b,l,r]=arrays.map(a=>Object.fromEntries(a.map(x=>[x.id,x])));
      return Object.values(merge(b,l,r)).filter(x=>x!==undefined);
    }
  }
  const object=v=>v && typeof v==='object' && !Array.isArray(v);
  if(object(local) && object(remote) && (base===undefined || object(base))) {
    const out={};
    for(const k of new Set([...Object.keys(base||{}),...Object.keys(local),...Object.keys(remote)])) {
      const v=merge(base?.[k],local[k],remote[k]); if(v!==undefined) out[k]=v;
    }
    return out;
  }
  throw new Error('Conflicto de sincronización: hay cambios distintos en el mismo dato. Tu copia local se conserva.');
}
