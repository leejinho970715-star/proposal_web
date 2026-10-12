import { get, put } from '@vercel/blob';
import { cors, isAdmin, validId, validateRecord, normalizeEtag, recordVersion, recordVersions } from '../lib/library.mjs';

const path = 'library/catalog.json';
const preconditionFailed = error => /Precondition|already exists/i.test(`${error.name} ${error.message}`);
export function createHandler({ getBlob = get, putBlob = put } = {}) {
  async function readCatalog() {
    let result = await getBlob(path, { access: 'public', useCache: false });
    if (!result) {
      try { await putBlob(path, '[]', { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: false, cacheControlMaxAge: 60 }); }
      catch (error) { if (!preconditionFailed(error)) throw error; }
      result = await getBlob(path, { access: 'public', useCache: false });
      if (!result) throw new Error('Catalog initialization failed');
    }
    return { result, records: await new Response(result.stream).json() };
  }
  return async function handler(req, res) {
    if (cors(req, res)) return;
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
    if (req.method === 'POST' && !isAdmin(req.headers.authorization)) return res.status(401).json({ error: '관리자 인증이 필요합니다.' });
    try {
      let catalog = await readCatalog();
      if (req.method === 'GET') return res.status(200).json({ records: catalog.records, revision: normalizeEtag(catalog.result.blob.etag), versions: recordVersions(catalog.records) });
      let body; try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { return res.status(400).json({ error: 'Invalid request' }); }
      if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid request' });
      let record;
      if (body.action === 'delete') {
        if (!validId(body.id)) return res.status(400).json({ error: '올바르지 않은 제안서입니다.' });
        record = { id: body.id, deleted: true };
      } else {
        try { record = validateRecord(body.record, new URL(catalog.result.blob.url).hostname); }
        catch (error) { return res.status(400).json({ error: error.message }); }
      }
      const usesRecordVersion = Object.hasOwn(body, 'baseVersion');
      for (let attempt = 0; attempt < 4; attempt++) {
        const current = catalog.records.find(item => item.id === record.id);
        const stale = usesRecordVersion ? body.baseVersion !== recordVersion(current) : normalizeEtag(body.revision) !== normalizeEtag(catalog.result.blob.etag);
        if (stale) return res.status(409).json({ code: 'PROPOSAL_CONFLICT', error: '이 제안서가 다른 곳에서 수정되거나 삭제되었습니다. 입력한 내용은 유지됩니다. 확인 후 현재 내용으로 다시 저장할 수 있습니다.' });
        const records = [...catalog.records];
        const index = records.findIndex(item => item.id === record.id);
        if (index < 0) records.push(record); else records[index] = record;
        try {
          // Keep catalog-level atomic writes, but rebase unrelated proposal changes automatically.
          const saved = await putBlob(path, JSON.stringify(records), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, ifMatch: catalog.result.blob.etag, cacheControlMaxAge: 60 });
          return res.status(200).json({ record, revision: normalizeEtag(saved.etag), version: recordVersion(record) });
        } catch (error) {
          if (!preconditionFailed(error)) throw error;
          catalog = await readCatalog();
        }
      }
      return res.status(409).json({ code: 'LIBRARY_BUSY', error: '여러 저장 요청이 동시에 처리되고 있습니다. 입력한 내용은 유지되니 잠시 후 저장 버튼을 다시 눌러주세요.' });
    } catch (error) {
      console.error('Library operation failed:', error.name);
      return res.status(503).json({ error: '공용 저장소에 연결하지 못했습니다. 잠시 후 다시 시도하세요.' });
    }
  };
}
export default createHandler();
