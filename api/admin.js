import { cors, isAdmin } from '../lib/library.mjs';
export default function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return isAdmin(req.headers.authorization) ? res.status(200).json({ ok: true }) : res.status(401).json({ error: '관리자 키를 확인하세요.' });
}
