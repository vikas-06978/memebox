// Step 6: the feedback site in a real browser. The local server runs the real Pages
// Functions with the site's _headers (CSP). Turnstile is faked on both ends (no network).
import { test as base, expect } from '@playwright/test';
import { startSite } from '../../tools/site-dev.mjs';
import { TURNSTILE_VERIFY } from '../../site/src/security.js';

const ADMIN_KEY = 'test-admin-key-123';

const test = base.extend({
  site: [async ({}, use) => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      if (String(url) === TURNSTILE_VERIFY) return Response.json({ success: JSON.parse(init.body).response === 'fake-ok' });
      return realFetch(url, init);
    };
    const site = await startSite({ env: { TURNSTILE_SITE_KEY: 'fake-site-key', TURNSTILE_SECRET_KEY: 'fake-secret', ADMIN_KEY } });
    site.rows = async () => (await site.db.prepare('SELECT * FROM feedback ORDER BY created_at').all()).results;
    await use(site);
    await site.close();
    globalThis.fetch = realFetch;
  }, { scope: 'test' }],
  page: async ({ page }, use) => {
    // Stand-in for Cloudflare's Turnstile script: renders "invisibly" and hands out a token.
    await page.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({
      contentType: 'text/javascript',
      body: `window.turnstile = { render(el, o) { setTimeout(() => o.callback('fake-ok'), 50); return 'w1'; }, reset() {} };
             window.onMemeTurnstile && window.onMemeTurnstile();`,
    }));
    page.cspErrors = [];
    page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) page.cspErrors.push(m.text()); });
    await use(page);
  },
});
test.use({ channel: 'chromium' });

test('feedback form: rating, features, message; stored with only version and site from the link', async ({ page, site }) => {
  await page.goto(`${site.url}/feedback?v=0.6.0&site=meet`);
  await expect(page.locator('h1')).toHaveText('How is MemeBox for you?');
  await page.locator('input[name=rating][value="3"]').check({ force: true });
  await page.getByLabel('Clips').check();
  await page.getByLabel('Voice changer').check();
  await page.getByLabel('What should we add?').fill('More cricket lines');
  await page.getByLabel('Your message').fill('Loved the chipmunk voice');
  await page.waitForTimeout(150); // fake Turnstile token arrives
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.locator('#thanks')).toBeVisible();

  const [row] = await site.rows();
  expect(row).toMatchObject({ type: 'feedback', rating: 3, used: '["clips","voice-changer"]', wants: 'More cricket lines',
    message: 'Loved the chipmunk voice', email: '', version: '0.6.0', site: 'meet', lang: 'en' });
  expect(page.cspErrors).toEqual([]);
});

test('feedback form checks the rating and email before sending', async ({ page, site }) => {
  await page.goto(`${site.url}/feedback`);
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.locator('#error')).toHaveText('Please pick a rating.');
  await page.locator('input[name=rating][value="4"]').check({ force: true });
  await page.getByLabel(/Email/).fill('nope');
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.locator('#error')).toHaveText("That email doesn't look right.");
  expect(await site.rows()).toHaveLength(0);
});

test('odd link parameters are dropped, not sent', async ({ page, site }) => {
  await page.goto(`${site.url}/feedback?v=<script>&site=evil.com`);
  await page.locator('input[name=rating][value="4"]').check({ force: true });
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.locator('#thanks')).toBeVisible();
  const [row] = await site.rows();
  expect(row.version).toBe('');
  expect(row.site).toBe('');
});

test('feedback page in Hindi', async ({ page, site }) => {
  await page.goto(`${site.url}/feedback?lang=hi`);
  await expect(page.locator('h1')).toHaveText('MemeBox आपको कैसा लगा?');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
});

test('uninstall survey stores the reason with type "uninstall"', async ({ page, site }) => {
  const res = await page.goto(`${site.url}/uninstall?v=0.6.0`);
  expect(res.headers()['x-robots-tag']).toBe('noindex');
  await page.getByLabel('Too hard to use').check();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('#thanks')).toBeVisible();
  const [row] = await site.rows();
  expect(row).toMatchObject({ type: 'uninstall', reason: 'too-hard', version: '0.6.0', rating: null });
});

test('admin: wrong key refused; right key shows totals, requests and messages; CSV; sign out', async ({ page, site }) => {
  for (const [rating, wants, ip] of [[4, 'Dark mode', '10.0.0.1'], [4, 'dark mode', '10.0.0.2'], [1, '', '10.0.0.3']]) {
    const r = await fetch(`${site.url}/api/feedback`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify({ type: 'feedback', rating, wants, message: 'msg ' + rating, token: 'fake-ok' }),
    });
    expect(r.status).toBe(200);
  }

  const first = await page.goto(`${site.url}/admin`);
  expect(first.headers()['x-robots-tag']).toBe('noindex, nofollow');
  await page.getByLabel('Admin key').fill('wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.error')).toHaveText('Wrong key.');

  await page.getByLabel('Admin key').fill(ADMIN_KEY);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('h1')).toHaveText('MemeBox admin');
  await expect(page.getByText('3 answers in total')).toBeVisible();
  await expect(page.locator('.requests li').first()).toContainText('dark mode ×2');
  await expect(page.locator('tbody tr')).toHaveCount(3);

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download CSV' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^memebox-feedback-\d{4}-\d\d-\d\d\.csv$/);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByLabel('Admin key')).toBeVisible();
  expect(page.cspErrors).toEqual([]);
});
