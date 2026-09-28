// POST /api/license { key }: the extension checks a license key.
// Answers { ok, license: { key, status, unlimited, pictureSlots } }. Open to any origin (CORS),
// because the extension calls it from its own pages. The extension sends the JSON as text/plain
// (a "simple" request, so no preflight is needed). Rate limited per IP (hashed).
import { json, methodNotAllowed } from '../../src/http.js';
import { rateLimit, clientIp } from '../../src/security.js';
import { cleanKey, getLicense, licenseView, LICENSE_RE } from '../../src/shop.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return methodNotAllowed('POST, OPTIONS');
  if (!env.DB) return json({ ok: false, error: 'Licenses are not set up yet.' }, 503, CORS);

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Send JSON.' }, 400, CORS); }
  const key = cleanKey(body && body.key);
  if (!LICENSE_RE.test(key)) return json({ ok: false, error: 'That doesn\'t look like a MemeBox key (MBX-XXXX-XXXX-XXXX).' }, 400, CORS);

  const limit = await rateLimit(env.DB, { salt: env.RATE_SALT || env.ADMIN_KEY || '', ip: clientIp(request), bucket: 'license', max: 60 });
  if (!limit.allowed) return json({ ok: false, error: 'Too many checks. Try again in an hour.' }, 429, { ...CORS, 'Retry-After': '3600' });

  const row = await getLicense(env.DB, key);
  if (!row) return json({ ok: false, error: 'Unknown key.' }, 404, CORS);
  await env.DB.prepare('UPDATE licenses SET last_seen = ? WHERE key = ?').bind(new Date().toISOString().slice(0, 10), key).run();
  return json({ ok: true, license: licenseView(row) }, 200, CORS);
}
