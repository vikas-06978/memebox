// Options → Online packs: browse the site's packs, add free music and memes, paid packs say "Coming soon", strong language is off by default.
// The site is the real Pages Functions on a local server; the extension's calls to memebox.pages.dev are sent there.
import { test, expect } from './fixtures.mjs';
import { startSite } from '../../tools/site-dev.mjs';

async function seed(site) {
  const ts = new Date().toISOString();
  const pack = (id, title, kind, region, tier) => site.db.prepare(
    "INSERT INTO packs (id, title, kind, region, tier, description, status, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'test pack', 'live', 100, ?, ?)").bind(id, title, kind, region, tier, ts, ts).run();
  const item = (id, packId, title, kind, extra = {}) => site.db.prepare(
    "INSERT INTO pack_items (id, pack_id, title, kind, file_key, mime, bytes, text, lang, tags, explicit, licence, source, credit, cleared, status, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, 'Own work', '', '', 1, 'live', 100, ?)")
    .bind(id, packId, title, kind, extra.key || '', extra.mime || '', extra.bytes || 0, extra.text || '', extra.lang || '', extra.explicit ? 1 : 0, ts).run();
  await pack('phonk-free', 'Phonk starter', 'music', 'common', 'free');
  await pack('india-memes', 'India memes', 'memes', 'in', 'free');
  await pack('pro-music', 'Pro beats', 'music', 'common', 'pro');
  for (const n of [1, 2]) {
    const key = `packs/phonk-free/i-track0000${n}.mp3`;
    await site.bucket.put(key, new Uint8Array(3000).fill(n), { httpMetadata: { contentType: 'audio/mpeg' } });
    await item(`i-track0000${n}`, 'phonk-free', `Track ${n}`, 'audio', { key, mime: 'audio/mpeg', bytes: 3000 });
  }
  await item('i-line000001', 'india-memes', 'Chai pe charcha', 'line', { text: 'Chai pe charcha karte hain', lang: 'hinglish' });
  await item('i-line000002', 'india-memes', 'Strong one', 'line', { text: 'a line with strong language', lang: 'hinglish', explicit: true });
  const key = 'packs/pro-music/i-protrack001.mp3';
  await site.bucket.put(key, new Uint8Array(500), { httpMetadata: { contentType: 'audio/mpeg' } });
  await item('i-protrack001', 'pro-music', 'Pro track', 'audio', { key, mime: 'audio/mpeg', bytes: 500 });
}

test.use({ pro: false }); // a free user: no key

test('online packs: browse, add free music and memes, paid packs are "Coming soon", strong language needs the switch', async ({ context, extensionId }) => {
  const site = await startSite({ env: { ADMIN_KEY: 'k' } });
  try {
    await seed(site);
    await context.route('https://memebox.pages.dev/**', async (route) => {
      const u = new URL(route.request().url());
      await route.fulfill({ response: await route.fetch({ url: site.url + u.pathname + u.search }) });
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await expect(page.locator('#online-list li')).toHaveCount(0); // nothing is contacted until "Browse packs"
    await page.locator('#online-browse').click();
    await expect(page.locator('#online-list li')).toHaveCount(3);
    const pro = page.locator('#online-list li', { hasText: 'Pro beats' });
    await expect(pro.locator('button')).toHaveText('Coming soon');
    await expect(pro.locator('button')).toBeDisabled();

    // free music -> "My music" in the panel
    const phonk = page.locator('#online-list li', { hasText: 'Phonk starter' });
    await phonk.getByRole('button', { name: /^Add/ }).click();
    
    await expect(phonk.getByText('Added ✓')).toBeVisible();
    const { myMusic } = await page.evaluate(() => chrome.storage.local.get('myMusic'));
    expect(myMusic.map((m) => [m.name, m.pack])).toEqual([['Track 1', 'phonk-free'], ['Track 2', 'phonk-free']]);
    const clip = await page.evaluate((id) => MemeDB.getClip(id).then((c) => c.bytes.byteLength), myMusic[0].id);
    expect(clip).toBe(3000);

    // memes: the strong line is left out until the switch is on
    const india = page.locator('#online-list li', { hasText: 'India memes' });
    await india.getByRole('button', { name: /^Add/ }).click();
    await expect(india.getByText('Added ✓')).toBeVisible();
    let { lines } = await page.evaluate(() => chrome.storage.local.get('lines'));
    expect(lines.filter((l) => l.id.startsWith('pk-')).map((l) => l.text)).toEqual(['Chai pe charcha karte hain']);

    // remove both
    await phonk.getByRole('button', { name: 'Remove' }).click();
    await india.getByRole('button', { name: 'Remove' }).click();
    await expect(india.getByRole('button', { name: /^Add/ })).toBeVisible();
    expect((await page.evaluate(() => chrome.storage.local.get('myMusic'))).myMusic).toEqual([]);
    ({ lines } = await page.evaluate(() => chrome.storage.local.get('lines')));
    expect(lines.some((l) => l.id.startsWith('pk-'))).toBe(false);

    await page.locator('#online-strong').check();
    await expect(india.getByRole('button', { name: /^Add/ })).toContainText('MB'); // now both lines count
    await page.screenshot({ path: 'tests/.tmp/online-packs.png', fullPage: false });
  } finally {
    await site.close();
  }
});
