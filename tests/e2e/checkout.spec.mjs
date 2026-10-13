import { test as base, expect } from '@playwright/test';
import { startSite } from '../../tools/site-dev.mjs';
import { hmacHex } from '../../site/src/security.js';
import { fulfillCaptured } from '../../site/src/gateway.js';

const test = base.extend({
  site: async ({}, use) => {
    const original = globalThis.fetch;
    const env = { RAZORPAY_MODE: 'test', RAZORPAY_KEY_ID: 'rzp_test_browser', RAZORPAY_KEY_SECRET: 'browser-fixture', RAZORPAY_WEBHOOK_SECRET: 'webhook-fixture', RAZORPAY_TEST_INTERNATIONAL: 'on' };
    let n = 0; const orders = new Map();
    globalThis.fetch = async (url, options) => {
      if (String(url) === 'https://api.razorpay.com/v1/orders') {
        const body = JSON.parse(options.body), id = 'order_fixture' + (++n);
        orders.set(id, body); return Response.json({ id, amount: body.amount, currency: body.currency });
      }
      if (String(url).startsWith('https://api.razorpay.com/v1/payments/pay_fixture')) {
        const id = String(url).split('/').pop(), orderId = id.replace('pay_', 'order_'), row = orders.get(orderId);
        return Response.json({ id, order_id: orderId, amount: row.amount, currency: row.currency, status: 'captured', captured: true });
      }
      return original(url, options);
    };
    const site = await startSite({ env });
    site.sign = id => hmacHex(env.RAZORPAY_KEY_SECRET, `${id}|${id.replace('order_', 'pay_')}`);
    site.capture = async id => {
      const row = orders.get(id);
      await fulfillCaptured({ ...env, DB: site.db }, { id: id.replace('order_', 'pay_'), order_id: id, amount: row.amount, currency: row.currency, status: 'captured', captured: true });
    };
    try { await use(site); } finally { await site.close(); globalThis.fetch = original; }
  },
});
test.use({ channel: 'chromium' });

async function sdk(page, site, dismiss = false) {
  await page.exposeFunction('fixtureSignature', site.sign);
  await page.route('https://checkout.razorpay.com/**', route => route.fulfill({ contentType: 'text/javascript', body: `
    window.Razorpay = class { constructor(options) { this.options = options; } on() {} async open() {
      window.fixtureCheckout = this.options;
      ${dismiss ? 'this.options.modal.ondismiss();' : `this.options.handler({ razorpay_payment_id: this.options.order_id.replace('order_', 'pay_'), razorpay_signature: await window.fixtureSignature(this.options.order_id) });`}
    } };` }));
}
test('test checkout verifies payment, displays the key, and recovers it after reload', async ({ page, site }) => {
  await sdk(page, site);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(site.url + '/buy');
  await expect(page.locator('#gateway-notice')).toBeVisible();
  await page.locator('[data-product="pass_pro_60"]').click();
  await expect(page.locator('#key-box')).toBeVisible();
  const key = await page.locator('#key').textContent();
  expect(key).toMatch(/^MBX-/);
  expect(await page.evaluate(() => window.fixtureCheckout.amount)).toBe(1500);
  expect(await page.evaluate(() => location.search + location.hash)).not.toContain('recovery');
  await page.reload();
  await expect(page.locator('#key')).toHaveText(key);
  expect(errors).toEqual([]);
});
test('dismissed checkout grants nothing; a later verified capture can be recovered', async ({ page, site }) => {
  await sdk(page, site, true);
  await page.goto(site.url + '/buy');
  await page.locator('[data-product="char_bunny"]').click();
  await expect(page.locator('#gateway-message')).toContainText('Checkout closed');
  await expect(page.locator('#key-box')).toBeHidden();
  const id = await page.evaluate(() => window.fixtureCheckout.order_id);
  await site.capture(id);
  await page.locator('#gateway-check').click();
  await expect(page.locator('#key-box')).toBeVisible();
});
test('explicit international test configuration uses server USD subunits', async ({ page, site }) => {
  await sdk(page, site);
  await page.goto(site.url + '/buy');
  await page.locator('#checkout-currency').selectOption('USD');
  await expect(page.locator('[data-product="pass_max_60"]')).toContainText('$3.49');
  await page.locator('[data-product="pass_max_60"]').click();
  await expect(page.locator('#key-box')).toBeVisible();
  expect(await page.evaluate(() => ({ currency: window.fixtureCheckout.currency, amount: window.fixtureCheckout.amount }))).toEqual({ currency: 'USD', amount: 349 });
});

test('USD pricing links retain currency through checkout', async ({ page, site }) => {
  await sdk(page, site);
  await page.goto(site.url + '/pricing?cur=usd');
  const buy = page.locator('#passes-max a.button').first();
  await expect(buy).toHaveAttribute('href', '/buy?product=pass_max_60&currency=USD');
  await buy.click();
  await expect(page.locator('#key-box')).toBeVisible();
  expect(await page.evaluate(() => window.fixtureCheckout.currency)).toBe('USD');
});

test('multiple purchases retain separate recovery receipts on this browser', async ({ page, site }) => {
  await sdk(page, site);
  await page.goto(site.url + '/buy');
  await page.locator('[data-product="pass_pro_60"]').click();
  await expect(page.locator('#key-box')).toBeVisible();
  const firstKey = await page.locator('#key').textContent();
  const firstOrder = await page.locator('#order-id').textContent();
  await page.locator('#gateway-new').click();
  await page.locator('[data-product="char_bunny"]').click();
  await expect(page.locator('#order-id')).not.toHaveText(firstOrder);
  await expect(page.locator('#key-box')).toBeVisible();
  await page.locator('#gateway-history').selectOption(firstOrder);
  await expect(page.locator('#key')).toHaveText(firstKey);
  await page.reload();
  await page.locator('#gateway-history').selectOption(firstOrder);
  await expect(page.locator('#key')).toHaveText(firstKey);
});
