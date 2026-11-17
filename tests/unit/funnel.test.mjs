// The buying funnel: opened the buy page -> started checkout -> paid.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { D1 } from '../../tools/d1-sqlite.mjs';
import { countHit, funnelStats, share, isPage } from '../../site/src/funnel.js';
import { onRequest as config } from '../../site/functions/api/config.js';

const order = (db, id, status, product = 'pass_pro_60', amount = 1500, currency = 'INR', at = new Date().toISOString()) =>
  db.prepare('INSERT INTO gateway_orders (id, created_at, product, currency, amount, snapshot, recovery_hash, license_key, status) VALUES (?, ?, ?, ?, ?, \'{}\', \'x\', \'MBX-AAAA-AAAA-AAAA\', ?)')
    .bind(id, at, product, currency, amount, status).run();

test('only pages we know are counted, and counting never throws', async () => {
  const db = new D1();
  assert.equal(isPage('buy'), true);
  assert.equal(isPage('admin'), false);
  await countHit(db, 'buy');
  await countHit(db, 'buy');
  await countHit(db, 'nonsense');           // ignored
  await countHit(null, 'buy');              // no database: must not throw
  const row = await db.prepare("SELECT n FROM page_hits WHERE page = 'buy'").first();
  assert.equal(Number(row.n), 2);
});

test('the funnel counts each step and the fall-out between them', async () => {
  const db = new D1();
  for (let i = 0; i < 40; i++) await countHit(db, 'buy');
  await order(db, 'MBAAAAAAAAA1', 'fulfilled');
  await order(db, 'MBAAAAAAAAA2', 'fulfilled');
  await order(db, 'MBAAAAAAAAA3', 'pending');   // left in the middle of paying
  await order(db, 'MBAAAAAAAAA4', 'pending');
  await order(db, 'MBAAAAAAAAA5', 'refunded');

  const f = await funnelStats(db);
  assert.equal(f.opened, 40);
  assert.equal(f.started, 5);
  assert.equal(f.paid, 2);
  assert.equal(f.abandoned, 2);
  assert.equal(f.refunded, 1);
  assert.equal(Math.round(f.startRate * 100), 13);  // 5 of 40
  assert.equal(Math.round(f.payRate * 100), 40);    // 2 of 5
  assert.deepEqual(f.earned, { INR: 3000 });
});

test('it says which product people start but do not finish', async () => {
  const db = new D1();
  await order(db, 'MBBBBBBBBBB1', 'pending', 'pass_max_480', 9900);
  await order(db, 'MBBBBBBBBBB2', 'pending', 'pass_max_480', 9900);
  await order(db, 'MBBBBBBBBBB3', 'pending', 'pass_max_480', 9900);
  await order(db, 'MBBBBBBBBBB4', 'fulfilled', 'pass_pro_30', 900);

  const f = await funnelStats(db);
  const worst = f.byProduct[0];
  assert.equal(worst.product, 'pass_max_480');
  assert.equal(worst.started, 3);
  assert.equal(worst.paid, 0);               // nobody finished the expensive one
});

test('orders older than the window are left out', async () => {
  const db = new D1();
  const longAgo = new Date(Date.now() - 90 * 86400000).toISOString();
  await order(db, 'MBCCCCCCCCC1', 'fulfilled', 'pass_pro_60', 1500, 'INR', longAgo);
  await order(db, 'MBCCCCCCCCC2', 'fulfilled');
  assert.equal((await funnelStats(db, { days: 30 })).paid, 1);
  assert.equal((await funnelStats(db, { days: 365 })).paid, 2);
});

test('rupees and dollars are kept apart, never added up', async () => {
  const db = new D1();
  await order(db, 'MBDDDDDDDDD1', 'fulfilled', 'pass_pro_60', 1500, 'INR');
  await order(db, 'MBDDDDDDDDD2', 'fulfilled', 'pass_pro_60', 249, 'USD');
  assert.deepEqual((await funnelStats(db)).earned, { INR: 1500, USD: 249 });
});

test('opening the buy page counts once, and that answer is never cached', async () => {
  const db = new D1();
  const env = { DB: db };
  const get = (url) => config({ request: new Request(url, { method: 'GET' }), env });

  const counted = await get('https://memebox.site/api/config?from=buy');
  assert.equal(counted.headers.get('Cache-Control'), 'no-store');

  // Every other page shares the cached answer and must not be counted as a buyer.
  const plain = await get('https://memebox.site/api/config');
  assert.match(plain.headers.get('Cache-Control'), /max-age=300/);
  await get('https://memebox.site/api/config?from=somewhere-else');

  const row = await db.prepare("SELECT n FROM page_hits WHERE page = 'buy'").first();
  assert.equal(Number(row.n), 1);
});

test('percentages read as plain words, and say nothing when there is nothing to divide', () => {
  assert.equal(share(3, 40), '3 of 40 (8%)');
  assert.equal(share(0, 0), '0');
});
