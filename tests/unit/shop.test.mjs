// 1.1.0: license keys, UPI orders and the admin's control over both. Real Pages Functions on SQLite.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCTS, forSale, newLicenseKey, newOrderId, LICENSE_RE, ORDER_RE, upiLink, cleanKey, createLicense, getLicense,
  createOrder, claimOrder, approveOrder,
} from '../../site/src/shop.js';
import { makeSession } from '../../site/src/security.js';
import { onRequest as licenseApi } from '../../site/functions/api/license.js';
import { onRequest as orderApi } from '../../site/functions/api/order.js';
import { onRequest as configApi } from '../../site/functions/api/config.js';
import { onRequest as usageApi } from '../../site/functions/api/usage.js';
import { onRequest as adminPage } from '../../site/functions/admin/index.js';
import { onRequest as adminOrder } from '../../site/functions/admin/order.js';
import { onRequest as adminLicense } from '../../site/functions/admin/license.js';
import { D1 } from '../../tools/d1-sqlite.mjs';
import { readTomlVars } from '../../tools/site-dev.mjs';

const ADMIN_KEY = 'admin-key-for-tests';

test('concurrent manual approval creates one license and applies one top-up', async () => {
  const local = new D1(), order = await createOrder(local, { product: 'pass_pro_60' });
  await claimOrder(local, order.id, '123456789012');
  const keys = await Promise.all(Array.from({ length: 8 }, () => approveOrder(local, order.id)));
  assert.equal(new Set(keys).size, 1);
  assert.equal((await getLicense(local, keys[0])).pro_seconds, 3600);
  const topup = await createOrder(local, { product: 'pass_pro_60', forKey: keys[0] });
  await claimOrder(local, topup.id, '123456789013');
  await Promise.all(Array.from({ length: 8 }, () => approveOrder(local, topup.id)));
  assert.equal((await getLicense(local, keys[0])).pro_seconds, 7200);
  assert.equal((await local.prepare('SELECT COUNT(*) AS n FROM licenses').first()).n, 1);
});
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

test('prices match the current passes and eight-character bundle; exclusive characters are not for sale', () => {
  const p = PRODUCTS;
  assert.deepEqual([p.pass_pro_30.inr, p.pass_pro_60.inr, p.pass_pro_120.inr, p.pass_max_60.inr, p.pass_max_180.inr], [9, 15, 25, 25, 49]);
  assert.deepEqual([p.pass_pro_30.usd, p.pass_pro_60.usd, p.pass_pro_120.usd, p.pass_max_60.usd, p.pass_max_180.usd], [1.49, 2.49, 3.99, 3.49, 6.49]);
  assert.deepEqual([p.pass_pro_30.proSeconds, p.pass_pro_60.proSeconds, p.pass_pro_120.proSeconds, p.pass_max_60.maxSeconds, p.pass_max_180.maxSeconds], [1800, 3600, 7200, 3600, 10800]);
  const perHour = (x) => x.inr / ((x.proSeconds + x.maxSeconds) / 3600), perHourUsd = (x) => x.usd / ((x.proSeconds + x.maxSeconds) / 3600);
  const cheapestPro = Math.min(...['pass_pro_30', 'pass_pro_60', 'pass_pro_120', 'pass_pro_300'].map((id) => perHour(p[id])));
  const cheapestProUsd = Math.min(...['pass_pro_30', 'pass_pro_60', 'pass_pro_120', 'pass_pro_300'].map((id) => perHourUsd(p[id])));
  for (const id of ['pass_max_60', 'pass_max_180']) { assert.ok(perHour(p[id]) > cheapestPro, id + ' costs more per hour than Pro (rupees)'); assert.ok(perHourUsd(p[id]) > cheapestProUsd, id + ' costs more per hour than Pro (dollars)'); }
  assert.equal(p.pro.closed, true);
  assert.equal(p.pictures5.closed, true);
  assert.deepEqual(['bunny', 'panda', 'owl', 'fox'].map((c) => p['char_' + c].inr), [29, 29, 29, 29]);
  assert.deepEqual(['penguin', 'lion', 'monkey', 'frog'].map((c) => p['char_' + c].inr), [39, 39, 39, 39]);
  assert.deepEqual(['unicorn', 'robot'].map((c) => p['char_' + c].inr), [49, 49]);
  assert.equal(p.chars_all.closed, true);
  assert.equal(p.char_unicorn.closed, true);
  assert.equal(p.char_robot.closed, true);
  assert.equal(p.chars_eight.inr, 199);
  assert.equal(p.chars_eight.usd, 4.99);
  assert.equal(p.chars_eight.addons.length, 8);
  const separately = Object.entries(p).filter(([id]) => id.startsWith('char_')).reduce((a, [, x]) => a + x.inr, 0);
  assert.ok(p.chars_eight.inr < separately, 'the bundle is cheaper than buying one by one');
  assert.deepEqual(forSale().map(([id]) => id).slice(0, 5), ['pass_pro_30', 'pass_pro_60', 'pass_pro_120', 'pass_max_60', 'pass_max_180']);
  assert.equal(forSale().length, 7 + 8 + 1 + 15 + 3 + 2);
  assert.ok(forSale().every(([id]) => !['char_unicorn', 'char_robot', 'char_snake', 'char_bird', 'chars_all'].includes(id)));
});

test('closed exclusive products reject new orders while legacy pending orders retain their purchased entitlement', async () => {
  for (const product of ['char_unicorn', 'char_robot', 'char_snake', 'char_bird', 'chars_all']) {
    assert.equal((await call(orderApi, postJson('/api/order', { action: 'create', product }))).status, 400);
  }
  const id = newOrderId();
  await db.prepare("INSERT INTO orders (id, created_at, product, amount_inr, status, for_key, utr) VALUES (?, ?, 'chars_all', 249, 'waiting', '', '412345678909')").bind(id, new Date().toISOString()).run();
  await call(adminOrder, adminForm('/admin/order', { id, action: 'approve' }));
  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  assert.equal(order.status, 'approved');
  const license = await getLicense(db, order.license_key);
  const addons = JSON.parse(license.addons);
  assert.equal(addons.length, 10);
  assert.ok(addons.includes('character:unicorn'));
  assert.ok(addons.includes('character:robot'));
  assert.ok(!addons.includes('character:snake'));
});

test('wrangler.toml has no UPI ID or other settings, so the dashboard values are never overwritten', () => {
  assert.deepEqual(readTomlVars(), {});
});

test('/api/config tells the buy page the products and whether payments are open', async () => {
  const on = await (await call(configApi, req('/api/config'))).json();
  assert.equal(on.payments, true);
  assert.equal(on.products.pass_max_180.inr, 49);
  assert.equal(on.products.pass_max_180.usd, 6.49);
  assert.deepEqual(on.products.char_bunny.addons, ['character:bunny']);
  assert.equal(on.products.pro, undefined, 'the old lifetime Pro is not for sale');
  const off = await (await call(configApi, req('/api/config'), { DB: db })).json();
  assert.equal(off.payments, false);
});

test('/api/license: active, unknown, badly formed and turned-off keys; CORS for the extension', async () => {
  const key = await createLicense(db, { kind: 'owner', unlimited: true, note: 'me' });
  const ok = await call(licenseApi, postJson('/api/license', { key: key.toLowerCase() }));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), '*');
  assert.deepEqual((await ok.json()).license, { key, status: 'active', unlimited: true, pictureSlots: 0, proSeconds: 0, maxSeconds: 0, addons: [] });
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
  const created = await (await call(orderApi, postJson('/api/order', { action: 'create', product: 'pass_pro_60' }))).json();
  assert.equal(created.ok, true);
  assert.equal(created.amount, 15);
  assert.match(created.upiUrl, new RegExp(`^upi://pay\\?pa=memebox@upi&pn=MemeBox&am=15\\.00&cu=INR&tn=MemeBox%20${created.orderId}$`));

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
  assert.equal(lic.unlimited, 0);
  assert.equal(lic.pro_seconds, 3600, 'one hour of Pro');
  assert.equal(lic.kind, 'paid');

  const after = await (await call(adminPage, req('/admin', { headers: { Cookie: cookie } }))).text();
  assert.match(after, /Earned so far: <b>₹15<\/b> from 1 approved order\./);
});

test('hours top up an existing key (Pro Max too), a closed product cannot be ordered, and a used UTR can\'t be reused', async () => {
  const key = await createLicense(db, { kind: 'paid', proSeconds: 600 });
  const a = await (await call(orderApi, postJson('/api/order', { action: 'create', product: 'pass_max_180', forKey: key }))).json();
  await call(orderApi, postJson('/api/order', { action: 'claim', orderId: a.orderId, utr: '400000000001' }));
  await call(adminOrder, adminForm('/admin/order', { id: a.orderId, action: 'approve' }));
  const row = await getLicense(db, key);
  assert.deepEqual([row.pro_seconds, row.max_seconds], [600, 10800]);

  const b = await (await call(orderApi, postJson('/api/order', { action: 'create', product: 'pass_pro_30' }))).json();
  const reuse = await call(orderApi, postJson('/api/order', { action: 'claim', orderId: b.orderId, utr: '400000000001' }));
  assert.equal(reuse.status, 409);
  assert.match((await reuse.json()).error, /already used/);

  assert.equal((await call(orderApi, postJson('/api/order', { action: 'create', product: 'pro' }))).status, 400, 'lifetime Pro is closed');
  assert.equal((await call(orderApi, postJson('/api/order', { action: 'create', product: 'pictures5' }))).status, 400, 'picture packs are closed');
  const unknownKey = await call(orderApi, postJson('/api/order', { action: 'create', product: 'pass_pro_30', forKey: 'MBX-AAAA-BBBB-CCCC' }));
  assert.equal(unknownKey.status, 400);
});

test('rejecting an order gives no key; orders can\'t be approved twice', async () => {
  const o = await (await call(orderApi, postJson('/api/order', { action: 'create', product: 'pass_pro_60' }))).json();
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
  const o = await (await call(orderApi, postJson('/api/order', { action: 'create', product: 'pass_pro_60' }))).json();
  await call(orderApi, postJson('/api/order', { action: 'claim', orderId: o.orderId, utr: '411111111111' }));
  await call(adminOrder, adminForm('/admin/order', { id: o.orderId, action: 'approve' }));
  assert.equal((await db.prepare('SELECT status FROM orders').first()).status, 'waiting');
});

test('payments closed without a valid UPI_ID; orders are rate limited', async () => {
  assert.equal((await call(orderApi, postJson('/api/order', { action: 'create', product: 'pass_pro_60' }), env({ UPI_ID: '' }))).status, 503);
  for (let i = 0; i < 10; i++) assert.equal((await call(orderApi, postJson('/api/order', { action: 'create', product: 'pass_pro_60' }, '198.51.100.9'))).status, 200);
  assert.equal((await call(orderApi, postJson('/api/order', { action: 'create', product: 'pass_pro_60' }, '198.51.100.9'))).status, 429);
});

test('admin page counts paid Pro users, owner/gift keys and picture-only buyers separately', async () => {
  await createLicense(db, { kind: 'paid', unlimited: true, pictureSlots: 0, note: 'order A' });
  await createLicense(db, { kind: 'paid', unlimited: true, pictureSlots: 0, note: 'order B' });
  await createLicense(db, { kind: 'paid', unlimited: false, pictureSlots: 5, note: 'order C' });
  await createLicense(db, { kind: 'owner', unlimited: true, pictureSlots: 0, note: 'me' });
  const html = await (await call(adminPage, req('/admin', { headers: { Cookie: cookie } }))).text();
  assert.match(html, /<b>Pro users:<\/b> 2 paid · 1 owner\/gift · 0 checked in the last 7 days · 1 bought only picture slots/);
});

test('time pass: the extension reports seconds used; Pro Max is spent first, the balance never goes below 0, one report is capped', async () => {
  const key = await createLicense(db, { kind: 'gift', proSeconds: 1800, maxSeconds: 60 });
  const spend = async (n) => (await (await call(licenseApi, postJson('/api/license', { key, spend: n }))).json()).license;
  let l = await spend(0);
  assert.deepEqual([l.maxSeconds, l.proSeconds], [60, 1800]);
  l = await spend(45);
  assert.deepEqual([l.maxSeconds, l.proSeconds], [15, 1800]);
  l = await spend(60);
  assert.deepEqual([l.maxSeconds, l.proSeconds], [0, 1755]);
  l = await spend(-500);
  assert.equal(l.proSeconds, 1755, 'a negative report gives nothing back');
  l = await spend(99999);
  assert.equal(l.proSeconds, 1155, 'at most 10 minutes per report');
  assert.ok(l.proSeconds >= 0);
});

test('time pass: a turned-off key spends nothing, and the admin can gift minutes', async () => {
  await call(adminLicense, adminForm('/admin/license', { action: 'create', kind: 'gift', proMinutes: '30', maxMinutes: '60' }));
  const row = await db.prepare("SELECT * FROM licenses WHERE kind = 'gift'").first();
  assert.deepEqual([row.pro_seconds, row.max_seconds], [1800, 3600]);
  await call(adminLicense, adminForm('/admin/license', { action: 'revoke', key: row.key }));
  const r = await (await call(licenseApi, postJson('/api/license', { key: row.key, spend: 300 }))).json();
  assert.equal(r.license.status, 'revoked');
  assert.equal((await getLicense(db, row.key)).max_seconds, 3600);
  const page = await (await call(adminPage, req('/admin', { headers: { Cookie: cookie } }))).text();
  assert.match(page, /Pro Max 60 min left, Pro 30 min left/);
});

test('admin shows an activity section: earned, funnel, charts and pass time from orders and keys', async () => {
  const created = await (await call(orderApi, postJson('/api/order', { action: 'create', product: 'pass_pro_60' }))).json();
  assert.ok(created.ok, JSON.stringify(created));
  const html = await (await call(adminPage, req('/admin', { headers: { Cookie: cookie } }))).text();
  assert.match(html, /id="activity"[\s\S]*Sales and usage/);
  assert.match(html, /<div class="range" id="range"/, '7 / 14 / 30 day buttons');
  assert.match(html, /<nav class="admin-nav"/, 'section nav');
  assert.match(html, /data-pick="reason:too-hard"/, 'a reason bar filters the messages');
  assert.match(html, /<script src="\/assets\/admin\.js" defer><\/script>/, 'the dashboard loads its own script file');
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)/, 'no inline scripts');
  assert.match(html, /checkouts started/);
  assert.match(html, /<svg class="chart"/);
  assert.match(html, /Pass time/);
  assert.match(html, /What people use/);
  assert.match(html, /Platform coverage/);
  assert.doesNotMatch(html, /style="/, 'the admin page CSP blocks inline styles');
});

test('optional usage stores only allowlisted counters and feeds the admin ranking', async () => {
  const response = await call(usageApi, postJson('/api/usage', {
    install: '12345678-1234-4123-8123-123456789abc',
    events: [{ feature: 'character', item: 'panda', count: 2 }, { feature: 'meme', item: 'line' }, { feature: 'caption', item: 'secret' }],
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  const rows = (await db.prepare('SELECT * FROM usage_daily ORDER BY feature').all()).results;
  assert.equal(rows.length, 2, 'unknown feature was discarded');
  assert.equal(rows[0].subject.length, 64, 'only a one-way installation hash is stored');
  assert.equal(rows.some((row) => row.feature === 'character' && row.item === 'panda' && row.count === 2), true);
  const html = await (await call(adminPage, req('/admin', { headers: { Cookie: cookie } }))).text();
  assert.match(html, /character: panda/);
  assert.doesNotMatch(html, /12345678-1234-4123/);
});

test('buying a character: new purchases and the eight-character bundle add permanent ownership', async () => {
  const buy = async (product, forKey = '') => {
    const created = await (await call(orderApi, postJson('/api/order', { action: 'create', product, forKey }))).json();
    assert.ok(created.ok, JSON.stringify(created));
    await call(orderApi, postJson('/api/order', { action: 'claim', orderId: created.orderId, utr: String(Math.floor(1e11 + Math.random() * 9e11)) }));
    await call(adminOrder, adminForm('/admin/order', { id: created.orderId, action: 'approve' }));
    return (await (await call(orderApi, req('/api/order?id=' + created.orderId))).json()).order.licenseKey;
  };
  const key = await buy('char_panda');
  assert.match(key, LICENSE_RE);
  let view = (await (await call(licenseApi, postJson('/api/license', { key }))).json()).license;
  assert.deepEqual(view.addons, [{ id: 'character:panda', until: 0 }]);
  assert.equal(view.proSeconds, 0, 'a character is not a time pass');
  await buy('char_lion', key);
  await buy('char_panda', key); // the same one twice is kept once
  view = (await (await call(licenseApi, postJson('/api/license', { key }))).json()).license;
  assert.deepEqual(view.addons.map((a) => a.id).sort(), ['character:lion', 'character:panda']);
  await buy('chars_eight', key);
  view = (await (await call(licenseApi, postJson('/api/license', { key }))).json()).license;
  assert.equal(view.addons.length, 8);
  assert.ok(view.addons.every((a) => /^character:[a-z]+$/.test(a.id)));
  const dash = await (await call(adminPage, req('/admin', { headers: { Cookie: cookie } }))).text();
  assert.match(dash, /characters: /);
  assert.match(dash, /Character: Panda/);
});

test('standard Pro cosmetics sell individually and in bundles; Max cosmetics stay pass-only', async () => {
  const {PRODUCTS, COSMETIC_DRAFTS, forSale}=await import('../../site/src/shop.js');
  for(const id of COSMETIC_DRAFTS.filters) assert.equal(PRODUCTS['filter_'+id].closed,undefined);
  for(const id of COSMETIC_DRAFTS.outfits) assert.equal(PRODUCTS['outfit_'+id].closed,undefined);
  for(const id of COSMETIC_DRAFTS.maxFilters) assert.equal(PRODUCTS['filter_'+id],undefined);
  for(const id of COSMETIC_DRAFTS.maxOutfits) assert.equal(PRODUCTS['outfit_'+id],undefined);
  assert.equal(PRODUCTS.filters_fifteen.addons.length,15);
  assert.equal(PRODUCTS.outfits_three.addons.length,3);
  assert.ok(PRODUCTS.filters_fifteen.inr < COSMETIC_DRAFTS.filters.reduce((sum,id)=>sum+PRODUCTS['filter_'+id].inr,0));
  assert.ok(PRODUCTS.outfits_three.inr < COSMETIC_DRAFTS.outfits.reduce((sum,id)=>sum+PRODUCTS['outfit_'+id].inr,0));
  assert.ok(forSale().some(([id])=>id==='filter_vintage'));
  assert.ok(forSale().some(([id])=>id==='outfit_hoodie'));
  const buy = async (product, forKey = '') => {
    const created=await (await call(orderApi,postJson('/api/order',{action:'create',product,forKey}))).json();assert.ok(created.ok,JSON.stringify(created));
    await call(orderApi,postJson('/api/order',{action:'claim',orderId:created.orderId,utr:String(Math.floor(1e11+Math.random()*9e11))}));
    await call(adminOrder,adminForm('/admin/order',{id:created.orderId,action:'approve'}));
    return (await (await call(orderApi,req('/api/order?id='+created.orderId))).json()).order.licenseKey;
  };
  const key=await buy('filter_vintage');await buy('outfits_three',key);
  const view=(await (await call(licenseApi,postJson('/api/license',{key}))).json()).license;
  assert.deepEqual(view.addons.map(x=>x.id).sort(),['filter:vintage','outfit:bow','outfit:glasses','outfit:hoodie']);
});

test('the local public catalog uses authoritative server prices and excludes Max-only cosmetics', async()=>{
  const {loadScript}=await import('./helpers.mjs');const {PRODUCTS}=await import('../../site/src/shop.js');
  const {MemeShop}=loadScript('lib/shop-catalog.js');
  for(const [id,product] of Object.entries(MemeShop.products)){
    assert.equal(product.inr,PRODUCTS[id].inr,id+' INR');assert.equal(product.usd,PRODUCTS[id].usd,id+' USD');assert.equal(product.closed,!!PRODUCTS[id].closed,id+' availability');
  }
  assert.equal(MemeShop.products.filter_vintage.closed,false);
  assert.equal(MemeShop.products.filters_fifteen.inr,249);
  assert.equal(MemeShop.products.outfits_three.inr,79);
  assert.equal(MemeShop.products.filter_prism,undefined);
});
