// "Follow me" finds your face with a small bundled model (runs on this computer): the bridge answers a camera frame with the face position,
// also on a page whose security policy forbids WebAssembly, and the tracker then follows the face instead of the skin colour.
import { test, expect } from './fixtures.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Pictures of a real face and real hands (MediaPipe's own sample pictures). Downloaded once into tests/.tmp, not kept in the repository.
function sample(name, url) {
  const file = path.resolve(import.meta.dirname, '..', '.tmp', name);
  if (!fs.existsSync(file)) { try { execFileSync('curl', ['-s', '--max-time', '60', '-o', file, url]); } catch { /* offline */ } }
  return fs.existsSync(file) && fs.statSync(file).size > 10000 ? fs.readFileSync(file).toString('base64') : null;
}
const PORTRAIT = sample('portrait.jpg', 'https://storage.googleapis.com/mediapipe-assets/portrait.jpg');
const HANDS = sample('hands.jpg', 'https://storage.googleapis.com/mediapipe-tasks/hand_landmarker/woman_hands.jpg');

// Sends one picture like the camera hook does (a 384 px wide frame) and returns the whole answer.
const ask = (page, src, at, withHands = false) => page.evaluate(async ({ src, at, withHands }) => {
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360;
  const g = cv.getContext('2d');
  g.fillStyle = '#556'; g.fillRect(0, 0, 640, 360);
  if (src) {
    const bin = atob(src), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const img = await createImageBitmap(new Blob([u], { type: 'image/jpeg' }));
    const h = 360, w = img.width * h / img.height;
    g.drawImage(img, at * 640 - w * 0.5, 0, w, h); // the picture is centred on `at` (0..1 across)
  }
  const bm = await createImageBitmap(cv, { resizeWidth: 384, resizeHeight: 216 });
  return await new Promise((resolve) => {
    const t = setTimeout(() => resolve('timeout'), 40000);
    const on = (e) => {
      const d = e.data;
      if (e.source === window && d && d.source === 'memebox-bridge-9c1e' && d.type === 'face-result') { clearTimeout(t); removeEventListener('message', on); resolve(d); }
    };
    addEventListener('message', on);
    window.postMessage({ source: 'memebox-hook-9c1e', type: 'face-frame', bitmap: bm, w: 384, h: 216, hands: withHands }, '*', [bm]);
  });
}, { src, at, withHands });

// The model follows a face from one picture to the next, so after a jump it may need one more look.
const look = async (page, src, at) => { let r; for (let i = 0; i < 4; i++) { r = await ask(page, src, at); if (r.face || !src) break; } return r; };

test.describe('the face and hand models', () => {
  test.skip(!PORTRAIT || !HANDS, 'the sample pictures could not be downloaded');
  test.setTimeout(120000);

  test('a real face: where it is (left, middle, right), how it looks, and nobody in an empty room', async ({ callPage }) => {
    const mid = await ask(callPage, PORTRAIT, 0.5);
    expect(typeof mid, JSON.stringify(mid)).toBe('object');
    expect(mid.face, 'a face').toBeTruthy();
    expect(Math.abs(mid.face.x - 0.5)).toBeLessThan(0.1);
    expect(mid.bs.smile, 'the sample face is smiling').toBeGreaterThan(0.5);
    expect(mid.bs.tongue, 'no tongue out').toBeLessThan(0.3);
    expect(mid.hands, 'hands were not asked for').toBeNull();
    expect((await look(callPage, PORTRAIT, 0.25)).face.x).toBeLessThan(0.35);
    expect((await look(callPage, PORTRAIT, 0.75)).face.x).toBeGreaterThan(0.65);
    const none = await ask(callPage, null, 0.5);
    expect(none.face, 'an empty room has no face').toBeNull();
  });

  test('real hands are found, and described (fingers out, open hand)', async ({ callPage }) => {
    const r = await ask(callPage, HANDS, 0.5, true);
    expect(Array.isArray(r.hands), JSON.stringify(r).slice(0, 300)).toBe(true);
    expect(r.hands.length).toBeGreaterThan(0);
    for (const h of r.hands) { expect(h.x).toBeGreaterThan(0); expect(h.x).toBeLessThan(1); expect(typeof h.open).toBe('boolean'); }
  });

  test('the page security policy cannot block the models (WebAssembly forbidden there)', async ({ context, callPage }) => {
    await callPage.close();
    const page = await context.newPage();
    await context.route('https://meet.google.com/**', (route) => route.fulfill({
      status: 200, contentType: 'text/html', headers: { 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'" }, body: '<!doctype html><body>call</body>',
    }));
    await page.goto('https://meet.google.com/xyz-abcd-efg');
    const r = await ask(page, PORTRAIT, 0.5);
    expect(typeof r, JSON.stringify(r)).toBe('object');
    expect(r.face, 'a face').toBeTruthy();
  });
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

test('the tracker reads how your face looks and what your hands do: tongue, kiss, wave, thumbs up, peace', async ({ page }) => {
  await page.setContent('<body></body>');
  await page.addScriptTag({ path: 'extension/lib/fx.js' });
  const r = await page.evaluate(() => {
    const R = MemeFx.createRenderer();
    const c = document.createElement('canvas'); c.width = 320; c.height = 180;
    c.getContext('2d').fillRect(0, 0, 320, 180);
    let now = 100000;
    const face = { x: 0.5, y: 0.4, w: 0.2, h: 0.3 };
    const bs = (o) => ({ blinkL: 0, blinkR: 0, jaw: 0, smile: 0, tongue: 0, brow: 0, pucker: 0, wide: 0, ...o });
    const answer = (o, hands) => { now += 110; R.ml = { at: now, face, bs: bs(o), hands: hands || null, handsAt: hands ? now : -1e9 }; return R.track(c, now); };
    const out = {};
    for (let i = 0; i < 3; i++) answer({});
    out.calm = { ...answer({}) };
    for (let i = 0; i < 3; i++) out.tongue = { ...answer({ tongue: 0.9 }) };
    out.tongueBack = { ...answer({}) };
    for (let i = 0; i < 5; i++) out.kiss = { ...answer({ pucker: 0.9 }) };
    for (let i = 0; i < 4; i++) answer({});
    out.blinkL = answer({ blinkL: 1, blinkR: 1 }).bs.blinkL;
    // a wave: an open hand swinging left and right
    const open = (x) => [{ x, y: 0.5, s: 0.2, n: 4, open: true, thumbUp: false, peace: false }];
    let w; for (const x of [0.4, 0.55, 0.4, 0.55, 0.4, 0.55, 0.4]) w = { ...answer({}, open(x)) };
    out.wave = w;
    return out;
  });
  expect(r.calm.tongue).toBe(false);
  expect(r.tongue.tongue, 'tongue out').toBe(true);
  expect(r.tongue.tongueAt).toBeGreaterThan(0);
  expect(r.tongueBack.tongue, 'tongue back in').toBe(false);
  expect(r.kiss.kissAt, 'a kiss').toBeGreaterThan(0);
  expect(r.blinkL, 'a blink is seen at once').toBeGreaterThan(0.8);
  expect(r.wave.waveAt, 'a wave of an open hand').toBeGreaterThan(0);
});

test('thumbs up and peace are noticed, and a closed hand is not a wave', async ({ page }) => {
  await page.setContent('<body></body>');
  await page.addScriptTag({ path: 'extension/lib/fx.js' });
  const r = await page.evaluate(() => {
    const mk = () => { const R = MemeFx.createRenderer(); return R; };
    const c = document.createElement('canvas'); c.width = 320; c.height = 180; c.getContext('2d').fillRect(0, 0, 320, 180);
    const face = { x: 0.5, y: 0.4, w: 0.2, h: 0.3 };
    const bs = { blinkL: 0, blinkR: 0, jaw: 0, smile: 0, tongue: 0, brow: 0, pucker: 0, wide: 0 };
    const hand = (o) => [{ x: 0.5, y: 0.5, s: 0.2, n: 0, open: false, thumbUp: false, peace: false, ...o }];
    const run = (R, hands, n) => { let now = 100000, T; for (let i = 0; i < n; i++) { now += 110; R.ml = { at: now, face, bs, hands: hands(i), handsAt: now }; T = R.track(c, now); } return { ...T }; };
    const a = run(mk(), () => hand({ thumbUp: true }), 4), b = run(mk(), () => hand({ peace: true, n: 2 }), 4);
    const c3 = run(mk(), (i) => hand({ x: i % 2 ? 0.4 : 0.55 }), 9); // a closed hand going left and right
    return { thumb: a.thumbAt, peace: b.peaceAt, wave: c3.waveAt };
  });
  expect(r.thumb).toBeGreaterThan(0);
  expect(r.peace).toBeGreaterThan(0);
  expect(r.wave, 'a closed hand is not a wave').toBeLessThan(0);
});
