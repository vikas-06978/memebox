// Lights & looks on the camera you send: the real camera (a fake one here) goes through the pipeline and
// comes out with the lamp, the light and the filter, live, without restarting the camera.
import { test, expect } from './fixtures.mjs';
import fs from 'node:fs';

async function setFx(context, fx) {
  const [sw] = context.serviceWorkers();
  await sw.evaluate(async (fx) => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...MEME.defaultSettings(), ...(settings || {}), fx } });
  }, fx);
  await new Promise((r) => setTimeout(r, 400)); // the bridge passes it on to the page
}

const helpers = () => {
  window.openCam = async () => {
    window.cam = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 }, audio: false });
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.srcObject = window.cam;
    document.body.append(v);
    await v.play();
    window.camVideo = v;
    return window.cam.getVideoTracks()[0].label;
  };
  // Average colour of a rectangle (fractions of the frame) of what the call would send.
  window.avg = (x0, y0, x1, y1) => {
    const v = window.camVideo, c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(v, 0, 0);
    const d = g.getImageData(Math.floor(x0 * c.width), Math.floor(y0 * c.height), Math.max(1, Math.floor((x1 - x0) * c.width)), Math.max(1, Math.floor((y1 - y0) * c.height))).data;
    let r = 0, gg = 0, b = 0, n = 0, grey = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; grey = Math.max(grey, Math.abs(d[i] - d[i + 1]), Math.abs(d[i + 1] - d[i + 2])); }
    return { r: r / n, g: gg / n, b: b / n, lum: (r + gg + b) / (3 * n), spread: grey, w: c.width, h: c.height };
  };
  window.png = () => {
    const v = window.camVideo, c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    return c.toDataURL('image/png');
  };
};

test('a filter changes the camera picture live, and nothing changes when everything is off', async ({ context, callPage }) => {
  await callPage.evaluate(helpers);
  await setFx(context, { armed: true }); // prepared, but nothing switched on
  await callPage.evaluate(() => window.openCam());
  await callPage.waitForTimeout(700);
  const plain = await callPage.evaluate(() => window.avg(0.1, 0.1, 0.9, 0.9));
  expect(plain.w).toBe(640);
  expect(plain.spread, 'the fake camera is coloured').toBeGreaterThan(40);

  await setFx(context, { armed: true, filter: 'bw' });
  await callPage.waitForTimeout(700);
  const grey = await callPage.evaluate(() => window.avg(0.1, 0.1, 0.9, 0.9));
  expect(grey.spread, 'black and white: no colour left').toBeLessThan(10);

  await setFx(context, { armed: true, filter: 'none' });
  await callPage.waitForTimeout(700);
  const back = await callPage.evaluate(() => window.avg(0.1, 0.1, 0.9, 0.9));
  expect(back.spread).toBeGreaterThan(40);
});

test('Lights draw the lamp and light on the camera you send, and switching them on needs no camera restart', async ({ context, callPage }, testInfo) => {
  await callPage.evaluate(helpers);
  await setFx(context, { armed: true });
  await callPage.evaluate(() => window.openCam());
  await callPage.waitForTimeout(700);
  const before = await callPage.evaluate(() => ({ top: window.avg(0.44, 0.15, 0.56, 0.24), mid: window.avg(0.3, 0.45, 0.7, 0.9), edge: window.avg(0, 0.4, 0.08, 0.6) }));

  await setFx(context, { armed: true, on: true, lampAnim: 'still', color: 'warm', focus: true });
  await callPage.waitForTimeout(1200);
  const after = await callPage.evaluate(() => ({ top: window.avg(0.44, 0.15, 0.56, 0.24), mid: window.avg(0.3, 0.45, 0.7, 0.9), edge: window.avg(0, 0.4, 0.08, 0.6) }));
  fs.writeFileSync(testInfo.outputPath('lights-on.png'), Buffer.from((await callPage.evaluate(() => window.png())).split(',')[1], 'base64'));
  fs.mkdirSync('tests/.tmp', { recursive: true });
  fs.copyFileSync(testInfo.outputPath('lights-on.png'), 'tests/.tmp/lights-on.png');

  expect(after.top.b, 'the lamp shade (bluish metal) is where the plain camera was green').toBeGreaterThan(before.top.b + 25);
  expect(after.edge.lum, 'the edges are darker (focus on you)').toBeLessThan(before.edge.lum);
  expect(after.mid.r, 'warm light on you adds red').toBeGreaterThan(before.mid.r + 15);
});

test('a free person cannot send Pro looks: locked corner lights, a drop animation and a paid filter fall back to the free look', async ({ context, callPage }) => {
  // The fixtures give a Pro key. Without one (and Pro switched on in config.js) only the free choices are sent.
  const [sw] = context.serviceWorkers();
  await sw.evaluate(() => chrome.storage.local.remove('license'));
  await callPage.evaluate(helpers);
  await setFx(context, { armed: true, on: true, corners: true, pattern: 'disco', color: 'rose', lampAnim: 'drop', sync: true, filter: 'neon' });
  await callPage.evaluate(() => window.openCam());
  await callPage.waitForTimeout(900); // a drop would still be high above the frame; the free still lamp is already there
  const corner = await callPage.evaluate(() => window.avg(0, 0.88, 0.1, 1)); // bottom-left: a coloured corner light would add red here
  const shade = await callPage.evaluate(() => window.avg(0.44, 0.15, 0.56, 0.24));
  expect(corner.r, 'no rose corner light for a free person').toBeLessThan(40);
  expect(shade.b, 'the free lamp hangs still, already in place').toBeGreaterThan(25);

  // With a Pro key the same settings are allowed: the corner light shows.
  await sw.evaluate(() => chrome.storage.local.set({ license: { key: 'MBX-TEST-TEST-TEST', status: 'active', unlimited: true, pictureSlots: 0, checkedAt: Date.now() } }));
  await callPage.waitForTimeout(1500);
  const proCorner = await callPage.evaluate(() => window.avg(0, 0.88, 0.1, 1));
  expect(proCorner.r, 'the rose corner light for Pro').toBeGreaterThan(corner.r + 25);
});

test('a character (cat) sits in the corner for Pro, not for a free person', async ({ context, callPage }) => {
  const [sw] = context.serviceWorkers();
  await sw.evaluate(() => chrome.storage.local.remove('license'));
  await callPage.evaluate(helpers);
  await setFx(context, { armed: true, on: true, lamp: false, focus: false, character: 'cat', charPos: 'right' });
  await callPage.evaluate(() => window.openCam());
  await callPage.waitForTimeout(1800);
  const free = await callPage.evaluate(() => window.avg(0.78, 0.68, 0.88, 0.8));

  await sw.evaluate(() => chrome.storage.local.set({ license: { key: 'MBX-TEST-TEST-TEST', status: 'active', unlimited: true, pictureSlots: 0, checkedAt: Date.now() } }));
  await callPage.waitForTimeout(2500); // the cat pops up
  const pro = await callPage.evaluate(() => window.avg(0.78, 0.68, 0.88, 0.8));
  await callPage.screenshot({ path: 'tests/.tmp/cat-in-call.png' });
  expect(pro.r - free.r, 'orange fur where the plain camera was').toBeGreaterThan(40);
});

test('the newer filters (thermal, night vision, matrix, snow) run in the call and change the picture', async ({ context, callPage }) => {
  await callPage.evaluate(helpers);
  await setFx(context, { armed: true });
  await callPage.evaluate(() => window.openCam());
  await callPage.waitForTimeout(700);
  const plain = await callPage.evaluate(() => window.avg(0.1, 0.1, 0.9, 0.9));
  const seen = {};
  for (const filter of ['heat', 'night', 'matrix', 'snow']) {
    await setFx(context, { armed: true, filter });
    await callPage.waitForTimeout(900);
    seen[filter] = await callPage.evaluate(() => window.avg(0.1, 0.1, 0.9, 0.9));
    expect(JSON.stringify(seen[filter]), filter + ' differs from the plain camera').not.toBe(JSON.stringify(plain));
  }
  expect(seen.night.g, 'night vision is green').toBeGreaterThan(seen.night.r + 25);
  expect(seen.heat.r + seen.heat.b, 'thermal: the plain green camera becomes red/blue heat colours').toBeGreaterThan(seen.heat.g);
});

test('a hanging disco ball (Pro) is drawn on the camera in the call', async ({ context, callPage }) => {
  await callPage.evaluate(helpers);
  await setFx(context, { armed: true });
  await callPage.evaluate(() => window.openCam());
  await callPage.waitForTimeout(700);
  const before = await callPage.evaluate(() => window.avg(0.42, 0.12, 0.58, 0.32));
  await setFx(context, { armed: true, on: true, fixture: 'discoball', lampAnim: 'still', focus: false });
  await callPage.waitForTimeout(1200);
  const after = await callPage.evaluate(() => window.avg(0.42, 0.12, 0.58, 0.32));
  await callPage.screenshot({ path: 'tests/.tmp/discoball-in-call.png' });
  expect(after.r + after.b, 'the silver ball and its glow are where the plain camera was').toBeGreaterThan(before.r + before.b + 40);
});
