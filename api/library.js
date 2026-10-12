import { get, head, put } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { cors, isAdmin, validId, validateRecord, normalizeEtag, recordVersion, recordVersions } from '../lib/library.mjs';

const path = 'library/catalog.json';
const preconditionFailed = error => /Precondition|already exists/i.test(`${error.name} ${error.message}`);
export function createHandler({ getBlob = get, headBlob = head, putBlob = put } = {}) {
  async function writeVersion(content) {
    const etag = createHash('md5').update(content).digest('hex');
    try {
      await putBlob(`library/catalog-versions/${etag}.json`, content, { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: false });
    } catch (error) { if (!preconditionFailed(error)) throw error; }
    return etag;
  }
  async function readCatalog() {
    for (let attempt = 0; attempt < 4; attempt++) {
      // Public GET responses can have weak CDN ETags. Writes need the origin
      // ETag returned by the metadata API, not that HTTP response header.
      let metadata;
      try { metadata = await headBlob(path); }
      catch (error) {
        if (error.name !== 'BlobNotFoundError') throw error;
        await writeVersion('[]');
        try { await putBlob(path, '[]', { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: false, cacheControlMaxAge: 60 }); }
        catch (error) { if (!preconditionFailed(error)) throw error; }
        continue;
      }
      const revision = normalizeEtag(metadata.etag);
      const versionUrl = new URL(`/library/catalog-versions/${revision}.json`, metadata.url);
      let result = await getBlob(versionUrl.toString(), { access: 'public', useCache: false });
      if (result) {
        const content = await new Response(result.stream).text();
        if (createHash('md5').update(content).digest('hex') !== revision) throw new Error('Catalog version content did not match');
        return { result, records: JSON.parse(content), etag: metadata.etag };
      }
      // Migrate catalogs created before immutable snapshots were introduced.
      const url = new URL(metadata.url);
      url.searchParams.set('version', revision);
      result = await getBlob(url.toString(), { access: 'public', useCache: false });
      if (!result) continue;
      const content = await new Response(result.stream).text();
      // Do not apply a current write precondition to older cached contents.
      if (normalizeEtag(result.blob.etag) === revision && createHash('md5').update(content).digest('hex') === revision) {
        await writeVersion(content);
        return { result, records: JSON.parse(content), etag: metadata.etag };
      }
    }
    throw new Error('Catalog content and origin version did not match');
  }
  return async function handler(req, res) {
    if (cors(req, res)) return;
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
    if (req.method === 'POST' && !isAdmin(req.headers.authorization)) return res.status(401).json({ error: '관리자 인증이 필요합니다.' });
    try {
      let catalog = await readCatalog();
      if (req.method === 'GET') return res.status(200).json({ records: catalog.records, revision: normalizeEtag(catalog.etag), versions: recordVersions(catalog.records) });
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
        const stale = usesRecordVersion ? body.baseVersion !== recordVersion(current) : normalizeEtag(body.revision) !== normalizeEtag(catalog.etag);
        if (stale) return res.status(409).json({ code: 'PROPOSAL_CONFLICT', error: '이 제안서가 다른 곳에서 수정되거나 삭제되었습니다. 입력한 내용은 유지됩니다. 확인 후 현재 내용으로 다시 저장할 수 있습니다.' });
        const records = [...catalog.records];
        const index = records.findIndex(item => item.id === record.id);
        if (index < 0) records.push(record); else records[index] = record;
        try {
          // Keep catalog-level atomic writes, but rebase unrelated proposal changes automatically.
          const content = JSON.stringify(records);
          await writeVersion(content);
          const saved = await putBlob(path, content, { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, ifMatch: catalog.etag, cacheControlMaxAge: 60 });
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
