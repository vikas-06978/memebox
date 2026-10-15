import { test as base, expect } from './fixtures.mjs';
import { clickPanel, panelElement } from './closed-panel.mjs';
import { startSite } from '../../tools/site-dev.mjs';

const test=base.extend({
  playerSite:async({},use)=>{const site=await startSite();await use(site);await site.close();},
});
test.use({pro:false});

test('free install includes the meme library and all sixteen tunes without a published backend',async({context,extensionId})=>{
  const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/music-room.html?mode=memes`);
  await expect(page.locator('.meme-item')).toHaveCount(27);
  await expect(page.locator('[data-video-id="dHER3Vc9GBI"]')).toBeVisible();
  await page.locator('#room-adult').check();await expect(page.locator('.meme-item')).toHaveCount(33);
  await page.goto(`chrome-extension://${extensionId}/music-room.html`);
  await expect(page.locator('[data-original]')).toHaveCount(16);
  await expect(page.locator('[data-original="phonk_drift"]')).toBeVisible();
});

test('a 200 landing page is refused as a player and does not redirect playlist playback',async({context,extensionId,playerSite})=>{
  const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/music-room.html`);
  // The home page returns 200, exactly like the old production fallback.
  await page.evaluate(base=>{globalThis.MEMEBOX_CONFIG={...MEMEBOX_CONFIG,PLAYER_URL:base+'/'};},playerSite.url);
  await page.locator('[data-playlist-play]').first().click();
  await expect(page.locator('#room-status')).toContainText('Start-MemeBox-Music.cmd');
  await expect(page).toHaveURL(`chrome-extension://${extensionId}/music-room.html`);
  await expect(page.locator('[data-playlist]')).toHaveCount(5);
});

test('music and video buttons open the current HTTP player directly with the right mode',async({context,extensionId,callPage,playerSite})=>{
  const sw=context.serviceWorkers()[0];
  await sw.evaluate(base=>{globalThis.MEMEBOX_CONFIG={...MEMEBOX_CONFIG,PLAYER_URL:base+'/music-room'};},playerSite.url);
  await callPage.evaluate(()=>window.joinCall());await callPage.waitForTimeout(650);
  await callPage.mouse.click(42,574,{button:'right'});await clickPanel(callPage,'.ptab[data-tab="music"]');
  const [music]=await Promise.all([context.waitForEvent('page'),clickPanel(callPage,'[data-music-room]')]);
  await music.waitForLoadState();await expect(music.locator('[data-playlist]')).toHaveCount(5);
  expect(new URL(music.url()).pathname).toBe('/music-room');
  await callPage.bringToFront();
  const [memes]=await Promise.all([context.waitForEvent('page'),clickPanel(callPage,'.add-music:last-child')]);
  await memes.waitForLoadState();expect(new URL(memes.url()).searchParams.get('mode')).toBe('memes');
  await expect(memes.locator('.meme-item')).toHaveCount(27);
});

test('free call panel exposes premium previews and section-specific plans while keeping payment closed',async({context,extensionId,callPage})=>{
  await callPage.evaluate(()=>window.joinCall());await callPage.waitForTimeout(650);
  await callPage.mouse.click(42,574,{button:'right'});await clickPanel(callPage,'.ptab[data-tab="music"]');
  expect((await panelElement(callPage,'details[data-page="music"]')).text).toContain('Midnight');
  expect((await panelElement(callPage,'details[data-page="music"]')).text).toContain('Drift');
  const [plans]=await Promise.all([context.waitForEvent('page'),clickPanel(callPage,'[data-music-plans]')]);
  await plans.waitForLoadState();expect(new URL(plans.url()).hash).toBe('#music');
  await expect(plans.locator('#shop-status')).toContainText('Payments are not open');
  await callPage.bringToFront();await clickPanel(callPage,'.ptab[data-tab="lights"]');
  expect((await panelElement(callPage,'details.fx[data-page="lights"]')).text).toContain('Panda');
  const [filters]=await Promise.all([context.waitForEvent('page'),clickPanel(callPage,'[data-plans-section="filters"]')]);
  await filters.waitForLoadState();expect(new URL(filters.url()).hash).toBe('#filters');
});

test('product details and preview links select the specific item instead of opening the same generic page',async({context,extensionId})=>{
  const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/plans.html#filters`);
  const teal=page.locator('#product-filter_teal');
  await teal.getByRole('link',{name:'Item details & availability'}).click();
  await expect(teal.locator('.availability')).toContainText('₹29');
  await expect(teal.locator('.availability')).toContainText('Checkout is not open');
  await teal.getByRole('link',{name:'Preview Teal',exact:true}).click();
  await expect(page.locator('#filter')).toHaveValue('teal');
  await page.goto(`chrome-extension://${extensionId}/plans.html#characters`);
  await page.locator('#product-char_panda').getByRole('link',{name:'Preview Character: Panda',exact:true}).click();
  await expect(page.locator('#selected-character')).toHaveText('Panda');
});
