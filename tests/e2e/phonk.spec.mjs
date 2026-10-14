// Phonk Mode: the /phonk page on the site. Free tracks play for everybody, paid ones are locked until the plan allows them, the key from the
// extension (after "#") is removed from the address, and YouTube's own embed is shown (here a stand-in page: no network).
import { test as base, expect } from '@playwright/test';
import { startSite } from '../../tools/site-dev.mjs';
import { createLicense } from '../../site/src/shop.js';

const test = base.extend({
  site: [async ({}, use) => {
    const site = await startSite({ env: { ADMIN_KEY: 'k' } });
    const ts = new Date().toISOString();
    await site.db.prepare("INSERT INTO packs (id, title, kind, region, tier, description, status, sort, created_at, updated_at) VALUES ('phonk-mode', 'Phonk Mode', 'links', 'common', 'max', '', 'live', 1, ?, ?)").bind(ts, ts).run();
    const add = (n, id, title, artist, tier) => site.db.prepare("INSERT INTO pack_items (id, pack_id, title, kind, text, credit, licence, cleared, status, sort, created_at, tier) VALUES (?, 'phonk-mode', ?, 'link', ?, ?, 'Official', 1, 'live', ?, ?, ?)").bind(`i-link00000${n}`, title, id, artist, n, ts, tier).run();
    await add(1, 'aaaaaaaaaaa', 'Free track', 'Artist A', 'free');
    await add(2, 'bbbbbbbbbbb', 'Pro track', 'Artist B', 'pro');
    await add(3, 'ccccccccccc', 'Max track', 'Artist C', '');
    site.proKey = await createLicense(site.db, { kind: 'paid', proSeconds: 600 });
    await use(site);
    await site.close();
  }, { scope: 'test' }],
  page: async ({ page }, use) => {
    page.cspErrors = [];
    page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) page.cspErrors.push(m.text()); });
    await page.route('https://www.youtube-nocookie.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stand-in for the YouTube player</title><p>player</p>' }));
    await use(page);
  },
});
test.use({ channel: 'chromium' });

test('YouTube playlists are free, originals require a pass, and the YouTube player stays visible', async ({ page, site }) => {
  await page.goto(`${site.url}/phonk`);
  await expect(page.locator('h1 [data-t="ph_title"]')).toHaveText('Phonk Mode');
  await expect(page.locator('#tracks li')).toHaveCount(6);
  await expect(page.locator('#tracks li').first().locator('button')).toBeEnabled();
  await expect(page.locator('#tracks').getByRole('button', { name: /Desi Phonk/ })).toBeDisabled();
  await page.locator('#playlists').getByRole('button', { name: 'Phonk Mode' }).click();
  await expect(page.locator('#tracks li')).toHaveCount(3);
  await expect(page.locator('#tracks li').nth(0).locator('.tier')).toHaveText('Free');
  await expect(page.locator('#tracks li').nth(1).locator('.tier')).toHaveText('Free');
  await expect(page.locator('#tracks li').nth(1).locator('button')).toBeEnabled();
  await expect(page.locator('#player-box')).toBeHidden();
  await page.locator('#tracks li').nth(0).locator('button').click();
  await expect(page.locator('#player-box')).toBeVisible();
  const src = await page.locator('#player').getAttribute('src');
  expect(src).toContain('https://www.youtube-nocookie.com/embed/aaaaaaaaaaa');
  expect(src).toContain('autoplay=1');
  await expect(page.locator('#now')).toContainText('Free track');
  await expect(page.locator('#open-yt')).toHaveAttribute('href', 'https://www.youtube.com/watch?v=aaaaaaaaaaa');
  // the player is really visible (YouTube requires it): at least 200 x 200
  const size = await page.locator('#player').boundingBox();
  expect(size.width).toBeGreaterThanOrEqual(200);
  expect(size.height).toBeGreaterThanOrEqual(200);
  // "next" skips the tracks this person may not play
  await page.locator('#next').click();
  await page.waitForTimeout(300);
  expect(await page.locator('#player').getAttribute('src')).toContain('bbbbbbbbbbb');
  expect(page.cspErrors).toEqual([]);
});

test('Pro unlocks Desi original, Max originals stay locked, and the key is removed from the address', async ({ page, site }) => {
  await page.goto(`${site.url}/phonk#k=${site.proKey}`);
  await expect(page.locator('#tracks li')).toHaveCount(6);
  expect(page.url()).toBe(`${site.url}/phonk`); // the key is gone from the address
  await expect(page.locator('#tracks').getByRole('button', { name: /Desi Phonk/ })).toBeEnabled();
  await expect(page.locator('#tracks').getByRole('button', { name: /Drift Phonk/ })).toBeDisabled();
  await expect(page.locator('#tracks').getByRole('button', { name: /Midnight Phonk/ })).toBeDisabled();
  await page.locator('#tracks').getByRole('button', { name: /Desi Phonk/ }).click();
  await expect(page.locator('#now')).toContainText('Desi Phonk');
  await expect(page.locator('#player-box')).toBeHidden();
  await page.locator('#toggle').click();
  await expect(page.locator('#toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#prev').click();
  await expect(page.locator('#player')).toHaveAttribute('src', /ccccccccccc/);
  await page.screenshot({ path: 'tests/.tmp/phonk-page.png', fullPage: true });
});

test('Phonk Mode: switched off (PHONK_MODE=off) the page says it is resting and gives no links', async ({ page }) => {
  const site = await startSite({ env: { ADMIN_KEY: 'k', PHONK_MODE: 'off' } });
  try {
    const ts = new Date().toISOString();
    await site.db.prepare("INSERT INTO packs (id, title, kind, region, tier, description, status, sort, created_at, updated_at) VALUES ('p', 'P', 'links', 'common', 'free', '', 'live', 1, ?, ?)").bind(ts, ts).run();
    await site.db.prepare("INSERT INTO pack_items (id, pack_id, title, kind, text, credit, licence, cleared, status, sort, created_at, tier) VALUES ('i-link000099', 'p', 'T', 'link', 'aaaaaaaaaaa', 'A', 'Official', 1, 'live', 1, ?, 'free')").bind(ts).run();
    await page.goto(`${site.url}/phonk`);
    await expect(page.locator('#status')).toContainText('resting');
    await expect(page.locator('#tracks li')).toHaveCount(0);
  } finally { await site.close(); }
});

test('playlists, search and playback queue stay independent while browsing', async ({ page, site }) => {
  const ts = new Date().toISOString();
  await site.db.prepare("INSERT INTO packs (id, title, kind, region, tier, description, status, sort, created_at, updated_at) VALUES ('regional', 'Regional favourites', 'links', 'in', 'free', '', 'live', 2, ?, ?)").bind(ts, ts).run();
  await site.db.prepare("INSERT INTO pack_items (id, pack_id, title, kind, text, credit, licence, cleared, status, sort, created_at, tier) VALUES ('i-link000004', 'regional', 'Regional track', 'link', 'ddddddddddd', 'Artist D', 'Official', 1, 'live', 1, ?, 'free')").bind(ts).run();
  await page.goto(`${site.url}/phonk#k=${site.proKey}`);
  await page.locator('#playlists').getByRole('button', { name: 'Phonk Mode' }).click();
  await expect(page.locator('#tracks li')).toHaveCount(3);
  await page.locator('#tracks li').first().locator('button').click();
  await expect(page.locator('#player')).toHaveAttribute('src', /aaaaaaaaaaa/);
  await page.locator('#playlists').getByRole('button', { name: 'Regional favourites' }).click();
  await expect(page.locator('#tracks li')).toHaveCount(1);
  await page.locator('#next').click();
  await expect(page.locator('#player')).toHaveAttribute('src', /bbbbbbbbbbb/);
  await page.locator('#search').fill('no such song');
  await expect(page.locator('#tracks li')).toHaveCount(0);
  await expect(page.locator('#status')).toContainText('No matching tracks');
  await page.locator('#search').fill('Artist D');
  await expect(page.locator('#tracks li')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'tests/.tmp/phonk-mobile-upgrade.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('shuffle retains playback history, visits each selected track once and adds no per-play API calls', async ({ page, site }) => {
  await page.addInitScript(() => { Math.random = () => 0; localStorage.removeItem('memebox-phonk-shuffle'); });
  const linkRequests = []; page.on('request', r => { if (r.url().includes('/api/pack-link')) linkRequests.push(r.url()); });
  await page.goto(`${site.url}/phonk`);
  await page.locator('#playlists').getByRole('button', { name: 'Phonk Mode' }).click();
  await page.locator('#shuffle').click();
  await expect(page.locator('#shuffle')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#tracks li').first().locator('button').click();
  await expect(page.locator('#player')).toHaveAttribute('src', /aaaaaaaaaaa/);
  await page.locator('#next').click();
  await expect(page.locator('#player')).toHaveAttribute('src', /ccccccccccc/);
  await page.locator('#next').click();
  await expect(page.locator('#player')).toHaveAttribute('src', /bbbbbbbbbbb/);
  await page.locator('#prev').click();
  await expect(page.locator('#player')).toHaveAttribute('src', /ccccccccccc/);
  expect(linkRequests).toEqual([]);
});

test('thirty free songs are available equally and owner metadata edits appear after refresh', async ({ page, site }) => {
  const ts = new Date().toISOString();
  for (let n = 4; n <= 30; n++) {
    await site.db.prepare("INSERT INTO pack_items (id, pack_id, title, kind, text, credit, licence, cleared, status, sort, created_at, tier) VALUES (?, 'phonk-mode', ?, 'link', ?, 'Artist', 'Official', 1, 'live', ?, ?, 'free')")
      .bind('i-song' + String(n).padStart(6, '0'), 'Song ' + n, 'v' + String(n).padStart(10, '0'), n, ts).run();
  }
  await page.goto(`${site.url}/phonk`);
  await page.locator('#playlists').getByRole('button', { name: 'Phonk Mode' }).click();
  await expect(page.locator('#tracks li')).toHaveCount(30);
  await expect(page.locator('#tracks button:disabled')).toHaveCount(0);
  await site.db.prepare("UPDATE pack_items SET title = 'New owner choice', sort = 0 WHERE id = 'i-song000030'").run();
  await page.reload();
  await page.locator('#playlists').getByRole('button', { name: 'Phonk Mode' }).click();
  await expect(page.locator('#tracks li').first()).toContainText('New owner choice');
});

test('adult tracks are opt-in and removed from the active player and queue when hidden',async({page,site})=>{
 await site.db.prepare("UPDATE pack_items SET explicit=1 WHERE id='i-link000003'").run();
 await page.goto(site.url+'/phonk');await expect(page.locator('#tracks')).not.toContainText('Max track');
 await page.locator('#adult-content').check();await expect(page.locator('#tracks')).toContainText('Max track');
 await page.locator('#tracks button',{hasText:'Max track'}).click();await expect(page.locator('#player')).toHaveAttribute('src',/ccccccccccc/);
 await page.locator('#adult-content').uncheck();await expect(page.locator('#tracks')).not.toContainText('Max track');await expect(page.locator('#player')).not.toHaveAttribute('src',/ccccccccccc/);
});
