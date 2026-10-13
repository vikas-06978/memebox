import { test, expect } from './fixtures.mjs';

test('Playground previews characters and music without changing call settings', async ({ context, extensionId }) => {
  const page = await context.newPage();
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`chrome-extension://${extensionId}/playground.html`);
  await expect(page.locator('[data-character]')).toHaveCount(14);
  await expect(page.locator('[data-tune]')).toHaveCount(16);
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

test('every character renders its three accessories in the shared camera engine', async ({ context, extensionId }) => {
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
  for (const row of rendered) expect(row.count, row.character + ' has visibly distinct outfits').toBe(4);
});
