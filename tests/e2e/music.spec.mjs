// Music: original tunes play INTO the call's mic stream, stop on request, and a locked tune can be
// previewed in the panel without going into the call.
import { test, expect } from './fixtures.mjs';

const send = (page, msg) => page.evaluate((m) => window.postMessage({ source: 'memebox-bridge-9c1e', ...m }, '*'), msg);

test('a tune plays into the mic stream and stops; the music is audible, not just silence', async ({ callPage }) => {
  await callPage.evaluate(async () => { await window.joinCall(); await window.noDuck(); });
  const quiet = await callPage.evaluate(() => window.peakOver(600));
  await send(callPage, { type: 'music-play', value: 'party', volume: 0.9 });
  await callPage.waitForTimeout(500);
  const withMusic = await callPage.evaluate(() => window.peakOver(1500));
  expect(withMusic, 'the party tune is in the stream').toBeGreaterThan(quiet * 2);
  expect(withMusic).toBeGreaterThan(0.1);

  await send(callPage, { type: 'music-stop' });
  await callPage.waitForTimeout(700);
  const after = await callPage.evaluate(() => window.peakOver(900));
  expect(after, 'quiet again after stop').toBeLessThan(withMusic * 0.6);
});

test('"stop all" (Alt+0 path) also stops the music, and an unknown tune is ignored', async ({ callPage }) => {
  await callPage.evaluate(async () => { await window.joinCall(); await window.noDuck(); });
  await send(callPage, { type: 'music-play', value: 'not-a-tune' });
  await callPage.waitForTimeout(400);
  const none = await callPage.evaluate(() => window.peakOver(600));
  await send(callPage, { type: 'music-play', value: 'retro', volume: 0.9 });
  await callPage.waitForTimeout(500);
  const loud = await callPage.evaluate(() => window.peakOver(900));
  await send(callPage, { type: 'stop' });
  await callPage.waitForTimeout(700);
  const after = await callPage.evaluate(() => window.peakOver(900));
  expect(loud).toBeGreaterThan(none * 2);
  expect(after).toBeLessThan(loud * 0.6);
});

test('the panel has a Music section (look at tests/.tmp/music-panel.png)', async ({ callPage }) => {
  await callPage.evaluate(() => window.joinCall());
  await callPage.waitForTimeout(800);
  await callPage.mouse.click(42, 574, { button: 'right' });
  await callPage.waitForTimeout(400);
  await callPage.screenshot({ path: 'tests/.tmp/music-panel0.png' });
  await callPage.mouse.click(250, 632); // the "Music" row
  await callPage.waitForTimeout(700);
  await callPage.screenshot({ path: 'tests/.tmp/music-panel1.png' });
});
