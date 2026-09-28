// Step 6: the extension's side of feedback. Opening the page, and the one-time ask after 10 plays.
import { test, expect } from './fixtures.mjs';

const FAB = { x: 16 + 26, y: 720 - 120 - 26 };

test('Options → Send feedback opens the feedback page with only the version', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  const version = await page.evaluate(() => chrome.runtime.getManifest().version);
  // Tabs opened by chrome.tabs.create aren't routed by Playwright (and the page's own request
  // isn't reported), so check the address the new tab goes to.
  const [tab] = await Promise.all([context.waitForEvent('page'), page.locator('#feedback').click()]);
  await expect.poll(() => tab.url()).toBe(`https://memebox.pages.dev/feedback?v=${version}`);
});

test('after the 10th meme it asks once, and never again', async ({ context, callPage }) => {
  const [sw] = context.serviceWorkers();
  const stats = () => sw.evaluate(async () => (await chrome.storage.local.get('stats')).stats || {});
  await sw.evaluate(() => chrome.storage.local.set({ stats: { plays: 8 } }));
  await callPage.evaluate(() => window.joinCall());
  await callPage.waitForTimeout(500);

  await callPage.mouse.click(FAB.x, FAB.y); // play 9
  await expect.poll(async () => (await stats()).plays, { timeout: 8000 }).toBe(9);
  expect((await stats()).askedFeedback).toBeUndefined();

  await callPage.mouse.click(FAB.x, FAB.y); // play 10 -> ask
  await expect.poll(async () => (await stats()).askedFeedback, { timeout: 8000 }).toBe(true);

  await callPage.mouse.click(FAB.x, FAB.y); // play 11 -> still asked once
  await expect.poll(async () => (await stats()).plays, { timeout: 8000 }).toBe(11);
  expect((await stats()).askedFeedback).toBe(true);
});
