// Step 4 – options page: packs, clips (file / video / link / recording), trimmer, pack files, per-line volume.
import { test, expect } from './fixtures.mjs';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const TMP = path.resolve('tests/.tmp');

// A 3 s, fairly loud 440 Hz WAV "airhorn".
function toneWav(file, seconds = 3, rate = 22050, level = 0.6) {
  const n = seconds * rate, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * level * 32767), 44 + i * 2);
  fs.mkdirSync(TMP, { recursive: true });
  fs.writeFileSync(file, b);
  return b;
}

async function openOptions(context, extensionId) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.locator('#lines-body tr').first()).toBeVisible();
  page.store = (keys) => page.evaluate((k) => chrome.storage.local.get(k), keys);
  page.toast = () => page.locator('#toast').textContent();
  return page;
}

const setRange = (page, sel, value) => page.$eval(sel, (el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, value);

test('first install has the general pack + College, Cricket, Office, Party', async ({ context, extensionId }) => {
  const page = await openOptions(context, extensionId);
  const { lines } = await page.store('lines');
  const cats = new Set(lines.map((l) => l.category));
  for (const c of ['general', 'college', 'cricket', 'office', 'party']) expect(cats.has(c)).toBe(true);
  expect(lines.length).toBeGreaterThanOrEqual(46);
  await expect(page.locator('#builtin-packs li')).toHaveCount(5);
});

test('upload a WAV, trim it, save as a clip, and it plays into the call', async ({ context, extensionId, callPage }) => {
  const file = path.join(TMP, 'horn.wav');
  toneWav(file);
  const page = await openOptions(context, extensionId);
  await page.setInputFiles('#clip-file', file);
  await expect(page.locator('#trimmer')).toBeVisible();
  await setRange(page, '#trim-start', 100);  // 0.3 s
  await setRange(page, '#trim-end', 700);    // 2.1 s
  await expect(page.locator('#trim-label')).toContainText('1.8');
  await page.fill('#clip-name', 'Test airhorn');
  await page.selectOption('#clip-fav', '2');
  await page.click('#clip-form button[type=submit]');
  await expect(page.locator('#toast')).toContainText(/Clip saved|क्लिप सेव/);

  const { lines } = await page.store('lines');
  const clip = lines.find((l) => l.text === 'Test airhorn');
  expect(clip).toMatchObject({ kind: 'clip', fav: 2, category: 'clips' });
  const size = await page.evaluate((id) => MemeDB.getClip(id).then((c) => ({ bytes: c.bytes.byteLength, type: c.type })), clip.clipId);
  expect(size.type).toBe('audio/wav');
  expect(size.bytes).toBeLessThanOrEqual(1024 * 1024);
  expect(size.bytes).toBeGreaterThan(1.7 * 22050 * 2); // ~1.8 s kept

  // Alt+2 on the call page plays the new clip into the mic.
  await callPage.bringToFront();
  await callPage.evaluate(() => window.joinCall());
  await callPage.evaluate(() => window.noDuck());
  await callPage.mouse.click(700, 300);
  await callPage.keyboard.press('Alt+Digit2');
  await expect.poll(() => callPage.evaluate(() => window.peak), { timeout: 5000 }).toBeGreaterThan(0.4);
});

test('a video file (webm) is accepted – only its sound is kept', async ({ context, extensionId }) => {
  const page = await openOptions(context, extensionId);
  // Make a real 1.5 s webm in the page (MediaRecorder of a tone), then "choose" it.
  await page.evaluate(async () => {
    const ac = new AudioContext();
    const d = ac.createMediaStreamDestination();
    const o = ac.createOscillator(); o.connect(d); o.start();
    const rec = new MediaRecorder(d.stream, { mimeType: 'audio/webm' });
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise((r) => { rec.onstop = r; });
    rec.start(100);
    await new Promise((r) => setTimeout(r, 1500));
    rec.stop();
    await done;
    const input = document.getElementById('clip-file');
    const dt = new DataTransfer();
    dt.items.add(new File([new Blob(chunks, { type: 'video/webm' })], 'funny-video.webm', { type: 'video/webm' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });
  await expect(page.locator('#trimmer')).toBeVisible();
  await expect(page.locator('#clip-name')).toHaveValue('funny video');
  await page.click('#clip-form button[type=submit]');
  await expect(page.locator('#toast')).toContainText(/Clip saved|क्लिप सेव/);
});

test('direct links: CORS-friendly file works, blocked server and video pages get clear errors', async ({ context, extensionId }) => {
  // A real local server (Playwright's request routing would skip the browser's CORS check):
  // /open/* sends Access-Control-Allow-Origin, /closed/* doesn't.
  const wav = toneWav(path.join(TMP, 'link.wav'), 1);
  const server = http.createServer((req, res) => {
    const open = req.url.startsWith('/open/');
    res.writeHead(200, { 'Content-Type': 'audio/wav', ...(open ? { 'Access-Control-Allow-Origin': '*' } : {}) });
    res.end(wav);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await openOptions(context, extensionId);

  await page.fill('#link-url', 'https://www.youtube.com/watch?v=abc');
  await page.click('#link-form button');
  await expect(page.locator('#toast')).toContainText(/video page|वीडियो पेज/);

  await page.fill('#link-url', `${base}/open/page.html`);
  await page.click('#link-form button');
  await expect(page.locator('#toast')).toContainText(/\.mp3/);

  await page.fill('#link-url', `${base}/closed/horn.wav`);
  await page.click('#link-form button');
  await expect(page.locator('#toast')).toContainText(/127\.0\.0\.1.*CORS/);

  await page.fill('#link-url', `${base}/open/sounds/air-horn.wav`);
  await page.click('#link-form button');
  await expect(page.locator('#trimmer')).toBeVisible();
  await expect(page.locator('#clip-name')).toHaveValue('air horn');
  server.close();
});

test('record my own clip (fake mic) goes into the trimmer', async ({ context, extensionId }) => {
  const page = await openOptions(context, extensionId);
  await page.click('#rec-btn');
  await expect(page.locator('#rec-btn')).toContainText(/⏹/);
  await page.waitForTimeout(1500);
  await page.click('#rec-btn');
  await expect(page.locator('#trimmer')).toBeVisible();
  const label = await page.locator('#trim-label').textContent();
  const secs = Number(label.match(/\(([\d.]+)/)[1]);
  expect(secs).toBeGreaterThan(0.8);
  expect(secs).toBeLessThan(10.5);
});

test('export a pack, wipe lines, import it back; invalid packs show errors', async ({ context, extensionId }) => {
  const page = await openOptions(context, extensionId);
  await page.selectOption('#export-which', 'office');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export')]);
  const file = path.join(TMP, 'office.memepack.json');
  await dl.saveAs(file);
  const pack = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(pack.format).toBe('memebox-pack');
  expect(pack.lines.every((l) => l.category === 'office')).toBe(true);
  expect(dl.suggestedFilename()).toMatch(/\.memepack\.json$/);

  await page.evaluate(() => chrome.storage.local.set({ lines: [] }));
  await page.reload();
  await page.setInputFiles('#import', file);
  await expect(page.locator('#toast')).toContainText(/Imported 8 lines|8 लाइनें/);
  expect((await page.store('lines')).lines.length).toBe(8);

  const badFile = path.join(TMP, 'bad.memepack.json');
  fs.writeFileSync(badFile, JSON.stringify({ ...pack, hacker: true, lines: [{ ...pack.lines[0], tone: 'loud' }] }));
  await page.setInputFiles('#import', badFile);
  await expect(page.locator('#import-errors')).toBeVisible();
  await expect(page.locator('#import-errors')).toContainText('hacker: unknown field');
  await expect(page.locator('#import-errors')).toContainText('lines[0].tone');
  expect((await page.store('lines')).lines.length).toBe(8); // nothing changed
});

test('per-line volume: a line at 0% is silent in the call, at 200% it is loud', async ({ context, extensionId, callPage }) => {
  const page = await openOptions(context, extensionId);
  const setVol = (v) => page.evaluate(async (vol) => {
    const { lines } = await chrome.storage.local.get('lines');
    await chrome.storage.local.set({ lines: lines.map((l) => (l.id === 'd-en-6' ? { ...l, volume: vol } : l)) }); // Alt+9 line
  }, v);
  await callPage.bringToFront();
  await callPage.evaluate(() => window.joinCall());
  await callPage.evaluate(() => window.noDuck());
  const micOnly = await callPage.evaluate(() => window.peakOver(600));
  await setVol(0);
  await callPage.mouse.click(700, 300);
  await callPage.keyboard.press('Alt+Digit9');
  const silent = await callPage.evaluate(() => window.peakOver(2500));
  await setVol(2);
  await callPage.keyboard.press('Alt+Digit9');
  const loud = await callPage.evaluate(() => window.peakOver(2500));
  expect(silent).toBeLessThan(Math.max(0.3, micOnly * 1.5));
  expect(loud).toBeGreaterThan(Math.max(0.5, silent * 2));
});
