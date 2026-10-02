// Step 3 on-call UI: shortcuts, auto-duck, per-site position.
import { test, expect } from './fixtures.mjs';

const FAB = { x: 16 + 26, y: 720 - 120 - 26 }; // centre of the 😂 button at its default spot

async function joined(page, { duck = false } = {}) {
  await page.evaluate(() => window.joinCall());
  await page.waitForTimeout(500);
  if (!duck) await page.evaluate(() => window.noDuck());
}

test('auto-duck: memes get quieter while I am talking', async ({ callPage }) => {
  // My "voice" is a loud tone (0.4) the whole time. Compare the beep on top of it with duck on/off.
  await callPage.evaluate(() => window.useSiteMic(0.4));
  await joined(callPage, { duck: true });
  await callPage.waitForTimeout(700); // let the UI send its settings (auto-duck on)
  const voiceOnly = await callPage.evaluate(() => window.peakOver(500));
  const ducked = await callPage.evaluate(() => { window.beep(); return window.peakOver(700); });
  // Turn auto-duck off through the same message the panel sends.
  await callPage.evaluate(() => window.postMessage({ source: 'memebox-bridge-9c1e', type: 'duck', value: false }, '*'));
  await callPage.waitForTimeout(800);
  const full = await callPage.evaluate(() => { window.beep(); return window.peakOver(700); });
  expect(voiceOnly).toBeGreaterThan(0.3);
  expect(full - voiceOnly).toBeGreaterThan(0.25);            // beep adds a lot when not ducked
  expect(ducked - voiceOnly).toBeLessThan((full - voiceOnly) * 0.6); // …and clearly less when ducked
});

test('Alt+0 stops a playing meme', async ({ callPage }) => {
  await joined(callPage);
  const micOnly = await callPage.evaluate(() => window.peakOver(600));
  await callPage.mouse.click(FAB.x, FAB.y);   // 😂 random line
  await expect.poll(() => callPage.evaluate(() => window.peak), { timeout: 5000 }).toBeGreaterThan(Math.max(0.3, micOnly * 2));
  await callPage.mouse.click(700, 300);       // focus the page (not a text box)
  await callPage.keyboard.press('Alt+Digit0');
  await callPage.waitForTimeout(300);
  const after = await callPage.evaluate(() => window.peakOver(800));
  expect(after).toBeLessThan(Math.max(0.3, micOnly * 1.5));
});

test('Alt+M hides and shows the 😂 button', async ({ callPage }) => {
  await joined(callPage);
  const micOnly = await callPage.evaluate(() => window.peakOver(600)); // (Chrome's AGC lifts the fake mic a bit)
  await callPage.mouse.click(700, 300);
  await callPage.keyboard.press('Alt+KeyM');  // hide
  await callPage.waitForTimeout(200);
  await callPage.mouse.click(FAB.x, FAB.y);   // nothing there now
  const hiddenClick = await callPage.evaluate(() => window.peakOver(2500));
  expect(hiddenClick).toBeLessThan(Math.max(0.3, micOnly * 1.5));
  await callPage.keyboard.press('Alt+KeyM');  // show again
  await callPage.waitForTimeout(200);
  await callPage.mouse.click(FAB.x, FAB.y);
  await expect.poll(() => callPage.evaluate(() => window.peak), { timeout: 5000 }).toBeGreaterThan(Math.max(0.3, micOnly * 2));
});

test('the 😂 position is saved for this site', async ({ callPage }) => {
  await callPage.mouse.move(FAB.x, FAB.y);
  await callPage.mouse.down();
  await callPage.mouse.move(300, 300, { steps: 8 });
  await callPage.mouse.move(426, 326, { steps: 8 });
  await callPage.mouse.up();
  await callPage.waitForTimeout(400);
  await callPage.reload();
  await joined(callPage);
  await callPage.mouse.click(426, 326);       // the button's new home
  await expect.poll(() => callPage.evaluate(() => window.peak), { timeout: 5000 }).toBeGreaterThan(0.3);
});

test.describe('Hindi UI', () => {
  test.use({ extraArgs: ['--lang=hi'] });
  test('popup is shown in Hindi when Chrome runs in Hindi', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.locator('#how summary')).toHaveText('यह कैसे काम करता है?');
  });
});
