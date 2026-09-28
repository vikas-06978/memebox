// Step 5 – live voice changer, captions on my own camera, tab-sound volume, WAV / WhatsApp sharing.
import { test, expect } from './fixtures.mjs';
import fs from 'node:fs';

// A steady 200 Hz "voice" straight from the page (Chrome's noise suppression would slowly
// fade the fake device's constant tone and make the levels drift).
async function joined(page) {
  await page.evaluate(() => window.useSiteMic(0.2));
  await page.evaluate(() => window.joinCall());
  await page.waitForTimeout(500);
  await page.evaluate(() => window.noDuck());
}

const toHook = (page, msg) => page.evaluate((m) => window.postMessage({ source: 'memebox-bridge-9c1e', ...m }, '*'), msg);

async function settledHz(page) {
  await page.waitForTimeout(900);
  return page.evaluate(() => window.dominantHz());
}

test('Alt+V: my voice goes up in pitch (Chipmunk, AudioWorklet) and back to normal', async ({ callPage }) => {
  await joined(callPage);
  const plain = await settledHz(callPage);
  expect(Math.abs(plain - 200)).toBeLessThan(15); // the fake mic is a 200 Hz "voice"

  await callPage.mouse.click(700, 300);
  await callPage.keyboard.press('Alt+KeyV');
  await expect.poll(() => callPage.logs.some((l) => l.includes('voice changer: chipmunk'))).toBe(true);
  const chip = await settledHz(callPage);
  expect(Math.abs(chip - 320)).toBeLessThan(20); // 200 Hz × 1.6
  expect(callPage.logs.some((l) => l.includes('fallback pitch shifter'))).toBe(false); // the worklet loaded

  await callPage.keyboard.press('Alt+KeyV');
  await expect.poll(() => callPage.logs.some((l) => l.includes('voice changer: off'))).toBe(true);
  expect(Math.abs((await settledHz(callPage)) - 200)).toBeLessThan(15);
});

test('Deep lowers my voice; Robot, Echo and Radio keep it flowing; memes still mix in', async ({ callPage }) => {
  await joined(callPage);
  await toHook(callPage, { type: 'voice', value: 'deep' }); // no worklet URL here -> exercises the fallback
  expect(Math.abs((await settledHz(callPage)) - 144)).toBeLessThan(15); // 200 Hz × 0.72
  for (const fx of ['robot', 'echo', 'radio']) {
    await toHook(callPage, { type: 'voice', value: fx });
    await callPage.waitForTimeout(300);
    expect(await callPage.evaluate(() => window.peakOver(500)), fx).toBeGreaterThan(0.1);
  }
  const voiceOnly = await callPage.evaluate(() => window.peakOver(500));
  const beep = await callPage.evaluate(() => { window.beep(); return window.peakOver(900); });
  expect(beep - voiceOnly).toBeGreaterThan(0.25);
  await toHook(callPage, { type: 'voice', value: 'off' });
  expect(Math.abs((await settledHz(callPage)) - 200)).toBeLessThan(15);
});

test('camera captions: off by default; when on, my camera goes through a canvas that stops the real camera', async ({ context, callPage }) => {
  const plain = await callPage.evaluate(async () => {
    const s = await navigator.mediaDevices.getUserMedia({ video: true });
    const t = s.getVideoTracks()[0];
    const r = t.constructor.name;
    t.stop();
    return r;
  });
  expect(plain).not.toBe('CanvasCaptureMediaStreamTrack');

  const [sw] = context.serviceWorkers();
  await sw.evaluate(async () => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...settings, camCaptions: true } });
  });
  await callPage.waitForTimeout(300);

  const r = await callPage.evaluate(async () => {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 640, height: 480 } });
    const [a] = s.getAudioTracks();
    const [v] = s.getVideoTracks();
    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = new MediaStream([v]);
    await video.play();
    await new Promise((res) => setTimeout(res, 500));
    const out = { kind: v.constructor.name, label: v.label, w: video.videoWidth, h: video.videoHeight, audio: !!a };
    v.stop();
    out.stopped = v.readyState;
    return out;
  });
  expect(r.kind).toBe('CanvasCaptureMediaStreamTrack');
  expect(r.label).toBeTruthy(); // mirrors the real camera's label
  expect(r.w).toBeGreaterThan(0);
  expect(r.h).toBeGreaterThan(0);
  expect(r.audio).toBe(true);
  expect(r.stopped).toBe('ended');
  await expect.poll(() => callPage.logs.some((l) => l.includes('camera captions on'))).toBe(true);
});

test('tab-sound volume slider in the popup is saved (shared with the panel slider)', async ({ context, extensionId, callPage }) => {
  await joined(callPage);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.$eval('#vol', (el) => { el.value = '150'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect.poll(() => popup.evaluate(async () => (await chrome.storage.local.get('settings')).settings.tabVolume)).toBe(1.5);
  await expect(popup.locator('#vol-out')).toHaveText('150%');
});

test('options: save a line as a WAV file, and share its text on WhatsApp', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  const row = page.locator('#lines-body tr').first();
  await expect(row).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent('download'), row.getByRole('button', { name: '💾 WAV' }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.wav$/);
  const bytes = fs.readFileSync(await download.path());
  expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
  expect(bytes.subarray(8, 12).toString()).toBe('WAVE');
  expect(bytes.length).toBeGreaterThan(44 + 8000); // real speech, not an empty file

  await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'wa' }));
  const [wa] = await Promise.all([context.waitForEvent('page'), row.getByRole('button', { name: 'WhatsApp' }).click()]);
  await wa.waitForLoadState();
  const text = new URL(wa.url()).searchParams.get('text');
  expect(new URL(wa.url()).hostname).toBe('wa.me');
  expect(text).toContain('MemeBox');
  expect(text).toContain('https://memebox.pages.dev');
});
