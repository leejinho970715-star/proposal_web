import { get, put } from '@vercel/blob';
import { cors, isAdmin, validId, validateRecord } from '../lib/library.mjs';

const path = 'library/catalog.json';
export function createHandler({ getBlob = get, putBlob = put } = {}) { return async function handler(req, res) {
  if (cors(req, res)) return;
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (req.method === 'POST' && !isAdmin(req.headers.authorization)) return res.status(401).json({ error: '관리자 인증이 필요합니다.' });
  try {
    let result = await getBlob(path, { access: 'public', useCache: false });
    if (!result) {
      // Initialize once, without overwriting a catalog another request just created.
      try { await putBlob(path, '[]', { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: false, cacheControlMaxAge: 60 }); }
      catch (error) { if (!/Precondition|already exists/i.test(`${error.name} ${error.message}`)) throw error; }
      result = await getBlob(path, { access: 'public', useCache: false });
      if (!result) throw new Error('Catalog initialization failed');
    }
    const records = result ? await new Response(result.stream).json() : [];
    const revision = result?.blob.etag ?? null;
    if (req.method === 'GET') return res.status(200).json({ records, revision });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (body?.revision !== revision) return res.status(409).json({ error: '다른 곳에서 목록이 변경되었습니다. 새로고침한 뒤 다시 저장하세요.' });
    let record;
    if (body.action === 'delete') {
      if (!validId(body.id)) return res.status(400).json({ error: '올바르지 않은 제안서입니다.' });
      record = { id: body.id, deleted: true };
    } else {
      try { record = validateRecord(body.record, new URL(result.blob.url).hostname); } catch (error) { return res.status(400).json({ error: error.message }); }
    }
    const index = records.findIndex(item => item.id === record.id);
    if (index < 0) records.push(record); else records[index] = record;
    const saved = await putBlob(path, JSON.stringify(records), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: !!result, ...(revision ? { ifMatch: revision } : {}), cacheControlMaxAge: 60 });
    return res.status(200).json({ record, revision: saved.etag });
  } catch (error) {
    if (/Precondition|already exists/i.test(`${error.name} ${error.message}`)) return res.status(409).json({ error: '다른 곳에서 목록이 변경되었습니다. 새로고침한 뒤 다시 저장하세요.' });
    console.error('Library operation failed:', error.name);
    return res.status(503).json({ error: '공용 저장소에 연결하지 못했습니다. 잠시 후 다시 시도하세요.' });
  }
}

}
export default createHandler();
