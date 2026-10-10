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

    await page.locator('#mic-start').click();
    await expect(page.locator('#mic-status')).toHaveText('✅ We hear you. Your mic works.', { timeout: 8000 });
    await page.locator('#mic-stop').click();
    await expect(page.locator('#mic-start')).toBeVisible();

    await page.locator('#hear').click();
    await expect(page.locator('#mic-status')).toHaveText(/^“.+”$/, { timeout: 15000 });
  });
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
