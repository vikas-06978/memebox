import {test,expect} from './fixtures.mjs';
import {clickPanel,panelElement} from './closed-panel.mjs';

test('paid labels have a working local plans route, with accurate tiers, currencies and closed checkout',async({context,extensionId})=>{
 const page=await context.newPage(),requests=[];page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
 await page.goto(`chrome-extension://${extensionId}/playground.html`);
 await page.locator('a[href="plans.html"]').click();
 await expect(page.locator('#shop-status')).toContainText('Payments are not open');
 await expect(page.locator('#filter-list article')).toHaveCount(29);
 await expect(page.locator('#outfit-list article')).toHaveCount(10);
 await expect(page.locator('#character-list article')).toHaveCount(9);
 const prism=page.locator('#filter-list article',{has:page.getByRole('heading',{name:'Prism light',exact:true})});
 await expect(prism).toContainText('never individually sold');await expect(prism.locator('.price')).toHaveCount(0);
 const teal=page.locator('#filter-list article',{has:page.getByRole('heading',{name:'Teal',exact:true})});
 await expect(teal).toContainText('₹29');await expect(teal).toContainText('Owned forever');
 await page.locator('#currency').selectOption('usd');await expect(teal).toContainText('$0.99');
 expect(await page.locator('a[href*="/buy?"]').count()).toBe(0);expect(requests).toEqual([]);
});

test('marked personal memes require adult opt-in; toggling off hides them and stops outgoing audio',async({context,extensionId,callPage})=>{
 const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/options.html`);
 await page.locator('#line-text').fill('Adult sample reaction');await page.locator('#line-say').fill('This is a long example used only to test the adult preference. It should stop immediately when the preference is disabled.');
 await page.locator('#line-lang').selectOption('en');await page.locator('#line-fav').selectOption('4');await page.locator('#line-explicit').check();await page.locator('#line-submit').click();
 await expect(page.locator('#toast')).toHaveText('Line added');await expect(page.locator('#lines-body')).not.toContainText('Adult sample reaction');
 const sw=context.serviceWorkers()[0];const line=await sw.evaluate(async()=>{const {lines}=await chrome.storage.local.get('lines');return lines.find(l=>l.text==='Adult sample reaction')});expect(line.explicit).toBe(true);
 const blocked=await sw.evaluate(async item=>{try{await audioFor({...item,explicit:false});return 'unexpected'}catch(e){return e.message}},line);expect(blocked).toContain('Adult memes are hidden');
 await callPage.evaluate(async()=>{await window.joinCall();await window.noDuck()});await callPage.waitForTimeout(400);
 await callPage.mouse.click(42,574,{button:'right'});
 expect((await panelElement(callPage,'.list')).text).not.toContain('Adult sample reaction');
 await clickPanel(callPage,'.adult-preference input');
 await expect.poll(async()=>sw.evaluate(async()=>{const {settings}=await chrome.storage.local.get('settings');return settings.showStrong&&settings.adultConfirmed})).toBe(true);
 expect((await panelElement(callPage,'.list')).text).toContain('Adult sample reaction');
 await callPage.keyboard.press('Alt+Digit4');await expect.poll(()=>callPage.evaluate(()=>window.peakOver(250))).toBeGreaterThan(.1);
 await clickPanel(callPage,'.adult-preference input');
 await expect.poll(async()=>sw.evaluate(async()=>{const {settings}=await chrome.storage.local.get('settings');return settings.showStrong||settings.adultConfirmed})).toBe(false);
 expect((await panelElement(callPage,'.list')).text).not.toContain('Adult sample reaction');
 // Storage commits before the stop message crosses the isolated-world bridge.
 await expect.poll(()=>callPage.evaluate(()=>window.peakOver(250)),{timeout:1500}).toBeLessThan(.1);
 expect(await callPage.evaluate(()=>window.peakOver(900))).toBeLessThan(.1);
});

test('adult opt-out cancels an Options preview before a slow decode can start audio',async({context,extensionId})=>{
 const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/options.html`);
 await page.locator('#content-strong').check();
 await page.locator('#line-text').fill('Harmless flagged preview');await page.locator('#line-explicit').check();
 await page.evaluate(()=>{
  window.decodeEntered=0;window.audioStarts=0;window.holdDecode=true;
  const decode=AudioContext.prototype.decodeAudioData,create=AudioContext.prototype.createBufferSource;
  AudioContext.prototype.decodeAudioData=async function(...args){window.decodeEntered++;const buffer=await decode.apply(this,args);if(window.holdDecode)await new Promise(resolve=>{window.releaseDecode=resolve});return buffer};
  AudioContext.prototype.createBufferSource=function(...args){const src=create.apply(this,args),start=src.start;src.start=function(...a){window.audioStarts++;return start.apply(this,a)};return src};
 });
 await page.locator('#line-preview').click();await expect.poll(()=>page.evaluate(()=>window.decodeEntered)).toBe(1);
 await expect.poll(()=>page.evaluate(()=>typeof window.releaseDecode)).toBe('function');
 await page.locator('#content-strong').uncheck();
 await expect.poll(()=>page.evaluate(async()=>{const {settings}=await chrome.storage.local.get('settings');return settings.showStrong})).toBe(false);
 await page.evaluate(()=>{window.holdDecode=false;window.releaseDecode()});await page.waitForTimeout(100);expect(await page.evaluate(()=>window.audioStarts)).toBe(0);
 await page.locator('#content-strong').check();await page.locator('#line-preview').click();await expect.poll(()=>page.evaluate(()=>window.audioStarts)).toBe(1);
});
