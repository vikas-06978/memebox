// 1.1.0: bulk audio import, picture memes, the UPI buy page and license keys, end to end.
// The MemeBox site runs locally (real Pages Functions on SQLite) and stands in for
// https://memebox.pages.dev, so the extension talks to it exactly as it would online.
import { test as base, expect } from './fixtures.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { startSite } from '../../tools/site-dev.mjs';
import { makeSession } from '../../site/src/security.js';

const ADMIN_KEY = 'e2e-admin-key';
const ICON = fs.readFileSync(path.resolve('extension/icons/icon128.png'));

const test = base.extend({
  site: async ({ context }, use) => {
    const site = await startSite({ env: { ADMIN_KEY, RATE_SALT: 's', UPI_ID: 'memebox@upi', UPI_NAME: 'MemeBox' } });
    await context.route('https://memebox.pages.dev/**', async (route) => {
      const r = route.request();
      const u = new URL(r.url());
      const res = await fetch(site.url + u.pathname + u.search, {
        method: r.method(), headers: { ...r.headers(), 'cf-connecting-ip': '127.0.0.1' }, body: ['GET', 'HEAD'].includes(r.method()) ? undefined : r.postDataBuffer(),
        redirect: 'manual',
      });
      const headers = {};
      res.headers.forEach((v, k) => { headers[k] = v; });
      // Playwright doesn't route the request a redirect leads to, so it would reach the real,
      // live site. Redirect from the page instead: that new request is routed here again.
      // (Only the cookies are kept: the site's own headers include a CSP that would block this.)
      if (res.status >= 300 && res.status < 400 && headers.location) {
        const to = new URL(headers.location, r.url()).href;
        const cookie = headers['set-cookie'];
        await route.fulfill({
          status: 200, headers: { 'content-type': 'text/html', ...(cookie ? { 'set-cookie': cookie } : {}) },
          body: `<meta http-equiv="refresh" content="0;url=${to.replace(/"/g, '&quot;')}">`,
        });
        return;
      }
      await route.fulfill({ status: res.status, headers, body: Buffer.from(await res.arrayBuffer()) });
    });
    site.adminCookie = async () => ({ name: 'memebox_admin', value: await makeSession(ADMIN_KEY), url: 'https://memebox.pages.dev/admin' });
    await use(site);
    await site.close();
  },
});

// A short tone WAV, as a file to upload.
function wav(seconds, hz) {
  const sr = 16000, n = Math.round(sr * seconds), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * hz * i) / sr) * 12000), 44 + i * 2);
  return b;
}

async function openOptions(context, extensionId) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.locator('#lines-body tr').first()).toBeVisible();
  page.store = (keys) => page.evaluate((k) => chrome.storage.local.get(k), keys);
  return page;
}

test('import many audio files at once: each good file becomes a clip, the rest are listed as skipped', async ({ context, extensionId }) => {
  const page = await openOptions(context, extensionId);
  const before = (await page.store('lines')).lines.length;
  await page.setInputFiles('#bulk-files', [
    { name: 'air-horn.wav', mimeType: 'audio/wav', buffer: wav(1, 440) },
    { name: 'sad_trombone.wav', mimeType: 'audio/wav', buffer: wav(1.5, 220) },
    { name: 'drum-roll.wav', mimeType: 'audio/wav', buffer: wav(0.5, 330) },
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not audio') },
  ]);
  await expect(page.locator('#bulk-status')).toHaveText('Added 3 clips. Skipped 1. Skipped: notes.txt', { timeout: 15000 });
  const { lines } = await page.store('lines');
  expect(lines.length).toBe(before + 3);
  const added = lines.slice(-3);
  expect(added.map((l) => l.text)).toEqual(['air horn', 'sad trombone', 'drum roll']);
  for (const l of added) expect(l).toMatchObject({ kind: 'clip', category: 'clips' });
  const clips = await page.evaluate(async () => (await MemeDB.listClips()).map((c) => ({ type: c.type, size: c.bytes.byteLength })));
  expect(clips.filter((c) => c.type === 'audio/wav')).toHaveLength(3);
});

test.describe('free plan (no key)', () => {
  test.use({ pro: false });
  test('bulk import and the voice changer say they are Pro features', async ({ context, extensionId, callPage }) => {
    const page = await openOptions(context, extensionId);
    const before = (await page.store('lines')).lines.length;
    await page.setInputFiles('#bulk-files', [{ name: 'air-horn.wav', mimeType: 'audio/wav', buffer: wav(1, 440) }]);
    await expect(page.locator('#toast')).toHaveText('This is a MemeBox Pro feature.');
    expect((await page.store('lines')).lines.length).toBe(before);

    await callPage.bringToFront();
    await callPage.mouse.click(700, 300);
    await callPage.keyboard.press('Alt+KeyV');
    await callPage.waitForTimeout(1000);
    expect(callPage.logs.some((l) => l.includes('voice changer: chipmunk'))).toBe(false);
  });
});

test('picture meme: add a picture to a line; playing it shows the picture on my camera', async ({ context, extensionId, callPage }) => {
  const page = await openOptions(context, extensionId);
  const picture = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d'); g.fillStyle = '#ff00b4'; g.fillRect(0, 0, 128, 128);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  // The first line ("Bhai tu rehne de") is on Alt+1. (The list shows English by default in an English browser: pick all languages.)
  await page.selectOption('#lines-lang', '');
  await page.locator('#lines-body tr').first().getByRole('button', { name: 'Edit' }).click();
  await page.setInputFiles('#line-pic', { name: 'picture.png', mimeType: 'image/png', buffer: Buffer.from(picture, 'base64') });
  await expect(page.locator('#line-pic-preview')).toBeVisible();
  await page.locator('#line-submit').click();
  await expect(page.locator('#toast')).toHaveText('Line saved');
  const { lines } = await page.store('lines');
  const line = lines.find((l) => l.fav === 1);
  expect(line.pictureId).toMatch(/^p-/);
  const pic = await page.evaluate(async (id) => { const p = await MemeDB.getPicture(id); return { type: p.type, size: p.bytes.byteLength, w: p.width }; }, line.pictureId);
  expect(pic.type).toBe('image/webp');
  expect(pic.size).toBeLessThan(300 * 1024);
  expect(pic.w).toBe(128);
  await expect(page.locator('#lines-body tr').first().locator('.tag', { hasText: '🖼' })).toBeVisible();

  // Camera captions on, join with camera, play Alt+1.
  const [sw] = context.serviceWorkers();
  await sw.evaluate(async () => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...settings, camCaptions: true } });
  });
  await callPage.waitForTimeout(300);
  await callPage.evaluate(async () => { window.s = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }); await window.measure(window.s); });
  await callPage.waitForTimeout(600);
  await callPage.mouse.click(700, 300);
  await callPage.keyboard.press('Alt+Digit1');
  await expect.poll(() => callPage.logs.some((l) => l.includes('meme picture ready 128x128')), { timeout: 10000 }).toBe(true);

  // Inspect the outgoing stream, not only a log or the sender's local overlay.
  await callPage.evaluate(async () => {
    const video = document.createElement('video'); video.muted = true; video.srcObject = window.s; await video.play();
    window.pictureFraction = () => {
      const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 120;
      const g = canvas.getContext('2d'); g.drawImage(video, 0, 0, 160, 120);
      const pixels = g.getImageData(0, 0, 160, 120).data;
      let pink = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 200 && pixels[i + 1] < 60 && pixels[i + 2] > 130) pink++;
      return pink / (160 * 120);
    };
  });
  await expect.poll(() => callPage.evaluate(() => pictureFraction())).toBeGreaterThan(0.2);
  await callPage.waitForTimeout(3500);
  expect(await callPage.evaluate(() => pictureFraction())).toBeGreaterThan(0.2);
  // A sound without a picture must not remove the pinned picture.
  await callPage.evaluate(() => window.beep());
  await callPage.waitForTimeout(300);
  expect(await callPage.evaluate(() => pictureFraction())).toBeGreaterThan(0.2);
  await callPage.keyboard.press('Escape');
  await expect.poll(() => callPage.evaluate(() => pictureFraction())).toBeLessThan(0.05);
  await callPage.keyboard.press('Alt+Digit1');
  await expect.poll(() => callPage.evaluate(() => pictureFraction())).toBeGreaterThan(0.2);
  await callPage.keyboard.press('Alt+Digit0');
  await expect.poll(() => callPage.evaluate(() => pictureFraction())).toBeLessThan(0.05);

  // Removing the picture deletes it once no line uses it.
  await page.locator('#lines-body tr').first().getByRole('button', { name: 'Edit' }).click();
  await page.locator('#line-pic-remove').click();
  await page.locator('#line-submit').click();
  await expect.poll(() => page.evaluate(async (id) => !!(await MemeDB.getPicture(id)), line.pictureId)).toBe(false);
});

test('buy page: QR for memebox@upi with the amount and order note; UTR; admin approves; the key appears', async ({ context, site }) => {
  const buyer = await context.newPage();
  await buyer.goto('https://memebox.pages.dev/buy');
  await expect(buyer.locator('.product')).toHaveCount(16);
  await expect(buyer.locator('.product.best')).toHaveCount(3);
  await buyer.locator('button[data-product="pass_pro_60"]').click();
  await expect(buyer.locator('#pay')).toBeVisible();
  const qrText = await buyer.locator('#qr').getAttribute('data-text');
  const orderId = new URL(buyer.url()).searchParams.get('order');
  expect(qrText).toBe(`upi://pay?pa=memebox@upi&pn=MemeBox&am=15.00&cu=INR&tn=MemeBox%20${orderId}`);
  expect(await buyer.locator('#upi-link').getAttribute('href')).toBe(qrText);
  await expect(buyer.locator('#note')).toHaveText(`MemeBox ${orderId}`);
  // The QR really is drawn (dark modules on the canvas).
  const dark = await buyer.locator('#qr').evaluate((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 50) n++; return n;
  });
  expect(dark).toBeGreaterThan(5000);

  await buyer.locator('#utr').fill('123');
  await buyer.getByRole('button', { name: "I've paid" }).click();
  await expect(buyer.locator('#error')).toContainText('12 digits');
  await buyer.locator('#utr').fill('412345678901');
  await buyer.getByRole('button', { name: "I've paid" }).click();
  await expect(buyer.locator('#status-title')).toHaveText('Thanks! Checking your payment ⏳');

  // The admin approves it on /admin.
  await context.addCookies([await site.adminCookie()]);
  const admin = await context.newPage();
  await admin.goto('https://memebox.pages.dev/admin');
  await expect(admin.getByText('Payments waiting for you (1)')).toBeVisible();
  await admin.getByRole('button', { name: 'Approve' }).click();
  await expect(admin.locator('.notice')).toContainText(`Order ${orderId} approved`);
  await expect(admin.getByText('Earned so far: ₹15 from 1 approved order.')).toBeVisible();

  await buyer.reload();
  await expect(buyer.locator('#status-title')).toHaveText('Payment confirmed 🎉');
  await expect(buyer.locator('#key')).toHaveText(/^MBX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
});

test('pricing page: rupees in India mode with Buy links to /buy, dollars elsewhere with a note instead of Buy buttons', async ({ context, site }) => {
  const page = await context.newPage();
  await page.goto('https://memebox.pages.dev/pricing?cur=inr');
  await expect(page.locator('h1')).toHaveText('Plans and prices');
  await expect(page.locator('.pass')).toHaveCount(7);
  await expect(page.locator('.char-card')).toHaveCount(9);
  await expect(page.locator('#passes-pro .pass-price')).toHaveText(['₹9', '₹15', '₹25', '₹49']);
  await expect(page.locator('#passes-max .pass-price')).toHaveText(['₹25', '₹49', '₹99']);
  await expect(page.locator('#passes-max a.button').nth(1)).toHaveAttribute('href', '/buy?product=pass_max_180');
  await expect(page.locator('.char-card .pass-price').first()).toHaveText('₹29');
  await expect(page.locator('.char-card.all .pass-price')).toHaveText('₹199');
  await expect(page.locator('#usd-note')).toBeHidden();
  await page.screenshot({ path: 'tests/.tmp/pricing-inr.png', fullPage: true });

  await page.locator('.seg-btn[data-cur="usd"]').click();
  await expect(page.locator('#passes-pro .pass-price')).toHaveText(['$1.49', '$2.49', '$3.99', '$7.99']);
  await expect(page.locator('#passes-max .pass-price')).toHaveText(['$3.49', '$6.49', '$14.99']);
  await expect(page.locator('.char-card .pass-price').first()).toHaveText('$0.99');
  await expect(page.locator('.pass a.button')).toHaveCount(0);
  await expect(page.locator('#usd-note')).toBeVisible();
  await page.screenshot({ path: 'tests/.tmp/pricing-usd.png', fullPage: true });

  // "Buy" goes straight to the payment step for that pass.
  await page.goto('https://memebox.pages.dev/pricing?cur=inr');
  await page.locator('#passes-pro a.button').nth(2).click();
  await expect(page.locator('#pay')).toBeVisible();
  await expect(page.locator('#amount')).toHaveText('₹25');
});

test('owner key from /admin activates in Options; turning it off in /admin is picked up', async ({ context, extensionId, site }) => {
  await context.addCookies([await site.adminCookie()]);
  const admin = await context.newPage();
  await admin.goto('https://memebox.pages.dev/admin#licenses');
  await admin.locator('select[name=kind]').selectOption('owner');
  await admin.locator('input[name=note]').fill('my laptop');
  await admin.getByRole('button', { name: 'Make a key' }).click();
  const key = (await admin.locator('.notice code').textContent()).trim();
  expect(key).toMatch(/^MBX-/);

  const page = await openOptions(context, extensionId);
  await page.locator('#license-key').fill(key.toLowerCase());
  await page.getByRole('button', { name: 'Activate' }).click();
  await expect(page.locator('#pro-status')).toContainText(`Key ${key}: unlimited Pro Max.`);
  const { license } = await page.store('license');
  expect(license).toMatchObject({ key, status: 'active', unlimited: true });

  // Turn it off in /admin, then check again from Options.
  await admin.goto('https://memebox.pages.dev/admin#licenses');
  await admin.getByRole('button', { name: 'Turn off' }).click();
  await page.locator('#license-key').fill(key);
  await page.getByRole('button', { name: 'Activate' }).click();
  await expect(page.locator('#pro-status')).toContainText(`The key ${key} was turned off.`);

  await page.locator('#license-key').fill('MBX-AAAA-BBBB-CCCC');
  await page.getByRole('button', { name: 'Activate' }).click();
  await expect(page.locator('#toast')).toHaveText('Unknown key.');
});
