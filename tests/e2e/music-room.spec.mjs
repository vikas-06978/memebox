import {test,expect} from './fixtures.mjs';
import {clickPanel} from './closed-panel.mjs';

test('call panel opens the website player directly in one tab',async({context,extensionId,callPage})=>{
 const sw=context.serviceWorkers()[0],site=await sw.evaluate(()=>MEMEBOX_CONFIG.SITE_URL),local=site.startsWith('http://127.0.0.1:');
 const target=local?'http://127.0.0.1:8790/music-room.html':new URL('/music-room',site).href;
 await context.route(target+'**',route=>route.fulfill({contentType:'text/html',body:'<h1>Music player</h1>'}));
 await callPage.evaluate(()=>window.joinCall());await callPage.waitForTimeout(600);await callPage.mouse.click(42,574,{button:'right'});await clickPanel(callPage,'[data-tab="music"]');
 const before=context.pages().length;await clickPanel(callPage,'[data-music-room]');
 await expect.poll(()=>context.pages().some(page=>page.url().startsWith(target)),{timeout:5000}).toBe(true);
 expect(context.pages().length).toBe(before+1);const page=context.pages().find(page=>page.url().startsWith(target));
 expect(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('extension')).toBe(extensionId);
});

test('supplied playlists are fixed for users and playlist management stays admin-only',async({context,extensionId})=>{
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`chrome-extension://${extensionId}/music-room.html`);await expect(page.locator('[data-playlist]')).toHaveCount(5);
 await expect(page.locator('#playlist-manager')).toBeHidden();
 await expect(page.locator('[data-playlist-edit]')).toHaveCount(0);
 await expect(page.locator('[data-playlist-remove]')).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('extension playlist playback opens the configured website player without sending a license key',async({context,extensionId})=>{
 const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/music-room.html`);await expect(page.locator('[data-playlist]')).toHaveCount(5);
 const site=await page.evaluate(()=>MEMEBOX_CONFIG.SITE_URL),local=site.startsWith('http://127.0.0.1:');const target=local?'http://127.0.0.1:8790/music-room.html':new URL('/music-room',site).href;await context.route(target+'**',route=>route.fulfill({contentType:'text/html',body:'<p>Website player</p>'}));
 const before=context.pages().length;await page.locator('[data-playlist-play]').first().click();await page.waitForURL(target+'**');expect(context.pages().length).toBe(before);const url=new URL(page.url());expect(url.pathname).toBe(local?'/music-room.html':'/music-room');expect(url.search).toBe('');expect(new URLSearchParams(url.hash.slice(1)).get('list')).toBe('PLNMH5TG547qkMqLjy9l2yn4Yaf-X5yAzN');expect(page.url()).not.toContain('MBX-');
});
