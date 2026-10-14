import {test,expect} from './fixtures.mjs';
import {spawn} from 'node:child_process';
import path from 'node:path';
let server,origin;
test.beforeAll(async()=>{
 const file=path.resolve(import.meta.dirname,'../../review/start-music.py');
 const code=`import importlib.util; s=importlib.util.spec_from_file_location('room',${JSON.stringify(file)}); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); server=m.ThreadingHTTPServer(('127.0.0.1',0),m.RoomHandler); print(server.server_address[1],flush=True); server.serve_forever()`;
 server=spawn('python3',['-u','-c',code],{stdio:['ignore','pipe','pipe']});
 const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Room server startup timeout')),10000);server.stdout.once('data',data=>{clearTimeout(timer);resolve(Number(String(data).trim()))});server.once('error',reject)});origin='http://127.0.0.1:'+port;
});
test.afterAll(()=>server?.kill());
const mockYoutube=async context=>context.route('https://www.youtube-nocookie.com/**',route=>route.fulfill({contentType:'text/html',body:'<html><body>Visible YouTube fixture<script>parent.postMessage(JSON.stringify({event:"onStateChange",info:1}),"*")</script></body></html>'}));

test('localhost room embeds playlists, stops them when an original is selected, and keeps provider requests opt-in',async({context})=>{
 await mockYoutube(context);const page=await context.newPage(),requests=[],errors=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/music-room.html');await expect(page.locator('[data-playlist]')).toHaveCount(5);await expect(page.locator('[data-original]')).toHaveCount(16);
 expect(requests.filter(url=>url.includes('youtube')).length).toBe(0);expect(requests.filter(url=>url.includes('/api/')).length).toBe(0);
 await page.locator('[data-playlist-play]').first().click();await expect(page.locator('#youtube-player')).toBeVisible();await expect(page.locator('#room-status')).toContainText('Playing through YouTube');const url=new URL(await page.locator('#youtube-player').getAttribute('src'));expect(url.searchParams.get('list')).toBe('PLNMH5TG547qkMqLjy9l2yn4Yaf-X5yAzN');expect(url.searchParams.get('origin')).toBe(origin);
 await page.locator('[data-original-play="phonk_drift"]').click();await expect(page.locator('#youtube-box')).toBeHidden();expect(await page.locator('#youtube-player').getAttribute('src')).toBeNull();await expect(page.locator('#room-status')).toContainText('Playing on your speakers');await page.locator('#stop').click();await expect(page.locator('[data-original-play="phonk_drift"]')).toHaveAttribute('aria-pressed','false');expect(errors).toEqual([]);
});

test('incoming adult markers are not lost; opting out unloads the playlist and it stays hidden after reload',async({context})=>{
 await mockYoutube(context);const page=await context.newPage();await page.goto(origin+'/music-room.html#list=PLNMH5TG547qkMqLjy9l2yn4Yaf-X5yAzN&explicit=1');await expect(page.locator('[data-playlist]')).toHaveCount(4);expect(await page.locator('#youtube-player').getAttribute('src')).toBeNull();
 await page.locator('#room-adult').check();await expect(page.locator('[data-playlist]')).toHaveCount(5);await page.locator('[data-playlist-play="PLNMH5TG547qkMqLjy9l2yn4Yaf-X5yAzN"]').click();await expect(page.locator('#youtube-box')).toBeVisible();await page.locator('#room-adult').uncheck();expect(await page.locator('#youtube-player').getAttribute('src')).toBeNull();await page.reload();await expect(page.locator('[data-playlist]')).toHaveCount(4);
});

test('the same web preview contains working prices and animal previews, with responsive layout and no checkout activation',async({context})=>{
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/music-room.html');await expect(page.locator('[data-original]')).toHaveCount(16);await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'tests/.tmp/music-room-mobile.png',fullPage:true});
 const maxOpened=context.waitForEvent('page');await page.locator('[data-original="phonk_drift"] a').click();const maxPlans=await maxOpened;await expect(maxPlans.locator('#pass-list article')).toHaveCount(3);await expect(maxPlans.locator('#pass-tier')).toHaveValue('max');await expect(maxPlans.locator('#pass-list')).not.toContainText('Pro pass:');
 const opened=context.waitForEvent('page');await page.locator('nav a[href="plans.html"]').click();const plans=await opened;await expect(plans.locator('#filter-list article')).toHaveCount(28);await expect(plans.locator('#outfit-list article')).toHaveCount(9);await expect(plans.locator('#shop-status')).toContainText('Payments are not open');expect(await plans.locator('a[href*="/buy?"]').count()).toBe(0);
 await plans.locator('#currency').selectOption('usd');await expect(plans.locator('#pass-list')).toContainText('$1.49');await plans.locator('header a[href="playground.html"]').click();await expect(plans.locator('[data-character]')).toHaveCount(14);await plans.locator('[data-character="bird"]').click();await expect(plans.locator('#selected-character')).toHaveText('Bird');expect(errors).toEqual([]);
});

test('published collections refresh from admin metadata, exclude adult songs and need no API request per play',async({context})=>{
 await mockYoutube(context);let reads=0,version=1;
 await context.route(origin+'/preview-catalog.js',route=>route.fulfill({contentType:'text/javascript',body:'globalThis.MemeBoxPreviewCatalog=[]'}));
 await context.route('http://127.0.0.1:8789/api/config',route=>{reads++;return route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{phonkEnabled:true}})});
 await context.route('http://127.0.0.1:8789/api/packs**',route=>{reads++;return route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{packs:[{id:'p-global',kind:'links',title:version===1?'Worldwide hits':'Updated collection',items:[{videoId:'abcdefghijk',title:'Clean song'},{videoId:'12345678901',title:'Marked song',explicit:true}]}]}})});
 const page=await context.newPage();await page.goto(origin+'/music-room.html');await expect(page.locator('[data-playlist]')).toHaveCount(5);expect(reads).toBe(0);await page.locator('#published-browse').click();await expect(page.locator('[data-published]')).toHaveCount(1);await expect(page.locator('#published-list li')).toHaveCount(1);expect(reads).toBe(2);
 await page.locator('[data-published-play]').click();await expect(page.locator('#youtube-player')).toHaveAttribute('src',/\/embed\/abcdefghijk\?/);expect(reads).toBe(2);
 await page.locator('#room-adult').check();await expect(page.locator('#published-list li')).toHaveCount(2);await page.locator('[data-published-play]').click();await expect(page.locator('#youtube-player')).toHaveAttribute('src',/playlist=12345678901/);expect(reads).toBe(2);
 await page.locator('#room-adult').uncheck();expect(await page.locator('#youtube-player').getAttribute('src')).toBeNull();await expect(page.locator('#published-list li')).toHaveCount(1);
 version=2;await page.locator('#published-browse').click();await expect(page.locator('#published-list')).toContainText('Updated collection');expect(reads).toBe(4);
});

test('video meme mode is an admin-only catalog with regional packs, adult gating and a visible player',async({context})=>{
 await mockYoutube(context);let reads=0;
 await context.route(origin+'/preview-catalog.js',route=>route.fulfill({contentType:'text/javascript',body:'globalThis.MemeBoxPreviewCatalog=[]'}));
 await context.route('http://127.0.0.1:8789/api/config',route=>{reads++;return route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{phonkEnabled:true}})});
 await context.route('http://127.0.0.1:8789/api/packs**',route=>{reads++;return route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:{packs:[{id:'world-video',kind:'memevideos',title:'Worldwide Video Meme Classics',items:[{videoId:'abcdefghijk',title:'Clean reaction',credit:'Original channel'},{videoId:'12345678901',title:'After dark reaction',explicit:true}]}]}})});
 const page=await context.newPage();await page.goto(origin+'/music-room.html?mode=memes');
 await expect(page).toHaveTitle('MemeBox Video Memes');await expect(page.locator('#playlist-section')).toBeHidden();await expect(page.locator('#original-section')).toBeHidden();
 await expect(page.locator('#published-section h2')).toHaveText('Video meme packs');await expect(page.locator('#how-to-add')).toContainText('Send this tab’s sound');expect(reads).toBe(0);
 await page.locator('#published-browse').click();await expect(page.locator('[data-published]')).toHaveCount(1);await expect(page.locator('.meme-item')).toHaveCount(1);expect(reads).toBe(2);
 await page.locator('[data-video-id="abcdefghijk"]').click();await expect(page.locator('#youtube-player')).toBeVisible();await expect(page.locator('#youtube-player')).toHaveAttribute('src',/\/embed\/abcdefghijk\?/);await expect(page.locator('#youtube-link')).toBeHidden();
 await page.locator('#room-adult').check();await expect(page.locator('.meme-item')).toHaveCount(2);
});
