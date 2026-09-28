// GET /admin/csv: every answer as a CSV file (signed-in admins only).
import { toCsv } from '../../src/admin.js';
import { adminResponse, adminRedirect } from '../../src/http.js';
import { isAdmin } from '../../src/security.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return adminResponse('Method not allowed', { status: 405, type: 'text/plain; charset=utf-8', headers: { Allow: 'GET' } });
  if (!env.ADMIN_KEY || !env.DB || !(await isAdmin(request, env))) return adminRedirect('/admin');
  const { results } = await env.DB.prepare('SELECT * FROM feedback ORDER BY created_at DESC').all();
  const day = new Date().toISOString().slice(0, 10);
  return adminResponse(toCsv(results), {
    type: 'text/csv; charset=utf-8',
    headers: { 'Content-Disposition': `attachment; filename="memebox-feedback-${day}.csv"` },
  });
}
