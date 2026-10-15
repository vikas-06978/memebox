// Adding sounds and music from inside the call (no trip to Options), and lights that follow the music.
import { test, expect } from './fixtures.mjs';
import {clickPanel} from './closed-panel.mjs';

const send = (page, msg) => page.evaluate((m) => window.postMessage({ source: 'memebox-bridge-9c1e', ...m }, '*'), msg);
// A 1.5 s tone as a small WAV (base64), the same kind of file the panel makes.
const toneWavB64 = (hz = 440, secs = 1.5, rate = 16000) => {
  const n = Math.floor(secs * rate), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * 20000), 44 + i * 2);
  return b.toString('base64');
};

test('a sound added from the panel is saved at once and shows up in the list without a reload', async ({ context, callPage }) => {
  const [sw] = context.serviceWorkers();
  const before = await sw.evaluate(async () => (await chrome.storage.local.get('lines')).lines.length);
  const res = await sw.evaluate(async (b64) => callPanelStore({ type: 'clip-add', name: 'my-airhorn.wav', b64 }), toneWavB64());
  expect(res.ok).toBe(true);
  const after = await sw.evaluate(async () => { const { lines } = await chrome.storage.local.get('lines'); return { n: lines.length, last: lines[lines.length - 1] }; });
  expect(after.n).toBe(before + 1);
  expect(after.last.kind).toBe('clip');
  expect(after.last.text).toBe('my airhorn');
  expect(await sw.evaluate(async (id) => !!(await MemeDB.getClip(id)), after.last.clipId)).toBe(true);
  // it is a real line: it plays into the call
  await callPage.evaluate(async () => { await window.joinCall(); await window.noDuck(); });
  await sw.evaluate(async (item) => {
    const [tab] = await chrome.tabs.query({ url: 'https://meet.google.com/*' });
    await handlePlay(tab.id, { frameId: 0, reqId: 99, item });
  }, after.last);
  const peak = await callPage.evaluate(() => window.peakOver(1500));
  expect(peak, 'the added sound is heard').toBeGreaterThan(0.1);
  // a file that is not a clip is refused
  const bad = await sw.evaluate(async () => callPanelStore({ type: 'clip-add', name: 'x', b64: btoa('not a wav at all') }));
  expect(bad.ok).toBe(false);
});

test('my own music: added from the panel, plays in the call on repeat, stops, and can be removed', async ({ context, callPage }) => {
  const [sw] = context.serviceWorkers();
  await callPage.evaluate(async () => { await window.joinCall(); await window.noDuck(); });
  const added = await sw.evaluate(async (b64) => callPanelStore({ type: 'music-add', name: 'My Song.mp3', mime: 'audio/wav', b64 }), toneWavB64(330, 1.2));
  expect(added.ok).toBe(true);
  expect(await sw.evaluate(async () => (await chrome.storage.local.get('myMusic')).myMusic.map((m) => m.name))).toEqual(['My Song']);
  const quiet = await callPage.evaluate(() => window.peakOver(500));
  await sw.evaluate(async (id) => {
    const [tab] = await chrome.tabs.query({ url: 'https://meet.google.com/*' });
    await playMine(tab.id, { frameId: 0, id, volume: 0.9, audience: 'call' });
  }, added.id);
  await callPage.waitForTimeout(500);
  const loud = await callPage.evaluate(() => window.peakOver(2600)); // longer than the 1.2 s track: it repeats
  expect(loud).toBeGreaterThan(Math.max(0.1, quiet * 2));
  await send(callPage, { type: 'stop' });
  await callPage.waitForTimeout(500);
  const after = await callPage.evaluate(() => window.peakOver(900));
  expect(after, 'Stop all stops it').toBeLessThan(loud * 0.5);
  expect((await sw.evaluate(async (id) => callPanelStore({ type: 'music-del', id }), added.id)).ok).toBe(true);
  expect(await sw.evaluate(async () => (await chrome.storage.local.get('myMusic')).myMusic)).toEqual([]);
  expect(await sw.evaluate(async (id) => !!(await MemeDB.getClip(id)), added.id)).toBe(false);
});


test.describe('free personal music',()=>{
 test.use({pro:false});
 test('a free user can upload and play their own music through the actual call panel',async({context,callPage})=>{
  await callPage.evaluate(async()=>{await window.joinCall();await window.noDuck()});const quiet=await callPage.evaluate(()=>window.peakOver(300));
  await callPage.mouse.click(42,574,{button:'right'});await clickPanel(callPage,'[data-tab="music"]');
  const selected=callPage.waitForEvent('filechooser');await clickPanel(callPage,'.add-music');const chooser=await selected;await chooser.setFiles({name:'Personal beat.wav',mimeType:'audio/wav',buffer:Buffer.from(toneWavB64(330,1.5),'base64')});
  const sw=context.serviceWorkers()[0];await expect.poll(()=>sw.evaluate(async()=>{const {myMusic}=await chrome.storage.local.get('myMusic');return myMusic?.length||0})).toBe(1);
  await clickPanel(callPage,'[data-audience="call"]');
  await clickPanel(callPage,'.fx-chips button[title="Personal beat"]');expect(await callPage.evaluate(()=>window.peakOver(900))).toBeGreaterThan(Math.max(.1,quiet*2));
  await callPage.keyboard.press('Alt+Digit0');await expect.poll(()=>callPage.evaluate(()=>window.peakOver(250))).toBeLessThan(.1);
 });
});
