import { createHash } from 'node:crypto';

export const host = 'test.public.blob.vercel-storage.com';
export const digest = content => createHash('md5').update(content).digest('hex');
const precondition = () => Object.assign(new Error('Precondition failed'), {name:'BlobPreconditionFailedError'});
export function memoryStore({ cacheCatalog = false } = {}) {
  const files = new Map();
  let cachedCatalog;
  const pathname = value => value.startsWith('https:') ? new URL(value).pathname.slice(1) : value;
  return {
    files,
    async headBlob(path) {
      const content = files.get(path);
      if (content === undefined) throw Object.assign(new Error('Not found'), {name:'BlobNotFoundError'});
      return {url:`https://${host}/${path}`,etag:`"${digest(content)}"`};
    },
    async getBlob(value) {
      const path = pathname(value);
      const content = cacheCatalog && path === 'library/catalog.json' && cachedCatalog !== undefined ? cachedCatalog : files.get(path);
      return content === undefined ? null : {blob:{url:`https://${host}/${path}`,etag:`W/"${digest(content)}"`},stream:new Response(content).body};
    },
    async putBlob(path, content, options) {
      const current = files.get(path);
      if (current !== undefined && (!options.allowOverwrite || options.ifMatch !== `"${digest(current)}"`)) throw precondition();
      if (path === 'library/catalog.json' && cachedCatalog === undefined) cachedCatalog = content;
      files.set(path,content);
      return {etag:`"${digest(content)}"`};
    }
  };
}
