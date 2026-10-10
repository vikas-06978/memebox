// npm run tutorial: records the "how to use MemeBox" video from the real extension running in Chromium,
// on a neutral mock call (coloured tiles, first names, no logos or real people).
//   1 join a call   2 click 😂 (a Hindi or English meme line)   3 right-click for the panel and pick a line
//   4 muted = silent   5 add your own sound (Options: choose a file, trim, name, save)   6 play it in the call
//   7 OPTIONAL: add the Sound effects pack (Options → Packs → Add) and play the airhorn
// The sound is real: it is the mixed microphone the call would receive (the memes, and silence while
// muted), recorded from the extension. Big captions say what to do, so it also works with the sound off.
// Output: site/public/assets/tutorial.mp4 and tutorial.webm, plus tutorial-poster.png. Needs ffmpeg.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { render } from './lib/sfx.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const EXT = path.join(ROOT, 'extension');
const OUT = path.join(ROOT, 'site', 'public', 'assets');
const W = 1280, H = 800;
const FAB = { x: 16 + 26, y: H - 120 - 26 }; // centre of the 😂 button at its default spot
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'memebox-tutorial-'));

// The fake microphone must be silent: Chromium's default fake device beeps, and only the sounds should be heard.
const silence = path.join(tmp, 'silence.wav');
{
  const sr = 48000, n = sr * 5, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  fs.writeFileSync(silence, b);
}
// The sound the video uploads in step 5: a deep movie "boom" (made here, not a built-in effect).
const boomFile = path.join(tmp, 'boom.wav');
fs.writeFileSync(boomFile, render('boom'));

const CALL_SCENE = `<!doctype html><html><head><title>Team call</title><style>
  * { box-sizing: border-box; } html, body { margin: 0; height: 100%; }
  body { background: #1f2023; font: 15px system-ui, "Segoe UI", sans-serif; color: #fff; display: grid; grid-template-rows: 1fr 76px; overflow: hidden; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px 16px 0 110px; }
  .tile { border-radius: 14px; position: relative; display: grid; place-items: center; }
  .tile b { width: 110px; height: 110px; border-radius: 50%; display: grid; place-items: center; font-size: 44px; background: rgba(255,255,255,.18); }
  .tile span { position: absolute; left: 14px; bottom: 12px; background: rgba(0,0,0,.45); padding: 3px 10px; border-radius: 8px; }
  .bar { display: flex; gap: 14px; justify-content: center; align-items: center; }
  .bar i { width: 48px; height: 48px; border-radius: 50%; background: #3c4043; display: block; }
  .bar i.end { background: #d93025; width: 64px; border-radius: 24px; }
</style></head><body>
  <div class="grid">
    <div class="tile" style="background:#364fc7"><b>A</b><span>Aman</span></div>
    <div class="tile" style="background:#0b7285"><b>P</b><span>Priya</span></div>
    <div class="tile" style="background:#5f3dc4"><b>R</b><span>Rahul</span></div>
    <div class="tile" style="background:#2b8a3e"><b>S</b><span>Sneha</span></div>
  </div>
  <div class="bar"><i></i><i></i><i></i><i class="end"></i></div>
  <script>
    window.joinCall = async () => { window.s = await navigator.mediaDevices.getUserMedia({ audio: true }); };
    // Records what the call would send: the mixed mic stream (the sounds, and silence while muted).
    window.startRec = async () => {
      const ac = new AudioContext(); await ac.resume();
      const dest = ac.createMediaStreamDestination();
      ac.createMediaStreamSource(window.s).connect(dest);
      window.chunks = [];
      window.rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
      window.rec.ondataavailable = (e) => window.chunks.push(e.data);
      window.rec.start(100);
      return Date.now();
    };
    window.stopRec = async () => {
      await new Promise((r) => { window.rec.onstop = r; window.rec.stop(); });
      const buf = new Uint8Array(await new Blob(window.chunks).arrayBuffer());
      let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(bin);
    };
  </script>
</body></html>`;

// Tutorial overlay: caption above the player's control bar, a visible mouse pointer, and title / end cards.
const OVERLAY_CSS = `
  #tut-cap { position: fixed; bottom: 130px; left: 860px; transform: translateX(-50%); z-index: 2147483000; display: flex; gap: 16px; align-items: center;
    width: max-content; max-width: 790px; background: rgba(20,20,26,.92); color: #fff; padding: 16px 30px 16px 18px; border-radius: 22px; box-shadow: 0 10px 40px rgba(0,0,0,.45);
    font: 700 30px/1.2 system-ui, "Segoe UI", sans-serif; transition: opacity .35s; opacity: 0; pointer-events: none; }
  #tut-cap .n { flex: none; width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center; font-size: 30px; color: #3d2c00;
    background: linear-gradient(135deg, #ffe066, #ff922b); }
  #tut-cap small { display: block; font-weight: 500; font-size: 22px; color: #d0d0d8; margin-top: 4px; }
  #tut-ptr { position: fixed; left: -50px; top: -50px; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; z-index: 2147483001; pointer-events: none;
    background: rgba(255,255,255,.9); border: 4px solid #1a73e8; box-shadow: 0 0 0 3px #fff, 0 2px 12px rgba(0,0,0,.6); }
  .tut-rip { position: fixed; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; border: 4px solid #ffd43b; z-index: 2147483001; pointer-events: none;
    animation: tut-rip .7s ease-out forwards; }
  @keyframes tut-rip { to { transform: scale(3.4); opacity: 0; } }
  #tut-card { position: fixed; inset: 0; z-index: 2147483002; display: grid; place-content: center; text-align: center; gap: 10px; opacity: 0; pointer-events: none;
    background: linear-gradient(135deg, #fff4bf, #ffd43b 55%, #ff922b); color: #1c1b20; transition: opacity .5s; font-family: system-ui, "Segoe UI", sans-serif; }
  #tut-card .big { font-size: 120px; line-height: 1; }
  #tut-card h1 { margin: 0; font-size: 70px; letter-spacing: -.02em; }
  #tut-card p { margin: 0; font-size: 34px; font-weight: 600; color: #3d3a2f; }
  #tut-card .url { margin-top: 18px; font-size: 40px; font-weight: 800; background: #1c1b20; color: #ffd43b; padding: 10px 28px; border-radius: 999px; justify-self: center; }
`;
// Runs inside the page (Playwright sends the function's source, so it works on extension pages too).
function installOverlay() {
  if (document.getElementById('tut-cap')) return;
  document.body.insertAdjacentHTML('beforeend', '<div id="tut-cap"></div><div id="tut-ptr"></div><div id="tut-card"></div>');
  const ptr = document.getElementById('tut-ptr');
  addEventListener('mousemove', (e) => { ptr.style.left = e.clientX + 'px'; ptr.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', (e) => {
    const r = document.createElement('div'); r.className = 'tut-rip'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
    document.body.append(r); setTimeout(() => r.remove(), 800);
  }, true);
  window.tutCaption = (n, text, sub) => {
    const c = document.getElementById('tut-cap');
    c.style.opacity = text ? 1 : 0;
    if (text) c.innerHTML = '<span class="n">' + n + '</span><span>' + text + (sub ? '<small>' + sub + '</small>' : '') + '</span>';
  };
  window.tutCard = (html) => {
    const c = document.getElementById('tut-card');
    c.style.opacity = html ? 1 : 0;
    if (html) c.innerHTML = html;
  };
}

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium', headless: true, viewport: { width: W, height: H },
  recordVideo: { dir: tmp, size: { width: W, height: H } },
  args: [
    `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--lang=en-US',
    '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${silence}`,
  ],
});
let [sw] = context.serviceWorkers();
if (!sw) sw = await context.waitForEvent('serviceworker');
await new Promise((r) => setTimeout(r, 1500)); // let the install finish (packs, welcome tab)
// The library for the video: a few of the short built-in meme lines (Hindi and English), so a random click is always short.
await sw.evaluate(() => chrome.storage.local.set({
  lines: MEME.defaultLines().filter((l) => ['d-hi-1', 'd-hi-7', 'd-hi-8', 'd-en-1', 'd-en-2', 'd-en-3', 'd-en-4', 'd-en-6'].includes(l.id)),
}));

await context.route('https://meet.google.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: CALL_SCENE }));
const now = () => Date.now();
const t0 = now(); // the call page's video starts when the page is created
const call = await context.newPage();
await call.goto('https://meet.google.com/abc-defg-hij');
await call.addStyleTag({ content: OVERLAY_CSS });
await call.evaluate(installOverlay);
await call.evaluate(() => window.joinCall());
const recStart = await call.evaluate(() => window.startRec()); // wall-clock ms when the audio recording began
await call.mouse.move(640, 400);

let page = call;
const wait = (ms) => page.waitForTimeout(ms);
const caption = (n, text, sub = '') => page.evaluate(([a, b, c]) => window.tutCaption(a, b, c), [n, text, sub]);
const card = (html) => page.evaluate((h) => window.tutCard(h), html);
const glide = (x, y) => page.mouse.move(x, y, { steps: 28 });
const type = (text, delay = 160) => page.keyboard.type(text, { delay });
const segments = []; // picture + sound pieces of the final video, in order
let open = null;
const begin = (src, t) => { open = { src, w0: now(), t }; };
const finish = () => { open.w1 = now(); segments.push(open); open = null; };
const search = async (q) => { await page.keyboard.press('Control+A'); await type(q, 190); await wait(500); };

// Title card (not part of the video: the page is trimmed from the first caption on).
await card('<div class="big">😂</div><h1>MemeBox</h1><p>Meme sounds and a voice changer for your video calls</p>');
await wait(2600);
await card('');
await wait(500);
begin('call', t0);

// 1. Join.
await caption('1', 'Join your call in the browser', 'Google Meet · Zoom · Teams · Discord');
await wait(3400);

// 2. One click.
await caption('2', 'Click the 😂 button', 'A random meme plays');
await wait(900);
await glide(FAB.x, FAB.y);
await wait(500);
await call.mouse.click(FAB.x, FAB.y);
await wait(1700);
await caption('✓', 'Everyone in the call hears it', 'It goes into your microphone. They don’t need MemeBox.');
await wait(3600);

// 3. The panel: pick sounds.
await caption('3', 'Right-click 😂 to pick a meme', 'Search, favourites, voices');
await wait(700);
await call.mouse.click(FAB.x, FAB.y, { button: 'right' });
await wait(900);
await type('chai');
await wait(700);
await call.keyboard.press('Enter'); // "Chai break!"
await wait(3300);
await search('bruh');
await call.keyboard.press('Enter'); // "Bruh."
await wait(3300);

// 4. Muted.
await caption('!', 'Muted? Memes are silent too', 'Unmute your mic in the call first');
await call.evaluate(() => { window.s.getAudioTracks()[0].enabled = false; }); // the call's mute button
await wait(2800); // the panel notices and turns amber
await call.keyboard.press('Enter'); // "Bruh." again: nobody hears it now
await wait(3600);
await call.evaluate(() => { window.s.getAudioTracks()[0].enabled = true; });
await call.mouse.click(900, 300); // close the panel
await caption('', '');
finish();

// 5. Add your own sound (Options page, silent: only the call's microphone is recorded).
const tOpt0 = now();
const opt = await context.newPage();
await opt.goto(`chrome-extension://${sw.url().split('/')[2]}/options.html`);
await opt.addStyleTag({ content: OVERLAY_CSS });
await opt.evaluate(installOverlay);
await opt.evaluate(() => { document.getElementById('clips-card').scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); });
await opt.mouse.move(700, 500);
page = opt;
await wait(500);
begin('opt', tOpt0);
await caption('5', 'Add your own sound', 'Settings → Add a clip: MP3, WAV, or a video');
await wait(1500);
const pick = await opt.locator('#clips-card .sources label.button.primary').boundingBox();
await glide(pick.x + pick.width / 2, pick.y + pick.height / 2);
await wait(500);
await opt.mouse.down(); await opt.mouse.up();
await opt.setInputFiles('#clip-file', boomFile); // the file chooser itself can't be recorded
await opt.locator('#trimmer').waitFor();
await opt.evaluate(() => document.getElementById('trimmer').scrollIntoView({ block: 'center' }));
await wait(1200);
await caption('5', 'Trim it, name it, save it', 'A saved clip can be up to 1 MB');
const nameBox = await opt.locator('#clip-name').boundingBox();
await glide(nameBox.x + 80, nameBox.y + nameBox.height / 2);
await opt.mouse.down(); await opt.mouse.up();
await opt.locator('#clip-name').fill('');
await type('Movie boom', 130);
await wait(700);
const save = await opt.locator('#clip-form button[type=submit]').boundingBox();
await glide(save.x + save.width / 2, save.y + save.height / 2);
await wait(500);
await opt.mouse.down(); await opt.mouse.up(); // the click saves the clip
await wait(1800);
await caption('✓', 'Saved! It is now in your list', '');
await wait(1800);
await caption('', '');
finish();

// 6. Back in the call: play the new sound.
page = call;
await call.bringToFront();
await wait(700);
begin('call', t0);
await caption('6', 'Your sound is in the list', 'Search for it and press Enter');
await call.mouse.move(640, 400);
await call.mouse.click(FAB.x, FAB.y, { button: 'right' });
await wait(900);
await search('boom');
await wait(600);
await call.keyboard.press('Enter');
await wait(3200);
await call.mouse.click(900, 300); // close the panel
await caption('', '');
finish();

// 7. OPTIONAL: the Sound effects pack (Options → Packs → Add).
await opt.bringToFront();
page = opt;
await wait(600);
await opt.evaluate(() => { document.getElementById('builtin-packs').scrollIntoView({ block: 'start' }); window.scrollBy(0, -120); });
await opt.mouse.move(700, 300);
begin('opt', tOpt0);
await caption('7', 'Optional: add the Sound effects pack', 'Settings → Packs → Add. Airhorn, rimshot, sad trombone…');
await wait(1800);
const addPack = opt.locator('#builtin-packs li', { hasText: 'Sound effects' }).locator('button.primary');
const addBox = await addPack.boundingBox();
await glide(addBox.x + addBox.width / 2, addBox.y + addBox.height / 2);
await wait(500);
await opt.mouse.down(); await opt.mouse.up(); // the click adds the pack
await wait(2200);
await caption('', '');
finish();

page = call;
await call.bringToFront();
await wait(700);
begin('call', t0);
await caption('7', 'Now try the airhorn', 'Right-click 😂, search “air”, press Enter');
await call.mouse.move(640, 400);
await call.mouse.click(FAB.x, FAB.y, { button: 'right' });
await wait(900);
await search('air'); // replaces the text left from step 6
const posterWall = now();
await call.keyboard.press('Enter'); // the airhorn
await wait(2900);
await search('sad');
await call.keyboard.press('Enter'); // sad trombone
await wait(3900);

// End card: close the panel and hide the button first (they sit above everything else on the page).
await call.mouse.click(900, 300);
await call.keyboard.press('Alt+KeyM');
await caption('✓', 'Ready in 10 seconds', 'Add MemeBox, open your call, click 😂');
await wait(3800); // the "MemeBox is hidden" note fades meanwhile
await caption('', '');
await wait(500);
await card('<div class="big">😂</div><h1>Free for Chrome and Edge</h1><p>Optional Pro: voice changer, camera captions, more packs</p><div class="url">memebox.pages.dev</div>');
await wait(3600);
finish();

const audioFile = path.join(tmp, 'call-audio.webm');
fs.writeFileSync(audioFile, Buffer.from(await call.evaluate(() => window.stopRec()), 'base64'));
const callVideo = call.video(), optVideo = opt.video();
await context.close(); // finishes the recordings
const callWebm = await callVideo.path(), optWebm = await optVideo.path();

// ---- put the pieces together ----
const run = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
const peak = /max_volume: (-?[\d.]+) dB/.exec(execFileSync('ffmpeg', ['-hide_banner', '-i', audioFile, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) || '');
const gain = peak ? Math.min(12, -2 - Number(peak[1])) : 0;
const sec = (ms) => (ms / 1000).toFixed(3);
const parts = [];
segments.forEach((s, i) => {
  const out = path.join(tmp, `part${i}.mp4`), len = sec(s.w1 - s.w0);
  const video = ['-ss', sec(s.w0 - s.t), '-t', len, '-i', s.src === 'call' ? callWebm : optWebm];
  const audio = s.src === 'call'
    ? ['-ss', sec(s.w0 - recStart), '-t', len, '-i', audioFile]
    : ['-f', 'lavfi', '-t', len, '-i', 'anullsrc=r=48000:cl=mono']; // the Options page makes no sound
  run([...video, ...audio, '-map', '0:v', '-map', '1:a', '-r', '25', '-c:v', 'libx264', '-crf', '17', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-af', `aresample=48000,aformat=channel_layouts=mono,volume=${gain.toFixed(1)}dB,alimiter=limit=0.95`, '-c:a', 'aac', '-b:a', '128k', out]);
  parts.push(out);
});
const list = path.join(tmp, 'parts.txt');
fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
const joined = path.join(tmp, 'joined.mp4');
run(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined]);
fs.mkdirSync(OUT, { recursive: true });
run(['-i', joined, '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '80k', '-ac', '1', '-movflags', '+faststart', path.join(OUT, 'tutorial.mp4')]);
run(['-i', joined, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-c:a', 'libopus', '-b:a', '56k', '-ac', '1', path.join(OUT, 'tutorial.webm')]);
// Poster: the airhorn moment, with the panel open (what shows before the video loads).
const last = segments.at(-1);
const posterAt = segments.slice(0, -1).reduce((a, s) => a + (s.w1 - s.w0) / 1000, 0) + (posterWall - last.w0) / 1000 + 0.9;
run(['-ss', posterAt.toFixed(2), '-i', path.join(OUT, 'tutorial.mp4'), '-frames:v', '1', path.join(OUT, 'tutorial-poster.png')]);
for (const f of ['tutorial.mp4', 'tutorial.webm', 'tutorial-poster.png']) {
  console.log(`assets/${f}  ${(fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0)} KB`);
}
console.log(`gain ${gain.toFixed(1)} dB; segments ${segments.map((s) => `${s.src} ${((s.w1 - s.w0) / 1000).toFixed(1)}s`).join(', ')}`);
console.log('frames kept in', tmp);
