import { test, expect } from './fixtures.mjs';
import { startSite } from '../../tools/site-dev.mjs';
import { createLicense, getLicense } from '../../site/src/shop.js';

test('extension retries a lost signed usage response without spending twice and retains offline debt', async ({ context }) => {
  const site = await startSite({ env: { PASS_SESSION_SECRET: 'browser-fixture-secret-more-than-thirty-two-characters' } });
  try {
    const key = await createLicense(site.db, { proSeconds: 1000 });
    const worker = context.serviceWorkers()[0];
    const results = await worker.evaluate(async ({ url, key }) => {
      const original = globalThis.fetch; let lose = true;
      globalThis.fetch = async (input, options) => {
        const local = new URL(input); const response = await original(url + local.pathname, options);
        if (local.pathname === '/api/pass-session' && JSON.parse(options.body).action === 'report' && lose) {
          lose = false; throw new Error('simulated lost response after server committed');
        }
        return response;
      };
      const license = { key, status: 'active', usageProtocol: 'signed-v1' };
      try {
        const lost = await reportPassTime(license, 100);
        const recovered = await reportPassTime(license, 150);
        const remaining = await reportPassTime(license, 50);
        return { lost, recovered, remaining, usage: (await chrome.storage.local.get('passUsage')).passUsage };
      } finally { globalThis.fetch = original; }
    }, { url: site.url, key });
    expect(results.lost).toBeNull();
    expect(results.recovered.acknowledged).toBe(100);
    expect(results.recovered.license.proSeconds).toBe(900);
    expect(results.remaining.license.proSeconds).toBe(850);
    expect(results.usage.acknowledged).toBe(150);
    expect((await getLicense(site.db, key)).pro_seconds).toBe(850);
  } finally { await site.close(); }
});

test('stopped pass debt is synchronized without starting a call or charging a different key', async ({ context }) => {
  const site = await startSite({ env: { PASS_SESSION_SECRET: 'browser-fixture-secret-more-than-thirty-two-characters' } });
  try {
    const key = await createLicense(site.db, { proSeconds: 1000 }), other = await createLicense(site.db, { proSeconds: 2000 });
    const worker = context.serviceWorkers()[0];
    const result = await worker.evaluate(async ({ url, key, other }) => {
      const original = globalThis.fetch;
      globalThis.fetch = (input, options) => original(url + new URL(input).pathname, options);
      try {
        await chrome.storage.local.set({ license: { key, status: 'active', proSeconds: 0, maxSeconds: 0, usageProtocol: 'signed-v1' }, pass: { on: false, unsynced: 1000, debtKey: key } });
        const synced = await flushPassDebt();
        const pass = (await chrome.storage.local.get('pass')).pass;
        await chrome.storage.local.set({ license: { key: other, status: 'active', proSeconds: 2000, maxSeconds: 0, usageProtocol: 'signed-v1' }, pass: { on: false, unsynced: 100, debtKey: key } });
        const mismatch = await flushPassDebt();
        return { synced, pass, mismatch };
      } finally { globalThis.fetch = original; }
    }, { url: site.url, key, other });
    expect(result.synced).toBe(true); expect(result.pass.unsynced).toBe(0); expect(result.pass.on).toBe(false);
    expect(result.mismatch).toBe(false);
    expect((await getLicense(site.db, key)).pro_seconds).toBe(0);
    expect((await getLicense(site.db, other)).pro_seconds).toBe(2000);
  } finally { await site.close(); }
});
