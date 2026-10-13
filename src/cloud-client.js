import { upload } from '@vercel/blob/client';
import { withDeadline, cancelledError } from './operation.js';
export { withDeadline } from './operation.js';

export function createCloudClient({ fetchRequest = fetch, uploadFile = upload, base = '', requestTimeoutMs = 30000, uploadIdleTimeoutMs = 120000 } = {}) {
  let key = '', revision = null, versions = {};
  const uploaded = new WeakMap();
  async function request(path, body, authenticated = false, signal) {
    return withDeadline(async abortSignal => {
    const response = await fetchRequest(`${base}/api/${path}`, { method: body ? 'POST' : 'GET', cache: 'no-store', signal: abortSignal, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(authenticated ? { Authorization: `Bearer ${key}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({ error: '공용 서버 응답을 확인할 수 없습니다.' }));
    if (!response.ok) { const error = new Error(data.error || '공용 저장소에 연결하지 못했습니다.'); error.code = data.code; throw error; }
    return data;
    }, { signal, timeoutMs: requestTimeoutMs });
  }
  async function uploadMedia(item, progress, pdf = false, signal) {
    if(signal?.aborted)throw cancelledError();
    if (!item?.blob) return item;
    const cached = uploaded.get(item.blob); if (cached) return cached;
    const extension = pdf ? 'pdf' : (item.name.split('.').pop() || '').toLowerCase();
    const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', pdf: 'application/pdf' };
    if (!types[extension]) throw new Error(`지원하지 않는 파일입니다: ${item.name}`);
    if (item.blob.size > (pdf ? 200 : 25) * 1024 * 1024) throw new Error(`${item.name}: ${pdf ? 200 : 25}MB 이하 파일을 선택하세요.`);
    progress(`${item.name} 업로드 준비 중…`);
    const result = await withDeadline((abortSignal, restart) => {
      let lastLoaded=0;
      return uploadFile(`media/${crypto.randomUUID()}.${extension}`, item.blob, { access: 'public', contentType: types[extension], handleUploadUrl: `${base}/api/upload`, headers: { Authorization: `Bearer ${key}` }, multipart: item.blob.size > 5 * 1024 * 1024, abortSignal,
        onUploadProgress: ({loaded,total,percentage}) => {
          if(abortSignal.aborted)return;
          if(loaded>lastLoaded){lastLoaded=loaded;restart();}
          progress(`${item.name} 업로드 중 · ${Math.round(percentage)}% (${(loaded/1048576).toFixed(1)} / ${(total/1048576).toFixed(1)}MB)`);
        }
      });
    }, {signal,timeoutMs:uploadIdleTimeoutMs,timeoutMessage:`${item.name}: 업로드가 응답하지 않습니다. 인터넷 연결을 확인하고 다시 저장해주세요. 입력 내용은 유지됩니다.`});
    const media = { name: item.name, src: result.url }; uploaded.set(item.blob, media); return media;
  }
  function remember(id, data) { revision = data.revision; versions[id] = data.version; }
  return {
    async login(value) { key = value.trim(); try { await request('admin', {}, true); } catch (error) { key = ''; throw error; } },
    logout() { key = ''; },
    getVersion(id) { return versions[id] ?? null; },
    async refreshVersion(id) { const data = await request('library'); revision = data.revision; versions[id] = data.versions?.[id] ?? null; return versions[id]; },
    async load() { const data = await request('library'); revision = data.revision; versions = data.versions ?? {}; return data.records; },
    async remove(id, baseVersion = versions[id] ?? null) { const data = await request('library', { revision, baseVersion, action: 'delete', id }, true); remember(id, data); },
    async save(record, progress = () => {}, baseVersion = versions[record.id] ?? null, {signal} = {}) {
      const pages = []; for (const item of record.pages) pages.push(await uploadMedia(item, progress, false, signal));
      const pdf = record.pdf ? await uploadMedia(record.pdf, progress, true, signal) : null;
      if(signal?.aborted)throw cancelledError();
      progress('제안서 목록 저장 중…');
      const savedRecord={ ...record, pages, pdf };
      let data;
      try { data = await request('library', { revision, baseVersion, record: savedRecord }, true, signal); }
      catch(error){
        // The server may have committed before the response was lost. Check
        // the public catalog before asking the user to retry a completed save.
        if(error.code!=='OPERATION_TIMEOUT'&&!(error instanceof TypeError))throw error;
        progress('저장 결과 확인 중…');
        const latest=await request('library');
        const found=latest.records.find(item=>item.id===record.id);
        const same=found&&['id','name','subtitle','pages','pdf'].every(field=>JSON.stringify(found[field])===JSON.stringify(savedRecord[field]));
        if(!same)throw error;
        data={record:found,revision:latest.revision,version:latest.versions?.[record.id]};
      }
      remember(record.id, data); return data.record;
    }
  };
}
export const cloud = createCloudClient({ base: typeof location !== 'undefined' && location.hostname.endsWith('github.io') ? 'https://proposalweb-plum.vercel.app' : '' });
