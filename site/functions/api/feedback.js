// POST /api/feedback: the feedback form and the uninstall survey.
// Order: size and JSON checks, strict validation, rate limit (5 per IP per hour, IP only
// hashed), honeypot, Turnstile, then one INSERT with only the validated fields.
import { validateSubmission } from '../../src/validate.js';
import { rateLimit, clientIp, verifyTurnstile } from '../../src/security.js';
import { json, methodNotAllowed } from '../../src/http.js';

const MAX_BODY = 16 * 1024;

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return methodNotAllowed('POST');
  if (!env.DB || !env.TURNSTILE_SECRET_KEY) return json({ ok: false, error: 'Feedback is not set up yet.' }, 503);
  if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) {
    return json({ ok: false, error: 'Send JSON.' }, 415);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ ok: false, error: 'Too long.' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ ok: false, error: 'Not valid JSON.' }, 400); }

  const res = validateSubmission(body);
  if (!res.ok) return json({ ok: false, errors: res.errors }, 400);

  const limit = await rateLimit(env.DB, { salt: env.RATE_SALT || env.ADMIN_KEY || '', ip: clientIp(request) });
  if (!limit.allowed) {
    return json({ ok: false, error: 'Too many messages from here. Please try again in an hour.' }, 429, { 'Retry-After': '3600' });
  }

  if (res.spam) return json({ ok: true }); // honeypot filled: look like a success, store nothing

  if (!(await verifyTurnstile(env.TURNSTILE_SECRET_KEY, res.token))) {
    return json({ ok: false, error: 'The spam check failed. Reload the page and try again.' }, 403);
  }

  const v = res.value;
  await env.DB.prepare(
    'INSERT INTO feedback (id, created_at, type, rating, used, wants, message, email, reason, version, site, lang) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(
    crypto.randomUUID(), new Date().toISOString(), v.type, v.rating, JSON.stringify(v.used),
    v.wants, v.message, v.email, v.reason, v.version, v.site, v.lang,
  ).run();
  return json({ ok: true });
}
