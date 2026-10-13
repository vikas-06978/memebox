import { json, methodNotAllowed, readJsonLimited } from '../../src/http.js';
import { rateLimit, clientIp } from '../../src/security.js';
import { cleanKey, getLicense } from '../../src/shop.js';
import { signedPassesEnabled, openPassSession, billPassSession } from '../../src/pass-session.js';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return methodNotAllowed('POST, OPTIONS');
  if (!env.DB || !signedPassesEnabled(env)) return json({ ok: false, error: 'Signed usage is not configured.' }, 503, CORS);
  let body;
  try { body = await readJsonLimited(request); } catch (error) { return json({ ok: false, error: error.message }, error.status || 400, CORS); }
  const key = cleanKey(body?.key);
  const limit = await rateLimit(env.DB, { salt: env.RATE_SALT || env.ADMIN_KEY || '', ip: clientIp(request), bucket: 'pass-session', max: 120 });
  if (!limit.allowed) return json({ ok: false, error: 'Too many requests.' }, 429, CORS);
  const row = await getLicense(env.DB, key);
  if (!row || row.status !== 'active') return json({ ok: false, error: 'Active license required.' }, 403, CORS);
  if (body.action === 'open') {
    try { return json({ ok: true, session: await openPassSession(env, key, Date.now(), body.token || '') }, 200, CORS); }
    catch { return json({ ok: false, error: 'Invalid session renewal.' }, 409, CORS); }
  }
  if (body.action !== 'report') return json({ ok: false, error: 'Unknown action.' }, 400, CORS);
  try { return json({ ok: true, ...await billPassSession(env, key, body.token, body.total) }, 200, CORS); }
  catch { return json({ ok: false, error: 'Invalid or expired pass report.' }, 409, CORS); }
}
