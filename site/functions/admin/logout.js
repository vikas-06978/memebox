// POST /admin/logout: clears the session cookie.
import { adminResponse, adminRedirect } from '../../src/http.js';
import { sessionCookie } from '../../src/security.js';

export function onRequest({ request }) {
  if (request.method !== 'POST') return adminResponse('Method not allowed', { status: 405, type: 'text/plain; charset=utf-8', headers: { Allow: 'POST' } });
  return adminRedirect('/admin', { 'Set-Cookie': sessionCookie('', 0) });
}
