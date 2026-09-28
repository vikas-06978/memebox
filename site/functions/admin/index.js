// /admin: sign in with ADMIN_KEY (a Cloudflare secret), then the dashboard.
// The session is an HMAC-signed cookie that lasts 8 hours. Sign-in tries are rate limited.
import { loadStats, loginPage, dashboardPage } from '../../src/admin.js';
import { adminResponse, adminRedirect } from '../../src/http.js';
import { isAdmin, safeEqual, makeSession, sessionCookie, SESSION_MS, rateLimit, clientIp } from '../../src/security.js';

export async function onRequest({ request, env }) {
  if (!env.ADMIN_KEY || !env.DB) return adminResponse(loginPage('Admin is not set up yet (ADMIN_KEY or DB missing).'), { status: 503 });

  if (request.method === 'GET') {
    if (!(await isAdmin(request, env))) return adminResponse(loginPage());
    return adminResponse(dashboardPage(await loadStats(env.DB)));
  }

  if (request.method === 'POST') {
    const limit = await rateLimit(env.DB, { salt: env.RATE_SALT || env.ADMIN_KEY, ip: clientIp(request), bucket: 'admin-login', max: 10 });
    if (!limit.allowed) return adminResponse(loginPage('Too many tries. Wait an hour.'), { status: 429 });
    let key = '';
    try { key = String((await request.formData()).get('key') || ''); } catch { /* treat as empty */ }
    if (!key || !safeEqual(key, env.ADMIN_KEY)) return adminResponse(loginPage('Wrong key.'), { status: 401 });
    const cookie = sessionCookie(await makeSession(env.ADMIN_KEY), SESSION_MS / 1000);
    return adminRedirect('/admin', { 'Set-Cookie': cookie });
  }

  return adminResponse('Method not allowed', { status: 405, type: 'text/plain; charset=utf-8', headers: { Allow: 'GET, POST' } });
}
