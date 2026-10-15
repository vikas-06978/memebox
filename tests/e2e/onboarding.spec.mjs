// Step 8: welcome page after install (3 steps + mic test), and the "reload this tab" hint.
import { test, expect } from './fixtures.mjs';

test.describe('welcome page', () => {
  test('opens once after install with 3 steps; the mic test hears the (fake) mic', async ({ context, extensionId }) => {
    void extensionId;
    const page = context.welcome;
    expect(page, 'the welcome tab opened by itself').toBeTruthy();
    await expect(page.locator('h1')).toHaveText('Welcome to MemeBox 😂');
    await expect(page.locator('.steps > li')).toHaveCount(3);
    const video = page.locator('.tutorial video'); // the tutorial plays on the welcome page too
    await expect.poll(() => video.evaluate((v) => v.currentTime), { timeout: 15000 }).toBeGreaterThan(1);
    expect(await video.evaluate((v) => ({ paused: v.paused, muted: v.muted, h: v.videoHeight }))).toMatchObject({ paused: false, muted: true, h: 800 });
    await page.locator('#sound-on').click(); // Chrome only autoplays muted video: the button turns the sound on
    await expect(page.locator('#sound-on')).toBeHidden();
    await expect.poll(() => video.evaluate((v) => v.webkitAudioDecodedByteCount), { timeout: 15000 }).toBeGreaterThan(5000);
    await expect(page.locator('.steps svg')).toHaveCount(3);
    await page.locator('[data-tour-time="50"]').click();
    await expect.poll(() => video.evaluate(v => v.currentTime)).toBeGreaterThanOrEqual(50);
    await expect(page.locator('#feature-guide article')).toHaveCount(6);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'tests/.tmp/welcome-new-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.locator('#mic-start').click();
    await expect(page.locator('#mic-status')).toHaveText('✅ We hear you. Your mic works.', { timeout: 8000 });
    await page.locator('#mic-stop').click();
    await expect(page.locator('#mic-start')).toBeVisible();

    await page.locator('#hear').click();
    await expect(page.locator('#mic-status')).toHaveText(/^“.+”$/, { timeout: 15000 });
  });
});

test('Lets go opens the full studio and preserves saved settings', async ({ context, extensionId }) => {
  const page = context.welcome;
  const [sw] = context.serviceWorkers();
  const before = await sw.evaluate(() => chrome.storage.local.get(['lines', 'settings', 'license']));
  await page.locator('#close').click();
  await expect(page).toHaveURL(`chrome-extension://${extensionId}/playground.html`);
  await expect(page.locator('[data-character]')).toHaveCount(14);
  expect(await sw.evaluate(() => chrome.storage.local.get(['lines', 'settings', 'license']))).toEqual(before);
  expect((await sw.evaluate(() => chrome.storage.local.get('onboardingComplete'))).onboardingComplete).toBe(true);
});

test('updating an existing install preserves personal content, preferences and paid ownership', async ({ context, extensionId }) => {
  const [sw] = context.serviceWorkers();
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.evaluate(() => MemeDB.putClip({ id: 'upgrade-clip', name: 'Personal sound', type: 'audio/wav', bytes: new Uint8Array([1, 2, 3]).buffer }));
  const saved = await sw.evaluate(async () => {
    const value = { lines: [{ id: 'my-upgrade-line', kind: 'tts', text: 'Keep my line', lang: 'en', tone: 'normal', category: 'mine' }],
      settings: { ...MEME.defaultSettings(), theme: 'neon', volume: .7 },
      license: { key: 'MBX-TEST-TEST-TEST', status: 'active', proSeconds: 1234, maxSeconds: 5678, addons: [{ id: 'character:panda', until: 0 }], checkedAt: Date.now() },
      myMusic: [{ id: 'my-track', name: 'Keep my music' }], seeded: 2 };
    await chrome.storage.local.set(value);
    await initializeInstall({ reason: 'update' });
    return { before: value, after: await chrome.storage.local.get(Object.keys(value)) };
  });
  expect(saved.after).toEqual(saved.before);
  expect(await page.evaluate(async () => (await MemeDB.getClip('upgrade-clip')).name)).toBe('Personal sound');
});

// The "reload this tab" hint needs a call tab opened BEFORE the extension loaded, which
// Playwright can't create (the extension is there from the start). This checks the two
// things the hint relies on. The hint itself is in the manual test steps.
test('popup can read a call tab URL (host permission) and a running call tab answers the ping', async ({ context, extensionId }) => {
  await context.route('https://meet.google.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>call</title>' }));
  const call = await context.newPage();
  await call.goto('https://meet.google.com/old-tab');
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const res = await popup.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://meet.google.com/*' });
    const alive = await chrome.tabs.sendMessage(tab.id, { type: 'ping' }, { frameId: 0 }).catch(() => null);
    return { url: tab.url, alive };
  });
  expect(res.url).toBe('https://meet.google.com/old-tab'); // host permission lets the popup read the URL
  expect(res.alive).toEqual({ ok: true });                 // a normal call tab answers the ping
});

test('legacy media database gains picture storage without deleting saved audio', async ({ context, extensionId }) => {
  const [sw] = context.serviceWorkers();
  await sw.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('memebox', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('clips', { keyPath: 'id' });
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction('clips', 'readwrite');
      tx.objectStore('clips').put({ id: 'legacy-audio', name: 'My saved sound', type: 'audio/wav', bytes: new Uint8Array([4, 5, 6]).buffer });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }));
  const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/options.html`);
  const result = await page.evaluate(async () => {
    const clip = await MemeDB.getClip('legacy-audio');
    await MemeDB.putPicture({ id: 'upgrade-picture', name: 'New picture', type: 'image/webp', bytes: new Uint8Array([7]).buffer, width: 1, height: 1 });
    return { clip: clip.name, bytes: [...new Uint8Array(clip.bytes)], picture: (await MemeDB.getPicture('upgrade-picture')).name };
  });
  expect(result).toEqual({ clip: 'My saved sound', bytes: [4, 5, 6], picture: 'New picture' });
});
