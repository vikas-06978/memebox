// English captioned product tour. Captures actual packaged UI in a disposable
// browser profile, then composes readable chapters with the bundled camera engine.
// Never records real users, meetings or a physical camera/microphone.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { clickPanel } from '../tests/e2e/closed-panel.mjs';

const root = path.resolve(import.meta.dirname, '..');
const ext = path.join(root, 'extension'), out = path.join(root, 'site/public/assets');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'memebox-product-tour-'));
const chapters = [
  ['intro', 'Your call.\nYour personality.', 'MemeBox brings memes, music, pictures and camera effects into browser calls.', 'A personal studio for browser calls', 'call'],
  ['memes', 'One click.\nA room full of laughs.', 'Join a browser call. Click 😂 for a random meme; right-click it to choose one.', '01 / Memes and sound effects', 'call'],
  ['panel', 'Everything\nin one panel.', 'Search your library, save favourites and use Alt+1–9. Alt+0 stops all playback.', '02 / Your call controls', 'panel'],
  ['music', 'Keep the vibe.\nChoose the audience.', 'Only me is private listening. Everyone in call mixes music into your meeting mic.', '03 / Music and audience', 'music'],
  ['player', 'Playlists and\nvideo memes, too.', 'For player audio, choose Everyone in call, select the player tab and enable Share tab audio.', '04 / Browser-approved tab audio', 'music'],
  ['pictures', 'A picture.\nWith or without words.', 'Choose a picture, preview it and press Add. Caption and Read caption aloud are optional.', '05 / Pictures and captions', 'picture'],
  ['characters', 'Meet your\nnew companions.', 'Pick a character and outfit. Preview its signature action, waving, dancing and reactions.', '06 / Animated companions', 'companion'],
  ['gestures', 'Small gestures.\nBig personality.', 'Optional Follow me uses local face and hand models. It supports selected gestures, not general sign language.', '07 / Local face and hand reactions', 'companion'],
  ['filters', 'Make your\ncamera feel like you.', 'Try filters, studio lights and light shows. Your camera must be on for others to see them.', '08 / Lights and camera filters', 'filter'],
  ['voice', 'Your voice.\nA different twist.', 'Try voice effects and auto-duck. Keep the meeting mic unmuted so others hear the mix.', '09 / Voice and sound', 'sound'],
  ['timers', 'The right line.\nAt the right time.', 'Party mode plays a selected line at a clock time or interval while your call mic is connected.', '10 / Timed lines', 'timer'],
  ['plans', 'Start free.\nAdd your favourites.', 'Passes count only while on in a connected call. Unused time never expires; owned extras stay on your key.', '11 / Passes and ownership', 'plans'],
  ['ready', 'Open the studio.\nMake it yours.', 'Preview first, then join your browser call. Your saved content stays on this device when you update.', 'Ready for your next call', 'companion'],
].map(([id, title, caption, label, shot]) => ({ id, title, caption, label, shot, seconds: id === 'player' || id === 'plans' || id === 'gestures' ? 10 : 8 }));
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium', headless: true, viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--lang=en-US', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
try {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker');
  const id = sw.url().split('/')[2];
  const options = await context.newPage();
  await options.goto(`chrome-extension://${id}/options.html`);
  await sw.evaluate(async () => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...settings, theme: 'light' }, license: { key: 'MBX-DEMO-DEMO-DEMO', status: 'active', unlimited: true, checkedAt: Date.now() } });
  });
  await context.route('https://meet.google.com/**', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>Illustrative browser call</title><style>body{margin:0;background:#17232b;color:#fff;font:18px system-ui;padding:32px}main{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:20px 0 0 80px}.person{height:260px;background:#29465a;border-radius:22px;display:grid;place-content:center;text-align:center;font-size:68px}.person:nth-child(2){background:#4c3870}.person:nth-child(3){background:#246355}.person:nth-child(4){background:#565b2d}small{display:block;font-size:18px;margin-top:14px}</style><b>Browser call · illustrative scene</b><main><div class="person">A<small>Alex</small></div><div class="person">S<small>Sam</small></div><div class="person">J<small>Jamie</small></div><div class="person">You<small>Your camera</small></div></main><script>navigator.mediaDevices.getUserMedia({audio:true}).then(s=>window.callStream=s)</script>` }));
  const call = await context.newPage();
  await call.goto('https://meet.google.com/demo-tour');
  await call.waitForFunction(() => !!window.callStream);
  await call.waitForTimeout(1200);
  const shots = {};
  const capture = async (name, page, locator) => { shots[name] = 'data:image/png;base64,' + (await (locator ? page.locator(locator) : page).screenshot()).toString('base64'); };
  await capture('call', call);
  await call.mouse.click(42, 654, { button: 'right' });
  await call.waitForTimeout(400);
  await capture('panel', call);
  await clickPanel(call, '.ptab[data-tab="music"]'); await capture('music', call);
  await clickPanel(call, '.ptab[data-tab="sound"]'); await capture('sound', call);
  await options.bringToFront();
  await options.locator('#line-text').fill('That was close!');
  const pic = await options.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 400; const g = c.getContext('2d'); g.fillStyle = '#fff0a5'; g.fillRect(0,0,600,400); g.fillStyle = '#222'; g.font = 'bold 52px system-ui'; g.textAlign = 'center'; g.fillText('THAT WAS CLOSE!',300,160); g.font = '100px sans-serif'; g.fillText('😅',300,300); return c.toDataURL().split(',')[1]; });
  await options.setInputFiles('#line-pic', { name: 'reaction.png', mimeType: 'image/png', buffer: Buffer.from(pic, 'base64') });
  await options.locator('#line-pic-preview').waitFor({ state: 'visible' });
  await options.locator('#lines-card').scrollIntoViewIfNeeded();
  await capture('picture', options, '#lines-card');
  await options.locator('#party-card').scrollIntoViewIfNeeded(); await capture('timer', options, '#party-card');
  const plans = await context.newPage(); await plans.goto(`chrome-extension://${id}/plans.html`); await capture('plans', plans);
  const pg = await context.newPage(); await pg.goto(`chrome-extension://${id}/playground.html`);
  await pg.locator('[data-character="panda"]').click(); await pg.selectOption('#outfit', 'glasses'); await capture('companion', pg);
  await pg.selectOption('#filter', 'neon'); await capture('filter', pg);
  const renderPage = await context.newPage();
  await renderPage.setContent('<!doctype html><html><title>MemeBox product tour renderer</title><body style="margin:0;background:#101820"><canvas width="1280" height="800"></canvas></body></html>');
  await renderPage.addScriptTag({ path: path.join(ext, 'lib/music.js') });
  await renderPage.addScriptTag({ path: path.join(ext, 'lib/fx.js') });
  await renderPage.evaluate(async ({ chapters, shots }) => {
    const canvas = document.querySelector('canvas'), g = canvas.getContext('2d');
    const images = {};
    for (const [id, src] of Object.entries(shots)) { const image = new Image(); image.src = src; await image.decode(); images[id] = image; }
    const ac = new AudioContext(); await ac.resume();
    const dest = ac.createMediaStreamDestination(), music = MemeMusic.createPlayer(ac, dest); music.setVolume(.22); music.play('chill');
    const stream = canvas.captureStream(25); stream.addTrack(dest.stream.getAudioTracks()[0]);
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 1800000 });
    const chunks = []; rec.ondataavailable = e => chunks.push(e.data); rec.start(250);
    const sample = document.createElement('canvas'); sample.width = 800; sample.height = 450;
    const cam = document.createElement('canvas'); cam.width = 800; cam.height = 450;
    const renderer = MemeFx.createRenderer();
    const wrap = (text, x, y, width, lineHeight) => { let line = ''; for (const word of text.split(' ')) { const next = line ? line + ' ' + word : word; if (g.measureText(next).width > width && line) { g.fillText(line, x, y); y += lineHeight; line = word; } else line = next; } if (line) g.fillText(line, x, y); return y; };
    const round = (x,y,w,h,r,fill) => { g.fillStyle=fill; g.beginPath(); g.roundRect(x,y,w,h,r); g.fill(); };
    const total = chapters.reduce((n,c)=>n+c.seconds,0), start = performance.now();
    await new Promise(resolve => {
      const tick = () => {
        const elapsed = (performance.now()-start)/1000;
        let offset = 0, chapter = chapters.at(-1), index = chapters.length - 1;
        for (let i=0;i<chapters.length;i++) { if (elapsed < offset + chapters[i].seconds) { chapter=chapters[i]; index=i; break; } offset += chapters[i].seconds; }
        g.fillStyle='#111d25'; g.fillRect(0,0,1280,800);
        const glow=g.createRadialGradient(1080,80,0,1080,80,850);glow.addColorStop(0,'#234754');glow.addColorStop(1,'#111d25');g.fillStyle=glow;g.fillRect(0,0,1280,800);
        g.font='bold 26px system-ui';g.fillStyle='#fff';g.fillText('MemeBox',48,58);
        g.font='13px system-ui';g.fillStyle='#a8bdc7';g.fillText('THE PRODUCT TOUR  /  ENGLISH CAPTIONS',48,84);
        g.textAlign='right';g.fillText(String(index+1).padStart(2,'0')+' / '+chapters.length,1232,58);g.textAlign='left';
        round(48,145,180,29,14,'#ffe398');g.fillStyle='#263019';g.font='bold 12px system-ui';g.fillText('MADE FOR YOUR CALLS',62,165);
        g.fillStyle='#fff';g.font='bold 40px system-ui';chapter.title.split('\n').forEach((line,i)=>g.fillText(line,48,235+i*49));
        g.font='19px system-ui';g.fillStyle='#b8cbd4';wrap(chapter.label,48,368,335,28);
        g.font='14px system-ui';g.fillStyle='#9aafb9';wrap('Chrome & Edge · browser calls\nPreview first. Share when ready.'.replace('\n',' '),48,478,310,25);
        const x=430,y=132,w=802,h=500;
        round(x-3,y-3,w+6,h+6,20,'#41545d');
        g.save();g.beginPath();g.roundRect(x,y,w,h,18);g.clip();g.fillStyle='#fff';g.fillRect(x,y,w,h);
        if (chapter.shot==='companion' || chapter.id==='filters') {
          MemeFx.drawSample(sample.getContext('2d'),800,450,elapsed*1000);
          const character=chapter.id==='ready'?'cat':chapter.id==='gestures'?'bird':'panda';
          const cfg={...MemeFx.DEFAULTS,on:true,lamp:chapter.id==='filters',character,follow:false,filter:chapter.id==='filters'?'neon':'none',outfit:chapter.id==='characters'?'glasses':'none',studio:true};
          renderer.render(cam.getContext('2d'),sample,800,450,cfg,elapsed*1000,{level:.4,bass:.3,mid:.2,high:.2,mood:'fun'},{charAct:chapter.id==='gestures'?'wave':'dance',charT:elapsed,charU:(elapsed%4)/4});
          g.drawImage(cam,x,y,w,h-48);g.fillStyle='#fff';g.fillRect(x,y+h-48,w,48);g.fillStyle='#263641';g.font='15px system-ui';g.fillText('Simulated camera preview · actual MemeBox effects engine',x+20,y+h-18);
        } else {
          const image=images[chapter.shot],scale=Math.min(w/image.width,h/image.height);g.drawImage(image,x+(w-image.width*scale)/2,y+(h-image.height*scale)/2,image.width*scale,image.height*scale);
        }
        g.restore();
        round(32,665,1216,96,18,'#070f14');g.fillStyle='#fff';g.font='21px system-ui';wrap(chapter.caption,56,704,1160,29);
        round(48,779,1184,4,2,'#344751');round(48,779,1184*Math.min(1,elapsed/total),4,2,'#ffe398');
        if(elapsed>=total){rec.onstop=async()=>{const bytes=new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer());let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));window.tourResult=btoa(s);music.stop();ac.close();resolve();};rec.stop();return;}
        requestAnimationFrame(tick);
      };tick();
    });
  }, { chapters, shots });
  const raw = path.join(tmp, 'tour.webm'); fs.writeFileSync(raw, Buffer.from(await renderPage.evaluate(() => window.tourResult), 'base64'));
  fs.mkdirSync(out, { recursive: true });
  const run = args => execFileSync('ffmpeg', ['-y','-loglevel','error',...args], { stdio: 'inherit' });
  run(['-i',raw,'-r','20','-c:v','libx264','-preset','slow','-crf','34','-pix_fmt','yuv420p','-c:a','aac','-b:a','40k','-movflags','+faststart',path.join(out,'tutorial.mp4')]);
  run(['-i',raw,'-r','20','-c:v','libvpx-vp9','-b:v','0','-crf','42','-row-mt','1','-threads','4','-c:a','libopus','-b:a','32k',path.join(out,'tutorial.webm')]);
  fs.copyFileSync(path.join(out,'tutorial.webm'),path.join(ext,'tutorial.webm'));
  run(['-ss','50','-i',raw,'-frames:v','1',path.join(out,'tutorial-poster.png')]);
  let at=0;const stamp=n=>new Date(n*1000).toISOString().slice(11,23);
  const vtt='WEBVTT\n\n'+chapters.map((chapter,i)=>{const from=at;at+=chapter.seconds;return `${i+1}\n${stamp(from)} --> ${stamp(at)}\n${chapter.caption}\n`;}).join('\n');
  fs.writeFileSync(path.join(out,'tutorial.en.vtt'),vtt);fs.writeFileSync(path.join(ext,'tutorial.en.vtt'),vtt);
  fs.writeFileSync(path.join(out,'tutorial-chapters.json'),JSON.stringify(chapters.map(({id,label,seconds})=>({id,label,seconds})),null,2)+'\n');
  console.log(`English captioned tour: ${at}s, ${chapters.length} chapters. MP4, WebM, poster and VTT created.`);
} finally { await context.close(); }
