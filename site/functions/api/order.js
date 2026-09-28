// /api/order: UPI orders from the /buy page.
//   POST { action: 'create', product, forKey? } -> { orderId, amount, upiUrl, upiId, payee }
//   POST { action: 'claim', orderId, utr }       -> the buyer paid, waiting for the admin
//   GET  ?id=MB...                               -> { status, product, amount, licenseKey (when approved) }
import { json, methodNotAllowed } from '../../src/http.js';
import { rateLimit, clientIp } from '../../src/security.js';
import {
  PRODUCTS, createOrder, claimOrder, getOrder, upiLink, cleanKey, getLicense, LICENSE_RE, ORDER_RE, UTR_RE, VPA_RE,
} from '../../src/shop.js';

const view = (o) => ({
  orderId: o.id,
  status: o.status,
  product: o.product,
  productName: PRODUCTS[o.product] ? PRODUCTS[o.product].name : o.product,
  amount: o.amount_inr,
  ...(o.status === 'approved' ? { licenseKey: o.license_key } : {}),
});

export async function onRequest({ request, env }) {
  if (!env.DB || !env.UPI_ID || !VPA_RE.test(env.UPI_ID)) return json({ ok: false, error: 'Payments are not set up yet.' }, 503);
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const id = String(url.searchParams.get('id') || '');
    if (!ORDER_RE.test(id)) return json({ ok: false, error: 'Order not found.' }, 404);
    const order = await getOrder(env.DB, id);
    if (!order) return json({ ok: false, error: 'Order not found.' }, 404);
    return json({ ok: true, order: view(order) });
  }
  if (request.method !== 'POST') return methodNotAllowed('GET, POST');

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Send JSON.' }, 400); }
  if (!body || typeof body !== 'object') return json({ ok: false, error: 'Send JSON.' }, 400);
  const ip = clientIp(request);
  const salt = env.RATE_SALT || env.ADMIN_KEY || '';

  if (body.action === 'create') {
    if (!Object.prototype.hasOwnProperty.call(PRODUCTS, body.product)) return json({ ok: false, error: 'Unknown product.' }, 400);
    let forKey = '';
    if (body.forKey) {
      forKey = cleanKey(body.forKey);
      if (!LICENSE_RE.test(forKey) || !(await getLicense(env.DB, forKey))) return json({ ok: false, error: 'That license key wasn\'t found. Leave it empty to get a new key.' }, 400);
    }
    const limit = await rateLimit(env.DB, { salt, ip, bucket: 'order', max: 10 });
    if (!limit.allowed) return json({ ok: false, error: 'Too many orders from here. Try again in an hour.' }, 429, { 'Retry-After': '3600' });
    const o = await createOrder(env.DB, { product: body.product, forKey });
    return json({
      ok: true, orderId: o.id, amount: o.amount, productName: o.product.name,
      upiId: env.UPI_ID, payee: env.UPI_NAME || 'MemeBox',
      upiUrl: upiLink({ upiId: env.UPI_ID, payee: env.UPI_NAME || 'MemeBox', amount: o.amount, orderId: o.id }),
    });
  }

  if (body.action === 'claim') {
    const id = String(body.orderId || '');
    const utr = String(body.utr || '').replace(/\s+/g, '');
    if (!ORDER_RE.test(id)) return json({ ok: false, error: 'Order not found.' }, 404);
    if (!UTR_RE.test(utr)) return json({ ok: false, error: 'The UPI transaction ID (UTR) has 12 digits. You find it in your UPI app under the payment.' }, 400);
    const limit = await rateLimit(env.DB, { salt, ip, bucket: 'claim', max: 10 });
    if (!limit.allowed) return json({ ok: false, error: 'Too many tries from here. Try again in an hour.' }, 429, { 'Retry-After': '3600' });
    const error = await claimOrder(env.DB, id, utr);
    if (error) return json({ ok: false, error }, error.includes('not found') ? 404 : 409);
    return json({ ok: true, order: view(await getOrder(env.DB, id)) });
  }

  return json({ ok: false, error: 'Unknown action.' }, 400);
}
