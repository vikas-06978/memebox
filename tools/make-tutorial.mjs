// npm run tutorial: records a short "how to use MemeBox" video from the real extension running in
// Chromium, on a neutral mock call (coloured tiles, first names, no logos or real people).
// Silent on purpose (it autoplays on the landing page): big captions say what to do.
// Output: site/public/assets/tutorial.mp4 and tutorial.webm, plus tutorial-poster.png. Needs ffmpeg.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const EXT = path.join(ROOT, 'extension');
const OUT = path.join(ROOT, 'site', 'public', 'assets');
const W = 1280, H = 800;
const FAB = { x: 16 + 26, y: H - 120 - 26 }; // centre of the 😂 button at its default spot
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'memebox-tutorial-'));

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
  /* Tutorial overlay: caption on top, a visible mouse pointer, and title / end cards. */
  #cap { position: fixed; bottom: 24px; left: 860px; transform: translateX(-50%); z-index: 2147483000; display: flex; gap: 16px; align-items: center;
    width: max-content; max-width: 790px; background: rgba(20,20,26,.92); color: #fff; padding: 16px 30px 16px 18px; border-radius: 22px; box-shadow: 0 10px 40px rgba(0,0,0,.45);
    font: 700 30px/1.2 system-ui, "Segoe UI", sans-serif; transition: opacity .35s; opacity: 0; pointer-events: none; }
  #cap .n { flex: none; width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center; font-size: 30px; color: #3d2c00;
    background: linear-gradient(135deg, #ffe066, #ff922b); }
  #cap small { display: block; font-weight: 500; font-size: 22px; color: #d0d0d8; margin-top: 4px; }
  #ptr { position: fixed; left: -50px; top: -50px; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; z-index: 2147483001; pointer-events: none;
    background: rgba(255,255,255,.9); border: 4px solid #1a73e8; box-shadow: 0 0 0 3px #fff, 0 2px 12px rgba(0,0,0,.6); }
  .rip { position: fixed; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; border: 4px solid #ffd43b; z-index: 2147483001; pointer-events: none;
    animation: rip .7s ease-out forwards; }
  @keyframes rip { to { transform: scale(3.4); opacity: 0; } }
  #card { position: fixed; inset: 0; z-index: 2147483002; display: grid; place-content: center; text-align: center; gap: 10px; opacity: 0; pointer-events: none;
    background: linear-gradient(135deg, #fff4bf, #ffd43b 55%, #ff922b); color: #1c1b20; transition: opacity .5s; font-family: system-ui, "Segoe UI", sans-serif; }
  #card .big { font-size: 120px; line-height: 1; }
  #card h1 { margin: 0; font-size: 70px; letter-spacing: -.02em; }
  #card p { margin: 0; font-size: 34px; font-weight: 600; color: #3d3a2f; }
  #card .url { margin-top: 18px; font-size: 40px; font-weight: 800; background: #1c1b20; color: #ffd43b; padding: 10px 28px; border-radius: 999px; justify-self: center; }
</style></head><body>
  <div class="grid">
    <div class="tile" style="background:#364fc7"><b>A</b><span>Aman</span></div>
    <div class="tile" style="background:#0b7285"><b>P</b><span>Priya</span></div>
    <div class="tile" style="background:#5f3dc4"><b>R</b><span>Rahul</span></div>
    <div class="tile" style="background:#2b8a3e"><b>S</b><span>Sneha</span></div>
  </div>
  <div class="bar"><i></i><i></i><i></i><i class="end"></i></div>
  <div id="cap"></div><div id="ptr"></div><div id="card"></div>
  <script>
    window.joinCall = async () => { window.s = await navigator.mediaDevices.getUserMedia({ audio: true }); };
    const ptr = document.getElementById('ptr');
    addEventListener('mousemove', (e) => { ptr.style.left = e.clientX + 'px'; ptr.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', (e) => {
      const r = document.createElement('div'); r.className = 'rip'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      document.body.append(r); setTimeout(() => r.remove(), 800);
    }, true);
    window.caption = (n, text, sub) => {
      const c = document.getElementById('cap');
      c.style.opacity = text ? 1 : 0;
      if (text) c.innerHTML = '<span class="n">' + n + '</span><span>' + text + (sub ? '<small>' + sub + '</small>' : '') + '</span>';
    };
    window.card = (html) => {
      const c = document.getElementById('card');
      c.style.opacity = html ? 1 : 0;
      if (html) c.innerHTML = html;
    };
  </script>
</body></html>`;

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium', headless: true, viewport: { width: W, height: H },
  recordVideo: { dir: tmp, size: { width: W, height: H } },
  args: [
    `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--lang=en-US',
    '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
  ],
});
let [sw] = context.serviceWorkers();
if (!sw) sw = await context.waitForEvent('serviceworker');
await new Promise((r) => setTimeout(r, 1500)); // let the install finish (packs, welcome tab)
// Pro stays on, so the tutorial matches what the store listing says; no key needed for what it shows.

await context.route('https://meet.google.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: CALL_SCENE }));
const call = await context.newPage();
const t0 = Date.now(); // the video starts when the page is created
await call.goto('https://meet.google.com/abc-defg-hij');
await call.evaluate(() => window.joinCall());
await call.mouse.move(640, 400);
const wait = (ms) => call.waitForTimeout(ms);
const caption = (n, text, sub = '') => call.evaluate(([a, b, c]) => window.caption(a, b, c), [n, text, sub]);
const card = (html) => call.evaluate((h) => window.card(h), html);
const glide = (x, y) => call.mouse.move(x, y, { steps: 28 });

// Title card.
await card('<div class="big">😂</div><h1>MemeBox</h1><p>Meme sounds and a voice changer for your video calls</p>');
await wait(2800);
await card('');
await wait(500);
const startAt = (Date.now() - t0) / 1000; // the picture is ready from here

// 1. Join.
await caption('1', 'Join your call in the browser', 'Google Meet · Zoom · Teams · Discord');
await wait(3600);

// 2. One click.
await caption('2', 'Click the 😂 button', 'A random meme plays');
await wait(900);
await glide(FAB.x, FAB.y);
await wait(500);
await call.mouse.click(FAB.x, FAB.y);
await wait(1500);
await call.screenshot({ path: path.join(tmp, 'random-line.png') });
await caption('✓', 'Everyone in the call hears it', 'It goes into your microphone. They don’t need MemeBox.');
await wait(3600);

// 3. The panel.
await caption('3', 'Right-click 😂 for all memes', 'Search, favourites, voices');
await wait(700);
await call.mouse.click(FAB.x, FAB.y, { button: 'right' });
await wait(900);
await call.keyboard.type('chai', { delay: 220 });
await wait(900);
await call.screenshot({ path: path.join(tmp, 'after-search.png') });
await call.keyboard.press('Enter'); // plays the first match
const posterAt = (Date.now() - t0) / 1000 - startAt + 1.2;
await wait(3600);

// 4. Muted.
await caption('!', 'Muted? Memes are silent too', 'Unmute your mic in the call first');
await call.evaluate(() => { window.s.getAudioTracks()[0].enabled = false; }); // the call's mute button
await wait(4200);
await call.evaluate(() => { window.s.getAudioTracks()[0].enabled = true; });
await wait(800);

// End card: close the panel and hide the button first (they sit above everything else on the page).
await call.mouse.click(900, 300);
await call.keyboard.press('Alt+KeyM');
await caption('✓', 'Ready in 10 seconds', 'Add MemeBox, open your call, click 😂');
await wait(3800); // the "MemeBox is hidden" note fades meanwhile
await caption('', '');
await wait(500);
await card('<div class="big">😂</div><h1>Free for Chrome and Edge</h1><p>Optional Pro: voice changer, camera captions, more packs</p><div class="url">memebox.pages.dev</div>');
await wait(3600);
await call.screenshot({ path: path.join(tmp, 'poster-source.png') });
const video = call.video();
await context.close(); // finishes the recording
const webm = await video.path();

fs.mkdirSync(OUT, { recursive: true });
const trim = ['-ss', String(Math.max(0, startAt - 0.3).toFixed(2))];
const run = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
run([...trim, '-i', webm, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p', '-r', '25', '-movflags', '+faststart', path.join(OUT, 'tutorial.mp4')]);
run([...trim, '-i', webm, '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-r', '25', path.join(OUT, 'tutorial.webm')]);
// Poster: a frame from the moment a meme caption is on screen (what shows before the video loads).
run(['-ss', posterAt.toFixed(2), '-i', path.join(OUT, 'tutorial.mp4'), '-frames:v', '1', path.join(OUT, 'tutorial-poster.png')]);
for (const f of ['tutorial.mp4', 'tutorial.webm', 'tutorial-poster.png']) {
  console.log(`assets/${f}  ${(fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0)} KB`);
}
console.log('frames kept in', tmp);
