import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { isAdmin, validateRecord } from '../lib/library.mjs';
import { createHandler } from '../api/library.js';
import upload from '../api/upload.js';
import { memoryStore, digest } from './blob-store.mjs';

const host = 'test.public.blob.vercel-storage.com';
const proposal = { id: 'b0b807cd-4480-43a4-b54b-456b979ef631', name: '회사소개서', subtitle: '소제목', pages: [{ name: '1.png', src: `https://${host}/media/b0b807cd-4480-43a4-b54b-456b979ef631.png` }], pdf: null };
const key = randomBytes(32).toString('hex');
process.env.ADMIN_ACCESS_KEY = key;
function response() { return { headers: {}, statusCode: 200, setHeader(k,v){this.headers[k]=v;}, status(n){this.statusCode=n;return this;}, json(data){this.data=data;return this;}, end(){} }; }
async function call(handler, method, body, authenticated=false) {
  const res=response(); await handler({method,body,headers:{origin:'https://leejinho970715-star.github.io',...(authenticated?{authorization:`Bearer ${key}`}:{})}},res);return res;
}
test('authentication fails closed and checks complete bearer value',()=>{
  assert.equal(isAdmin(undefined,key),false);assert.equal(isAdmin(`Bearer ${key}`,key),true);
  assert.equal(isAdmin(`Bearer ${key}x`,key),false);assert.equal(isAdmin('Bearer short','short'),false);
  assert.equal(isAdmin(`Bearer ${key} `,` ${key}\n`),true);
});

test('origin metadata selects a fresh catalog URL and cached old contents cannot overwrite current data',async()=>{
  const store=memoryStore();const initial=createHandler(store);await call(initial,'GET');
  const saved=await call(initial,'POST',{baseVersion:null,record:proposal},true);
  store.files.delete(`library/catalog-versions/${saved.data.revision}.json`);
  let staleReads=0;
  const handler=createHandler({...store,async getBlob(path,options){
    if(path.startsWith('https:')){
      if(new URL(path).pathname==='/library/catalog.json'){
        assert.equal(new URL(path).searchParams.get('version'),saved.data.revision);
        if(staleReads++===0)return {blob:{url:`https://${host}/library/catalog.json`,etag:`W/"${digest('[]')}"`},stream:new Response('[]').body};
      }
    }
    return store.getBlob(path,options);
  }});
  const result=await call(handler,'GET');assert.equal(result.statusCode,200);
  assert.equal(result.data.records[0].name,proposal.name);assert.equal(staleReads,2);
});

test('an older cached catalog paired with a new origin ETag is never written',async()=>{
  let writes=0;
  const handler=createHandler({
    async headBlob(){return {url:`https://${host}/library/catalog.json`,etag:'"new"'};},
    async getBlob(path){return path.includes('/catalog-versions/')?null:{blob:{url:`https://${host}/library/catalog.json`,etag:'W/"old"'},stream:new Response('[]').body};},
    async putBlob(){writes++;}
  });
  const result=await call(handler,'POST',{baseVersion:null,record:proposal},true);
  assert.equal(result.statusCode,503);assert.equal(writes,0);
});

test('create, edit and delete remain immediately visible while the public catalog cache stays stale',async()=>{
  const store=memoryStore({cacheCatalog:true});const handler=createHandler(store);await call(handler,'GET');
  const first=await call(handler,'POST',{baseVersion:null,record:proposal},true);assert.equal(first.statusCode,200);
  assert.equal((await call(handler,'GET')).data.records.length,1);
  const edited=await call(handler,'POST',{baseVersion:first.data.version,record:{...proposal,name:'즉시 반영'}},true);assert.equal(edited.statusCode,200);
  assert.equal((await call(handler,'GET')).data.records[0].name,'즉시 반영');
  assert.equal((await call(handler,'POST',{baseVersion:edited.data.version,action:'delete',id:proposal.id},true)).statusCode,200);
  assert.deepEqual((await call(handler,'GET')).data.records,[{id:proposal.id,deleted:true}]);
  assert.equal(await new Response((await store.getBlob('library/catalog.json')).stream).text(),'[]');
});

test('simultaneous catalog initialization and identical content snapshots are safe',async()=>{
  const handler=createHandler(memoryStore());
  const results=await Promise.all([call(handler,'GET'),call(handler,'GET')]);
  assert.deepEqual(results.map(result=>result.statusCode),[200,200]);
  const first=await call(handler,'POST',{baseVersion:null,record:proposal},true);
  assert.equal((await call(handler,'POST',{baseVersion:first.data.version,record:proposal},true)).statusCode,200);
});
test('media URLs must belong to this store; built-in documents remain editable',()=>{
  assert.equal(validateRecord(proposal,host).name,proposal.name);
  for(const src of ['javascript:alert(1)','https://evil.example/media/a.png',`https://${host}@evil.example/media/a.png`,`https://${host}/media/a.png?bad=1`]) assert.throws(()=>validateRecord({...proposal,pages:[{name:'x',src}]},host));
  assert.equal(validateRecord({...proposal,id:'eumsquare',pages:[{name:'1',src:'assets/eumsquare/page-1.png'}],pdf:{name:'PDF',src:'assets/eumsquare/company-profile.pdf'}},host).builtIn,true);
});

test('Figma Slides and PPTX attachments validate independently of images and PDF',()=>{
  const pptx={name:'제안서.pptx',src:`https://${host}/media/b0b807cd-4480-43a4-b54b-456b979ef631.pptx`};
  const figmaUrl='https://www.figma.com/slides/RucV8xVMHXoAZXp59TVixq';
  const result=validateRecord({...proposal,pptx,figmaUrl},host);
  assert.deepEqual(result.pptx,pptx);assert.equal(result.figmaUrl,figmaUrl);
  for(const url of ['javascript:alert(1)','https://evil.example/slides/abc','https://www.figma.com@evil.example/slides/abc','https://www.figma.com/file/abc'])assert.throws(()=>validateRecord({...proposal,figmaUrl:url},host));
  for(const src of ['assets/page-1.png',`https://${host}/media/a.pdf`,'https://evil.example/media/a.pptx'])assert.throws(()=>validateRecord({...proposal,pptx:{...pptx,src}},host));
  assert.throws(()=>validateRecord({...proposal,pages:[pptx]},host));
  assert.throws(()=>validateRecord({...proposal,pdf:pptx},host));
});

test('older editors preserve new attachments, while explicit removal clears them',async()=>{
  const handler=createHandler(memoryStore());await call(handler,'GET');
  const attachments={pptx:{name:'제안서.pptx',src:`https://${host}/media/b0b807cd-4480-43a4-b54b-456b979ef631.pptx`},figmaUrl:'https://www.figma.com/slides/RucV8xVMHXoAZXp59TVixq'};
  const created=await call(handler,'POST',{baseVersion:null,record:{...proposal,...attachments}},true);
  const edited=await call(handler,'POST',{baseVersion:created.data.version,record:{...proposal,name:'기존 편집 화면'}},true);
  assert.equal(edited.statusCode,200);assert.deepEqual(edited.data.record.pptx,attachments.pptx);assert.equal(edited.data.record.figmaUrl,attachments.figmaUrl);
  const removed=await call(handler,'POST',{baseVersion:edited.data.version,record:{...proposal,pptx:null,figmaUrl:null}},true);
  assert.equal(removed.data.record.pptx,null);assert.equal(removed.data.record.figmaUrl,null);
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
