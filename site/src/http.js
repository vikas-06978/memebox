// MemeBox site: small response helpers shared by the Pages Functions.

const NOINDEX = { 'X-Robots-Tag': 'noindex, nofollow' };
const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY, ...extra },
  });
}

// Every admin response goes through here: never indexed, never cached, no scripts at all.
export function adminResponse(body, { status = 200, type = 'text/html; charset=utf-8', headers = {} } = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': type,
      ...SECURITY,
      ...NOINDEX,
      'Content-Security-Policy': "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      'X-Frame-Options': 'DENY',
      ...headers,
    },
  });
}

export function adminRedirect(location, headers = {}) {
  return adminResponse('', { status: 303, headers: { Location: location, ...headers } });
}

export const methodNotAllowed = (allow) => json({ ok: false, error: 'Method not allowed' }, 405, { Allow: allow });

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
