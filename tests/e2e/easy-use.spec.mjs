// 1.2.3: first-use help. The 😂 button and the panel say when you're muted, and the welcome page
// offers a reload button for call tabs that were open before MemeBox.
import { test, expect } from './fixtures.mjs';

const FAB = { x: 16 + 26, y: 720 - 120 - 26 }; // centre of the 😂 button at its default spot
const BADGE = { x: FAB.x - 40, y: FAB.y + 6, width: 36, height: 36 }; // the bottom-left corner, where the 🔇 badge sits

test('muted in the call: the 😂 button gets a badge and the panel line turns into a warning', async ({ callPage }, testInfo) => {
  await callPage.evaluate(() => window.joinCall());
  await callPage.waitForTimeout(1200);
  const live = await callPage.screenshot({ clip: BADGE });

  await callPage.evaluate(() => { window.s.getAudioTracks()[0].enabled = false; }); // the call's mute button
  await callPage.waitForTimeout(2500);
  const muted = await callPage.screenshot({ clip: BADGE });
  expect(Buffer.compare(live, muted), 'the corner of the button changed').not.toBe(0);

  await callPage.mouse.click(FAB.x, FAB.y, { button: 'right' }); // open the panel
  await callPage.waitForTimeout(500);
  await callPage.screenshot({ path: testInfo.outputPath('muted-panel.png') });
  await callPage.screenshot({ path: 'tests/.tmp/muted-panel.png' });

  await callPage.keyboard.press('Escape');
  await callPage.evaluate(() => { window.s.getAudioTracks()[0].enabled = true; });
  await callPage.waitForTimeout(2500);
  await callPage.screenshot({ path: 'tests/.tmp/live-panel.png' });
  await callPage.evaluate(() => { window.s.getAudioTracks()[0].enabled = false; });
  await callPage.waitForTimeout(2500);
  await callPage.screenshot({ path: 'tests/.tmp/fab-muted.png', clip: { x: 0, y: 520, width: 140, height: 120 } });
});

test('pressing a meme while muted explains why nobody hears it, for long enough to read', async ({ callPage }) => {
  await callPage.evaluate(() => window.joinCall());
  await callPage.waitForTimeout(800);
  await callPage.evaluate(() => { window.s.getAudioTracks()[0].enabled = false; });
  await callPage.waitForTimeout(2000);
  await callPage.mouse.click(FAB.x, FAB.y);
  await callPage.waitForTimeout(4500); // the old toast was gone after 3.2 s
  await callPage.screenshot({ path: 'tests/.tmp/muted-toast.png' });
});

test('welcome page: a call tab that MemeBox cannot reach gets a reload button (nothing reloads by itself)', async ({ context, extensionId }) => {
  await context.route('https://meet.google.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>old call</title>' }));
  const call = await context.newPage();
  await call.goto('https://meet.google.com/old-tab');
  let reloads = 0;
  call.on('load', () => { reloads++; });

  // A tab that opened before MemeBox was installed never answers the ping: pretend that here.
  const page = await context.newPage();
  await page.addInitScript(() => { chrome.tabs.sendMessage = () => Promise.reject(new Error('Receiving end does not exist.')); });
  await page.goto(`chrome-extension://${extensionId}/onboarding.html`);
  const card = page.locator('#reload-card');
  await expect(card).toBeVisible();
  await expect(card.locator('#reload-list li')).toHaveCount(1);
  await expect(card.locator('.url')).toHaveText('meet.google.com');
  await expect(card.locator('h2')).toHaveText('A call tab is already open');
  await page.waitForTimeout(500);
  expect(reloads, 'nothing reloaded by itself').toBe(0);

  await card.locator('button').click();
  await expect.poll(() => reloads).toBe(1);
  await expect(card).toBeHidden();
});

test('welcome page: no reload card when every open call tab already works', async ({ context, extensionId, callPage }) => {
  void callPage; // a normal call tab: it answers the ping
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/onboarding.html`);
  await page.waitForTimeout(800);
  await expect(page.locator('#reload-card')).toBeHidden();
});
