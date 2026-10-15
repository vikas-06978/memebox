import { json, methodNotAllowed, readJsonLimited, RequestBodyError } from '../../src/http.js';
import { cleanKey, getLicense, LICENSE_RE } from '../../src/shop.js';
import { clientIp, hmacHex, rateLimit } from '../../src/security.js';

const FEATURES = new Set(['meme', 'music', 'phonk', 'video-meme', 'picture', 'character', 'filter', 'outfit', 'voice', 'lights']);
const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const INSTALL = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return methodNotAllowed('POST, OPTIONS');
  if (!env.DB || !env.RATE_SALT) return json({ ok: false, error: 'Not configured.' }, 503, CORS);
  try {
    const body = await readJsonLimited(request, 8192);
    if (!INSTALL.test(String(body.install || ''))) return json({ ok: false, error: 'Bad installation id.' }, 400, CORS);
    const events = Array.isArray(body.events) ? body.events.slice(0, 40) : [];
    const clean = events.map((event) => ({
      feature: String(event?.feature || ''), item: String(event?.item || ''),
      count: Math.max(1, Math.min(100, Math.floor(Number(event?.count)) || 1)),
    })).filter((event) => FEATURES.has(event.feature) && ID.test(event.item));
    if (!clean.length) return json({ ok: false, error: 'No valid events.' }, 400, CORS);
    const limit = await rateLimit(env.DB, { salt: env.RATE_SALT, ip: clientIp(request), bucket: 'usage', max: 120 });
    if (!limit.allowed) return json({ ok: false, error: 'Too many reports.' }, 429, CORS);
    const key = cleanKey(body.key);
    const license = LICENSE_RE.test(key) ? await getLicense(env.DB, key) : null;
    const activeKey = license?.status === 'active' ? key : '';
    const subject = await hmacHex(env.RATE_SALT, 'usage:' + String(body.install).toLowerCase());
    const day = new Date().toISOString().slice(0, 10);
    await env.DB.batch(clean.map((event) => env.DB.prepare(
      `INSERT INTO usage_daily(day, subject, license_key, feature, item, count) VALUES(?, ?, ?, ?, ?, ?)
       ON CONFLICT(day, subject, feature, item) DO UPDATE SET count = MIN(10000, count + excluded.count), license_key = excluded.license_key`,
    ).bind(day, subject, activeKey, event.feature, event.item, event.count)));
    // Retain enough history for annual planning without keeping it indefinitely.
    await env.DB.prepare('DELETE FROM usage_daily WHERE day < ?').bind(new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10)).run();
    return json({ ok: true }, 200, CORS);
  } catch (error) {
    if (error instanceof RequestBodyError) return json({ ok: false, error: error.message }, error.status, CORS);
    return json({ ok: false, error: 'Could not save usage.' }, 500, CORS);
  }
}
