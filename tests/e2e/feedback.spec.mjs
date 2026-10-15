// Step 6: the extension's side of feedback. Opening the page, and the one-time ask after 10 plays.
import { test, expect } from './fixtures.mjs';

const FAB = { x: 16 + 26, y: 720 - 120 - 26 };

test('Options → Send feedback opens the feedback page with only the version', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  const version = await page.evaluate(() => chrome.runtime.getManifest().version);
  const siteUrl = await page.evaluate(() => MEMEBOX_CONFIG.SITE_URL);
  // Observe the real tabs.create request. The extension intentionally lacks the
  // broad tabs permission, and a restricted network can turn the opened page
  // into chrome-error://chromewebdata before Playwright observes its URL.
  const [worker] = context.serviceWorkers();
  await worker.evaluate(() => {
    const original = chrome.tabs.create;
    globalThis.feedbackTabRequest = null;
    globalThis.restoreTabsCreate = () => { chrome.tabs.create = original; };
    chrome.tabs.create = function (...args) { globalThis.feedbackTabRequest = args[0]; return original.apply(chrome.tabs, args); };
  });
  try {
    await page.locator('#feedback').click();
    await expect.poll(() => worker.evaluate(() => globalThis.feedbackTabRequest)).toEqual({ url: `${siteUrl}/feedback?v=${version}` });
  } finally {
    await worker.evaluate(() => { globalThis.restoreTabsCreate(); delete globalThis.restoreTabsCreate; delete globalThis.feedbackTabRequest; });
  }
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
