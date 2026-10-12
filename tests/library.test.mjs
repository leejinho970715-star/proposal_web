import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { isAdmin, validateRecord, normalizeEtag } from '../lib/library.mjs';
import { createHandler } from '../api/library.js';
import upload from '../api/upload.js';

const host = 'test.public.blob.vercel-storage.com';
const proposal = { id: 'b0b807cd-4480-43a4-b54b-456b979ef631', name: '회사소개서', subtitle: '소제목', pages: [{ name: '1.png', src: `https://${host}/media/b0b807cd-4480-43a4-b54b-456b979ef631.png` }], pdf: null };
const key = randomBytes(32).toString('hex');
process.env.ADMIN_ACCESS_KEY = key;
function response() { return { headers: {}, statusCode: 200, setHeader(k,v){this.headers[k]=v;}, status(n){this.statusCode=n;return this;}, json(data){this.data=data;return this;}, end(){} }; }
function memoryStore() {
  let content = null, version = 0;
  return {
    async getBlob(path, options) { assert.equal(options.useCache,false); return content === null ? null : { blob: { url: `https://${host}/${path}`, etag: `"${version}"` }, stream: new Response(content).body }; },
    async putBlob(path, value, options) {
      if (content !== null && (!options.allowOverwrite || normalizeEtag(options.ifMatch) !== String(version))) { const error = new Error('Precondition failed'); error.name='BlobPreconditionFailedError'; throw error; }
      content=value; version++; return {etag:String(version)};
    }
  };
}
async function call(handler, method, body, authenticated=false) {
  const res=response(); await handler({method,body,headers:{origin:'https://leejinho970715-star.github.io',...(authenticated?{authorization:`Bearer ${key}`}:{})}},res);return res;
}
test('authentication fails closed and checks complete bearer value',()=>{
  assert.equal(isAdmin(undefined,key),false);assert.equal(isAdmin(`Bearer ${key}`,key),true);
  assert.equal(isAdmin(`Bearer ${key}x`,key),false);assert.equal(isAdmin('Bearer short','short'),false);
  assert.equal(isAdmin(`Bearer ${key} `,` ${key}\n`),true);
});
test('media URLs must belong to this store; built-in documents remain editable',()=>{
  assert.equal(validateRecord(proposal,host).name,proposal.name);
  for(const src of ['javascript:alert(1)','https://evil.example/media/a.png',`https://${host}@evil.example/media/a.png`,`https://${host}/media/a.png?bad=1`]) assert.throws(()=>validateRecord({...proposal,pages:[{name:'x',src}]},host));
  assert.equal(validateRecord({...proposal,id:'eumsquare',pages:[{name:'1',src:'assets/eumsquare/page-1.png'}],pdf:{name:'PDF',src:'assets/eumsquare/company-profile.pdf'}},host).builtIn,true);
});
test('public reads, protected writes, shared create/edit/delete, and stale-write rejection',async()=>{
  const handler=createHandler(memoryStore());
  let result=await call(handler,'GET');assert.deepEqual(result.data.records,[]);assert.equal(result.headers['Access-Control-Allow-Origin'],'https://leejinho970715-star.github.io');
  const initial=result.data.revision;
  assert.equal((await call(handler,'POST',{revision:initial,record:proposal})).statusCode,401);
  result=await call(handler,'POST',{revision:initial,record:proposal},true);assert.equal(result.statusCode,200);
  const created=result.data.revision;
  assert.equal((await call(handler,'POST',{revision:initial,record:{...proposal,name:'stale'}},true)).statusCode,409);
  result=await call(handler,'POST',{revision:created,record:{...proposal,name:'수정된 회사소개서'}},true);assert.equal(result.statusCode,200);
  const edited=result.data.revision;
  assert.equal((await call(handler,'GET')).data.records[0].name,'수정된 회사소개서');
  result=await call(handler,'POST',{revision:edited,action:'delete',id:proposal.id},true);assert.equal(result.statusCode,200);
  assert.deepEqual((await call(handler,'GET')).data.records,[{id:proposal.id,deleted:true}]);
});
test('simultaneous writes cannot silently overwrite each other',async()=>{
  const handler=createHandler(memoryStore());const revision=(await call(handler,'GET')).data.revision;
  const results=await Promise.all([call(handler,'POST',{revision,record:proposal},true),call(handler,'POST',{revision,record:{...proposal,name:'concurrent'}},true)]);
  assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,409]);
});
test('upload token endpoint rejects unauthenticated and callback requests',async()=>{
  assert.equal((await call(upload,'POST',{type:'blob.generate-client-token'})).statusCode,401);
  assert.equal((await call(upload,'POST',{type:'blob.upload-completed'},true)).statusCode,400);
  assert.equal((await call(upload,'OPTIONS')).statusCode,204);
});

test('saving a different proposal does not block an open edit or deletion',async()=>{
  const handler=createHandler(memoryStore());
  await call(handler,'GET');
  const other={...proposal,id:'c0b807cd-4480-43a4-b54b-456b979ef631',name:'다른 제안서'};
  assert.equal((await call(handler,'POST',{baseVersion:null,record:proposal},true)).statusCode,200);
  const version=(await call(handler,'GET')).data.versions[proposal.id];
  assert.equal((await call(handler,'POST',{baseVersion:null,record:other},true)).statusCode,200);
  const saved=await call(handler,'POST',{baseVersion:version,record:{...proposal,name:'변경한 제목'}},true);
  assert.equal(saved.statusCode,200);
  const secondVersion=(await call(handler,'GET')).data.versions[other.id];
  assert.equal((await call(handler,'POST',{baseVersion:saved.data.version,action:'delete',id:proposal.id},true)).statusCode,200);
  assert.equal((await call(handler,'POST',{baseVersion:secondVersion,action:'delete',id:other.id},true)).statusCode,200);
});

test('concurrent changes to different proposals merge without losing either one',async()=>{
  const handler=createHandler(memoryStore());await call(handler,'GET');
  const other={...proposal,id:'c0b807cd-4480-43a4-b54b-456b979ef631'};
  const results=await Promise.all([call(handler,'POST',{baseVersion:null,record:proposal},true),call(handler,'POST',{baseVersion:null,record:other},true)]);
  assert.deepEqual(results.map(r=>r.statusCode),[200,200]);
  assert.equal((await call(handler,'GET')).data.records.length,2);
});

test('same-proposal changes and deletion are protected; explicit latest-version save succeeds',async()=>{
  const handler=createHandler(memoryStore());await call(handler,'GET');
  const first=await call(handler,'POST',{baseVersion:null,record:proposal},true);
  const updated=await call(handler,'POST',{baseVersion:first.data.version,record:{...proposal,name:'他の編集'}},true);
  const conflict=await call(handler,'POST',{baseVersion:first.data.version,record:{...proposal,name:'my draft'}},true);
  assert.equal(conflict.statusCode,409);assert.equal(conflict.data.code,'PROPOSAL_CONFLICT');
  assert.equal((await call(handler,'GET')).data.records[0].name,'他の編集');
  const forced=await call(handler,'POST',{baseVersion:updated.data.version,record:{...proposal,name:'my draft'}},true);assert.equal(forced.statusCode,200);
  assert.equal((await call(handler,'POST',{baseVersion:forced.data.version,action:'delete',id:proposal.id},true)).statusCode,200);
  assert.equal((await call(handler,'POST',{baseVersion:forced.data.version,record:proposal},true)).statusCode,409);
});
