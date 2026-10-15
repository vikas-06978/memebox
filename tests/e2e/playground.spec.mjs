import { test, expect } from './fixtures.mjs';

test('Playground previews characters and music without changing call settings', async ({ context, extensionId }) => {
  const page = await context.newPage();
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`chrome-extension://${extensionId}/playground.html`);
  await expect(page.locator('[data-character]')).toHaveCount(14);
  await expect(page.locator('[data-tune]')).toHaveCount(13);
  const before = await page.evaluate(() => chrome.storage.local.get('settings'));
  const imageBefore = await page.locator('#preview').evaluate((c) => c.toDataURL());
  await page.locator('[data-character="bird"]').click();
  await page.locator('#outfit').selectOption('crown');
  await expect(page.locator('#selected-character')).toHaveText('Bird');
  await page.locator('[data-action="dance"]').click();
  await expect(page.locator('[data-action="dance"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#filter').selectOption('neon');
  await expect.poll(() => page.locator('#preview').evaluate((c) => c.toDataURL())).not.toBe(imageBefore);
  await page.locator('[data-character="snake"]').click();
  await expect(page.locator('#selected-character')).toHaveText('Snake');
  await page.locator('[data-tune="chill"]').click();
  await expect(page.locator('#music-status')).toContainText('only you hear it');
  await page.locator('#stop-music').click();
  await expect(page.locator('[data-tune="chill"]')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => chrome.storage.local.get('settings'))).toEqual(before);
  expect(errors).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'tests/.tmp/playground-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'tests/.tmp/playground-mobile.png', fullPage: true });
});

test('every character renders all nine costume designs in the shared camera engine', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/playground.html`);
  const rendered = await page.evaluate(() => {
    const source = document.createElement('canvas'); source.width = 960; source.height = 540;
    const sg = source.getContext('2d'); sg.fillStyle = '#777'; sg.fillRect(0, 0, 960, 540);
    const output = document.createElement('canvas'); output.width = 960; output.height = 540;
    const results = [];
    for (const character of MemeFx.CHARACTERS) {
      const frames = MemeFx.OUTFITS.map(outfit => {
        const renderer = MemeFx.createRenderer(), cfg = MemeFx.sanitize({ on: true, lamp: false, character, outfit, follow: false, studio: false });
        renderer.render(output.getContext('2d'), source, 960, 540, cfg, 5000, null, { charStand: 1, charAct: 'wave', charT: 1, charU: 0.2 });
        return output.toDataURL();
      });
      results.push({ character, count: new Set(frames).size });
    }
    return results;
  });
  expect(rendered).toHaveLength(14);
  for (const row of rendered) expect(row.count, row.character + ' has visibly distinct outfits').toBe(10);
});

test('companions stay sad through prolonged absence even with happy music, and welcome only after a stable return', async ({context,extensionId}) => {
  const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/playground.html`);
  const result=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=640;c.height=360;const g=c.getContext('2d'),src=document.createElement('canvas');src.width=640;src.height=360;
    MemeFx.drawSample(src.getContext('2d'),640,360,0);const r=MemeFx.createRenderer();
    const cfg={...MemeFx.DEFAULTS,on:true,lamp:false,focus:false,studio:false,character:'cat',follow:true,awayDance:true};
    let now=0;const tr={present:false,live:true,ml:true,x:.5,y:.5,fw:.23,fh:.4,energy:0,exitAt:0,enterAt:-1e9,riseAt:-1e9,waveAt:-1e9};
    for(;now<60000;now+=100) r.render(g,src,640,360,cfg,now,{level:.5,mood:'fun'},{track:{...tr,away:now/1000}});
    const away={mode:r.stg.mode,action:r.cAct.name,water:r.stg.tear};
    for(let i=0;i<5;i++,now+=100)r.render(g,src,640,360,cfg,now,{level:.5,mood:'fun'},{track:{...tr,present:true,enterAt:60000,away:0}});
    const brief=r.stg.mode;
    for(let i=0;i<10;i++,now+=100)r.render(g,src,640,360,cfg,now,null,{track:{...tr,present:true,enterAt:60000,away:0}});
    return {away,brief,back:r.stg.mode};
  });
  expect(result.away.mode).toBe('cry');expect(['cry','float']).toContain(result.away.action);expect(result.away.water).toBeGreaterThan(.8);
  expect(result.brief).toBe('cry');expect(result.back).toBe('welcome');
});

test('Bird flies along a visible route; disabling exploration returns to the selected shoulder', async ({context,extensionId})=>{
  const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/playground.html`);
  const result=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=640;c.height=360;const g=c.getContext('2d'),src=document.createElement('canvas');src.width=640;src.height=360;
    const r=MemeFx.createRenderer(),cfg={...MemeFx.DEFAULTS,on:true,lamp:false,focus:false,studio:false,character:'bird',charHome:'shoulder',masti:false};
    const tr={present:true,live:true,ml:true,x:.5,y:.5,fw:.23,fh:.4,energy:0,exitAt:-1e9,enterAt:-1e9,riseAt:-1e9,waveAt:-1e9};
    const points=[];let now=0;
    for(;now<8000;now+=100){r.render(g,src,640,360,cfg,now,null,{track:tr});if(r.stg.mode==='travel')points.push({x:r.stg.x,y:r.stg.fy,action:r.cAct.name});}
    return {points,mode:r.stg.mode,perch:r.stg.perch};
  });
  expect(result.points.length).toBeGreaterThan(10);expect(result.points.some(p=>p.action==='fly')).toBe(true);
  expect(new Set(result.points.map(p=>p.y.toFixed(3))).size).toBeGreaterThan(10);expect(result.perch).toBe('shoulder');expect(result.mode).toBe('perch');
});

test('every companion has a visibly animated signature action and rolling follows the head route before returning', async ({context,extensionId})=>{
  const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/playground.html`);
  const result=await page.evaluate(()=>{
    const out=document.createElement('canvas');out.width=640;out.height=360;const g=out.getContext('2d'),src=document.createElement('canvas');src.width=640;src.height=360;MemeFx.drawSample(src.getContext('2d'),640,360,0);
    const animated=MemeFx.CHARACTERS.map(character=>{
      const r=MemeFx.createRenderer(),cfg={...MemeFx.DEFAULTS,on:true,lamp:false,focus:false,studio:false,character,follow:false};
      const frames=[.2,.8,1.4].map(t=>{r.render(g,src,640,360,cfg,5000,null,{charAct:MemeFx.PERSONAS[character].action,charT:t,charU:t/2});return out.toDataURL()});
      return {character,count:new Set(frames).size};
    });
    const r=MemeFx.createRenderer(),cfg={...MemeFx.DEFAULTS,on:true,lamp:false,focus:false,studio:false,character:'cat',masti:false,charHome:'shoulder'};
    const tr={present:true,live:true,ml:true,x:.5,y:.5,fw:.23,fh:.4,energy:0,exitAt:-1e9,enterAt:-1e9,riseAt:-1e9,waveAt:-1e9};let now=0;
    for(;now<4000;now+=100)r.render(g,src,640,360,cfg,now,null,{track:tr});
    cfg.command='roll';cfg.commandSeq=1;const route=[];
    for(;now<18000;now+=100){r.render(g,src,640,360,cfg,now,null,{track:tr});if(r.stg.perch==='orbit')route.push(r.stg.x.toFixed(3))}
    return {animated,route:new Set(route).size,perch:r.stg.perch};
  });
  for(const entry of result.animated)expect(entry.count,entry.character+' signature moves').toBeGreaterThan(1);
  expect(result.route).toBeGreaterThan(8);expect(result.perch).toBe('shoulder');
});

test('Picture mode accepts a local image and keeps it visible until the user closes it', async ({context,extensionId})=>{
  const page=await context.newPage();await page.goto(`chrome-extension://${extensionId}/playground.html`);
  const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=60;c.getContext('2d').fillRect(0,0,80,60);return c.toDataURL().split(',')[1]});
  await page.locator('#picture-file').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
  await expect(page.locator('#picture-preview')).toBeVisible();await expect.poll(()=>page.locator('#picture-image').evaluate(i=>i.naturalWidth)).toBe(80);
  await page.locator('#picture-close').click();await expect(page.locator('#picture-preview')).toBeHidden();
});
