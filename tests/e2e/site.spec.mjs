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
    const site = await startSite({ env: { TURNSTILE_SITE_KEY: 'fake-site-key', TURNSTILE_SECRET_KEY: 'fake-secret', ADMIN_KEY, HOSTED_AUDIO_ENABLED: 'on' } });
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

  await expect(page.locator('#thanks .did li')).toHaveCount(3); // what is coming, so people see their answers matter
  await expect(page.locator('#thanks')).toContainText('we will read it');
  await page.screenshot({ path: 'tests/.tmp/feedback-thanks.png' });

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

  // The dashboard is interactive (admin.js): search, filters, clickable bars, ticks, 7/14/30 days.
  await expect(page.locator('#m-count')).toHaveText('3 of 3');
  await page.locator('#m-q').fill('msg 1');
  await expect(page.locator('#messages tbody tr:visible')).toHaveCount(1);
  await page.locator('#m-clear').click();
  await expect(page.locator('#messages tbody tr:visible')).toHaveCount(3);
  await page.locator('li[data-pick="rating:4"]').click(); // a bar filters the table
  await expect(page.locator('#messages tbody tr:visible')).toHaveCount(2);
  await page.locator('#m-clear').click();
  await page.locator('#messages tbody tr').first().locator('input.done').check();
  await page.locator('#m-hide-done').check();
  await expect(page.locator('#messages tbody tr:visible')).toHaveCount(2);
  await page.locator('#m-hide-done').uncheck();
  const before = await page.locator('.chartbox').first().locator('rect').count();
  await page.locator('#range button[data-days="7"]').click();
  expect(await page.locator('.chartbox').first().locator('rect').count()).toBe(7);
  expect(before).toBe(30);
  await page.screenshot({ path: 'tests/.tmp/admin-dashboard.png', fullPage: true });

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download CSV' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^memebox-feedback-\d{4}-\d\d-\d\d\.csv$/);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByLabel('Admin key')).toBeVisible();
  expect(page.cspErrors).toEqual([]);
});

test('uninstall survey and feedback form can say where and on which device; the link pre-selects the browser version', async ({ page, site }) => {
  await page.goto(`${site.url}/uninstall?v=1.2.3`);
  await page.locator('input[name=reason][value="didnt-work"]').check({ force: true });
  await page.locator('select[name=platform]').selectOption('zoom-app');
  await page.locator('select[name=device]').selectOption('chromebook');
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('#thanks')).toBeVisible();

  await page.goto(`${site.url}/feedback?v=1.2.3&site=teams`);
  await expect(page.locator('select[name=platform]')).toHaveValue('teams-web'); // the extension only runs in the browser
  await page.locator('input[name=rating][value="4"]').check({ force: true });
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.locator('#thanks')).toBeVisible();

  const rows = await site.rows();
  expect(rows[0]).toMatchObject({ type: 'uninstall', reason: 'didnt-work', platform: 'zoom-app', device: 'chromebook' });
  expect(rows[1]).toMatchObject({ type: 'feedback', platform: 'teams-web', device: '' });
  expect(page.cspErrors).toEqual([]);
});

test('the new questions are translated (Hindi) and the admin page shows the answers and the Pro count', async ({ page, site }) => {
  await page.goto(`${site.url}/uninstall?lang=hi`);
  await expect(page.locator('label.field', { hasText: 'आपने MemeBox कहाँ इस्तेमाल किया?' })).toBeVisible();
  await expect(page.locator('select[name=platform] option[value="zoom-app"]')).toHaveText('Zoom (डेस्कटॉप ऐप)');

  await site.db.prepare("INSERT INTO feedback (id, created_at, type, reason, platform, device, version) VALUES ('a', '2026-10-07T01:00:00Z', 'uninstall', 'didnt-work', 'zoom-app', 'chromebook', '1.2.2')").run();
  await page.goto(`${site.url}/admin`);
  await page.locator('input[name=key]').fill(ADMIN_KEY);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Where they used it' })).toBeVisible();
  await expect(page.locator('section', { has: page.getByRole('heading', { name: 'Where they used it' }) }).locator('li', { hasText: 'Zoom (desktop app)' })).toContainText('1');
  await expect(page.getByRole('heading', { name: 'Which device' })).toBeVisible();
  await expect(page.getByText(/Pro users:/)).toBeVisible();
});

test('landing page: the tutorial video autoplays muted, loops, has controls, and the page CSP allows it', async ({ page, site }) => {
  await page.goto(site.url + '/');
  const video = page.locator('.frame video');
  await expect(video).toHaveCount(1);
  await expect(video).toHaveAttribute('muted', '');
  await expect(video).toHaveAttribute('loop', '');
  await expect(video).toHaveAttribute('controls', '');
  await expect.poll(() => video.evaluate((v) => v.currentTime), { timeout: 15000 }).toBeGreaterThan(1);
  expect(await video.evaluate((v) => ({ paused: v.paused, muted: v.muted, h: v.videoHeight, d: v.duration }))).toMatchObject({ paused: false, muted: true, h: 800 });
  // The button turns the sound on, restarts the video, and the audio track really decodes.
  await page.locator('.soundon').click();
  await expect(page.locator('.soundon')).toBeHidden();
  await expect.poll(() => video.evaluate((v) => v.muted)).toBe(false);
  await expect.poll(() => video.evaluate((v) => v.webkitAudioDecodedByteCount), { timeout: 15000 }).toBeGreaterThan(5000);
  await page.screenshot({ path: 'tests/.tmp/landing-hero.png' });
  expect(page.cspErrors).toEqual([]);
});

test('landing page in Hindi has the same tutorial video', async ({ page, site }) => {
  await page.goto(site.url + '/hi/');
  await expect(page.locator('.frame video source')).toHaveCount(2);
});

test('admin packs: make a pack, upload music with a licence, add India memes with strong language, publish, and the app catalogue shows them', async ({ page, site }) => {
  await page.goto(`${site.url}/admin`);
  await page.getByLabel('Admin key').fill(ADMIN_KEY);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: 'Music & meme packs' }).click();
  await expect(page.locator('h1')).toHaveText('Music & meme packs');
  await expect(page.getByText('licensed to you in writing')).toBeVisible();

  await page.getByLabel('Name', { exact: true }).fill('Phonk starter pack');
  await page.getByRole('button', { name: 'Make the pack' }).click();
  await expect(page.locator('h1')).toHaveText('Phonk starter pack');

  const wav = Buffer.concat([Buffer.from('RIFF$\0\0\0WAVEfmt \x10\0\0\0\x01\0\x01\0\x40\x1f\0\0\x80\x3e\0\0\x02\0\x10\0data\0\0\0\0', 'binary')]);
  await page.locator('input[name=files]').setInputFiles([{ name: 'drift night.wav', mimeType: 'audio/wav', buffer: wav }]);
  await page.locator('form:has(input[name=files]) input[name=cleared]').check();
  await page.locator('form:has(input[name=files]) input[name=licenceNote]').fill('made by me');
  await page.locator('form:has(input[name=files]) button[type=submit]').click();
  await expect(page.locator('.notice').first()).toContainText('1 file uploaded');
  await expect(page.locator('audio')).toHaveCount(1);
  await expect(page.locator('input[name=title][value="drift night"]')).toBeVisible();

  // publish the pack
  await page.locator('form:has(input[value=pack-update]) select[name=status]').selectOption('live');
  await page.locator('form:has(input[value=pack-update]) button[type=submit]').click();

  // India memes
  await page.getByRole('link', { name: 'All packs' }).click();
  await page.getByLabel('Name', { exact: true }).fill('India memes');
  await page.getByLabel('Type').selectOption('memes');
  await page.getByLabel('For').selectOption('in');
  await page.getByRole('button', { name: 'Make the pack' }).click();
  await page.locator('textarea[name=lines]').fill('Bhai tu rehne de | hinglish\nkadak line | hi | strong');
  await page.locator('form:has(textarea[name=lines]) input[name=cleared]').check();
  await page.locator('form:has(textarea[name=lines]) input[name=licenceNote]').fill('written by me');
  await page.locator('form:has(textarea[name=lines]) button[type=submit]').click();
  await expect(page.locator('.notice').first()).toContainText('2 memes added');
  await page.locator('form:has(input[value=pack-update]) select[name=status]').selectOption('live');
  await page.locator('form:has(input[value=pack-update]) button[type=submit]').click();
  await page.screenshot({ path: 'tests/.tmp/admin-packs.png', fullPage: true });

  const catalog = await (await fetch(`${site.url}/api/packs`)).json();
  expect(catalog.packs.map((p) => p.id).sort()).toEqual(['india-memes', 'phonk-starter-pack']);
  const india = catalog.packs.find((p) => p.id === 'india-memes');
  expect(india.region).toBe('in');
  expect(india.items.map((i) => [i.text, i.explicit])).toEqual([['Bhai tu rehne de', false], ['kadak line', true]]);
  const music = catalog.packs.find((p) => p.id === 'phonk-starter-pack');
  const file = await fetch(`${site.url}/api/pack-file?item=${music.items[0].id}`);
  expect(file.status).toBe(200);
  expect(file.headers.get('content-type')).toBe('audio/wav');
  expect(page.cspErrors).toEqual([]);
});
