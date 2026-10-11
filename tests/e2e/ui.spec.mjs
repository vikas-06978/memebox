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

test('the panel has four pages (Memes, Music, Lights, Sound); the page you leave open is remembered, and the meme language can be chosen', async ({ context, callPage }) => {
  const [sw] = context.serviceWorkers();
  const store = async (k) => (await sw.evaluate((k) => chrome.storage.local.get(k), k))[k];
  await sw.evaluate(() => chrome.storage.local.set({ startDone: true })); // (the "Start here" card would move the tabs)
  await callPage.reload();
  await callPage.evaluate(() => window.joinCall());
  await callPage.waitForTimeout(900);
  await callPage.mouse.click(16 + 26, 720 - 120 - 26, { button: 'right' }); // open the panel
  await callPage.waitForTimeout(900);
  const shotMemes = await callPage.screenshot();
  await callPage.mouse.click(215, 231); // the Music tab
  await expect.poll(async () => ((await store('settings')) || {}).panelTab, { message: 'music tab saved' }).toBe('music');
  await callPage.waitForTimeout(500);
  const shotMusic = await callPage.screenshot();
  expect(Buffer.compare(shotMemes, shotMusic), 'the Music page looks different from the Memes page').not.toBe(0);
  // another tab (or the options) changes the page: the open panel follows
  const shots = {};
  for (const tab of ['lights', 'sound', 'memes']) {
    await sw.evaluate(async (tab) => { const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...settings, panelTab: tab } }); }, tab);
    await callPage.waitForTimeout(700);
    shots[tab] = await callPage.screenshot();
  }
  for (const [a, b] of [['lights', 'sound'], ['sound', 'memes'], ['lights', 'memes']]) expect(Buffer.compare(shots[a], shots[b]), `${a} and ${b} look different`).not.toBe(0);
  expect(Buffer.compare(shotMusic, shots.memes), 'back on Memes it is not the Music page any more').not.toBe(0);
  // meme language: the chip row is under the category chips
  await callPage.mouse.click(307, 358); // हिन्दी
  await expect.poll(async () => ((await store('settings')) || {}).lineLang).toBe('hi');
  await callPage.mouse.click(150, 358); // All languages
  await expect.poll(async () => ((await store('settings')) || {}).lineLang).toBe('all');
});
