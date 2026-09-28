// npm run store-images: makes the store screenshots (1280x800) and the promo tile (440x280)
// from the real extension running in Chromium. Output: store/*.png
// The call scene is a neutral mock-up (coloured tiles, initials, no logos or real people).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const EXT = path.join(ROOT, 'extension');
const OUT = path.join(ROOT, 'store');
fs.mkdirSync(OUT, { recursive: true });
const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(EXT, 'icons', 'icon128.png')).toString('base64');

const CALL_SCENE = `<!doctype html><html><head><title>Team call</title><style>
  * { box-sizing: border-box; } html, body { margin: 0; height: 100%; }
  body { background: #1f2023; font: 15px system-ui, "Segoe UI", sans-serif; color: #fff; display: grid; grid-template-rows: 1fr 76px; }
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
  <script>window.joinCall = async () => { window.s = await navigator.mediaDevices.getUserMedia({ audio: true }); };</script>
</body></html>`;

function frame(title, sub, img, { w = 1280, h = 800 } = {}) {
  return `<!doctype html><html><head><style>
    html, body { margin: 0; width: ${w}px; height: ${h}px; }
    body { background: linear-gradient(135deg, #fff4bf, #ffd43b); font: 16px system-ui, "Segoe UI", sans-serif; color: #202124;
      display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 40px; padding: 0 80px; box-sizing: border-box; }
    h1 { font-size: 52px; line-height: 1.1; margin: 0 0 16px; } p { font-size: 22px; margin: 0; color: #4a4a4a; }
    .shot { justify-self: center; border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.25); max-width: 100%; }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 700; font-size: 24px; margin-bottom: 28px; }
  </style></head><body>
    <div><div class="brand"><img src="${icon}" width="48" height="48" alt="">MemeBox</div><h1>${title}</h1><p>${sub}</p></div>
    <img class="shot" src="${img}" alt="">
  </body></html>`;
}

const PROMO = `<!doctype html><html><head><style>
  html, body { margin: 0; width: 440px; height: 280px; overflow: hidden; }
  body { background: linear-gradient(135deg, #fff4bf, #ffd43b); font-family: system-ui, "Segoe UI", sans-serif; color: #202124;
    display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  img { width: 96px; height: 96px; } h1 { margin: 8px 0 4px; font-size: 40px; } p { margin: 0; font-size: 18px; font-weight: 600; }
</style></head><body><img src="${icon}" alt=""><h1>MemeBox</h1><p>Meme sounds &amp; voice changer for your calls</p></body></html>`;

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: [
    `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--lang=en-US',
    '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
  ],
});
let [sw] = context.serviceWorkers();
if (!sw) sw = await context.waitForEvent('serviceworker');
const id = sw.url().split('/')[2];
await new Promise((r) => setTimeout(r, 1500)); // let the install finish (packs, welcome tab)
const shot = (name) => path.join(OUT, name);

// 1. The call with the panel open and a caption on screen.
await context.route('https://meet.google.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: CALL_SCENE }));
const call = await context.newPage();
await call.goto('https://meet.google.com/abc-defg-hij');
await call.evaluate(() => window.joinCall());
await call.waitForTimeout(800);
await call.mouse.click(42, 800 - 120 - 26, { button: 'right' }); // open the panel
await call.waitForTimeout(400);
await call.keyboard.type('chai');
await call.keyboard.press('Enter'); // plays "Chai break!" -> big caption
await call.waitForTimeout(900);
await call.screenshot({ path: shot('screenshot-1-call.png') });

// 2. Options page.
const options = await context.newPage();
await options.goto(`chrome-extension://${id}/options.html`);
await options.waitForTimeout(600);
await options.screenshot({ path: shot('screenshot-2-options.png') });

// 3. Welcome page.
const welcome = context.pages().find((p) => p.url().endsWith('/onboarding.html')) || await context.newPage();
if (!welcome.url().endsWith('/onboarding.html')) await welcome.goto(`chrome-extension://${id}/onboarding.html`);
await welcome.setViewportSize({ width: 1280, height: 800 });
await welcome.waitForTimeout(300);
await welcome.screenshot({ path: shot('screenshot-3-welcome.png') });

// 4. The toolbar popup, framed with a headline.
const popup = await context.newPage();
await popup.setViewportSize({ width: 320, height: 420 });
await popup.goto(`chrome-extension://${id}/popup.html`);
await popup.evaluate(() => { document.getElementById('how').open = false; });
await popup.waitForTimeout(400);
const box = await popup.locator('body').boundingBox();
const popupPng = await popup.screenshot({ clip: { x: 0, y: 0, width: 320, height: Math.ceil(box.height) } });
const framed = await context.newPage();
await framed.setViewportSize({ width: 1280, height: 800 });
await framed.setContent(frame('Play any tab into your call', 'A funny YouTube moment? Click the MemeBox icon on that tab and everyone in the call hears it. Nothing is downloaded.',
  'data:image/png;base64,' + popupPng.toString('base64')));
await framed.screenshot({ path: shot('screenshot-4-tab-audio.png') });

// Promo tile 440x280.
const promo = await context.newPage();
await promo.setViewportSize({ width: 440, height: 280 });
await promo.setContent(PROMO);
await promo.screenshot({ path: shot('promo-440x280.png') });

await context.close();
for (const f of fs.readdirSync(OUT).filter((x) => x.endsWith('.png'))) console.log('store/' + f);
