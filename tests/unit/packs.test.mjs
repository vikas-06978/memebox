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
import { listPacks, listItems, canPublish, slugify } from '../../site/src/packs.js';

const ADMIN_KEY = 'admin-key-for-tests';
let db, bucket, cookie;
const env = (extra = {}) => ({ DB: db, PACKS: bucket, ADMIN_KEY, RATE_SALT: 'salt', ...extra });
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
  assert.match(one, /Add text memes/);
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
  assert.match(page, /file storage is not set up/i);
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
