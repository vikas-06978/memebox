// 1.1.0: license keys, UPI orders and the admin's control over both. Real Pages Functions on SQLite.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCTS, newLicenseKey, newOrderId, LICENSE_RE, ORDER_RE, upiLink, cleanKey, createLicense, getLicense,
} from '../../site/src/shop.js';
import { makeSession } from '../../site/src/security.js';
import { onRequest as licenseApi } from '../../site/functions/api/license.js';
import { onRequest as orderApi } from '../../site/functions/api/order.js';
import { onRequest as configApi } from '../../site/functions/api/config.js';
import { onRequest as adminPage } from '../../site/functions/admin/index.js';
import { onRequest as adminOrder } from '../../site/functions/admin/order.js';
import { onRequest as adminLicense } from '../../site/functions/admin/license.js';
import { D1 } from '../../tools/d1-sqlite.mjs';
import { readTomlVars } from '../../tools/site-dev.mjs';

const ADMIN_KEY = 'admin-key-for-tests';
let db;
const env = (extra = {}) => ({ DB: db, ADMIN_KEY, RATE_SALT: 'salt', UPI_ID: 'memebox@upi', UPI_NAME: 'MemeBox', ...extra });
const call = (h, request, e = env()) => h({ request, env: e, params: {}, waitUntil() {} });
const req = (path, init = {}) => new Request('https://memebox.pages.dev' + path, { ...init, headers: { 'CF-Connecting-IP': '203.0.113.20', ...(init.headers || {}) } });
const postJson = (path, body, ip) => req(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(ip ? { 'CF-Connecting-IP': ip } : {}) }, body: JSON.stringify(body) });
let cookie;
const adminForm = (path, fields) => req(path, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie }, body: new URLSearchParams(fields).toString() });

beforeEach(async () => {
  db = new D1();
  cookie = `memebox_admin=${await makeSession(ADMIN_KEY)}`;
});

test('keys and order codes are random, readable and match their patterns', () => {
  const keys = new Set(Array.from({ length: 200 }, newLicenseKey));
  assert.equal(keys.size, 200);
  for (const k of keys) assert.match(k, LICENSE_RE);
  for (const k of keys) assert.doesNotMatch(k.slice(4), /[01OI]/);
  assert.match(newOrderId(), ORDER_RE);
  assert.equal(cleanKey(' mbx-abcd efgh-jkmn '), 'MBX-ABCDEFGH-JKMN');
});

test('UPI link has the payee, amount in rupees, INR and the order code as the note', () => {
  const url = upiLink({ upiId: 'memebox@upi', payee: 'Meme Box', amount: 29, orderId: 'MBABCDEFGHJK' });
  assert.equal(url, 'upi://pay?pa=memebox@upi&pn=Meme%20Box&am=29.00&cu=INR&tn=MemeBox%20MBABCDEFGHJK');
  assert.throws(() => upiLink({ upiId: 'not a vpa', amount: 1, orderId: 'x' }));
});

test('prices: 5 pictures for ₹29, Pro for ₹99', () => {
  assert.deepEqual({ ...PRODUCTS.pictures5 }, { name: '5 more picture memes', inr: 29, pictureSlots: 5, unlimited: false });
  assert.equal(PRODUCTS.pro.inr, 99);
  assert.equal(PRODUCTS.pro.unlimited, true);
});

test('wrangler.toml ships the placeholder UPI ID memebox@upi', () => {
  assert.deepEqual(readTomlVars(), { UPI_ID: 'memebox@upi', UPI_NAME: 'MemeBox' });
});

test('/api/config tells the buy page the products and whether payments are open', async () => {
  const on = await (await call(configApi, req('/api/config'))).json();
  assert.equal(on.payments, true);
  assert.equal(on.products.pro.inr, 99);
  const off = await (await call(configApi, req('/api/config'), { DB: db })).json();
  assert.equal(off.payments, false);
});

test('/api/license: active, unknown, badly formed and turned-off keys; CORS for the extension', async () => {
  const key = await createLicense(db, { kind: 'owner', unlimited: true, note: 'me' });
  const ok = await call(licenseApi, postJson('/api/license', { key: key.toLowerCase() }));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), '*');
  assert.deepEqual((await ok.json()).license, { key, status: 'active', unlimited: true, pictureSlots: 0 });
  assert.match((await getLicense(db, key)).last_seen, /^\d{4}-\d\d-\d\d$/);

  assert.equal((await call(licenseApi, postJson('/api/license', { key: 'MBX-AAAA-BBBB-CCCC' }))).status, 404);
  assert.equal((await call(licenseApi, postJson('/api/license', { key: 'hello' }))).status, 400);
  const pre = await call(licenseApi, req('/api/license', { method: 'OPTIONS' }));
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get('Access-Control-Allow-Methods'), /POST/);

  await call(adminLicense, adminForm('/admin/license', { action: 'revoke', key }));
  const off = await (await call(licenseApi, postJson('/api/license', { key }))).json();
  assert.equal(off.license.status, 'revoked');
});

test('order flow: create → QR link → claim with UTR → admin approves → buyer sees a new key', async () => {
  const created = await (await call(orderApi, postJson('/api/order', { action: 'create', product: 'pro' }))).json();
  assert.equal(created.ok, true);
  assert.equal(created.amount, 99);
  assert.match(created.upiUrl, new RegExp(`^upi://pay\\?pa=memebox@upi&pn=MemeBox&am=99\\.00&cu=INR&tn=MemeBox%20${created.orderId}$`));

  const bad = await call(orderApi, postJson('/api/order', { action: 'claim', orderId: created.orderId, utr: '123' }));
  assert.equal(bad.status, 400);
  const claimed = await (await call(orderApi, postJson('/api/order', { action: 'claim', orderId: created.orderId, utr: '412345678901' }))).json();
  assert.equal(claimed.order.status, 'waiting');
  assert.equal(claimed.order.licenseKey, undefined);

  // The admin sees it waiting, with the UTR and the note.
  const dash = await (await call(adminPage, req('/admin', { headers: { Cookie: cookie } }))).text();
  assert.match(dash, /Payments waiting for you \(1\)/);
  assert.match(dash, /UTR <b>412345678901<\/b>/);

  const approved = await call(adminOrder, adminForm('/admin/order', { id: created.orderId, action: 'approve' }));
  assert.equal(approved.status, 303);
  const status = await (await call(orderApi, req('/api/order?id=' + created.orderId))).json();
  assert.equal(status.order.status, 'approved');
  assert.match(status.order.licenseKey, LICENSE_RE);
  const lic = await getLicense(db, status.order.licenseKey);
  assert.equal(lic.unlimited, 1);
  assert.equal(lic.kind, 'paid');

  const after = await (await call(adminPage, req('/admin', { headers: { Cookie: cookie } }))).text();
  assert.match(after, /Earned so far: <b>₹99<\/b> from 1 approved order\./);
});

test('picture slots top up an existing key, and a used UTR can\'t be reused', async () => {
  const key = await createLicense(db, { kind: 'paid', pictureSlots: 5 });
  const a = await (await call(orderApi, postJson('/api/order', { action: 'create', product: 'pictures5', forKey: key }))).json();
  await call(orderApi, postJson('/api/order', { action: 'claim', orderId: a.orderId, utr: '400000000001' }));
  await call(adminOrder, adminForm('/admin/order', { id: a.orderId, action: 'approve' }));
  assert.equal((await getLicense(db, key)).picture_slots, 10);

  const b = await (await call(orderApi, postJson('/api/order', { action: 'create', product: 'pictures5' }))).json();
  const reuse = await call(orderApi, postJson('/api/order', { action: 'claim', orderId: b.orderId, utr: '400000000001' }));
  assert.equal(reuse.status, 409);
  assert.match((await reuse.json()).error, /already used/);

  const unknownKey = await call(orderApi, postJson('/api/order', { action: 'create', product: 'pictures5', forKey: 'MBX-AAAA-BBBB-CCCC' }));
  assert.equal(unknownKey.status, 400);
});

test('rejecting an order gives no key; orders can\'t be approved twice', async () => {
  const o = await (await call(orderApi, postJson('/api/order', { action: 'create', product: 'pro' }))).json();
  await call(orderApi, postJson('/api/order', { action: 'claim', orderId: o.orderId, utr: '499999999999' }));
  await call(adminOrder, adminForm('/admin/order', { id: o.orderId, action: 'reject' }));
  const s = await (await call(orderApi, req('/api/order?id=' + o.orderId))).json();
  assert.equal(s.order.status, 'rejected');
  assert.equal(s.order.licenseKey, undefined);
  await call(adminOrder, adminForm('/admin/order', { id: o.orderId, action: 'approve' }));
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM licenses').first()).n, 0);
});

test('admin makes an owner key for themself and a gift key with picture slots; turns one off and on', async () => {
  const r = await call(adminLicense, adminForm('/admin/license', { action: 'create', kind: 'owner', unlimited: 'on', note: 'my laptop' }));
  const key = decodeURIComponent(new URL(r.headers.get('Location'), 'https://x').searchParams.get('created'));
  assert.match(key, LICENSE_RE);
  const row = await getLicense(db, key);
  assert.equal(row.kind, 'owner');
  assert.equal(row.unlimited, 1);

  await call(adminLicense, adminForm('/admin/license', { action: 'create', kind: 'gift', slots: '3', note: 'friend' }));
  const gift = await db.prepare("SELECT * FROM licenses WHERE kind = 'gift'").first();
  assert.equal(gift.unlimited, 0);
  assert.equal(gift.picture_slots, 3);

  const page = await (await call(adminPage, req(`/admin?created=${key}`, { headers: { Cookie: cookie } }))).text();
  assert.ok(page.includes(`New key: <code>${key}</code>`));
  assert.match(page, /3 picture slots/);

  await call(adminLicense, adminForm('/admin/license', { action: 'revoke', key }));
  assert.equal((await getLicense(db, key)).status, 'revoked');
  await call(adminLicense, adminForm('/admin/license', { action: 'restore', key }));
  assert.equal((await getLicense(db, key)).status, 'active');
});

test('only a signed-in admin can make keys or approve orders', async () => {
  cookie = 'memebox_admin=forged';
  const r = await call(adminLicense, adminForm('/admin/license', { action: 'create', kind: 'owner', unlimited: 'on' }));
  assert.equal(r.headers.get('Location'), '/admin');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM licenses').first()).n, 0);
  const o = await (await call(orderApi, postJson('/api/order', { action: 'create', product: 'pro' }))).json();
  await call(orderApi, postJson('/api/order', { action: 'claim', orderId: o.orderId, utr: '411111111111' }));
  await call(adminOrder, adminForm('/admin/order', { id: o.orderId, action: 'approve' }));
  assert.equal((await db.prepare('SELECT status FROM orders').first()).status, 'waiting');
});

test('payments closed without a valid UPI_ID; orders are rate limited', async () => {
  assert.equal((await call(orderApi, postJson('/api/order', { action: 'create', product: 'pro' }), env({ UPI_ID: '' }))).status, 503);
  for (let i = 0; i < 10; i++) assert.equal((await call(orderApi, postJson('/api/order', { action: 'create', product: 'pro' }, '198.51.100.9'))).status, 200);
  assert.equal((await call(orderApi, postJson('/api/order', { action: 'create', product: 'pro' }, '198.51.100.9'))).status, 429);
});
