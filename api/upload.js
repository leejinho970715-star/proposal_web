import { handleUpload } from '@vercel/blob/client';
import { cors, isAdmin } from '../lib/library.mjs';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  // Upload completion callbacks are deliberately unused; only authenticated token requests are accepted.
  if (!isAdmin(req.headers.authorization)) return res.status(401).json({ error: '관리자 인증이 필요합니다.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (body?.type !== 'blob.generate-client-token') return res.status(400).json({ error: 'Invalid upload request' });
    const result = await handleUpload({ request: req, body, onBeforeGenerateToken: async pathname => {
      if (!/^media\/[a-f0-9-]{36}\.(png|jpg|jpeg|webp|gif|avif|pdf)$/.test(pathname)) throw new Error('Invalid pathname');
      return { allowedContentTypes: pathname.endsWith('.pdf') ? ['application/pdf'] : ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'], maximumSizeInBytes: pathname.endsWith('.pdf') ? 200 * 1024 * 1024 : 25 * 1024 * 1024, addRandomSuffix: false, allowOverwrite: false, validUntil: Date.now() + 15 * 60 * 1000 };
    } });
    return res.status(200).json(result);
  } catch { return res.status(400).json({ error: '파일 업로드를 시작하지 못했습니다.' }); }
}
