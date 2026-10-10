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
  expect(r[26000].tear, 'and the screen fills with tears').toBeGreaterThan(0.1);
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
