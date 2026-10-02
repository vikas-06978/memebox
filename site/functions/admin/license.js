// POST /admin/license: the admin makes a key (for themself or a friend) or turns one off/on.
//   action=create  kind (owner|gift), unlimited (on), slots (number), note
//   action=revoke | restore  key
import { adminResponse, adminRedirect } from '../../src/http.js';
import { isAdmin } from '../../src/security.js';
import { createLicense, setLicenseStatus, cleanKey, LICENSE_RE } from '../../src/shop.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return adminResponse('Method not allowed', { status: 405, type: 'text/plain; charset=utf-8', headers: { Allow: 'POST' } });
  if (!env.ADMIN_KEY || !env.DB || !(await isAdmin(request, env))) return adminRedirect('/admin');
  const form = await request.formData();
  const action = form.get('action');

  if (action === 'create') {
    const key = await createLicense(env.DB, {
      kind: form.get('kind') === 'owner' ? 'owner' : 'gift',
      unlimited: form.get('unlimited') === 'on',
      pictureSlots: Number(form.get('slots')) || 0,
      note: String(form.get('note') || ''),
    });
    return adminRedirect(`/admin?created=${encodeURIComponent(key)}#licenses`);
  }
  const key = cleanKey(form.get('key'));
  if ((action === 'revoke' || action === 'restore') && LICENSE_RE.test(key)) {
    await setLicenseStatus(env.DB, key, action === 'revoke' ? 'revoked' : 'active');
  }
  return adminRedirect('/admin#licenses');
}
