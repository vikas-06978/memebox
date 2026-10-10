// The Lights & looks section of the panel (look at tests/.tmp/lights-panel*.png).
import { test, expect } from './fixtures.mjs';

const FAB = { x: 16 + 26, y: 720 - 120 - 26 };

test('the panel has a Lights & looks section with a live preview', async ({ callPage, context }) => {
  await callPage.evaluate(() => window.joinCall());
  await callPage.waitForTimeout(800);
  await callPage.mouse.click(FAB.x, FAB.y, { button: 'right' });
  await callPage.waitForTimeout(500);
  await callPage.screenshot({ path: 'tests/.tmp/lights-panel0.png' });
});

test('Lights section opens, shows the preview, and switching it on is saved', async ({ callPage, context, extensionId }) => {
  await callPage.evaluate(() => window.joinCall());
  await callPage.waitForTimeout(800);
  await callPage.mouse.click(FAB.x, FAB.y, { button: 'right' });
  await callPage.waitForTimeout(400);
  await callPage.mouse.click(250, 632); // "Lights & looks"
  await callPage.waitForTimeout(900);
  await callPage.screenshot({ path: 'tests/.tmp/lights-panel1.png' });
  await callPage.mouse.move(250, 500);
  await callPage.mouse.wheel(0, 700); // the open section scrolls inside the panel
  await callPage.waitForTimeout(500);
  await callPage.screenshot({ path: 'tests/.tmp/lights-panel2.png' });
  const sw = await context.serviceWorkers()[0].evaluate(async () => (await chrome.storage.local.get('settings')).settings || {});
  expect((sw.fx || {}).on).not.toBe(true);
});

test('time pass: the seconds are counted only in a call with the pass on, and the pass switches itself off at 0', async ({ callPage, context }) => {
  const sw = context.serviceWorkers()[0];
  const now = Date.now();
  await sw.evaluate((n) => chrome.storage.local.set({
    license: { key: 'MBX-TEST-TEST-TEST', status: 'active', unlimited: false, pictureSlots: 0, proSeconds: 25, maxSeconds: 0, checkedAt: n },
    pass: { on: false, unsynced: 0, syncedAt: n },
  }), now);
  await callPage.waitForTimeout(600);
  const read = () => sw.evaluate(async () => { const r = await chrome.storage.local.get(['license', 'pass']); return { left: r.license.proSeconds, on: r.pass.on }; });

  await callPage.evaluate(() => window.joinCall());
  await callPage.waitForTimeout(12000);
  expect((await read()).left, 'pass off: nothing is counted').toBe(25);

  await sw.evaluate(() => chrome.storage.local.set({ pass: { on: true, unsynced: 0, syncedAt: Date.now() } }));
  await callPage.waitForTimeout(12000);
  const mid = await read();
  expect(mid.left, 'about 10 s counted').toBeLessThan(25);
  expect(mid.left).toBeGreaterThanOrEqual(10);

  await callPage.waitForTimeout(30000);
  const end = await read();
  expect(end.left).toBe(0);
  expect(end.on, 'switched itself off').toBe(false);
});
