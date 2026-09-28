// GET /api/config: public settings the static forms need (the Turnstile site key is public).
import { json, methodNotAllowed } from '../../src/http.js';

export function onRequest({ request, env }) {
  if (request.method !== 'GET') return methodNotAllowed('GET');
  return json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY || '' }, 200, { 'Cache-Control': 'public, max-age=300' });
}
