// 1.2.0: color themes, 12 languages and the interactive try-it demo, in the extension and on the site.
import { test, expect } from './fixtures.mjs';
import { test as base, expect as expect2 } from '@playwright/test';
import { startSite } from '../../tools/site-dev.mjs';

test('Options: picking a color theme applies it to Options and to the on-call panel', async ({ context, extensionId, callPage }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.locator('#theme option')).toHaveCount(6);
  await page.locator('#theme').selectOption('neon');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'neon');
  // The panel's host element carries the theme (its closed shadow root reads it).
  await expect.poll(() => callPage.evaluate(() => {
    const host = [...document.documentElement.children].find((n) => n.dataset && n.dataset.theme);
    return host && host.dataset.theme;
  })).toBe('neon');
  // Remembered: a fresh page opens in the same theme.
  const again = await context.newPage();
  await again.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(again.locator('html')).toHaveAttribute('data-theme', 'neon');
});

test('Options: the language menu switches MemeBox to Hindi, then Arabic (right to left), then back to Auto', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.locator('#ui-lang option')).toHaveCount(13);
  await expect(page.locator('#ui-lang')).toHaveValue('auto');

  await Promise.all([page.waitForEvent('load'), page.locator('#ui-lang').selectOption('hi')]);
  await expect(page.locator('#feedback')).toHaveText('💬 फ़ीडबैक भेजें');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await expect(page.locator('#ui-lang')).toHaveValue('hi');
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator('#how summary')).toHaveText('यह कैसे काम करता है?');
  // The panel reads the same choice from storage.
  const pack = await page.evaluate(async () => (await chrome.storage.local.get('langPack')).langPack);
  expect(pack.code).toBe('hi');
  expect(pack.messages.btn_random).toBe('🎲 कोई भी');

  await Promise.all([page.waitForEvent('load'), page.locator('#ui-lang').selectOption('ar')]);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#feedback')).toHaveText('💬 أرسل رأيك');

  await Promise.all([page.waitForEvent('load'), page.locator('#ui-lang').selectOption('auto')]);
  await expect(page.locator('#feedback')).toHaveText('💬 Send feedback');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  expect(await page.evaluate(async () => (await chrome.storage.local.get('langPack')).langPack)).toBeUndefined();
});

test('welcome page swatches set the theme too', async ({ context, extensionId }) => {
  const page = context.welcome;
  void extensionId;
  await expect(page.locator('.swatch')).toHaveCount(6);
  await page.locator('.swatch[data-theme="candy"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'candy');
  await expect(page.locator('.swatch[data-theme="candy"]')).toHaveAttribute('aria-checked', 'true');
});

test.describe('extension in Arabic', () => {
  test.use({ extraArgs: ['--lang=ar'] });
  test('popup is in Arabic and laid out right to left', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.locator('#how summary')).toHaveText('كيف يعمل؟');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});

test.describe('extension in Spanish', () => {
  test.use({ extraArgs: ['--lang=es'] });
  test('Options is in Spanish', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await expect(page.locator('#feedback')).toHaveText('💬 Enviar comentarios');
  });
});

// ---------- website ----------

const siteTest = base.extend({
  site: async ({}, use) => {
    const site = await startSite({ env: { UPI_ID: 'memebox@upi' } });
    await use(site);
    await site.close();
  },
});
siteTest.use({ channel: 'chromium' });

siteTest('site: the colors menu switches theme and remembers it', async ({ page, site }) => {
  await page.goto(site.url + '/');
  const menu = page.locator('footer select.pref-theme');
  await expect2(menu.locator('option')).toHaveCount(6);
  await menu.selectOption('sunny');
  await expect2(page.locator('html')).toHaveAttribute('data-theme', 'sunny');
  await page.goto(site.url + '/feedback');
  await expect2(page.locator('html')).toHaveAttribute('data-theme', 'sunny');
});

siteTest('site: the language menu reloads the page in that language (Tamil), and Arabic is right to left', async ({ page, site }) => {
  await page.goto(site.url + '/');
  await expect2(page.locator('h1 .hl')).toHaveText('10× funnier');
  await page.locator('footer select.pref').first().selectOption('ta');
  await expect2(page.locator('h1 .hl')).toHaveText('10 மடங்கு வேடிக்கையாக');
  await expect2(page.locator('html')).toHaveAttribute('lang', 'ta');
  await page.goto(site.url + '/buy?lang=ar');
  await expect2(page.locator('h1')).toHaveText('احصل على المزيد من MemeBox');
  await expect2(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

siteTest('site: try-it soundboard plays, shows the caption, counts, and emoji burst out', async ({ page, site }) => {
  await page.goto(site.url + '/#try');
  await page.locator('.tone[data-tone="chipmunk"]').click();
  await expect2(page.locator('.tone[data-tone="chipmunk"]')).toHaveAttribute('aria-checked', 'true');
  await page.locator('.pad[data-sound="chai"]').click();
  await expect2(page.locator('#stage-caption')).toHaveText('Chai break!');
  await expect2(page.locator('#stage-caption')).toHaveClass(/show/);
  await expect2(page.locator('#try-count')).toHaveText('Memes played: 1 🎉');
  await expect2(page.locator('.fx-burst').first()).toBeAttached();
  await page.locator('.pad[data-sound="horn"]').click();
  await expect2(page.locator('#try-count')).toHaveText('Memes played: 2 🎉');
  // The demo voice really loaded (a WAV from the site).
  const ok = await page.evaluate(async () => (await fetch('/assets/demo/chai.wav')).headers.get('content-type'));
  expect2(ok).toBe('audio/wav');
});

siteTest('site: on a phone the language and colors menus are in the top bar', async ({ page, site }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(site.url + '/');
  await expect2(page.locator('header select.pref').first()).toBeVisible();
  await expect2(page.locator('header select.pref-theme')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect2(overflow).toBe(false);
});

siteTest('site: clicking a floating emoji bursts it', async ({ page, site }) => {
  await page.goto(site.url + '/');
  await page.locator('.float.f1').click({ force: true }); // it bobs forever, so it never "holds still" for Playwright
  await expect2(page.locator('.fx-burst').first()).toBeAttached();
});
