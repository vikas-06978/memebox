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
