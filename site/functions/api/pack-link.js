// GET /api/pack-link?item=ID: the YouTube video id of one live Phonk Mode track. Free tracks are open; Pro and Pro Max tracks need a license key with
// the right plan (X-MemeBox-Key). Nothing is hosted: the app plays the official YouTube embed. PHONK_MODE=off in Cloudflare switches it all off.
import { json, methodNotAllowed } from '../../src/http.js';
import { rateLimit, clientIp } from '../../src/security.js';
import { getItem, getPack, VIDEO_ID_RE, canPublish } from '../../src/packs.js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'X-MemeBox-Key', 'Access-Control-Max-Age': '86400' };
const DAILY_LINKS = 300;

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'GET') return methodNotAllowed('GET, OPTIONS');
  if (!env.DB) return json({ ok: false, error: 'Not set up yet.' }, 503, CORS);
  if (env.PHONK_MODE === 'off') return json({ ok: false, error: 'Phonk Mode is switched off for now.' }, 503, CORS);

  const url = new URL(request.url);
  const item = await getItem(env.DB, url.searchParams.get('item') || '');
  const pack = item && await getPack(env.DB, item.pack_id);
  if (!item || !pack || item.kind !== 'link' || item.status !== 'live' || pack.status !== 'live' || !canPublish(item) || !VIDEO_ID_RE.test(item.text)) return json({ ok: false, error: 'Not found.' }, 404, CORS);

  // Third-party YouTube embeds are always free. Paid tiers apply to MemeBox originals.
  const who = 'ip:' + clientIp(request);
  const day = await rateLimit(env.DB, { salt: env.RATE_SALT || env.ADMIN_KEY || '', ip: who, bucket: 'pack-link-day', max: DAILY_LINKS, windowHours: 24 });
  if (!day.allowed) return json({ ok: false, error: 'Daily limit reached. Try again tomorrow.' }, 429, CORS);
  await env.DB.prepare('UPDATE pack_items SET downloads = downloads + 1 WHERE id = ?').bind(item.id).run();
  return json({ ok: true, id: item.text, title: item.title, artist: item.credit }, 200, { ...CORS, 'Cache-Control': 'private, max-age=300' });
}
