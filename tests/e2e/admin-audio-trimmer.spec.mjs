import { test, expect } from '@playwright/test';
import { startSite } from '../../tools/site-dev.mjs';
import { createPack } from '../../site/src/packs.js';

function silentWav(seconds = 2, rate = 48000) {
  const samples = Math.floor(seconds * rate), b = Buffer.alloc(44 + samples * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(samples * 2, 40);
  return b;
}

test('admin can trim the main meme part locally and place it in the upload field', async ({ page }) => {
  const site = await startSite({ env: { ADMIN_KEY: 'local-test-key', HOSTED_FILES_ENABLED: 'on', HOSTED_AUDIO_ENABLED: 'on' } });
  try {
    const id = await createPack(site.db, { title: 'Trim test', kind: 'memes', region: 'global', tier: 'free', description: 'test' });
    await page.goto(site.url + '/admin');
    await page.locator('input[name="key"]').fill('local-test-key');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.goto(`${site.url}/admin/packs?id=${id}`);
    await page.getByText('Trim a full audio file to its main meme part').click();
    await page.locator('#trim-source').setInputFiles({ name: 'full.wav', mimeType: 'audio/wav', buffer: silentWav() });
    await expect(page.locator('#trim-status')).toContainText('Loaded 2.0 seconds');
    await page.locator('#trim-start').fill('0.2');
    await page.locator('#trim-end').fill('0.8');
    await page.locator('#trim-use').click();
    await expect(page.locator('#trim-status')).toContainText('full-clip.wav is ready');
    await expect(page.locator('#trim-download')).toBeVisible();
    await expect(page.locator('#trim-download')).toHaveAttribute('download', 'full-clip.wav');
    const file = await page.locator('#pack-upload-files').evaluate((input) => ({ name: input.files[0]?.name, size: input.files[0]?.size }));
    expect(file.name).toBe('full-clip.wav');
    expect(file.size).toBeGreaterThan(50000);
    expect(file.size).toBeLessThan(70000);
  } finally {
    await site.close();
  }
});
