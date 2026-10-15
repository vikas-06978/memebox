import {test as base,expect} from './fixtures.mjs';
import {clickPanel} from './closed-panel.mjs';
import {startSite} from '../../tools/site-dev.mjs';
const test=base.extend({playerSite:async({},use)=>{const site=await startSite();await use(site);await site.close();}});

test('call panel opens the website player directly in one tab',async({context,extensionId,callPage,playerSite})=>{
 const sw=context.serviceWorkers()[0],target=playerSite.url+'/music-room';
 await sw.evaluate(url=>{globalThis.MEMEBOX_CONFIG={...MEMEBOX_CONFIG,PLAYER_URL:url};},target);
 await callPage.evaluate(()=>window.joinCall());await callPage.waitForTimeout(600);await callPage.mouse.click(42,574,{button:'right'});await clickPanel(callPage,'[data-tab="music"]');
 const before=context.pages().length;await clickPanel(callPage,'[data-music-room]');
 await expect.poll(()=>context.pages().some(page=>page.url().startsWith(target)),{timeout:5000}).toBe(true);
 expect(context.pages().length).toBe(before+1);const page=context.pages().find(page=>page.url().startsWith(target));
 await expect(page.locator('[data-playlist]')).toHaveCount(5);
 expect(await page.evaluate(()=>sessionStorage.getItem('memebox-extension'))).toBe(extensionId);
});

test('supplied playlists are fixed for users and playlist management stays admin-only',async({context,extensionId})=>{
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`chrome-extension://${extensionId}/music-room.html`);await expect(page.locator('[data-playlist]')).toHaveCount(5);
 await expect(page.locator('#playlist-manager')).toBeHidden();
 await expect(page.locator('[data-playlist-edit]')).toHaveCount(0);
 await expect(page.locator('[data-playlist-remove]')).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('extension playlist playback opens the configured website player without sending a license key',async({context,extensionId,playerSite})=>{
 const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/music-room.html`);await expect(page.locator('[data-playlist]')).toHaveCount(5);
 const target=playerSite.url+'/music-room';await page.evaluate(url=>{globalThis.MEMEBOX_CONFIG={...MEMEBOX_CONFIG,PLAYER_URL:url};},target);
 await context.route('https://www.youtube-nocookie.com/**',route=>route.fulfill({contentType:'text/html',body:'<p>Visible provider fixture</p>'}));
 const before=context.pages().length;await page.locator('[data-playlist-play]').first().click();await page.waitForURL(target+'**');expect(context.pages().length).toBe(before);
 await expect(page.locator('#youtube-player')).toHaveAttribute('src',/list=PLNMH5TG547qkMqLjy9l2yn4Yaf-X5yAzN/);expect(page.url()).not.toContain('MBX-');
});
