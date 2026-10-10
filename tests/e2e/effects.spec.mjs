// The Sound effects pack: real effects (not speech) that play loud into the call.
import { test, expect } from './fixtures.mjs';

const FAB = { x: 16 + 26, y: 720 - 120 - 26 };

test('airhorn, rimshot and sad trombone play loud into the call from the panel', async ({ callPage }) => {
  await callPage.evaluate(() => window.joinCall());
  await callPage.evaluate(() => window.noDuck());
  await callPage.mouse.click(FAB.x, FAB.y, { button: 'right' }); // open the panel
  await callPage.waitForTimeout(700);
  for (const query of ['airhorn', 'ba-dum', 'sad trombone']) { // the search looks at the shown text
    await callPage.keyboard.press('Control+A');
    await callPage.keyboard.type(query);
    await callPage.waitForTimeout(300);
    await callPage.evaluate(() => { window.peak = 0; });
    await callPage.keyboard.press('Enter'); // plays the first match
    await expect.poll(() => callPage.evaluate(() => window.peak), { timeout: 6000, message: query }).toBeGreaterThan(0.35);
    await callPage.waitForTimeout(3300); // let it finish before the next one
  }
});
