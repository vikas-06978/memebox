// "Follow me" finds your face with a small bundled model (runs on this computer): the bridge answers a camera frame with the face position,
// also on a page whose security policy forbids WebAssembly, and the tracker then follows the face instead of the skin colour.
import { test, expect } from './fixtures.mjs';

const ask = (page, dx) => page.evaluate(async (dx) => {
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360;
  MemeFx.drawSample(cv.getContext('2d'), 640, 360, 1000, dx === null ? { visible: false } : { dx, dy: 0 });
  const bm = await createImageBitmap(cv, { resizeWidth: 256, resizeHeight: 144 });
  return await new Promise((resolve) => {
    const t = setTimeout(() => resolve('timeout'), 20000);
    const on = (e) => {
      const d = e.data;
      if (e.source === window && d && d.source === 'memebox-bridge-9c1e' && d.type === 'face-result') { clearTimeout(t); removeEventListener('message', on); resolve(d.face); }
    };
    addEventListener('message', on);
    window.postMessage({ source: 'memebox-hook-9c1e', type: 'face-frame', bitmap: bm, w: 256, h: 144 }, '*', [bm]);
  });
}, dx);

test('the face model answers with where the face is (left, right, nobody)', async ({ callPage }) => {
  const mid = await ask(callPage, 0);
  expect(typeof mid, JSON.stringify(mid)).toBe('object');
  expect(Math.abs(mid.x - 0.5)).toBeLessThan(0.1);
  const left = await ask(callPage, -0.3), right = await ask(callPage, 0.3);
  expect(left.x).toBeLessThan(0.3);
  expect(right.x).toBeGreaterThan(0.7);
  expect(await ask(callPage, null), 'an empty room has no face').toBeNull();
});

test('the page security policy cannot block it (WebAssembly forbidden there)', async ({ context, callPage }) => {
  await callPage.close();
  const page = await context.newPage();
  await context.route('https://meet.google.com/**', (route) => route.fulfill({
    status: 200, contentType: 'text/html', headers: { 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'" }, body: '<!doctype html><body>call</body>',
  }));
  await page.goto('https://meet.google.com/xyz-abcd-efg');
  const r = await ask(page, 0);
  expect(typeof r, JSON.stringify(r)).toBe('object');
  expect(r.x).toBeGreaterThan(0.3);
});

test('the tracker follows the face model: the face decides where you are, and when you are gone', async ({ page }) => {
  await page.setContent('<body></body>');
  await page.addScriptTag({ path: 'extension/lib/fx.js' });
  const r = await page.evaluate(() => {
    const R = MemeFx.createRenderer();
    const c = document.createElement('canvas'); c.width = 320; c.height = 180;
    const g = c.getContext('2d');
    let now = 100000;
    // a wall the colour of skin everywhere: the old skin tracker would be fooled, the face model is not
    g.fillStyle = '#d9a066'; g.fillRect(0, 0, 320, 180);
    const run = (ms, face) => { let T; for (let i = 0; i < ms / 62; i++) { R.ml = { at: now, face }; T = R.track(c, now); now += 62; } return { ...T }; };
    const out = {};
    out.centre = run(1200, { x: 0.5, y: 0.4 });
    out.left = run(1200, { x: 0.12, y: 0.4 });
    out.right = run(1200, { x: 0.88, y: 0.4 });
    out.gone = run(2200, null);
    out.back = run(1000, { x: 0.3, y: 0.4 });
    return out;
  });
  expect(r.centre.ml).toBe(true);
  expect(Math.abs(r.centre.x - 0.5)).toBeLessThan(0.05);
  expect(r.left.x, 'at the left edge').toBeLessThan(0.18);
  expect(r.right.x, 'at the right edge').toBeGreaterThan(0.82);
  expect(r.gone.present, 'no face for two seconds').toBe(false);
  expect(r.back.present).toBe(true);
  expect(r.back.enterAt).toBeGreaterThan(r.gone.exitAt);
});

test('with Follow me on, the camera hook sends frames to be searched for a face', async ({ context, callPage }) => {
  const [sw] = context.serviceWorkers();
  await sw.evaluate(async () => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...MEME.defaultSettings(), ...(settings || {}), fx: { armed: true, on: true, lamp: true, follow: true } } });
  });
  await callPage.evaluate(() => {
    window.frames_ = 0;
    addEventListener('message', (e) => { if (e.source === window && e.data && e.data.source === 'memebox-hook-9c1e' && e.data.type === 'face-frame') window.frames_++; });
  });
  await callPage.waitForTimeout(500);
  await callPage.evaluate(async () => {
    window.cam = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 }, audio: false });
    const v = document.createElement('video'); v.muted = true; v.srcObject = window.cam; document.body.append(v); await v.play();
  });
  await callPage.waitForTimeout(3500);
  expect(await callPage.evaluate(() => window.frames_)).toBeGreaterThan(3);
});
