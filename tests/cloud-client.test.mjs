import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createHandler } from '../api/library.js';
import { createCloudClient } from '../src/cloud-client.js';
import { memoryStore } from './blob-store.mjs';

const host='test.public.blob.vercel-storage.com';
const id='b0b807cd-4480-43a4-b54b-456b979ef631';
const key=randomBytes(32).toString('hex');process.env.ADMIN_ACCESS_KEY=key;
const record={id,name:'제안서',subtitle:'',pages:[{name:'1.png',src:'assets/page-1.png'}],pdf:null};
function server() {
  const handler=createHandler(memoryStore({cacheCatalog:true}));
  return async (url,options)=>{
    if(url.endsWith('/admin'))return Response.json({ok:true});
    const response={code:200,status(n){this.code=n;return this;},setHeader(){},json(value){this.value=value;},end(){}};
    await handler({method:options.method,headers:{authorization:options.headers.Authorization},body:options.body?JSON.parse(options.body):undefined},response);
    return Response.json(response.value,{status:response.code});
  };
}
test('successive edits use strong origin ETags even when GET returns weak CDN ETags',async()=>{
  const cloud=createCloudClient({fetchRequest:server()});await cloud.login(key);await cloud.load();
  await cloud.save(record);await cloud.save({...record,name:'二回目'});
  assert.equal((await cloud.load())[0].name,'二回目');
});
test('another client saving an unrelated proposal does not invalidate a draft',async()=>{
  const fetchRequest=server();const a=createCloudClient({fetchRequest}),b=createCloudClient({fetchRequest});
  await a.login(key);await b.login(key);await a.load();await b.load();
  await a.save(record);const baseVersion=a.getVersion(id);
  await b.save({...record,id:'c0b807cd-4480-43a4-b54b-456b979ef631'});
  await a.save({...record,name:'開いた下書き'},()=>{},baseVersion);
  assert.equal((await a.load()).length,2);
});
test('conflicted save keeps files reusable and explicit retry avoids uploading them twice',async()=>{
  const fetchRequest=server();let uploads=0;
  const uploadFile=async()=>{uploads++;return {url:`https://${host}/media/${crypto.randomUUID()}.png`};};
  const a=createCloudClient({fetchRequest,uploadFile}),b=createCloudClient({fetchRequest});
  await a.login(key);await b.login(key);await a.load();await a.save(record);await b.load();
  const baseline=a.getVersion(id);await b.save({...record,name:'another edit'});
  const file=new Blob(['image']);const draft={...record,name:'my draft',pages:[{name:'1.png',blob:file}]};
  await assert.rejects(a.save(draft,()=>{},baseline),error=>error.code==='PROPOSAL_CONFLICT');
  const other={...record,id:'c0b807cd-4480-43a4-b54b-456b979ef631'};await b.save(other);
  await a.refreshVersion(id);assert.equal(a.getVersion(other.id),null);
  await a.save(draft,()=>{},a.getVersion(id));
  assert.equal(uploads,1);assert.equal((await a.load())[0].name,'my draft');
});

test('a stalled API response body times out instead of leaving the form waiting',async()=>{
  const cloud=createCloudClient({requestTimeoutMs:20,fetchRequest:async()=>({ok:true,json:()=>new Promise(()=>{})})});
  await assert.rejects(cloud.load(),error=>error.code==='OPERATION_TIMEOUT');
});

test('a stalled SDK upload times out, aborts and cannot publish a late result',async()=>{
  let resolveUpload,uploadSignal,writes=0;
  const fetchRequest=server();
  const cloud=createCloudClient({uploadIdleTimeoutMs:20,fetchRequest:async(url,options)=>{if(url.endsWith('/library')&&options.method==='POST')writes++;return fetchRequest(url,options);},
    uploadFile:async(_,__,options)=>{uploadSignal=options.abortSignal;return new Promise(resolve=>{resolveUpload=resolve;});}});
  await cloud.login(key);await cloud.load();
  const draft={...record,pages:[{name:'1.png',blob:new Blob(['image'])}]};
  await assert.rejects(cloud.save(draft),error=>error.code==='OPERATION_TIMEOUT');
  assert.equal(uploadSignal.aborted,true);
  resolveUpload({url:`https://${host}/media/${crypto.randomUUID()}.png`});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(writes,0);
});

test('upload progress renews the idle deadline and exposes a percentage',async()=>{
  const messages=[];
  const cloud=createCloudClient({fetchRequest:server(),uploadIdleTimeoutMs:80,uploadFile:async(_,__,options)=>{
    await new Promise(resolve=>setTimeout(resolve,45));options.onUploadProgress({loaded:5,total:10,percentage:50});
    await new Promise(resolve=>setTimeout(resolve,45));return {url:`https://${host}/media/${crypto.randomUUID()}.png`};
  }});
  await cloud.login(key);await cloud.load();
  await cloud.save({...record,pages:[{name:'1.png',blob:new Blob(['image'])}]},message=>messages.push(message));
  assert.ok(messages.some(message=>message.includes('50%')));
});

test('cancel during upload preserves completed files for retry and stops catalog writes',async()=>{
  let uploads=0,started;
  const secondStarted=new Promise(resolve=>{started=resolve;});
  const cloud=createCloudClient({fetchRequest:server(),uploadFile:async(_,__,options)=>{
    uploads++;
    if(uploads===2){started();return new Promise((_,reject)=>options.abortSignal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));}
    return {url:`https://${host}/media/${crypto.randomUUID()}.png`};
  }});
  await cloud.login(key);await cloud.load();
  const draft={...record,pages:[{name:'1.png',blob:new Blob(['a'])},{name:'2.png',blob:new Blob(['b'])}]};
  const controller=new AbortController();
  const saving=cloud.save(draft,()=>{},null,{signal:controller.signal});
  const rejected=assert.rejects(saving,error=>error.code==='SAVE_CANCELLED');
  await secondStarted;controller.abort();await rejected;
  assert.equal((await cloud.load()).length,0);
  await cloud.save(draft);
  assert.equal(uploads,3);assert.equal((await cloud.load())[0].pages.length,2);
});

test('a lost save response is reconciled with the public catalog without a second write',async()=>{
  const fetchRequest=server();let writes=0;
  const cloud=createCloudClient({requestTimeoutMs:20,fetchRequest:async(url,options)=>{
    const response=await fetchRequest(url,options);
    if(url.endsWith('/library')&&options.method==='POST'){writes++;return new Promise(()=>{});}
    return response;
  }});
  await cloud.login(key);await cloud.load();
  assert.equal((await cloud.save(record)).name,record.name);
  assert.equal(writes,1);assert.equal((await cloud.load()).length,1);
});
