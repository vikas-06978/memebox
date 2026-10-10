// node tools/music-sheet.mjs [outDir]: renders every tune offline (16 s) and writes a WAV and a spectrogram
// per tune, plus loudness numbers, so a change to lib/music.js can be checked without listening to everything.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const outDir = process.argv[2] || path.join(ROOT, 'tests', '.tmp', 'music');
fs.mkdirSync(outDir, { recursive: true });
const src = fs.readFileSync(path.join(ROOT, 'extension', 'lib', 'music.js'), 'utf8');
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.setContent('<body style="margin:0;background:#111;color:#ddd;font:12px system-ui"></body>');
await page.addScriptTag({ content: src });
const result = await page.evaluate(async () => {
  const SR = 24000, SECS = 16, out = [];
  for (const id of MemeMusic.IDS) {
    const ctx = new OfflineAudioContext(1, SR * SECS, SR);
    const master = ctx.createGain(); master.gain.value = 0.4; master.connect(ctx.destination);
    MemeMusic.scheduleTune(ctx, master, id, 0, SECS);
    const buf = await ctx.startRendering();
    const d = buf.getChannelData(0);
    let peak = 0, sum = 0;
    for (const x of d) { peak = Math.max(peak, Math.abs(x)); sum += x * x; }
    // spectrogram
    const W = 1400, H = 150, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const N = 512, hop = Math.floor(d.length / W);
    for (let x = 0; x < W; x++) {
      const off = x * hop;
      for (let y = 0; y < H; y++) {
        const f = (y / H) ** 2 * 0.5 * 0.75; // log-ish axis up to 9 kHz
        const k = f * N; let re = 0, im = 0;
        for (let n = 0; n < N; n += 2) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / N); const v = (d[off + n] || 0) * w; re += v * Math.cos(2 * Math.PI * k * n / N); im -= v * Math.sin(2 * Math.PI * k * n / N); }
        const mag = Math.min(1, Math.sqrt(re * re + im * im) / 6);
        const l = Math.round(255 * Math.sqrt(mag));
        g.fillStyle = `rgb(${l},${Math.round(l * 0.6)},${255 - l})`; g.fillRect(x, H - 1 - y, 1, 1);
      }
    }
    document.body.append(Object.assign(document.createElement('div'), { textContent: `${id}  peak ${peak.toFixed(2)}  rms ${Math.sqrt(sum / d.length).toFixed(3)}` }), c);
    out.push({ id, peak, rms: Math.sqrt(sum / d.length), pcm: Array.from(d.slice(0, SR * 8), (x) => Math.round(Math.max(-1, Math.min(1, x)) * 32767)) });
  }
  return out;
});
for (const r of result) {
  const n = r.pcm.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(24000, 24); b.writeUInt32LE(48000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  r.pcm.forEach((v, i) => b.writeInt16LE(v, 44 + i * 2));
  fs.writeFileSync(path.join(outDir, r.id + '.wav'), b);
  console.log(r.id.padEnd(9), 'peak', r.peak.toFixed(2), 'rms', r.rms.toFixed(3));
}
await page.screenshot({ path: path.join(outDir, 'spectrograms.png'), fullPage: true });
await browser.close();
