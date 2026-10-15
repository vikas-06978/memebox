import { test, expect } from './fixtures.mjs';
import { startSite } from '../../tools/site-dev.mjs';

test('four beta interface languages use native core controls and English advanced fallbacks', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  for (const [code, word] of [['de', 'Schließen (Esc)'], ['it', 'Chiudi (Esc)'], ['ja', '閉じる (Esc)'], ['pa', 'ਬੰਦ ਕਰੋ (Esc)']]) {
    await Promise.all([page.waitForEvent('load'), page.locator('#ui-lang').selectOption(code)]);
    await expect(page.locator('html')).toHaveAttribute('lang', code);
    expect(await page.evaluate(() => MemeI18n.t('close'))).toBe(word);
    expect(await page.evaluate(() => MemeI18n.t('fx_char_bird'))).toBe('Bird');
    const saved = await page.evaluate(async () => (await chrome.storage.local.get('langPack')).langPack);
    expect(saved.code).toBe(code);
    expect(Object.keys(saved.messages).length).toBeGreaterThan(500);
  }
});
test('Japanese website controls load with English fallback and a visible Beta language label', async ({ context }) => {
  const site = await startSite();
  try {
    const page = await context.newPage();
    await page.goto(site.url + '/phonk?lang=ja');
    await expect(page.locator('[data-t="ph_title"]')).toHaveText('Phonk モード');
    await expect(page.locator('#search')).toHaveAttribute('placeholder', '曲を検索');
    await expect(page.locator('[data-t="ph_intro"]')).toHaveText('Free YouTube music collections for every country.');
    expect(await page.evaluate(() => window.MemeSite.t('buy_how'))).toBe('How to use your key');
    await expect(page.locator('option[value="ja"]')).toHaveText('日本語 (Beta)');
  } finally { await site.close(); }
});
