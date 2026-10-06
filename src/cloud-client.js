import { upload } from '@vercel/blob/client';
const base = location.hostname.endsWith('github.io') ? 'https://proposalweb-plum.vercel.app' : '';
let key = '', revision = null;
async function request(path, body, authenticated = false) {
  const response = await fetch(`${base}/api/${path}`, { method: body ? 'POST' : 'GET', cache: 'no-store', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(authenticated ? { Authorization: `Bearer ${key}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({ error: '공용 서버 응답을 확인할 수 없습니다.' }));
  if (!response.ok) throw new Error(data.error || '공용 저장소에 연결하지 못했습니다.');
  return data;
}
export const cloud = {
  async login(value) { key = value; try { await request('admin', {}, true); } catch (error) { key = ''; throw error; } },
  logout() { key = ''; },
  async load() { const data = await request('library'); revision = data.revision; return data.records; },
  async remove(id) { const data = await request('library', { revision, action: 'delete', id }, true); revision = data.revision; },
  async save(record, progress = () => {}) {
    const uploadMedia = async (item, pdf = false) => {
      if (!item?.blob) return item;
      const extension = pdf ? 'pdf' : (item.name.split('.').pop() || '').toLowerCase();
      const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', pdf: 'application/pdf' };
      if (!types[extension]) throw new Error(`지원하지 않는 파일입니다: ${item.name}`);
      if (item.blob.size > (pdf ? 200 : 25) * 1024 * 1024) throw new Error(`${item.name}: ${pdf ? 200 : 25}MB 이하 파일을 선택하세요.`);
      progress(`${item.name} 업로드 중…`);
      const result = await upload(`media/${crypto.randomUUID()}.${extension}`, item.blob, { access: 'public', contentType: types[extension], handleUploadUrl: `${base}/api/upload`, headers: { Authorization: `Bearer ${key}` }, multipart: item.blob.size > 5 * 1024 * 1024 });
      return { name: item.name, src: result.url };
    };
    const pages = [];
    for (const item of record.pages) pages.push(await uploadMedia(item));
    const pdf = record.pdf ? await uploadMedia(record.pdf, true) : null;
    progress('제안서 목록 저장 중…');
    const data = await request('library', { revision, record: { ...record, pages, pdf } }, true);
    revision = data.revision;
    return data.record;
  }
};
