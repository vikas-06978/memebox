// POST /admin/order (id, action = approve | reject): the admin decides a UPI order
// after checking the bank app. Approving creates or tops up the buyer's license key.
import { adminResponse, adminRedirect } from '../../src/http.js';
import { isAdmin } from '../../src/security.js';
import { approveOrder, rejectOrder } from '../../src/shop.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return adminResponse('Method not allowed', { status: 405, type: 'text/plain; charset=utf-8', headers: { Allow: 'POST' } });
  if (!env.ADMIN_KEY || !env.DB || !(await isAdmin(request, env))) return adminRedirect('/admin');
  const form = await request.formData();
  const id = String(form.get('id') || '');
  const action = form.get('action');
  if (action === 'approve') {
    const key = await approveOrder(env.DB, id);
    return adminRedirect(key ? `/admin?approved=${encodeURIComponent(id)}#shop` : '/admin#shop');
  }
  if (action === 'reject') await rejectOrder(env.DB, id);
  return adminRedirect('/admin#shop');
}
