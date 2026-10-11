// GET /api/pack-file?item=ID: the audio file of one live item. Free packs are open; Pro and Pro Max packs need a license key
// with Pro or Pro Max time (sent in the X-MemeBox-Key header, or ?key=). Counts the download (a number only, nothing about who).
import { json, methodNotAllowed } from '../../src/http.js';
import { rateLimit, clientIp } from '../../src/security.js';
import { getItem, getPack, tierAllows, cleanKey, getLicense, LICENSE_RE, itemTier } from '../../src/packs.js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'X-MemeBox-Key', 'Access-Control-Max-Age': '86400' };

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'GET') return methodNotAllowed('GET, OPTIONS');
  if (!env.DB || !env.PACKS) return json({ ok: false, error: 'Packs are not set up yet.' }, 503, CORS);

  const limit = await rateLimit(env.DB, { salt: env.RATE_SALT || env.ADMIN_KEY || '', ip: clientIp(request), bucket: 'pack-file', max: 400 });
  if (!limit.allowed) return json({ ok: false, error: 'Too many downloads. Try again in an hour.' }, 429, { ...CORS, 'Retry-After': '3600' });

  const url = new URL(request.url);
  const item = await getItem(env.DB, url.searchParams.get('item') || '');
  const pack = item && await getPack(env.DB, item.pack_id);
  if (!item || !pack || item.status !== 'live' || pack.status !== 'live' || !item.file_key) return json({ ok: false, error: 'Not found.' }, 404, CORS);

  const tier = itemTier(item, pack); // this item's own plan, else the pack's
  if (tier !== 'free') {
    const key = cleanKey(request.headers.get('X-MemeBox-Key') || url.searchParams.get('key') || '');
    const license = LICENSE_RE.test(key) ? await getLicense(env.DB, key) : null;
    if (!tierAllows(tier, license)) return json({ ok: false, error: tier === 'max' ? 'This pack needs Pro Max.' : 'This pack needs Pro.' }, 403, CORS);
  }
  const obj = await env.PACKS.get(item.file_key);
  if (!obj) return json({ ok: false, error: 'Not found.' }, 404, CORS);
  await env.DB.prepare('UPDATE pack_items SET downloads = downloads + 1 WHERE id = ?').bind(item.id).run();
  return new Response(obj.body, {
    headers: { ...CORS, 'Content-Type': item.mime || (item.kind === 'image' ? 'image/png' : 'audio/mpeg'), 'Content-Length': String(obj.size), 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' },
  });
}
