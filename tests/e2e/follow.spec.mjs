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
