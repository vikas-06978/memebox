// Razorpay integration. Secrets never enter public configuration or browser code.
//
// RAZORPAY_MODE picks the mode and nothing else does: 'test' for the sandbox, 'live' for real
// money. The key id must carry the matching prefix, so a live key can never be charged while the
// rest of the configuration still says test, and a test key can never be presented as live.
// Set up both modes with their own webhook secret, and never point a test deployment at the
// database that holds real licenses (see docs/payment-testing.md and docs/RAZORPAY-LIVE.md).
import { PRODUCTS, newOrderId, newLicenseKey, cleanKey, getLicense } from './shop.js';
import { sha256Hex, hmacHex, safeEqual } from './security.js';

// 'test', 'live', or '' when the mode is missing or not one we know.
export function gatewayMode(env) {
  const mode = String((env && env.RAZORPAY_MODE) || '');
  return mode === 'test' || mode === 'live' ? mode : '';
}

export function gatewayEnabled(env) {
  const mode = gatewayMode(env);
  if (!mode) return false;
  const keyId = (env && env.RAZORPAY_KEY_ID) || '';
  // The prefix has to agree with the mode: half-finished configuration must not charge anyone.
  if (!new RegExp(`^rzp_${mode}_[A-Za-z0-9]+$`).test(keyId)) return false;
  return !!env.RAZORPAY_KEY_SECRET && !!env.RAZORPAY_WEBHOOK_SECRET;
}

// Dollars need international payments switched on at Razorpay, and that is granted per mode:
// passing the test sandbox says nothing about the live account, so each has its own flag.
export function gatewayCurrencies(env) {
  const on = gatewayMode(env) === 'live' ? env.RAZORPAY_INTERNATIONAL === 'on' : env.RAZORPAY_TEST_INTERNATIONAL === 'on';
  return on ? ['INR', 'USD'] : ['INR'];
}
const token = () => [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
const entityId = (s, prefix) => typeof s === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(s);
export class GatewayError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export async function razorpay(env, path, body) {
  if (!gatewayEnabled(env)) throw new GatewayError('Checkout is not configured.', 503);
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new GatewayError('Payment provider is unavailable. Please try later.', 502);
  return response.json();
}

export async function createGatewayOrder(env, body) {
  if (!gatewayEnabled(env)) throw new GatewayError('Checkout is not configured.', 503);
  const p = Object.hasOwn(PRODUCTS, body.product) ? PRODUCTS[body.product] : null;
  if (!p || p.closed) throw new GatewayError('Unknown product.');
  const currency = body.currency || 'INR';
  if (!gatewayCurrencies(env).includes(currency)) throw new GatewayError('This currency is not enabled.');
  const forKey = body.forKey ? cleanKey(body.forKey) : '';
  if (forKey && (await getLicense(env.DB, forKey))?.status !== 'active') throw new GatewayError('Use an active license key, or leave it empty.');
  const amount = Math.round((currency === 'USD' ? p.usd : p.inr) * 100);
  const id = newOrderId(), recoveryToken = token(), licenseKey = forKey || newLicenseKey();
  // Persist the entitlement snapshot BEFORE the remote operation. Never grant from client prices.
  await env.DB.prepare('INSERT INTO gateway_orders (id, created_at, product, currency, amount, snapshot, recovery_hash, for_key, license_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, new Date().toISOString(), body.product, currency, amount, JSON.stringify(p), await sha256Hex(recoveryToken), forKey, licenseKey).run();
  const remote = await razorpay(env, 'orders', { amount, currency, receipt: id, notes: { site: 'memebox', order: id } });
  if (!entityId(remote.id, 'order') || remote.amount !== amount || remote.currency !== currency) throw new GatewayError('Unexpected payment provider response.', 502);
  await env.DB.prepare('UPDATE gateway_orders SET gateway_id = ? WHERE id = ?').bind(remote.id, id).run();
  const mode = gatewayMode(env);
  return { orderId: id, recoveryToken, gatewayOrderId: remote.id, keyId: env.RAZORPAY_KEY_ID, amount, currency, product: body.product, mode, testMode: mode === 'test' };
}

export async function recoveredOrder(env, id, recoveryToken) {
  if (typeof id !== 'string' || !/^MB[A-HJ-NP-Z2-9]{10}$/.test(id) || typeof recoveryToken !== 'string' || !/^[a-f0-9]{64}$/.test(recoveryToken)) throw new GatewayError('Order not found.', 404);
  const row = await env.DB.prepare('SELECT * FROM gateway_orders WHERE id = ?').bind(id).first();
  if (!row || !safeEqual(row.recovery_hash, await sha256Hex(recoveryToken))) throw new GatewayError('Order not found.', 404);
  return row;
}
export const gatewayView = row => ({ orderId: row.id, product: row.product, amount: row.amount, currency: row.currency, status: row.status,
  ...(row.status === 'fulfilled' ? { licenseKey: row.license_key } : {}) });

export async function fulfillCaptured(env, payment) {
  if (!entityId(payment?.id, 'pay') || !entityId(payment.order_id, 'order') || payment.status !== 'captured' || payment.captured !== true) throw new GatewayError('Payment is not captured.', 409);
  const row = await env.DB.prepare('SELECT * FROM gateway_orders WHERE gateway_id = ?').bind(payment.order_id).first();
  if (!row) throw new GatewayError('Order not found.', 404);
  if (payment.amount !== row.amount || payment.currency !== row.currency) throw new GatewayError('Payment amount or currency does not match.', 409);
  if (row.status !== 'pending') {
    if (row.payment_id !== payment.id) throw new GatewayError('Order already paid with a different payment.', 409);
    return row;
  }
  const p = JSON.parse(row.snapshot), claim = token(), at = new Date().toISOString();
  const guard = 'EXISTS (SELECT 1 FROM gateway_orders WHERE id = ? AND claim = ? AND status = \'pending\')';
  const steps = [env.DB.prepare("UPDATE gateway_orders SET claim = ?, payment_id = ? WHERE id = ? AND status = 'pending' AND claim = ''").bind(claim, payment.id, row.id)];
  if (!row.for_key) {
    steps.push(env.DB.prepare(`INSERT INTO licenses (key, created_at, kind, unlimited, picture_slots, pro_seconds, max_seconds, status, note, addons)
      SELECT ?, ?, 'paid', ?, ?, ?, ?, 'active', ?, ? WHERE ${guard}`)
      .bind(row.license_key, at, p.unlimited ? 1 : 0, p.pictureSlots, p.proSeconds, p.maxSeconds, `gateway ${row.id}`, JSON.stringify(p.addons), row.id, claim));
  } else {
    // JSON union happens within the transaction, so concurrent character purchases cannot overwrite one another.
    steps.push(env.DB.prepare(`UPDATE licenses SET pro_seconds = MIN(864000, pro_seconds + ?), max_seconds = MIN(864000, max_seconds + ?),
      picture_slots = MIN(10000, picture_slots + ?), unlimited = MAX(unlimited, ?),
      addons = (SELECT json_group_array(value) FROM (SELECT value FROM json_each(licenses.addons) UNION SELECT value FROM json_each(?)))
      WHERE key = ? AND status = 'active' AND ${guard}`)
      .bind(p.proSeconds, p.maxSeconds, p.pictureSlots, p.unlimited ? 1 : 0, JSON.stringify(p.addons), row.license_key, row.id, claim));
  }
  // A revoked top-up is flagged for review instead of silently reactivating the key.
  steps.push(env.DB.prepare(`UPDATE gateway_orders SET status = CASE WHEN EXISTS (SELECT 1 FROM licenses WHERE key = license_key AND status = 'active') THEN 'fulfilled' ELSE 'review' END,
    fulfilled_at = ? WHERE id = ? AND claim = ?`).bind(at, row.id, claim));
  await env.DB.batch(steps);
  return env.DB.prepare('SELECT * FROM gateway_orders WHERE id = ?').bind(row.id).first();
}

export async function confirmGatewayPayment(env, body) {
  const row = await recoveredOrder(env, body.orderId, body.recoveryToken);
  if (!entityId(body.paymentId, 'pay') || !/^[a-f0-9]{64}$/.test(body.signature || '')) throw new GatewayError('Invalid payment confirmation.');
  const expected = await hmacHex(env.RAZORPAY_KEY_SECRET, `${row.gateway_id}|${body.paymentId}`);
  if (!safeEqual(expected, body.signature)) throw new GatewayError('Invalid payment signature.', 403);
  // A checkout callback alone is insufficient. Fetch the authoritative captured payment.
  const payment = await razorpay(env, `payments/${body.paymentId}`);
  if (payment.order_id !== row.gateway_id) throw new GatewayError('Payment does not belong to this order.', 409);
  if (payment.status !== 'captured') return gatewayView(row);
  return gatewayView(await fulfillCaptured(env, payment));
}

export async function recordRefund(env, refund) {
  if (!entityId(refund?.id, 'rfnd') || !entityId(refund.payment_id, 'pay') || refund.status !== 'processed' || !Number.isSafeInteger(refund.amount) || refund.amount <= 0) throw new GatewayError('Invalid processed refund.');
  const row = await env.DB.prepare('SELECT * FROM gateway_orders WHERE payment_id = ?').bind(refund.payment_id).first();
  if (!row) throw new GatewayError('Order not found.', 404);
  if (refund.amount > row.amount) throw new GatewayError('Refund exceeds payment.', 409);
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO gateway_refunds (id, order_id, amount, created_at) VALUES (?, ?, ?, ?)').bind(refund.id, row.id, refund.amount, new Date().toISOString()),
    env.DB.prepare("UPDATE gateway_orders SET refunded_amount = (SELECT SUM(amount) FROM gateway_refunds WHERE order_id = ?), status = 'review' WHERE id = ?").bind(row.id, row.id),
    // Shared/top-up licenses need manual entitlement reconciliation; never erase unrelated purchases.
    env.DB.prepare(`UPDATE licenses SET status = 'revoked' WHERE key = ? AND ? = ''
      AND EXISTS (SELECT 1 FROM gateway_orders WHERE id = ? AND refunded_amount >= amount)
      AND NOT EXISTS (SELECT 1 FROM gateway_orders WHERE license_key = ? AND id <> ? AND payment_id IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM orders WHERE for_key = ? AND status = 'approved')`)
      .bind(row.license_key, row.for_key, row.id, row.license_key, row.id, row.license_key),
    env.DB.prepare("UPDATE gateway_orders SET status = 'refunded' WHERE id = ? AND for_key = '' AND refunded_amount >= amount AND EXISTS (SELECT 1 FROM licenses WHERE key = license_key AND status = 'revoked')").bind(row.id),
  ]);
}
