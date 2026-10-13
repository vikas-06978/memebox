import { test } from 'node:test';
import assert from 'node:assert/strict';
import { D1 } from '../../tools/d1-sqlite.mjs';
import { reserveHostedDelivery, hostedUsage } from '../../site/src/content-budget.js';
import { storageLimitBytes } from '../../site/src/packs.js';

test('shared capacity is atomic across users, and refusal does not expand the counter', async () => {
  const db = new D1();
  const env = { DB: db, PACK_GLOBAL_DAILY_FILES: '2' };
  const now = Date.UTC(2026, 9, 13);
  const results = await Promise.all(Array.from({ length: 20 }, () => reserveHostedDelivery(env, 500, now)));
  assert.equal(results.filter(Boolean).length, 2);
  assert.equal((await db.prepare("SELECT count FROM rate_limits WHERE key = 'hosted:day-files:2026-10-13'").first()).count, 2);
  const view = await hostedUsage(env, now);
  assert.deepEqual(view.dayFiles, { used: 2, limit: 2 });
  assert.equal(view.monthFiles.used, 2);
});

test('daily reset cannot bypass monthly capacity and monthly windows reset independently', async () => {
  const env = { DB: new D1(), PACK_GLOBAL_MONTHLY_FILES: '1' };
  assert.equal(await reserveHostedDelivery(env, 500, Date.UTC(2026, 9, 13)), true);
  assert.equal(await reserveHostedDelivery(env, 500, Date.UTC(2026, 9, 14)), false);
  assert.equal(await reserveHostedDelivery(env, 500, Date.UTC(2026, 10, 1)), true);
});

test('byte caps, zero settings and malformed settings fail closed', async () => {
  assert.equal(await reserveHostedDelivery({ DB: new D1(), PACK_GLOBAL_DAILY_MB: '1' }, 1048577), false);
  for (const setting of ['0', '-1', 'no-limit', 'Infinity']) {
    assert.equal(await reserveHostedDelivery({ DB: new D1(), PACK_GLOBAL_DAILY_FILES: setting }, 100), false);
  }
  assert.equal(storageLimitBytes({}), 500 * 1048576);
  assert.equal(storageLimitBytes({ PACKS_MAX_MB: '5000' }), 500 * 1048576);
  assert.equal(storageLimitBytes({ PACKS_MAX_MB: '0' }), 0);
  assert.equal(storageLimitBytes({ PACKS_MAX_MB: 'bad' }), 0);
});
