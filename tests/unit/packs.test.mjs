// Music and meme packs: the admin uploads audio and text memes, items only go live when cleared, and users get only what is live
// (Pro and Pro Max packs need a key with the right time). Real Pages Functions on SQLite and an in-memory R2 bucket.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { D1 } from '../../tools/d1-sqlite.mjs';
import { R2Memory } from '../../tools/r2-memory.mjs';
import { makeSession } from '../../site/src/security.js';
import { createLicense } from '../../site/src/shop.js';
import { onRequest as adminPacks } from '../../site/functions/admin/packs.js';
import { onRequest as adminPackFile } from '../../site/functions/admin/packfile.js';
import { onRequest as apiPacks } from '../../site/functions/api/packs.js';
import { onRequest as apiPackFile } from '../../site/functions/api/pack-file.js';
import { listPacks, listItems, canPublish, slugify, youtubeId, addLinks } from '../../site/src/packs.js';
import { onRequest as apiPackLink } from '../../site/functions/api/pack-link.js';

const ADMIN_KEY = 'admin-key-for-tests';
let db, bucket, cookie;
const env = (extra = {}) => ({ DB: db, PACKS: bucket, ADMIN_KEY, RATE_SALT: 'salt', HOSTED_AUDIO_ENABLED: 'on', HOSTED_FILES_ENABLED: 'on', ...extra });
const call = (h, request, e = env()) => h({ request, env: e, params: {}, waitUntil() {} });
const req = (path, init = {}) => new Request('https://memebox.pages.dev' + path, { ...init, headers: { 'CF-Connecting-IP': '203.0.113.30', ...(init.headers || {}) } });
const post = (fields) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of [].concat(v)) f.append(k, x);
  return req('/admin/packs', { method: 'POST', headers: { Cookie: cookie }, body: f });
};
const audio = (name, size = 2000, type = 'audio/mpeg') => new File([new Uint8Array(size).fill(7)], name, { type });
const idOf = (res) => new URL(res.headers.get('Location'), 'https://x').searchParams.get('id');
const msgOf = (res) => new URL(res.headers.get('Location'), 'https://x').searchParams.get('msg') || '';
const errOf = (res) => new URL(res.headers.get('Location'), 'https://x').searchParams.get('err') || '';

async function makePack(extra = {}) {
  const res = await call(adminPacks, post({ action: 'pack-create', title: 'Phonk starter pack', kind: 'music', region: 'common', tier: 'free', description: 'Ten tracks', ...extra }));
  assert.equal(res.status, 303);
  return idOf(res);
}

beforeEach(async () => {
  db = new D1();
  bucket = new R2Memory();
  cookie = `memebox_admin=${await makeSession(ADMIN_KEY)}`;
});

test('playlist and track limits hold for concurrent admin submissions', async () => {
  for (let i = 0; i < 10; i++) await makePack({ title: 'Playlist ' + i, kind: 'links' });
  const refused = await call(adminPacks, post({ action: 'pack-create', title: 'One too many', kind: 'links' }));
  assert.match(errOf(refused), /playlist limit/);
  const links = Array.from({ length: 40 }, (_, i) => 'https://youtu.be/' + String(i).padStart(11, '0')).join('\n');
  const others = Array.from({ length: 40 }, (_, i) => 'https://youtu.be/' + String(i + 40).padStart(11, '0')).join('\n');
  const results = await Promise.all([addLinks(db, 'playlist-0', links, { cleared: true }), addLinks(db, 'playlist-0', others, { cleared: true })]);
  assert.equal(results.reduce((n, r) => n + r.added, 0), 50);
  assert.equal((await listItems(db, 'playlist-0')).length, 50);
});

test('regional recordings retain their language; unsupported text voices are refused before insertion', async () => {
  const id = await makePack({ title: 'Regional dialogues', kind: 'memes', region: 'in' });
  const uploaded = await call(adminPacks, post({ action: 'items-upload', pack: id, files: [audio('Local reaction.mp3')], licenceKind: 'own', cleared: 'on', lang: 'bho' }));
  assert.match(msgOf(uploaded), /1 file uploaded/);
  const [item] = await listItems(db, id);
  assert.equal(item.lang, 'bho');
  const rejected = await call(adminPacks, post({ action: 'lines-add', pack: id, lines: 'Hello | en\nA regional line | bho', licenceKind: 'own', cleared: 'on' }));
  assert.match(errOf(rejected), /recorded audio/);
  assert.equal((await listItems(db, id)).length, 1);
});

test('hosted global cap and pause switches refuse downloads before reading R2', async () => {
  const id = await makePack();
  await call(adminPacks, post({ action: 'items-upload', pack: id, files: [audio('Original.mp3')], licenceKind: 'own', cleared: 'on' }));
  await call(adminPacks, post({ action: 'pack-update', pack: id, title: 'Originals', kind: 'music', region: 'common', tier: 'free', status: 'live' }));
  const [item] = await listItems(db, id);
  let reads = 0;
  const originalGet = bucket.get.bind(bucket);
  bucket.get = (...args) => { reads++; return originalGet(...args); };
  const request = () => req('/api/pack-file?item=' + item.id);
  assert.equal((await call(apiPackFile, request(), env({ PACK_GLOBAL_DAILY_FILES: '1' }))).status, 200);
  assert.equal((await call(apiPackFile, request(), env({ PACK_GLOBAL_DAILY_FILES: '1' }))).status, 429);
  assert.equal(reads, 1);
  assert.equal((await call(apiPackFile, request(), env({ PACKS_ENABLED: 'off' }))).status, 503);
  assert.equal((await call(apiPackFile, request(), env({ HOSTED_AUDIO_ENABLED: 'off' }))).status, 503);
  assert.equal((await call(apiPackFile, request(), env({ HOSTED_AUDIO_ENABLED: undefined }))).status, 503, 'hosted audio is paused until explicitly enabled');
  assert.deepEqual((await (await call(apiPacks, req('/api/packs'), env({ HOSTED_AUDIO_ENABLED: undefined }))).json()).packs, [], 'paused audio is not advertised as available');
  assert.equal(reads, 1);
  assert.deepEqual((await (await call(apiPacks, req('/api/packs'), env({ PACKS_ENABLED: 'off' }))).json()).packs, []);
});

test('only the signed-in admin can use the packs pages', async () => {
  const res = await call(adminPacks, req('/admin/packs'));
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('Location'), '/admin');
  const res2 = await call(adminPacks, req('/admin/packs', { method: 'POST', body: new FormData() }));
  assert.equal(res2.status, 303);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM packs').first()).n, 0);
});

test('a new pack is a draft; the list and the pack page show it, with the copyright reminder and no inline scripts or styles', async () => {
  const id = await makePack();
  assert.equal(id, 'phonk-starter-pack');
  const list = await call(adminPacks, req('/admin/packs', { headers: { Cookie: cookie } }));
  const html = await list.text();
  assert.match(html, /Phonk starter pack/);
  assert.match(html, /licensed to you in writing/);
  assert.match(list.headers.get('Content-Security-Policy'), /media-src 'self'/);
  assert.doesNotMatch(html, /<script|style="/);
  const one = await (await call(adminPacks, req('/admin/packs?id=' + id, { headers: { Cookie: cookie } }))).text();
  assert.match(one, /Upload audio/);
  assert.doesNotMatch(one, /Add text memes/, 'text memes belong to memes packs');
  assert.match(one, /You planned 10 free tracks/, 'the free plan counter');
  const row = await db.prepare('SELECT * FROM packs WHERE id = ?').bind(id).first();
  assert.equal(row.status, 'draft');
  assert.equal(slugify('Indian Memes: Desi 😂!'), 'indian-memes-desi');
});

test('uploaded audio: stored in the bucket, a draft unless cleared with a licence, bad files skipped', async () => {
  const id = await makePack();
  const bad = new File(['hello'], 'notes.txt', { type: 'text/plain' });
  const big = new File([new Uint8Array(26 * 1024 * 1024)], 'huge.mp3', { type: 'audio/mpeg' });
  const r1 = await call(adminPacks, post({ action: 'items-upload', pack: id, files: [audio('Drift Night.mp3'), bad, big], licenceKind: 'own', cleared: 'on', lang: 'en', tags: 'phonk' }));
  assert.match(msgOf(r1), /1 file uploaded/);
  assert.match(msgOf(r1), /notes\.txt: not an audio file/);
  assert.match(msgOf(r1), /huge\.mp3: over 25 MB/);
  const items = await listItems(db, id);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Drift Night');
  assert.equal(items[0].status, 'live', 'cleared with a licence goes live');
  assert.equal(items[0].licence, 'Own work');
  assert.ok(await bucket.head(items[0].file_key));
  // not cleared: a draft
  await call(adminPacks, post({ action: 'items-upload', pack: id, files: [audio('Mystery.mp3')], licenceKind: 'own' }));
  const draft = (await listItems(db, id)).find((i) => i.title === 'Mystery');
  assert.equal(draft.status, 'draft');
  assert.equal(canPublish(draft), false);
  // no cleared box, no licence: "not cleared"
  await call(adminPacks, post({ action: 'items-upload', pack: id, files: [audio('X.mp3')] }));
  assert.equal((await listItems(db, id)).find((i) => i.title === 'X').status, 'draft');
  const admin = await call(adminPackFile, req('/admin/packfile?id=' + items[0].id, { headers: { Cookie: cookie } }));
  assert.equal(admin.status, 200);
  assert.equal(admin.headers.get('Content-Type'), 'audio/mpeg');
  assert.equal((await admin.arrayBuffer()).byteLength, 2000);
  const anon = await call(adminPackFile, req('/admin/packfile?id=' + items[0].id));
  assert.equal(anon.status, 303, 'drafts and files are for the admin only');
});

test('text memes: one per line with language and a strong-language mark', async () => {
  const id = await makePack({ title: 'India memes', kind: 'memes', region: 'in' });
  const r = await call(adminPacks, post({ action: 'lines-add', pack: id, lines: 'Bhai tu rehne de | hinglish\nWhat a day | en\n\nkuch kadak line | hi | strong', licenceKind: 'own', cleared: 'on' }));
  assert.match(msgOf(r), /3 memes added/);
  const items = await listItems(db, id);
  assert.equal(items.length, 3);
  assert.deepEqual(items.map((i) => [i.text, i.lang, i.explicit, i.status]), [['Bhai tu rehne de', 'hinglish', 0, 'live'], ['What a day', 'en', 0, 'live'], ['kuch kadak line', 'hi', 1, 'live']]);
});

test('an item cannot be set live without "I may share this" and a licence; it can once both are there', async () => {
  const id = await makePack();
  await call(adminPacks, post({ action: 'items-upload', pack: id, files: [audio('A.mp3')] }));
  const [item] = await listItems(db, id);
  const r1 = await call(adminPacks, post({ action: 'item-update', pack: id, item: item.id, title: 'A', status: 'live', licence: '', lang: '' }));
  assert.match(errOf(r1), /Kept as a draft/);
  assert.equal((await listItems(db, id))[0].status, 'draft');
  const r2 = await call(adminPacks, post({ action: 'item-update', pack: id, item: item.id, title: 'A track', status: 'live', licence: 'Licensed: Artist X, 2026-10-01, written', cleared: 'on', credit: 'Artist X', lang: 'en', explicit: 'on' }));
  assert.equal(errOf(r2), '');
  const now = (await listItems(db, id))[0];
  assert.deepEqual([now.title, now.status, now.credit, now.explicit], ['A track', 'live', 'Artist X', 1]);
});

test('users see only live packs and live items, without file keys; strong language is flagged', async () => {
  const live = await makePack({ title: 'Common vibes', kind: 'music' });
  await call(adminPacks, post({ action: 'items-upload', pack: live, files: [audio('One.mp3'), audio('Two.mp3')], licenceKind: 'cc0', cleared: 'on' }));
  await call(adminPacks, post({ action: 'items-upload', pack: live, files: [audio('Draft.mp3')] }));
  const hidden = await makePack({ title: 'Secret pack' });
  await call(adminPacks, post({ action: 'items-upload', pack: hidden, files: [audio('H.mp3')], licenceKind: 'own', cleared: 'on' }));
  const memes = await makePack({ title: 'India memes', kind: 'memes', region: 'in' });
  await call(adminPacks, post({ action: 'lines-add', pack: memes, lines: 'kadak | hi | strong', licenceKind: 'own', cleared: 'on' }));
  for (const p of [live, memes]) await call(adminPacks, post({ action: 'pack-update', pack: p, title: p === live ? 'Common vibes' : 'India memes', region: p === live ? 'common' : 'in', tier: 'free', status: 'live' }));

  const res = await call(apiPacks, req('/api/packs'));
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
  const body = await res.json();
  assert.deepEqual(body.packs.map((p) => p.id).sort(), ['common-vibes', 'india-memes']);
  const common = body.packs.find((p) => p.id === 'common-vibes');
  assert.deepEqual(common.items.map((i) => i.title).sort(), ['One', 'Two'], 'the draft is not shown');
  assert.equal(common.bytes, 4000);
  assert.ok(!JSON.stringify(body).includes('packs/'), 'no file keys');
  assert.equal(body.packs.find((p) => p.id === 'india-memes').items[0].explicit, true);
});

test('pack files: free is open, Pro needs Pro time, Pro Max needs Pro Max time, the unlimited key opens all, and drafts are never served', async () => {
  const mk = async (title, tier) => {
    const id = await makePack({ title, tier });
    await call(adminPacks, post({ action: 'items-upload', pack: id, files: [audio(title + '.mp3')], licenceKind: 'own', cleared: 'on' }));
    await call(adminPacks, post({ action: 'pack-update', pack: id, title, region: 'common', tier, status: 'live' }));
    return (await listItems(db, id))[0].id;
  };
  const free = await mk('Free tracks', 'free'), pro = await mk('Pro tracks', 'pro'), max = await mk('Max tracks', 'max');
  const get = (item, key) => call(apiPackFile, req('/api/pack-file?item=' + item, { headers: key ? { 'X-MemeBox-Key': key } : {} }));

  assert.equal((await get(free)).status, 200);
  assert.equal((await get(pro)).status, 403);
  assert.equal((await get(max)).status, 403);
  const proKey = await createLicense(db, { kind: 'paid', proSeconds: 600 });
  const maxKey = await createLicense(db, { kind: 'paid', maxSeconds: 600 });
  const allKey = await createLicense(db, { kind: 'owner', unlimited: true });
  const empty = await createLicense(db, { kind: 'paid' });
  assert.equal((await get(pro, proKey)).status, 200);
  assert.equal((await get(max, proKey)).status, 403, 'Pro time does not open Pro Max packs');
  assert.equal((await get(max, maxKey)).status, 200);
  assert.equal((await get(pro, maxKey)).status, 200, 'Pro Max time opens Pro packs too');
  assert.equal((await get(max, allKey)).status, 200);
  assert.equal((await get(pro, empty)).status, 403, 'a key with no time left');
  await db.prepare("UPDATE licenses SET status = 'revoked' WHERE key = ?").bind(proKey).run();
  assert.equal((await get(pro, proKey)).status, 403, 'a turned-off key');
  const ok = await get(free);
  assert.equal(ok.headers.get('Content-Type'), 'audio/mpeg');
  assert.equal((await ok.arrayBuffer()).byteLength, 2000);
  assert.ok(Number((await db.prepare('SELECT downloads FROM pack_items WHERE id = ?').bind(free).first()).downloads) >= 2, 'downloads are counted');
  // a draft item and an unknown item are not served
  await db.prepare("UPDATE pack_items SET status = 'draft' WHERE id = ?").bind(free).run();
  assert.equal((await get(free)).status, 404);
  assert.equal((await get('i-doesnotexist')).status, 404);
  assert.equal((await get('bad')).status, 404);
});

test('deleting an item or a pack removes its files from the bucket', async () => {
  const id = await makePack();
  await call(adminPacks, post({ action: 'items-upload', pack: id, files: [audio('One.mp3'), audio('Two.mp3')], licenceKind: 'own', cleared: 'on' }));
  const [a, b] = await listItems(db, id);
  assert.equal(bucket.map.size, 2);
  await call(adminPacks, post({ action: 'item-delete', pack: id, item: a.id }));
  assert.equal(bucket.map.size, 1);
  assert.ok(await bucket.head(b.file_key));
  await call(adminPacks, post({ action: 'pack-delete', pack: id }));
  assert.equal(bucket.map.size, 0);
  assert.equal((await listPacks(db)).length, 0);
});

test('without the R2 bucket the page says so and audio uploads are refused (text memes still work)', async () => {
  const e = env({ PACKS: undefined });
  const make = await call(adminPacks, post({ action: 'pack-create', title: 'No bucket', kind: 'music' }), e);
  const id = idOf(make);
  const page = await (await call(adminPacks, req('/admin/packs', { headers: { Cookie: cookie } }), e)).text();
  assert.match(page, /Hosted file uploads are paused or storage is unavailable/i);
  const r = await call(adminPacks, post({ action: 'items-upload', pack: id, files: [audio('A.mp3')] }), e);
  assert.match(errOf(r), /not set up/);
  const r2 = await call(adminPacks, post({ action: 'lines-add', pack: id, lines: 'hello' }), e);
  assert.match(msgOf(r2), /1 meme added/);
});

test('"Copyright-free" needs the link that says so: with it the item goes live, without it it stays a draft', async () => {
  const id = await makePack();
  await call(adminPacks, post({ action: 'items-upload', pack: id, files: [audio('A.mp3')], licenceKind: 'free', cleared: 'on' }));
  assert.equal((await listItems(db, id))[0].status, 'draft');
  const r = await call(adminPacks, post({ action: 'items-upload', pack: id, files: [audio('B.mp3')], licenceKind: 'free', cleared: 'on', source: 'https://example.com/licence' }));
  assert.match(msgOf(r), /live/);
  const b = (await listItems(db, id)).find((i) => i.title === 'B');
  assert.equal(b.status, 'live');
  assert.equal(b.licence, 'Copyright-free');
  assert.equal(b.source, 'https://example.com/licence');
});

test('you choose which items are free: an item\'s own plan beats the pack\'s, in the catalogue and on download', async () => {
  const id = await makePack({ tier: 'max' }); // a Pro Max pack...
  await call(adminPacks, post({ action: 'items-upload', pack: id, files: [audio('One.mp3'), audio('Two.mp3'), audio('Three.mp3')], licenceKind: 'own', cleared: 'on' }));
  const items = await listItems(db, id);
  assert.equal(items.length, 3);
  // ...with the first one made free in bulk
  const res = await call(adminPacks, post({ action: 'items-tier', pack: id, ids: [items[0].id], itemTier: 'free' }));
  assert.match(msgOf(res), /1 item updated/);
  assert.match(errOf(await call(adminPacks, post({ action: 'items-tier', pack: id, itemTier: 'free' }))), /Tick some items/);
  await call(adminPacks, post({ action: 'pack-update', pack: id, title: 'Phonk starter pack', region: 'common', tier: 'max', description: '', status: 'live', sort: '1' }));
  const cat = await (await call(apiPacks, req('/api/packs'))).json();
  const byTitle = Object.fromEntries(cat.packs[0].items.map((i) => [i.title, i.tier]));
  assert.deepEqual(byTitle, { One: 'free', Two: 'max', Three: 'max' });
  const get = (item, headers = {}) => call(apiPackFile, req('/api/pack-file?item=' + item, { headers }));
  assert.equal((await get(items[0].id)).status, 200, 'the free one is open to everybody');
  assert.equal((await get(items[1].id)).status, 403, 'the others still need Pro Max');
  // and one item can be set on its own, back to following the pack
  await call(adminPacks, post({ action: 'item-update', pack: id, item: items[0].id, title: 'One', lang: '', tags: '', licence: 'Own work', cleared: 'on', status: 'live', sort: '100', itemTier: '' }));
  assert.equal((await get(items[0].id)).status, 403);
  const page = await (await call(adminPacks, req('/admin/packs?id=' + id, { headers: { Cookie: cookie } }))).text();
  assert.match(page, /0 free/);
  assert.match(page, /3 Pro Max/);
});

test('a pictures pack takes png / jpg / webp, serves them with their type, and the free picture is open', async () => {
  const id = await makePack({ title: 'Meme pictures', kind: 'pictures' });
  const png = new File([new Uint8Array(500).fill(1)], 'drake.png', { type: 'image/png' });
  const wav = new File([new Uint8Array(500)], 'sound.wav', { type: 'audio/wav' });
  const res = await call(adminPacks, post({ action: 'items-upload', pack: id, files: [png, wav], licenceKind: 'own', cleared: 'on', itemTier: 'free' }));
  assert.match(msgOf(res), /1 file uploaded/);
  assert.match(msgOf(res), /not a picture/);
  const [item] = await listItems(db, id);
  assert.equal(item.kind, 'image');
  assert.equal(item.tier, 'free');
  await call(adminPacks, post({ action: 'pack-update', pack: id, title: 'Meme pictures', region: 'common', tier: 'pro', description: '', status: 'live', sort: '1' }));
  const file = await call(apiPackFile, req('/api/pack-file?item=' + item.id));
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('Content-Type'), 'image/png');
  const page = await (await call(adminPacks, req('/admin/packs?id=' + id, { headers: { Cookie: cookie } }))).text();
  assert.match(page, /Upload pictures/);
  assert.match(page, /<img class="thumb"/);
  assert.match(page, /That is the 1 free picture you planned/);
});

test('a daily cap on files per person: the next one is refused with 429; another person and the next day are fine; refused tries do not count', async () => {
  const id = await makePack({ title: 'Cap test' });
  await call(adminPacks, post({ action: 'items-upload', pack: id, files: [audio('A.mp3')], licenceKind: 'own', cleared: 'on' }));
  await call(adminPacks, post({ action: 'pack-update', pack: id, title: 'Cap test', region: 'common', tier: 'free', status: 'live' }));
  const [item] = await listItems(db, id);
  const e = env({ PACK_DAILY_LIMIT: '3' });
  const get = (ip, key) => call(apiPackFile, new Request('https://memebox.pages.dev/api/pack-file?item=' + item.id, { headers: { 'CF-Connecting-IP': ip, ...(key ? { 'X-MemeBox-Key': key } : {}) } }), e);
  for (let i = 0; i < 3; i++) assert.equal((await get('198.51.100.1')).status, 200);
  const blocked = await get('198.51.100.1');
  assert.equal(blocked.status, 429);
  assert.match((await blocked.json()).error, /Daily download limit/);
  assert.equal((await get('198.51.100.2')).status, 200, 'another person is not affected');
  const key = await createLicense(db, { kind: 'paid', proSeconds: 600 });
  for (let i = 0; i < 3; i++) assert.equal((await get('198.51.100.1', key)).status, 200, 'a key has its own count, whatever the address');
  assert.equal((await get('198.51.100.9', key)).status, 429, 'and it follows the key to another address');
  // the day after, the counter starts again
  await db.prepare('DELETE FROM rate_limits').run();
  assert.equal((await get('198.51.100.1')).status, 200);
});

test('the storage budget: uploads stop when the bucket would pass it, and the pages show how much is used', async () => {
  const id = await makePack({ title: 'Budget test' });
  const e = env({ PACKS_MAX_MB: '1' }); // 1 MB for the whole test
  const up = (files) => call(adminPacks, (() => {
    const f = new FormData(); f.append('action', 'items-upload'); f.append('pack', id); f.append('licenceKind', 'own'); f.append('cleared', 'on');
    for (const x of files) f.append('files', x);
    return req('/admin/packs', { method: 'POST', headers: { Cookie: cookie }, body: f });
  })(), e);
  const r = await up([audio('A.mp3', 600 * 1024), audio('B.mp3', 600 * 1024)]);
  assert.match(msgOf(r), /1 file uploaded/);
  assert.match(msgOf(r), /storage budget \(1 MB\) is full/);
  assert.equal((await listItems(db, id)).length, 1);
  const list = await (await call(adminPacks, req('/admin/packs', { headers: { Cookie: cookie } }), e)).text();
  assert.match(list, /Storage:<\/b> 0\.6 MB of 1\.0 MB used/);
  const one = await (await call(adminPacks, req('/admin/packs?id=' + id, { headers: { Cookie: cookie } }), e)).text();
  assert.match(one, /Storage:/);
});

test('a daily cap on how much too: big files use it up faster than small ones', async () => {
  const id = await makePack({ title: 'Mb cap' });
  await call(adminPacks, post({ action: 'items-upload', pack: id, files: [audio('Big.mp3', 600 * 1024)], licenceKind: 'own', cleared: 'on' }));
  await call(adminPacks, post({ action: 'pack-update', pack: id, title: 'Mb cap', region: 'common', tier: 'free', status: 'live' }));
  const [item] = await listItems(db, id);
  const e = env({ PACK_DAILY_MB: '1' });
  const get = (ip) => call(apiPackFile, new Request('https://memebox.pages.dev/api/pack-file?item=' + item.id, { headers: { 'CF-Connecting-IP': ip } }), e);
  assert.equal((await get('203.0.113.77')).status, 200);
  assert.equal((await get('203.0.113.77')).status, 429, 'a second 0.6 MB file passes the 1 MB a day');
  assert.equal((await get('203.0.113.78')).status, 200, 'another person is fine');
});

test('Phonk Mode: YouTube links are stored (nothing hosted), need the official-upload box to go live, and keep their plan per track', async () => {
  assert.equal(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://youtu.be/dQw4w9WgXcQ?si=abc'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://music.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://example.com/watch?v=dQw4w9WgXcQ'), '', 'only YouTube');
  assert.equal(youtubeId('https://www.youtube.com/watch?v=short'), '', 'not a video id');
  assert.equal(youtubeId('javascript:alert(1)'), '');

  const id = await makePack({ title: 'Phonk Mode', kind: 'links', tier: 'max' });
  const links = 'https://www.youtube.com/watch?v=aaaaaaaaaaa | Track A | Artist A\nhttps://youtu.be/bbbbbbbbbbb | Track B\nhttps://example.com/nope\nhttps://youtu.be/aaaaaaaaaaa | Again';
  let r = await call(adminPacks, post({ action: 'links-add', pack: id, links, itemTier: '' }));
  assert.match(msgOf(r), /2 links added/);
  assert.match(msgOf(r), /not a YouTube video link/);
  assert.match(msgOf(r), /already in this pack/);
  assert.match(msgOf(r), /drafts/, 'without the official-upload box they stay drafts');
  let items = await listItems(db, id);
  assert.deepEqual(items.map((i) => [i.kind, i.text, i.status, i.credit, i.bytes]), [['link', 'aaaaaaaaaaa', 'draft', 'Artist A', 0], ['link', 'bbbbbbbbbbb', 'draft', '', 0]]);
  await call(adminPacks, post({ action: 'items-tier', pack: id, ids: [items[0].id], itemTier: 'free' }));
  // confirm: add a third one as official, it goes live
  r = await call(adminPacks, post({ action: 'links-add', pack: id, links: 'https://youtu.be/ccccccccccc | Track C', official: 'on', itemTier: 'pro' }));
  assert.match(msgOf(r), /They are live/);
  items = await listItems(db, id);
  assert.equal(items[2].status, 'live');
  assert.equal(items[2].tier, 'pro');
  const page = await (await call(adminPacks, req('/admin/packs?id=' + id, { headers: { Cookie: cookie } }))).text();
  assert.match(page, /Nothing is hosted/);
  assert.match(page, /Open on YouTube/);
  assert.doesNotMatch(page, /<iframe/, 'the admin page embeds nothing');
});

test('YouTube playlists are always free, even with legacy paid labels; PHONK_MODE=off switches them off', async () => {
  const id = await makePack({ title: 'Phonk Mode', kind: 'links', tier: 'max' });
  await call(adminPacks, post({ action: 'links-add', pack: id, links: 'https://youtu.be/aaaaaaaaaaa | Free one | A\nhttps://youtu.be/bbbbbbbbbbb | Pro one | B\nhttps://youtu.be/ccccccccccc | Max one | C', official: 'on' }));
  const [a, b] = await listItems(db, id);
  await call(adminPacks, post({ action: 'items-tier', pack: id, ids: [a.id], itemTier: 'free' }));
  await call(adminPacks, post({ action: 'items-tier', pack: id, ids: [b.id], itemTier: 'pro' }));
  await call(adminPacks, post({ action: 'pack-update', pack: id, title: 'Phonk Mode', region: 'common', tier: 'max', description: '', status: 'live', sort: '1' }));
  const cat = await (await call(apiPacks, req('/api/packs'))).json();
  assert.equal(cat.packs[0].items.length, 3);
  assert.deepEqual(cat.packs[0].items.map((i) => i.tier), ['free', 'free', 'free']);
  assert.ok(cat.packs[0].items.every((i) => i.text === '' && i.bytes === 0));
  assert.deepEqual(cat.packs[0].items.map(i => i.videoId).sort(), ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'], 'free public video IDs avoid per-play D1 requests');
  assert.equal(cat.packs[0].tier, 'free');

  const items = await listItems(db, id);
  const link = (item, key, e = env()) => call(apiPackLink, req('/api/pack-link?item=' + item, { headers: key ? { 'X-MemeBox-Key': key } : {} }), e);
  const ok = await link(items[0].id);
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true, id: 'aaaaaaaaaaa', title: 'Free one', artist: 'A' });
  assert.equal((await link(items[1].id)).status, 200, 'third-party YouTube embeds never require a paid key');
  assert.equal((await link(items[2].id)).status, 200);
  const proKey = await createLicense(db, { kind: 'paid', proSeconds: 600 });
  const maxKey = await createLicense(db, { kind: 'paid', maxSeconds: 600 });
  assert.equal((await link(items[1].id, proKey)).status, 200);
  assert.equal((await link(items[2].id, proKey)).status, 200);
  assert.equal((await link(items[2].id, maxKey)).status, 200);
  assert.equal((await link('i-doesnotexist')).status, 404);
  await db.prepare('UPDATE pack_items SET cleared = 0 WHERE id = ?').bind(items[0].id).run();
  assert.equal((await link(items[0].id)).status, 404, 'an uncleared live record cannot bypass rights checks through the legacy endpoint');
  const restricted = await (await call(apiPacks, req('/api/packs'))).json();
  assert.ok(restricted.packs[0].items.every(i => i.id !== items[0].id), 'uncleared records are excluded from the public video catalog');
  // the kill switch
  const off = env({ PHONK_MODE: 'off' });
  assert.equal((await link(items[0].id, '', off)).status, 503);
  const cat2 = await (await call(apiPacks, req('/api/packs'), off)).json();
  assert.equal(cat2.packs.length, 0, 'the catalogue has no Phonk Mode packs while it is off');
  // a link item is never served as a file
  assert.equal((await call(apiPackFile, req('/api/pack-file?item=' + items[0].id))).status, 404);
});

// No R2 calls are permitted when hosting has not been explicitly enabled.
test('hosted files default off before database or bucket access', async () => {
  const disabled = env({ HOSTED_FILES_ENABLED: undefined, DB: { prepare() { throw Error('Unexpected database access'); } }, PACKS: { get() { throw Error('Unexpected R2 access'); } } });
  assert.equal((await call(apiPackFile, req('/api/pack-file?item=anything'), disabled)).status, 503);
});
test('disabled hosting rejects uploads without writing an R2 object', async () => {
  const id = await makePack();
  const before = await listItems(db, id);
  const disabled = env({ HOSTED_FILES_ENABLED: undefined, PACKS: { put() { throw Error('Unexpected R2 upload'); } } });
  const response = await call(adminPacks, post({ action: 'items-upload', pack: id, files: [audio('paused.mp3')] }), disabled);
  assert.match(errOf(response), /Hosted uploads are paused/);
  assert.deepEqual(await listItems(db, id), before);
});
