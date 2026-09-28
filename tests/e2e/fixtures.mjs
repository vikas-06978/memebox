// Shared Playwright setup: Chromium with the unpacked extension, a fake microphone,
// and a fake "call" page served at https://meet.google.com/ (so the content scripts run).
import { test as base, chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
// MEMEBOX_EXT lets CI run the same tests against the built/unzipped store package.
const EXT = process.env.MEMEBOX_EXT ? path.resolve(process.env.MEMEBOX_EXT) : path.join(ROOT, 'extension');
const TMP = path.join(ROOT, 'tests', '.tmp');

// 2 s of a quiet 200 Hz tone = "my voice" from the fake mic (peak ~0.05).
function quietWav() {
  fs.mkdirSync(TMP, { recursive: true });
  const file = path.join(TMP, 'quiet-mic.wav');
  const sr = 48000, n = sr * 2, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 200 * i) / sr) * 1600), 44 + i * 2);
  fs.writeFileSync(file, b);
  return file;
}

// The fake call page. `measure(stream)` keeps a running peak of whatever the "call" would send.
export const FAKE_CALL = `<!doctype html><html><head><title>fake call</title></head><body style="background:#333">
<script>
  const RealAudioContext = window.AudioContext;
  window.peak = 0;
  window.measure = async (stream) => {
    const ac = new RealAudioContext(); await ac.resume();
    const an = ac.createAnalyser(); an.fftSize = 2048;
    ac.createMediaStreamSource(stream).connect(an);
    // Pitch of what the call would send: the loudest bin between 80 Hz and 1.5 kHz.
    const fan = ac.createAnalyser(); fan.fftSize = 16384; fan.smoothingTimeConstant = 0;
    ac.createMediaStreamSource(stream).connect(fan);
    window.dominantHz = () => {
      const bins = new Float32Array(fan.frequencyBinCount); fan.getFloatFrequencyData(bins);
      const hz = ac.sampleRate / fan.fftSize; let best = -Infinity, at = 0;
      for (let i = Math.floor(80 / hz); i < 1500 / hz; i++) if (bins[i] > best) { best = bins[i]; at = i; }
      return Math.round(at * hz);
    };
    const buf = new Float32Array(2048);
    setInterval(() => { an.getFloatTimeDomainData(buf); for (const v of buf) window.peak = Math.max(window.peak, Math.abs(v)); }, 20);
  };
  window.peakOver = async (ms) => { window.peak = 0; await new Promise((r) => setTimeout(r, ms)); return window.peak; };
  // Makes the "site" use its own mic stream (a tone at the given level) – via the devicechange re-wrap.
  window.useSiteMic = async (level) => {
    const ac = new RealAudioContext(); const d = ac.createMediaStreamDestination();
    const o = ac.createOscillator(); o.frequency.value = 200; const g = ac.createGain(); g.gain.value = level;
    o.connect(g).connect(d); o.start();
    MediaDevices.prototype.getUserMedia = async () => new MediaStream([d.stream.getAudioTracks()[0].clone()]);
    navigator.mediaDevices.dispatchEvent(new Event('devicechange'));
  };
  window.joinCall = async () => { window.s = await navigator.mediaDevices.getUserMedia({ audio: true }); await window.measure(window.s); };
  // The fake mic is a steady tone, which auto-duck (correctly) treats as "talking". Tests that
  // measure pure mixing switch it off – after the UI has sent its own settings on join.
  window.noDuck = async () => {
    await new Promise((r) => setTimeout(r, 700));
    window.postMessage({ source: 'memebox-bridge-9c1e', type: 'duck', value: false }, '*');
    await new Promise((r) => setTimeout(r, 100));
  };
  // What the bridge sends to the hook – used to trigger the hard-coded beep directly.
  window.beep = () => window.postMessage({ source: 'memebox-bridge-9c1e', type: 'beep', reqId: 1 }, '*');
</script></body></html>`;

export const test = base.extend({
  // Extra Chromium flags for a test file, e.g. test.use({ extraArgs: ['--lang=hi'] }).
  extraArgs: [[], { option: true }],
  context: async ({ extraArgs }, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      viewport: { width: 1280, height: 720 },
      args: [
        ...extraArgs,
        `--disable-extensions-except=${EXT}`,
        `--load-extension=${EXT}`,
        '--autoplay-policy=no-user-gesture-required',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${quietWav()}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker');
    await use(sw.url().split('/')[2]);
  },
  // A fake call tab with the extension's content scripts running; collects [MemeBox] logs.
  callPage: async ({ context, extensionId }, use) => {
    void extensionId; // make sure the extension is up first
    const page = await context.newPage();
    page.logs = [];
    page.on('console', (m) => { if (m.text().includes('[MemeBox]')) page.logs.push(m.text()); });
    await context.route('https://meet.google.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: FAKE_CALL }));
    await page.goto('https://meet.google.com/abc-defg-hij');
    await use(page);
  },
});

export const expect = test.expect;
