import { test } from 'node:test';
import assert from 'node:assert/strict';
import { D1 } from '../../tools/d1-sqlite.mjs';
import { createLicense, getLicense } from '../../site/src/shop.js';
import { gatewayEnabled, gatewayMode, gatewayCurrencies, createGatewayOrder, recoveredOrder, fulfillCaptured, recordRefund, confirmGatewayPayment } from '../../site/src/gateway.js';
import { onRequest as webhook } from '../../site/functions/api/razorpay-webhook.js';
import { hmacHex } from '../../site/src/security.js';
import { onRequest as checkout } from '../../site/functions/api/checkout.js';

const environment = () => ({ DB: new D1(), RAZORPAY_MODE: 'test', RAZORPAY_KEY_ID: 'rzp_test_fixture', RAZORPAY_KEY_SECRET: 'fixture-only', RAZORPAY_WEBHOOK_SECRET: 'webhook-fixture' });
async function order(env, product = 'pass_pro_60', forKey = '') {
  const original = globalThis.fetch;
  let n = 0;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    return Response.json({ id: 'order_' + (++n) + crypto.randomUUID().replaceAll('-', ''), amount: body.amount, currency: body.currency });
  };
  try { return await createGatewayOrder(env, { product, forKey, amount: 1 }); } finally { globalThis.fetch = original; }
}
const payment = o => ({ id: 'pay_' + crypto.randomUUID().replaceAll('-', ''), order_id: o.gatewayOrderId, amount: o.amount, currency: o.currency, status: 'captured', captured: true });

test('the gateway is closed until a mode is set, and the key must match that mode', () => {
  const secrets = { RAZORPAY_KEY_SECRET: 'fixture-only', RAZORPAY_WEBHOOK_SECRET: 'webhook-fixture' };
  // Nothing configured, or a mode we don't know: closed.
  assert.equal(gatewayEnabled({}), false);
  assert.equal(gatewayMode({}), '');
  assert.equal(gatewayEnabled({ ...secrets, RAZORPAY_MODE: 'sandbox', RAZORPAY_KEY_ID: 'rzp_test_fixture' }), false);

  // Both modes work when the mode and the key prefix agree.
  assert.equal(gatewayEnabled(environment()), true);
  assert.equal(gatewayMode(environment()), 'test');
  const live = { ...secrets, RAZORPAY_MODE: 'live', RAZORPAY_KEY_ID: 'rzp_live_fixture' };
  assert.equal(gatewayEnabled(live), true);
  assert.equal(gatewayMode(live), 'live');

  // Half-finished configuration must never charge anyone: a live key under test settings, or
  // a test key presented as live, keeps the gateway shut.
  assert.equal(gatewayEnabled({ ...secrets, RAZORPAY_MODE: 'live', RAZORPAY_KEY_ID: 'rzp_test_fixture' }), false);
  assert.equal(gatewayEnabled({ ...secrets, RAZORPAY_MODE: 'test', RAZORPAY_KEY_ID: 'rzp_live_fixture' }), false);

  // A missing secret is also a closed gateway, in either mode.
  assert.equal(gatewayEnabled({ RAZORPAY_KEY_SECRET: 'x', RAZORPAY_MODE: 'live', RAZORPAY_KEY_ID: 'rzp_live_fixture' }), false);
  assert.equal(gatewayEnabled({ RAZORPAY_WEBHOOK_SECRET: 'x', RAZORPAY_MODE: 'live', RAZORPAY_KEY_ID: 'rzp_live_fixture' }), false);
});

test('dollars need international payments switched on for that same mode', () => {
  const secrets = { RAZORPAY_KEY_SECRET: 'fixture-only', RAZORPAY_WEBHOOK_SECRET: 'webhook-fixture' };
  const live = { ...secrets, RAZORPAY_MODE: 'live', RAZORPAY_KEY_ID: 'rzp_live_fixture' };
  assert.deepEqual(gatewayCurrencies(environment()), ['INR']);
  assert.deepEqual(gatewayCurrencies({ ...environment(), RAZORPAY_TEST_INTERNATIONAL: 'on' }), ['INR', 'USD']);
  assert.deepEqual(gatewayCurrencies(live), ['INR']);
  assert.deepEqual(gatewayCurrencies({ ...live, RAZORPAY_INTERNATIONAL: 'on' }), ['INR', 'USD']);
  // Passing the sandbox says nothing about the live account, so the test flag must not open USD live.
  assert.deepEqual(gatewayCurrencies({ ...live, RAZORPAY_TEST_INTERNATIONAL: 'on' }), ['INR']);
  // ...and the live flag must not open USD in the sandbox either.
  assert.deepEqual(gatewayCurrencies({ ...environment(), RAZORPAY_INTERNATIONAL: 'on' }), ['INR']);
});
test('server fixes prices and recovery requires the secret, which is stored only hashed', async () => {
  const env = environment(), o = await order(env);
  assert.equal(o.amount, 1500);
  const row = await recoveredOrder(env, o.orderId, o.recoveryToken);
  assert.notEqual(row.recovery_hash, o.recoveryToken);
  await assert.rejects(recoveredOrder(env, o.orderId, 'a'.repeat(64)), /not found/);
  await assert.rejects(createGatewayOrder(env, { product: 'char_bird' }), /Unknown/);
  await assert.rejects(createGatewayOrder(env, { product: 'pass_pro_60', currency: 'USD' }), /currency/);
});
test('concurrent capture retries create exactly one key and top up exactly once', async () => {
  const env = environment(), o = await order(env), p = payment(o);
  await Promise.all(Array.from({ length: 8 }, () => fulfillCaptured(env, p)));
  const row = await recoveredOrder(env, o.orderId, o.recoveryToken);
  assert.equal(row.status, 'fulfilled');
  assert.equal((await getLicense(env.DB, row.license_key)).pro_seconds, 3600);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM licenses').first()).n, 1);
  const topup = await order(env, 'pass_pro_60', row.license_key), q = payment(topup);
  await Promise.all(Array.from({ length: 8 }, () => fulfillCaptured(env, q)));
  assert.equal((await getLicense(env.DB, row.license_key)).pro_seconds, 7200);
  await assert.rejects(fulfillCaptured(env, { ...p, id: 'pay_different' }), /different payment/);
});
test('concurrent character top-ups preserve both entitlements', async () => {
  const env = environment(), key = await createLicense(env.DB);
  const a = await order(env, 'char_bunny', key), b = await order(env, 'char_panda', key);
  await Promise.all([fulfillCaptured(env, payment(a)), fulfillCaptured(env, payment(b))]);
  assert.deepEqual(JSON.parse((await getLicense(env.DB, key)).addons).sort(), ['character:bunny', 'character:panda']);
});
test('amount mismatch and authorization cannot fulfill; revoked top-up requires review', async () => {
  const env = environment(), key = await createLicense(env.DB), o = await order(env, 'pass_pro_60', key), p = payment(o);
  await assert.rejects(fulfillCaptured(env, { ...p, amount: 1 }), /does not match/);
  await assert.rejects(fulfillCaptured(env, { ...p, status: 'authorized', captured: false }), /not captured/);
  await env.DB.prepare("UPDATE licenses SET status = 'revoked' WHERE key = ?").bind(key).run();
  assert.equal((await fulfillCaptured(env, p)).status, 'review');
  assert.equal((await getLicense(env.DB, key)).pro_seconds, 0);
});
test('D1 batch rolls back earlier writes on failure', async () => {
  const db = new D1();
  await assert.rejects(db.batch([db.prepare("INSERT INTO rate_limits VALUES ('rollback', 1, 1)"), db.prepare('INSERT INTO nonexistent VALUES (1)')]));
  assert.equal(await db.prepare("SELECT * FROM rate_limits WHERE key = 'rollback'").first(), null);
});
test('webhook verifies exact raw body before capture and repeated deliveries are harmless', async () => {
  const env = environment(), o = await order(env), p = payment(o);
  const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: p } } });
  const signature = await hmacHex(env.RAZORPAY_WEBHOOK_SECRET, raw);
  const send = (body, sig) => webhook({ env, request: new Request('https://memebox.site/api/razorpay-webhook', { method: 'POST', headers: { 'X-Razorpay-Signature': sig }, body }) });
  assert.equal((await send(raw + ' ', signature)).status, 403);
  assert.equal((await send(raw, signature)).status, 200);
  assert.equal((await send(raw, signature)).status, 200);
  const row = await recoveredOrder(env, o.orderId, o.recoveryToken);
  assert.equal((await getLicense(env.DB, row.license_key)).pro_seconds, 3600);
});
test('checkout signature still requires an authoritative captured payment', async () => {
  const env = environment(), o = await order(env), p = payment(o), original = globalThis.fetch;
  const signature = await hmacHex(env.RAZORPAY_KEY_SECRET, `${o.gatewayOrderId}|${p.id}`);
  const body = { orderId: o.orderId, recoveryToken: o.recoveryToken, paymentId: p.id, signature };
  globalThis.fetch = async () => Response.json({ ...p, status: 'authorized', captured: false });
  try {
    assert.equal((await confirmGatewayPayment(env, body)).status, 'pending');
    globalThis.fetch = async () => Response.json(p);
    assert.equal((await confirmGatewayPayment(env, body)).status, 'fulfilled');
  } finally { globalThis.fetch = original; }
});
test('refund retries do not double count; full standalone refund revokes only its key', async () => {
  const env = environment(), o = await order(env), p = payment(o);
  const row = await fulfillCaptured(env, p), refund = { id: 'rfnd_one', payment_id: p.id, amount: p.amount, status: 'processed' };
  await recordRefund(env, refund); await recordRefund(env, refund);
  assert.equal((await recoveredOrder(env, o.orderId, o.recoveryToken)).refunded_amount, 1500);
  assert.equal((await getLicense(env.DB, row.license_key)).status, 'revoked');
  const key = await createLicense(env.DB, { proSeconds: 100 }), top = await order(env, 'pass_pro_60', key), q = payment(top);
  await fulfillCaptured(env, q); await recordRefund(env, { ...refund, id: 'rfnd_two', payment_id: q.id });
  assert.equal((await recoveredOrder(env, top.orderId, top.recoveryToken)).status, 'review');
  assert.equal((await getLicense(env.DB, key)).status, 'active');
});

test('refunding the first purchase does not revoke a key with later paid purchases', async () => {
  const env = environment(), original = await order(env), p = payment(original), row = await fulfillCaptured(env, p);
  const topup = await order(env, 'char_bunny', row.license_key);
  await fulfillCaptured(env, payment(topup));
  await recordRefund(env, { id: 'rfnd_shared', payment_id: p.id, amount: p.amount, status: 'processed' });
  assert.equal((await getLicense(env.DB, row.license_key)).status, 'active');
  assert.equal((await recoveredOrder(env, original.orderId, original.recoveryToken)).status, 'review');
});

test('signed webhooks for the other website are acknowledged without granting access', async () => {
  const env = environment();
  const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_other', order_id: 'order_other', amount: 1500, currency: 'INR', status: 'captured', captured: true } } } });
  const response = await webhook({ env, request: new Request('https://memebox.site/api/razorpay-webhook', { method: 'POST', headers: { 'X-Razorpay-Signature': await hmacHex(env.RAZORPAY_WEBHOOK_SECRET, raw) }, body: raw }) });
  assert.equal(response.status, 200); assert.equal((await response.json()).ignored, true);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM licenses').first()).n, 0);
});
test('checkout rejects oversized chunked bodies before parsing or creating orders', async () => {
  const env = environment(); let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(5000)); }, cancel() { cancelled = true; } });
  const response = await checkout({ env, request: new Request('https://memebox.site/api/checkout', { method: 'POST', body, duplex: 'half' }) });
  assert.equal(response.status, 413); assert.equal(cancelled, true);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM gateway_orders').first()).n, 0);
});
