import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createHandler } from '../api/library.js';
import { createCloudClient } from '../src/cloud-client.js';
import { normalizeEtag } from '../lib/library.mjs';

const host='test.public.blob.vercel-storage.com';
const id='b0b807cd-4480-43a4-b54b-456b979ef631';
const key=randomBytes(32).toString('hex');process.env.ADMIN_ACCESS_KEY=key;
const record={id,name:'제안서',subtitle:'',pages:[{name:'1.png',src:'assets/page-1.png'}],pdf:null};
function server() {
  let stored=null,version=0;
  const handler=createHandler({
    async getBlob(){return stored===null?null:{blob:{url:`https://${host}/library/catalog.json`,etag:`"${version}"`},stream:new Response(stored).body};},
    async putBlob(path,value,options){if(stored!==null&&(!options.allowOverwrite||normalizeEtag(options.ifMatch)!==String(version))){const error=new Error('Precondition');error.name='BlobPreconditionFailedError';throw error;}stored=value;return {etag:String(++version)};}
  });
  return async (url,options)=>{
    if(url.endsWith('/admin'))return Response.json({ok:true});
    const response={code:200,status(n){this.code=n;return this;},setHeader(){},json(value){this.value=value;},end(){}};
    await handler({method:options.method,headers:{authorization:options.headers.Authorization},body:options.body?JSON.parse(options.body):undefined},response);
    return Response.json(response.value,{status:response.code});
  };
}
test('two successive client edits tolerate quoted GET and unquoted PUT ETags',async()=>{
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
