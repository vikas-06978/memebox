// GET /admin/packfile?id=ITEM: plays an uploaded audio file in the admin pages (signed-in admins only, drafts included).
import { adminResponse, adminRedirect } from '../../src/http.js';
import { isAdmin } from '../../src/security.js';
import { getItem } from '../../src/packs.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return adminResponse('Method not allowed', { status: 405, type: 'text/plain; charset=utf-8', headers: { Allow: 'GET' } });
  if (!env.ADMIN_KEY || !env.DB || !(await isAdmin(request, env))) return adminRedirect('/admin');
  const item = await getItem(env.DB, new URL(request.url).searchParams.get('id') || '');
  if (!item || !item.file_key || !env.PACKS) return adminResponse('Not found', { status: 404, type: 'text/plain; charset=utf-8' });
  const obj = await env.PACKS.get(item.file_key);
  if (!obj) return adminResponse('Not found', { status: 404, type: 'text/plain; charset=utf-8' });
  return new Response(obj.body, { headers: { 'Content-Type': item.mime || 'audio/mpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' } });
}
