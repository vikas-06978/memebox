import {test,expect} from './fixtures.mjs';
import {clickPanel} from './closed-panel.mjs';

test('Music and Phonk links open a real room with five supplied collections, sixteen originals and pricing',async({context,extensionId,callPage})=>{
 await callPage.evaluate(()=>window.joinCall());await callPage.waitForTimeout(600);await callPage.mouse.click(42,574,{button:'right'});await clickPanel(callPage,'[data-tab="music"]');
 await clickPanel(callPage,'[data-music-room]');
 await expect.poll(()=>context.pages().some(page=>page.url()===`chrome-extension://${extensionId}/music-room.html`),{timeout:5000}).toBe(true);
 const page=context.pages().find(page=>page.url()===`chrome-extension://${extensionId}/music-room.html`);
 await expect(page.locator('[data-playlist]')).toHaveCount(5);await expect(page.locator('[data-original]')).toHaveCount(16);
 await expect(page.locator('#original-section')).toContainText('Drop at 12.3s');await expect(page.locator('nav a[href="plans.html"]')).toBeVisible();
 await page.locator('[data-tier="phonk"]').click();await expect(page.locator('[data-original]')).toHaveCount(3);
 await page.locator('[data-original-play="phonk_drift"]').click();await expect(page.locator('#room-status')).toContainText('Playing on your speakers');await page.locator('#stop').click();await expect(page.locator('[data-original-play="phonk_drift"]')).toHaveAttribute('aria-pressed','false');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
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
 const created=context.waitForEvent('page');await page.locator('[data-playlist-play]').first().click();const web=await created;await web.waitForURL(target+'**');const url=new URL(web.url());expect(url.pathname).toBe(local?'/music-room.html':'/music-room');expect(url.search).toBe('');expect(new URLSearchParams(url.hash.slice(1)).get('list')).toBe('PLNMH5TG547qkMqLjy9l2yn4Yaf-X5yAzN');expect(web.url()).not.toContain('MBX-');await expect(page.locator('#extension-player-help')).toBeVisible();
});
