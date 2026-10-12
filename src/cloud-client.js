import { upload } from '@vercel/blob/client';

export function createCloudClient({ fetchRequest = fetch, uploadFile = upload, base = '' } = {}) {
  let key = '', revision = null, versions = {};
  const uploaded = new WeakMap();
  async function request(path, body, authenticated = false) {
    const response = await fetchRequest(`${base}/api/${path}`, { method: body ? 'POST' : 'GET', cache: 'no-store', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(authenticated ? { Authorization: `Bearer ${key}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({ error: '공용 서버 응답을 확인할 수 없습니다.' }));
    if (!response.ok) { const error = new Error(data.error || '공용 저장소에 연결하지 못했습니다.'); error.code = data.code; throw error; }
    return data;
  }
  async function uploadMedia(item, progress, pdf = false) {
    if (!item?.blob) return item;
    const cached = uploaded.get(item.blob); if (cached) return cached;
    const extension = pdf ? 'pdf' : (item.name.split('.').pop() || '').toLowerCase();
    const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', pdf: 'application/pdf' };
    if (!types[extension]) throw new Error(`지원하지 않는 파일입니다: ${item.name}`);
    if (item.blob.size > (pdf ? 200 : 25) * 1024 * 1024) throw new Error(`${item.name}: ${pdf ? 200 : 25}MB 이하 파일을 선택하세요.`);
    progress(`${item.name} 업로드 중…`);
    const result = await uploadFile(`media/${crypto.randomUUID()}.${extension}`, item.blob, { access: 'public', contentType: types[extension], handleUploadUrl: `${base}/api/upload`, headers: { Authorization: `Bearer ${key}` }, multipart: item.blob.size > 5 * 1024 * 1024 });
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
    async save(record, progress = () => {}, baseVersion = versions[record.id] ?? null) {
      const pages = []; for (const item of record.pages) pages.push(await uploadMedia(item, progress));
      const pdf = record.pdf ? await uploadMedia(record.pdf, progress, true) : null;
      progress('제안서 목록 저장 중…');
      const data = await request('library', { revision, baseVersion, record: { ...record, pages, pdf } }, true);
      remember(record.id, data); return data.record;
    }
  };
}
export const cloud = createCloudClient({ base: typeof location !== 'undefined' && location.hostname.endsWith('github.io') ? 'https://proposalweb-plum.vercel.app' : '' });
