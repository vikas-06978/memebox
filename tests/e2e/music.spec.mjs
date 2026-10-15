// Music: original tunes play INTO the call's mic stream, stop on request, and a locked tune can be
// previewed in the panel without going into the call.
import { test, expect } from './fixtures.mjs';

const send = (page, msg) => page.evaluate((m) => window.postMessage({ source: 'memebox-bridge-9c1e', ...m }, '*'), msg);

test('all three original Phonk arrangements produce audio in the outgoing call stream', async ({ callPage }) => {
  await callPage.evaluate(async () => { await window.joinCall(); await window.noDuck(); });
  const quiet = await callPage.evaluate(() => window.peakOver(500));
  for (const id of ['phonk_desi', 'phonk_drift', 'phonk_midnight']) {
    await send(callPage, { type: 'music-play', value: id, volume: 0.7, audience: 'call' });
    await callPage.waitForTimeout(400);
    const peak = await callPage.evaluate(() => window.peakOver(2000)); // Includes a full sparse intro beat cycle.
    expect(peak, id + ' produces audible output').toBeGreaterThan(Math.max(0.08, quiet * 2));
    await send(callPage, { type: 'music-stop' }); await callPage.waitForTimeout(300);
  }
});

test('a tune plays into the mic stream and stops; the music is audible, not just silence', async ({ callPage }) => {
  await callPage.evaluate(async () => { await window.joinCall(); await window.noDuck(); });
  const quiet = await callPage.evaluate(() => window.peakOver(600));
  await send(callPage, { type: 'music-play', value: 'party', volume: 0.9, audience: 'call' });
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
  await send(callPage, { type: 'music-play', value: 'not-a-tune', audience: 'call' });
  await callPage.waitForTimeout(400);
  const none = await callPage.evaluate(() => window.peakOver(600));
  await send(callPage, { type: 'music-play', value: 'retro', volume: 0.9, audience: 'call' });
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

test('Stop all cancels meme and personal music while their audio decode is still pending', async ({ callPage }) => {
  await callPage.evaluate(async () => {
    await window.joinCall(); await window.noDuck();
    const decode = AudioContext.prototype.decodeAudioData;
    window.pendingDecodes = 0;
    AudioContext.prototype.decodeAudioData = async function (...args) {
      window.pendingDecodes++;
      const buffer = await decode.apply(this, args);
      await new Promise(resolve => setTimeout(resolve, 450));
      return buffer;
    };
    window.testWave = () => {
      const sr = 48000, n = sr * 2, bytes = new ArrayBuffer(44 + n * 2), v = new DataView(bytes);
      const ascii = (at, text) => [...text].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
      ascii(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); ascii(8, 'WAVEfmt '); v.setUint32(16, 16, true);
      v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
      v.setUint16(32, 2, true); v.setUint16(34, 16, true); ascii(36, 'data'); v.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(2 * Math.PI * 440 * i / sr) * 16000, true);
      return bytes;
    };
  });
  for (const [index, type] of ['play-audio', 'music-bytes'].entries()) {
    await callPage.evaluate(type => window.postMessage({ source: 'memebox-bridge-9c1e', type, reqId: 901, mid: 'm-test', bytes: window.testWave(), volume: .8 }, '*'), type);
    await expect.poll(() => callPage.evaluate(() => window.pendingDecodes)).toBe(index + 1);
    await send(callPage, { type: 'stop' });
    expect(await callPage.evaluate(() => window.peakOver(1000)), type + ' cannot start after Stop all').toBeLessThan(.1);
  }
});
