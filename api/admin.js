import { cors, isAdmin } from '../lib/library.mjs';
export default function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.ADMIN_ACCESS_KEY?.trim();
  if (!key) return res.status(503).json({ error: '서버에 관리자 키가 설정되지 않았습니다. Vercel의 Production 환경에 ADMIN_ACCESS_KEY를 저장한 뒤 재배포하세요.' });
  if (key.length < 32) return res.status(503).json({ error: 'Vercel에 저장된 관리자 키가 32자보다 짧아 로그인이 차단되었습니다. ADMIN_ACCESS_KEY를 32자 이상으로 변경한 뒤 재배포하세요.' });
  return isAdmin(req.headers.authorization) ? res.status(200).json({ ok: true }) : res.status(401).json({ error: '관리자 키를 확인하세요.' });
}
