import { test } from 'node:test';
import assert from 'node:assert/strict';
import { D1 } from '../../tools/d1-sqlite.mjs';
import { createLicense, getLicense } from '../../site/src/shop.js';
import { openPassSession, billPassSession } from '../../site/src/pass-session.js';

test('signed cumulative reports debit Max first and retries/stale reports do not spend twice', async () => {
  const env = { DB: new D1(), PASS_SESSION_SECRET: 'fixture-secret-longer-than-thirty-two-characters' }, now = Date.now();
  const key = await createLicense(env.DB, { proSeconds: 1000, maxSeconds: 100 });
  const session = await openPassSession(env, key, now);
  await Promise.all(Array.from({ length: 8 }, () => billPassSession(env, key, session.token, 150, now + 150000)));
  let row = await getLicense(env.DB, key);
  assert.equal(row.max_seconds, 0); assert.equal(row.pro_seconds, 950);
  await billPassSession(env, key, session.token, 100, now + 150000);
  assert.equal((await getLicense(env.DB, key)).pro_seconds, 950);
  await billPassSession(env, key, session.token, 200, now + 200000);
  assert.equal((await getLicense(env.DB, key)).pro_seconds, 900);
});
test('signed report rejects altered token, another key, expiry and oversized increments', async () => {
  const env = { DB: new D1(), PASS_SESSION_SECRET: 'fixture-secret-longer-than-thirty-two-characters' }, now = Date.now();
  const key = await createLicense(env.DB, { proSeconds: 1000 }), other = await createLicense(env.DB);
  const session = await openPassSession(env, key, now);
  await assert.rejects(billPassSession(env, other, session.token, 100, now));
  await assert.rejects(billPassSession(env, key, session.token.replace(/.$/, 'x'), 100, now));
  await assert.rejects(billPassSession(env, key, session.token, 601, now));
  await assert.rejects(billPassSession(env, key, session.token, 100, now + 31 * 86400000));
  assert.equal((await getLicense(env.DB, key)).pro_seconds, 1000);
});
test('simultaneous sessions debit current balances atomically across the Max to Pro boundary', async () => {
  const env = { DB: new D1(), PASS_SESSION_SECRET: 'fixture-secret-longer-than-thirty-two-characters' }, now = Date.now();
  const key = await createLicense(env.DB, { proSeconds: 1000, maxSeconds: 100 });
  const a = await openPassSession(env, key, now), b = await openPassSession(env, key, now);
  await Promise.all([billPassSession(env, key, a.token, 100, now + 100000), billPassSession(env, key, b.token, 100, now + 100000)]);
  const row = await getLicense(env.DB, key); assert.equal(row.max_seconds, 0); assert.equal(row.pro_seconds, 900);
});

test('renewal after expiry preserves receipts, including a payment report whose response was lost', async () => {
  const env = { DB: new D1(), PASS_SESSION_SECRET: 'fixture-secret-longer-than-thirty-two-characters' }, now = Date.now();
  const key = await createLicense(env.DB, { proSeconds: 1000 }), session = await openPassSession(env, key, now);
  await billPassSession(env, key, session.token, 100, now);
  const later = now + 31 * 86400000;
  const renewed = await openPassSession(env, key, later, session.token);
  assert.equal(renewed.billed, 100);
  await billPassSession(env, key, renewed.token, 100, later);
  assert.equal((await getLicense(env.DB, key)).pro_seconds, 900);
  await billPassSession(env, key, renewed.token, 150, later);
  assert.equal((await getLicense(env.DB, key)).pro_seconds, 850);
});
