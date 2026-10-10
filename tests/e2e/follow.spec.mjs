// "Follow me": the tiny tracker knows where you are (left, right, standing up, gone, back) from the camera picture alone.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.use({ channel: 'chromium' });
const FX = fs.readFileSync(path.resolve(import.meta.dirname, '..', '..', 'extension', 'lib', 'fx.js'), 'utf8');

test('the tracker follows a person left and right, sees standing up, notices when nobody is there, and when they return', async ({ page }) => {
  await page.setContent('<body></body>');
  await page.addScriptTag({ content: FX });
  const r = await page.evaluate(() => {
    const W = 320, H = 180;
    const R = MemeFx.createRenderer();
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    let now = 100000;
    const run = (ms, person) => { // feed frames at ~16 per second
      let T;
      for (let i = 0; i < ms / 62; i++) { MemeFx.drawSample(g, W, H, now, person(i)); T = R.track(c, now); now += 62; }
      return { ...T };
    };
    const out = {};
    out.centre = run(1200, () => ({ dx: 0, dy: 0 }));
    out.left = run(1500, () => ({ dx: -0.3, dy: 0 }));
    out.right = run(1500, () => ({ dx: 0.3, dy: 0 }));
    run(900, () => ({ dx: 0, dy: 0 }));
    const beforeRise = R.track(c, now).riseAt;
    out.riseStart = beforeRise;
    out.up = run(900, (i) => ({ dx: 0, dy: -Math.min(0.27, i * 0.03) }));
    run(900, () => ({ dx: 0, dy: 0 }));
    out.gone = run(2500, () => ({ visible: false }));
    out.back = run(1500, () => ({ dx: 0, dy: 0 }));
    return out;
  });
  expect(r.centre.present).toBe(true);
  expect(Math.abs(r.centre.x - 0.5), 'centred').toBeLessThan(0.12);
  expect(r.left.x, 'moved left').toBeLessThan(0.34);
  expect(r.right.x, 'moved right').toBeGreaterThan(0.66);
  expect(r.up.riseAt, 'standing up is noticed').toBeGreaterThan(r.riseStart);
  expect(r.gone.present, 'nobody there').toBe(false);
  expect(r.gone.away).toBeGreaterThan(0.5);
  expect(r.gone.exitAt).toBeGreaterThan(0);
  expect(r.back.present, 'they came back').toBe(true);
  expect(r.back.enterAt, 'the return is noticed').toBeGreaterThan(r.gone.exitAt);
});

test('when you are away the animal looks for you, misses you, cries (the screen fills with tears) and wipes them when you are back', async ({ page }) => {
  await page.setContent('<body></body>');
  await page.addScriptTag({ content: FX });
  const r = await page.evaluate(() => {
    const W = 320, H = 180;
    const R = MemeFx.createRenderer();
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), frame = document.createElement('canvas'); frame.width = W; frame.height = H;
    const cfg = MemeFx.sanitize({ armed: true, on: true, lamp: true, follow: true, character: 'cat', charPos: 'left', awayDance: false });
    const c0 = 34000 * 30, at = {};
    for (let ms = 0; ms <= 33000; ms += 50) {
      const sm = MemeFx.simulate(c0 + ms);
      MemeFx.drawSample(frame.getContext('2d'), W, H, ms, sm.person);
      R.render(g, frame, W, H, cfg, c0 + ms, { level: 0, voice: sm.voice }, { track: sm.track });
      if ([15000, 17500, 21000, 26000, 28900, 31500, 33000].includes(ms)) at[ms] = { mode: R.stg.mode, tear: R.stg.tear };
    }
    return at;
  });
  expect(r[15000].mode).not.toBe('search');
  expect(r[17500].mode, 'just left: it looks for you').toBe('search');
  expect(r[21000].mode, 'a few seconds later it misses you').toBe('miss');
  expect(r[26000].mode, 'then it cries').toBe('cry');
  expect(r[28900].tear, 'and the screen fills with tears').toBeGreaterThan(0.1);
  expect(r[31500].tear, 'back: the tears drained').toBeLessThan(0.05);
  expect(r[33000].mode).not.toBe('cry');
});

test('every animal can cry, wipe its tears, break its heart and feel its heart beat', async ({ page }) => {
  await page.setContent('<body></body>');
  await page.addScriptTag({ content: FX });
  const r = await page.evaluate(() => {
    const W = 320, H = 180, out = {};
    for (const kind of MemeFx.CHARACTERS) {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const R = MemeFx.createRenderer(), g = c.getContext('2d');
      const lit = document.createElement('canvas'); lit.width = W; lit.height = H;
      for (const act of ['cry', 'wipe', 'heartbreak', 'heartbeat']) {
        const cfg = MemeFx.sanitize({ armed: true, on: true, lamp: false, character: kind });
        try { R.render(g, lit, W, H, cfg, 1000, null, { charAct: act, charT: 1.2, charU: 0.4 }); out[kind + ':' + act] = true; } catch (e) { out[kind + ':' + act] = String(e); }
      }
      out[kind + ':list'] = MemeFx.ACTIONS[kind].includes('heartbeat');
    }
    return out;
  });
  for (const [k, v] of Object.entries(r)) expect(v, k).toBe(true);
});

test('the animal does not stand in front of your face: when you sit near its corner it walks to the other one', async ({ page }) => {
  await page.setContent('<body></body>');
  await page.addScriptTag({ content: FX });
  const r = await page.evaluate(() => {
    const W = 320, H = 180;
    const R = MemeFx.createRenderer();
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), frame = document.createElement('canvas'); frame.width = W; frame.height = H;
    const cfg = MemeFx.sanitize({ armed: true, on: true, lamp: true, follow: true, character: 'cat', charPos: 'left', mirror: false });
    let now = 500000;
    const track = (x) => ({ present: true, x, y: 0.45, energy: 0, side: 0, rise: 0, away: 0, vx: 0, vy: 0, enterAt: -1e9, exitAt: -1e9, exitSide: 0, riseAt: -1e9, waveAt: -1e9, live: true });
    const run = (ms, x) => { for (let i = 0; i < ms / 50; i++) { MemeFx.drawSample(frame.getContext('2d'), W, H, now, { dx: x - 0.5, dy: 0 }); R.render(g, frame, W, H, cfg, now, null, { track: track(x) }); now += 50; } return { x: R.stg.x, mode: R.stg.mode }; };
    const start = run(1500, 0.5);        // you in the middle: it sits in its (left) corner
    const near = run(10000, 0.15);       // you move to the left: it should leave
    return { start, near };
  });
  expect(r.start.x).toBeLessThan(0.3);
  expect(r.near.x, 'it crossed to the right corner, away from you').toBeGreaterThan(0.7);
});

test('you turn your head towards the animal and it turns towards you (and not when you turn away from it)', async ({ page }) => {
  await page.setContent('<body></body>');
  await page.addScriptTag({ content: FX });
  const r = await page.evaluate(() => {
    const W = 320, H = 180;
    const cfg = MemeFx.sanitize({ armed: true, on: true, lamp: false, follow: true, character: 'cat', charPos: 'left', mirror: false });
    const frame = document.createElement('canvas'); frame.width = W; frame.height = H;
    MemeFx.drawSample(frame.getContext('2d'), W, H, 1000, { dx: 0.1, dy: 0 });
    const shot = (yaw) => {
      const R = MemeFx.createRenderer(), c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d'), tr = { present: true, x: 0.6, y: 0.45, energy: 0, side: 0, rise: 0, away: 0, vx: 0, vy: 0, enterAt: -1e9, exitAt: -1e9, exitSide: 0, riseAt: -1e9, waveAt: -1e9, live: true, yaw };
      for (let i = 0; i < 40; i++) R.render(g, frame, W, H, cfg, 50000 + i * 50, null, { track: tr });
      return g.getImageData(0, Math.round(H * 0.4), Math.round(W * 0.4), Math.round(H * 0.6)).data;
    };
    const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) > 40) n++; return n; };
    const straight = shot(0), toward = shot(-0.3), away = shot(0.3);
    return { toward: diff(straight, toward), away: diff(straight, away) };
  });
  expect(r.toward, 'the animal reacts when your nose points at it').toBeGreaterThan(40);
  expect(r.away, 'and does not when you look the other way').toBeLessThan(r.toward / 3);
});
