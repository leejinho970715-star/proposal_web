import { createHash, timingSafeEqual } from 'node:crypto';

export function isAdmin(header, key = process.env.ADMIN_ACCESS_KEY) {
  key = key?.trim();
  if (!key || key.length < 32 || typeof header !== 'string') return false;
  const hash = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(header.trim()), hash(`Bearer ${key}`));
}
export function cors(req, res) {
  const allowed = ['https://proposalweb-plum.vercel.app', 'https://leejinho970715-star.github.io'];
  const origin = req.headers.origin;
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}
export function validId(id) { return typeof id === 'string' && /^(pms|pms-new|eumsquare|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.test(id); }
export function validateRecord(input, host) {
  const fail = () => { throw new Error('제안서 데이터 형식이 올바르지 않습니다.'); };
  const str = (value, max, empty = false) => {
    if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) fail();
    return value.trim();
  };
  const media = (item, pdf = false) => {
    if (!item || typeof item.src !== 'string') fail();
    const staticPath = pdf ? /^assets\/(pms-proposal\.pdf|pms-new\/proposal\.pdf|eumsquare(?:-new)?\/company-profile\.pdf)$/ : /^assets\/(page-(?:[1-9]|1\d|2[0-5])\.png|pms-new\/page-(?:[1-9]|1\d|2[0-6])\.png|eumsquare(?:-new)?\/page-(?:[1-9]|1[0-7])\.png)$/;
    if (!staticPath.test(item.src)) {
      let url; try { url = new URL(item.src); } catch { fail(); }
      if (!host || url.protocol !== 'https:' || url.hostname !== host || url.username || url.password || url.search || url.hash || !/^\/media\/[a-f0-9-]+\.(png|jpg|jpeg|webp|gif|avif|pdf)$/.test(url.pathname)) fail();
      if (pdf !== url.pathname.endsWith('.pdf')) fail();
    }
    return { name: str(item.name, 250), src: item.src };
  };
  if (!input || !validId(input.id)) fail();
  if (!Array.isArray(input.pages) || !input.pages.length || input.pages.length > 300) fail();
  return { id: input.id, builtIn: ['pms','pms-new','eumsquare'].includes(input.id), name: str(input.name, 100), subtitle: str(input.subtitle ?? '', 160, true), pages: input.pages.map(item => media(item)), pdf: input.pdf ? media(input.pdf, true) : null };
}
