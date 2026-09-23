import {test} from 'node:test';import assert from 'node:assert/strict';import {merge,clean} from '../src/utils/syncMerge.mjs';
test('Rocky-created order survives local edits to another order',()=>{
 const base=[{id:'a',name:'old'}],local=[{id:'a',name:'new'}],remote=[{id:'a',name:'old'},{id:'b',name:'Rocky'}];
 assert.deepEqual(merge(base,local,remote),[{id:'a',name:'new'},{id:'b',name:'Rocky'}]);
});
test('competing edits are reported, including deletion vs edit',()=>{
 assert.throws(()=>merge({name:'a'},{name:'b'},{name:'c'}));
 assert.throws(()=>merge([{id:'a',name:'old'}],[],[{id:'a',name:'updated'}]));
});
test('server-only data on a new device and local-only data are retained',()=>{
 assert.deepEqual(merge({}, {}, {'@finanzia/pedidos':[{id:'a'}]}),{'@finanzia/pedidos':[{id:'a'}]});
 assert.deepEqual(merge({}, {'@finanzia/pedidos':[{id:'a'}]}, {}),{'@finanzia/pedidos':[{id:'a'}]});
});
test('credentials, tenant ids and baselines never leave device',()=>{
 assert.deepEqual(clean({'@finanzia/authToken':'x','@finanzia/refreshToken':'x','@finanzia/empresaId':'x','@finanzia/syncBaseline:x':{},'@finanzia/pedidos':[]}),{'@finanzia/pedidos':[]});
});
