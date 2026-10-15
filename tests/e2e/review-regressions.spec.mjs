import {test,expect} from './fixtures.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {CURATED_VIDEO_GROUPS} from '../../site/src/curated-video-catalog.js';
import {clickPanel,panelElement} from './closed-panel.mjs';
const root=path.resolve(import.meta.dirname,'../..');
async function room(context,extensionId,{catalog=true}={}){
 await context.route('https://memebox.site/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/config')return route.fulfill({json:{phonkEnabled:true}});
  if(url.pathname==='/api/packs')return route.fulfill({json:{packs:catalog?CURATED_VIDEO_GROUPS.map(g=>({...g,id:g.name,title:g.packTitle})):[]}});
  const filename=path.join(root,'site/public',url.pathname==='/music-room'?'music-room.html':url.pathname);
  if(!fs.existsSync(filename))return route.fulfill({status:404,body:'missing'});
  return route.fulfill({path:filename,contentType:filename.endsWith('.js')?'text/javascript':filename.endsWith('.css')?'text/css':filename.endsWith('.html')?'text/html':undefined});
 });
 await context.route('https://www.youtube-nocookie.com/**',route=>route.fulfill({contentType:'text/html',body:`<script>parent.postMessage(JSON.stringify({event:'onReady'}),'*');parent.postMessage(JSON.stringify({event:'onStateChange',info:1}),'*');window.addEventListener('message',e=>{try{const d=JSON.parse(e.data);if(d.func==='loadVideoById')parent.postMessage(JSON.stringify({event:'onStateChange',info:1}),'*')}catch{}})</script>`}));
 const page=await context.newPage();await page.goto('https://memebox.site/music-room#extension='+extensionId);return page;
}
test('library loads memes beside music, counts strong language correctly and switches on the first click',async({context,extensionId})=>{
 const page=await room(context,extensionId);
 await expect(page.locator('.meme-item')).toHaveCount(27);
 await expect(page.locator('[data-video-id="dHER3Vc9GBI"]')).toBeVisible();
 await expect(page.locator('[data-video-id="JqIV1wSYhvM"]')).toHaveCount(0);
 await expect(page.locator('[data-video-id="vqcjCI581Wk"]')).toHaveCount(0);
 await page.locator('#room-adult').check();await expect(page.locator('.meme-item')).toHaveCount(33);
 await expect(page.locator('#published-list')).toContainText('Strong language');
 const first=page.locator('[data-video-id="gvoC8TJ27n8"]'),next=page.locator('[data-video-id="IknkMyCpOr8"]');
 await first.click();await expect(page.locator('#room-status')).toContainText('Playing through YouTube');
 const initial=await page.locator('#youtube-player').getAttribute('src');
 await next.click();await expect(next).toHaveAttribute('aria-pressed','true');await expect(page.locator('#room-status')).toContainText('Playing through YouTube');
 expect(await page.locator('#youtube-player').getAttribute('src')).toBe(initial);
 await page.locator('#room-adult').uncheck();await expect(page.locator('.meme-item')).toHaveCount(27);
 await page.locator('#published-section').screenshot({path:'tests/.tmp/fixed-meme-library.png'});
});
test('browser-approved player audio reaches the outgoing call and Only me disconnects it',async({context,extensionId,callPage})=>{
 await callPage.evaluate(async()=>{await window.joinCall();await window.noDuck()});
 const page=await room(context,extensionId,{catalog:false});
 await page.evaluate(()=>{navigator.mediaDevices.getDisplayMedia=async()=>{const ac=new AudioContext();await ac.resume();window.testShareContext=ac;const out=ac.createMediaStreamDestination(),osc=ac.createOscillator(),gain=ac.createGain();gain.gain.value=.5;osc.connect(gain).connect(out);osc.start();return out.stream;}});
 await page.locator('#room-everyone').click();
 await expect(page.locator('#room-share-status')).toContainText('Everyone in the call can hear',{timeout:20000});
 await expect.poll(()=>callPage.evaluate(()=>window.peakOver(700)),{timeout:10000}).toBeGreaterThan(.15);
 await page.locator('#room-only-me').click();await expect(page.locator('#room-share-status')).toHaveText('Only you hear this player.');
 const invalid=await page.evaluate(id=>new Promise(resolve=>chrome.runtime.sendMessage(id,{type:'room-audio-offer',sdp:'m=video'},resolve)),extensionId);expect(invalid.ok).toBe(false);expect(invalid.error).toBe('Invalid audio connection.');
 await page.evaluate(()=>{navigator.mediaDevices.getDisplayMedia=async()=>{throw new DOMException('cancelled','NotAllowedError')}});await page.locator('#room-everyone').click();await expect(page.locator('#room-share-status')).toContainText('Sharing cancelled');
 await expect.poll(()=>callPage.evaluate(()=>window.peakOver(300))).toBeLessThan(.1);
});
test('picture selection stays a draft and optional caption/speech never use the filename',async({context,extensionId,callPage})=>{
 const options=await context.newPage();await options.goto(`chrome-extension://${extensionId}/options.html`);
 const image=await options.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=60;c.getContext('2d').fillRect(0,0,80,60);return c.toDataURL().split(',')[1]});
 const sw=context.serviceWorkers()[0];const count=await sw.evaluate(async()=>((await chrome.storage.local.get('lines')).lines||[]).length);
 await options.locator('#line-pic').setInputFiles({name:'NEVER-SAY-THIS.jpg',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
 await expect(options.locator('#line-pic-preview')).toBeVisible();await expect(options.locator('#line-text')).toHaveValue('');
 await options.locator('#line-form').screenshot({path:'tests/.tmp/fixed-picture-editor.png'});
 expect(await sw.evaluate(async()=>((await chrome.storage.local.get('lines')).lines||[]).length)).toBe(count);
 await options.locator('#line-pic-remove').click();await expect(options.locator('#line-pic-preview')).toBeHidden();
 await options.locator('#line-pic').setInputFiles({name:'NEVER-SAY-THIS.jpg',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
 await options.locator('#line-submit').click();
 await expect.poll(()=>sw.evaluate(async()=>((await chrome.storage.local.get('lines')).lines||[]).some(l=>l.pictureId))).toBe(true);
 const picture=await sw.evaluate(async()=>((await chrome.storage.local.get('lines')).lines||[]).find(l=>l.pictureId));
 expect(picture.pictureCaption).toBe('');expect(picture.text).not.toContain('NEVER-SAY');
 await callPage.evaluate(async()=>{await window.joinCall();await window.noDuck()});
 await sw.evaluate(async item=>{const [tab]=await chrome.tabs.query({url:'https://meet.google.com/*'});await handlePlay(tab.id,{frameId:0,reqId:901,item})},picture);
 expect(await callPage.evaluate(()=>window.peakOver(700))).toBeLessThan(.1);
 await options.locator('#line-text').fill('Visible but silent');await options.locator('#line-speak').uncheck();
 await options.locator('#line-submit').click();
 const silent=await sw.evaluate(async()=>((await chrome.storage.local.get('lines')).lines||[]).find(l=>l.text==='Visible but silent'));
 expect(silent.speak).toBe(false);
});

test('picture pronunciation is audible with Read caption aloud and silent when unchecked',async({context,extensionId,callPage})=>{
 const options=await context.newPage();await options.goto(`chrome-extension://${extensionId}/options.html`);
 const image=await options.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=60;return c.toDataURL().split(',')[1]});
 await options.locator('#line-pic').setInputFiles({name:'do-not-speak.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
 await options.locator('#line-say').fill('Hello everyone this picture has a voice');
 await options.locator('#line-speak').check();await options.locator('#line-submit').click();
 const sw=context.serviceWorkers()[0];
 await expect.poll(()=>sw.evaluate(async()=>((await chrome.storage.local.get('lines')).lines||[]).filter(l=>l.pictureId).length)).toBe(1);
 await callPage.evaluate(async()=>{await window.joinCall();await window.noDuck()});
 const play=async()=>sw.evaluate(async()=>{const item=(await chrome.storage.local.get('lines')).lines.find(l=>l.pictureId);const [tab]=await chrome.tabs.query({url:'https://meet.google.com/*'});await handlePlay(tab.id,{frameId:0,reqId:911,item})});
 await play();await expect.poll(()=>callPage.evaluate(()=>window.peakOver(700)),{timeout:15000}).toBeGreaterThan(.15);
 await sw.evaluate(async()=>{const {lines}=await chrome.storage.local.get('lines');lines.find(l=>l.pictureId).speak=false;await chrome.storage.local.set({lines})});
 await callPage.evaluate(()=>window.postMessage({source:'memebox-bridge-9c1e',type:'stop'},'*'));
 await expect.poll(()=>callPage.evaluate(()=>window.peakOver(200))).toBeLessThan(.1);
 await play();
 expect(await callPage.evaluate(()=>window.peakOver(700))).toBeLessThan(.1);
});

test('call panel Everyone in call sends playlist audio and tabs have room for their labels',async({context,extensionId,callPage})=>{
 await callPage.evaluate(async()=>{await window.joinCall();await window.noDuck()});
 const player=await room(context,extensionId,{catalog:false});
 await callPage.bringToFront();await callPage.mouse.click(42,574,{button:'right'});await clickPanel(callPage,'[data-tab="music"]');
 const cdp=await context.newCDPSession(callPage),contexts=[];
 cdp.on('Runtime.executionContextCreated',e=>contexts.push(e.context));await cdp.send('Runtime.enable');
 let world;
 for(const ctx of contexts){const r=await cdp.send('Runtime.evaluate',{contextId:ctx.id,expression:'typeof globalThis.MemeBridge'});if(r.result.value==='object')world=ctx.id;}
 expect(world).toBeTruthy();
 await cdp.send('Runtime.evaluate',{contextId:world,expression:`navigator.mediaDevices.getDisplayMedia=async()=>{const ac=new AudioContext();await ac.resume();globalThis.testShareAudio=ac;const out=ac.createMediaStreamDestination(),osc=ac.createOscillator(),gain=ac.createGain();gain.gain.value=.5;osc.connect(gain).connect(out);osc.start();return out.stream;}`});
 await clickPanel(callPage,'[data-audience="call"]');
 await expect.poll(async()=>(await panelElement(callPage,'[data-share-player]')).text,{timeout:20000}).toContain('Player audio shared');
 await expect.poll(()=>callPage.evaluate(()=>window.peakOver(700)),{timeout:10000}).toBeGreaterThan(.15);
 await expect(player.locator('#room-everyone')).toHaveAttribute('aria-pressed','true');
 const tabs=await Promise.all(['memes','music','lights','pictures','sound'].map(id=>panelElement(callPage,`.ptab[data-tab="${id}"]`)));
 for(let i=1;i<tabs.length;i++)expect(tabs[i].x-tabs[i].width/2).toBeGreaterThan(tabs[i-1].x+tabs[i-1].width/2);
 await callPage.screenshot({path:'tests/.tmp/fixed-panel-audio-tabs.png'});
 await clickPanel(callPage,'[data-audience="me"]');
 await expect.poll(()=>callPage.evaluate(()=>window.peakOver(300))).toBeLessThan(.1);
 await expect(player.locator('#room-only-me')).toHaveAttribute('aria-pressed','true');
 await clickPanel(callPage,'[data-audience="call"]');
 await expect.poll(()=>callPage.evaluate(()=>window.peakOver(300))).toBeGreaterThan(.15);
 await expect(player.locator('#room-everyone')).toHaveAttribute('aria-pressed','true');
 await player.locator('#room-only-me').click();
 await expect.poll(()=>callPage.evaluate(()=>window.peakOver(300))).toBeLessThan(.1);
 await cdp.detach();
});
