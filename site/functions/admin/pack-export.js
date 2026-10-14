// Download a pack's metadata as CSV so the owner can share exactly what was prepared locally.
import { adminResponse, adminRedirect } from '../../src/http.js';
import { isAdmin } from '../../src/security.js';
import { getPack, listItems, itemTier } from '../../src/packs.js';

const cell = (value) => `"${String(value ?? '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;

export async function onRequest({ request, env }) {
  if (!env.ADMIN_KEY || !env.DB || !(await isAdmin(request, env))) return adminRedirect('/admin');
  if (request.method !== 'GET') return adminResponse('Method not allowed', { status: 405, type: 'text/plain; charset=utf-8', headers: { Allow: 'GET' } });
  const id = new URL(request.url).searchParams.get('id') || '';
  const pack = await getPack(env.DB, id);
  if (!pack) return adminResponse('Pack not found.', { status: 404, type: 'text/plain; charset=utf-8' });
  const headers = ['pack_id', 'pack_title', 'pack_status', 'item_id', 'title', 'kind', 'language', 'tags', 'strong_18_plus', 'plan', 'item_status', 'credit', 'source', 'licence', 'bytes'];
  const rows = (await listItems(env.DB, id)).map((item) => [
    pack.id, pack.title, pack.status, item.id, item.title, item.kind, item.lang, item.tags,
    Number(item.explicit) === 1 ? 'yes' : 'no', itemTier(item, pack), item.status, item.credit, item.source, item.licence, Number(item.bytes) || 0,
  ]);
  const csv = '\uFEFF' + [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
  return adminResponse(csv, {
    type: 'text/csv; charset=utf-8',
    headers: { 'Content-Disposition': `attachment; filename="${pack.id}-inventory.csv"` },
  });
}
