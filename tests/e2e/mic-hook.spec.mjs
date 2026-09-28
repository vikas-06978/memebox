// Step 1: the mic hook puts meme audio INTO the stream the call site gets from getUserMedia.
import { test, expect } from './fixtures.mjs';

test('hook is installed at document_start', async ({ callPage }) => {
  await expect.poll(() => callPage.logs.some((l) => l.includes('hook installed'))).toBe(true);
  expect(await callPage.evaluate(() => window.__memeboxHook === true)).toBe(true);
});

test('getUserMedia returns a mixed track that looks like the real mic, plus the video', async ({ callPage }) => {
  const info = await callPage.evaluate(async () => {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    const [a] = s.getAudioTracks();
    return { audio: s.getAudioTracks().length, video: s.getVideoTracks().length, label: a.label, deviceId: a.getSettings().deviceId };
  });
  expect(info.audio).toBe(1);
  expect(info.video).toBe(1);
  expect(info.label).not.toMatch(/Destination/i); // mirrors the real mic's label
  expect(info.deviceId).toBeTruthy();
  await expect.poll(() => callPage.logs.some((l) => l.includes('mic intercepted'))).toBe(true);
});

test('the hard-coded beep goes into the mic stream (what the other device hears)', async ({ callPage }) => {
  await callPage.evaluate(async () => { window.s = await navigator.mediaDevices.getUserMedia({ audio: true }); await window.measure(window.s); await window.noDuck(); });
  const micOnly = await callPage.evaluate(() => window.peakOver(600));
  const withBeep = await callPage.evaluate(() => { window.beep(); return window.peakOver(900); });
  expect(micOnly).toBeLessThan(0.3);
  expect(withBeep).toBeGreaterThan(micOnly * 2);
  expect(withBeep).toBeGreaterThan(0.3);
  await expect.poll(() => callPage.logs.some((l) => l.includes('playing into mic'))).toBe(true);
});

test('muting in the call mutes the memes too', async ({ callPage }) => {
  await callPage.evaluate(async () => { window.s = await navigator.mediaDevices.getUserMedia({ audio: true }); await window.measure(window.s); });
  const muted = await callPage.evaluate(() => {
    window.s.getAudioTracks()[0].enabled = false; // what the call's mute button does
    window.beep();
    return window.peakOver(900);
  });
  expect(muted).toBeLessThan(0.01);
});

test('clicking 😂 speaks a meme line (eSpeak) into the mic', async ({ callPage }) => {
  await callPage.evaluate(async () => { window.s = await navigator.mediaDevices.getUserMedia({ audio: true }); await window.measure(window.s); });
  await callPage.waitForTimeout(500); // status reaches the UI
  const micOnly = await callPage.evaluate(() => window.peakOver(500));
  await callPage.mouse.click(16 + 26, 720 - 120 - 26); // the floating 😂 button
  const peak = await callPage.evaluate(() => window.peakOver(3000));
  expect(peak).toBeGreaterThan(Math.max(0.3, micOnly * 2));
});

test('a site that replaces getUserMedia later gets re-wrapped on devicechange', async ({ callPage }) => {
  const ok = await callPage.evaluate(async () => {
    // The "site" swaps in its own getUserMedia that never calls ours.
    const plain = await navigator.mediaDevices.getUserMedia({ audio: true }); // (mixed, we only borrow its label)
    const ac = new AudioContext(); const d = ac.createMediaStreamDestination();
    const o = ac.createOscillator(); const g = ac.createGain(); g.gain.value = 0.05; o.connect(g).connect(d); o.start();
    MediaDevices.prototype.getUserMedia = async () => new MediaStream([d.stream.getAudioTracks()[0].clone()]);
    plain.getTracks().forEach((t) => t.stop());
    navigator.mediaDevices.dispatchEvent(new Event('devicechange'));
    window.s = await navigator.mediaDevices.getUserMedia({ audio: true });
    await window.measure(window.s);
    return true;
  });
  expect(ok).toBe(true);
  await callPage.evaluate(() => window.noDuck());
  await expect.poll(() => callPage.logs.some((l) => l.includes('re-wrapped getUserMedia'))).toBe(true);
  const withBeep = await callPage.evaluate(() => { window.beep(); return window.peakOver(900); });
  expect(withBeep).toBeGreaterThan(0.3);
});

test('if Web Audio fails, the call still gets the plain real mic', async ({ callPage }) => {
  const r = await callPage.evaluate(async () => {
    window.AudioContext = function Broken() { throw new Error('boom'); };
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    return { tracks: s.getAudioTracks().length, state: s.getAudioTracks()[0].readyState };
  });
  expect(r).toEqual({ tracks: 1, state: 'live' });
  await expect.poll(() => callPage.logs.some((l) => l.includes('using the plain mic'))).toBe(true);
});
