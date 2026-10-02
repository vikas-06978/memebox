// Step 6: the feedback site. Validation, rate limit, admin auth, and the real Pages Functions
// running against a D1 stand-in (node:sqlite with site/db/schema.sql).
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { validateSubmission, FEATURES } from '../../site/src/validate.js';
import {
  rateLimit, makeSession, checkSession, safeEqual, readCookie, SESSION_MS, TURNSTILE_VERIFY, sha256Hex,
} from '../../site/src/security.js';
import { csvCell, toCsv } from '../../site/src/admin.js';
import { onRequest as feedbackApi } from '../../site/functions/api/feedback.js';
import { onRequest as configApi } from '../../site/functions/api/config.js';
import { onRequest as adminPage } from '../../site/functions/admin/index.js';
import { onRequest as adminCsv } from '../../site/functions/admin/csv.js';
import { onRequest as adminLogout } from '../../site/functions/admin/logout.js';
import { D1 } from '../../tools/d1-sqlite.mjs';

const good = () => ({ type: 'feedback', rating: 4, used: ['clips', 'soundboard'], wants: 'More packs', message: 'Great fun', email: 'a@b.co', version: '0.6.0', site: 'meet', lang: 'en', token: 'tok', website: '' });

// ---------- validation ----------

test('a normal feedback post is accepted and cleaned', () => {
  const r = validateSubmission(good());
  assert.equal(r.ok, true);
  assert.equal(r.spam, false);
  assert.deepEqual(r.value.used, ['soundboard', 'clips']); // fixed order, no duplicates
  assert.equal(r.value.rating, 4);
  assert.equal(r.token, 'tok');
});

test('a minimal feedback post (rating only) and an uninstall post are accepted', () => {
  assert.equal(validateSubmission({ type: 'feedback', rating: 1 }).ok, true);
  const u = validateSubmission({ type: 'uninstall', reason: 'too-hard', version: '1.0.0', lang: 'hi' });
  assert.equal(u.ok, true);
  assert.equal(u.value.reason, 'too-hard');
  assert.equal(u.value.rating, null);
});

const bad = (patch, match) => {
  const body = typeof patch === 'function' ? patch(good()) : { ...good(), ...patch };
  const r = validateSubmission(body);
  assert.equal(r.ok, false, JSON.stringify(body));
  assert.ok(r.errors.some((e) => e.includes(match)), `expected "${match}" in ${JSON.stringify(r.errors)}`);
};

test('invalid posts are rejected with a reason', () => {
  bad({ ip: '1.2.3.4' }, 'ip: unknown field');
  bad({ userAgent: 'x' }, 'userAgent: unknown field');
  bad({ rating: 5 }, 'rating');
  bad({ rating: '4' }, 'rating');
  bad({ used: ['clips', 'hacking'] }, 'unknown feature');
  bad({ used: 'clips' }, 'used');
  bad({ wants: 'x'.repeat(501) }, 'wants: at most 500');
  bad({ message: 'x'.repeat(2001) }, 'message: at most 2000');
  bad({ message: 42 }, 'message: must be text');
  bad({ message: 'hi\u0000there' }, 'control characters');
  bad({ email: 'not-an-email' }, 'email');
  bad({ version: '1.0' }, 'version');
  bad({ site: 'youtube' }, 'site');
  bad({ lang: 'xx' }, 'lang');
  bad({ type: 'spam' }, 'type');
  bad(() => ({ type: 'uninstall' }), 'reason: required');
  bad(() => ({ type: 'uninstall', reason: 'other', rating: 3 }), 'rating: unknown field');
  assert.equal(validateSubmission(null).ok, false);
  assert.equal(validateSubmission([]).ok, false);
});

test('the honeypot marks a post as spam', () => {
  const r = validateSubmission({ ...good(), website: 'http://buy.example' });
  assert.equal(r.ok, true);
  assert.equal(r.spam, true);
});

test('the form offers exactly the six features from the brief', () => {
  assert.deepEqual(FEATURES, ['soundboard', 'voices', 'clips', 'tab-audio', 'voice-changer', 'captions']);
});

// ---------- rate limit ----------

test('5 per IP per hour, then blocked; another IP or the next hour is fine; the IP is never stored', async () => {
  const db = new D1();
  const now = Date.UTC(2026, 8, 28, 10, 15);
  const hit = (ip, t = now) => rateLimit(db, { salt: 's3cret', ip, now: t });
  for (let i = 1; i <= 5; i++) assert.equal((await hit('203.0.113.7')).allowed, true, `hit ${i}`);
  assert.equal((await hit('203.0.113.7')).allowed, false);
  assert.equal((await hit('198.51.100.1')).allowed, true);

  const rows = (await db.prepare('SELECT * FROM rate_limits').all()).results;
  assert.ok(!JSON.stringify(rows).includes('203.0.113.7'), 'raw IP not stored');
  const expected = await sha256Hex(`s3cret|${Math.floor(now / 3600000)}|feedback|203.0.113.7`);
  assert.ok(rows.some((r) => r.key === expected), 'key is SHA-256(salt|hour|bucket|IP)');

  const nextHour = now + 3600000;
  assert.equal((await hit('203.0.113.7', nextHour)).allowed, true);
  const left = (await db.prepare('SELECT hour FROM rate_limits').all()).results;
  assert.ok(left.every((r) => r.hour === Math.floor(nextHour / 3600000)), 'last hour rows deleted');
});

// ---------- admin session ----------

test('admin session: valid for 8 hours, rejects tampering, other keys and expiry', async () => {
  const now = Date.UTC(2026, 8, 28, 10);
  const s = await makeSession('key-1', now);
  assert.equal(await checkSession('key-1', s, now + 1000), true);
  assert.equal(await checkSession('key-1', s, now + SESSION_MS + 1), false);
  assert.equal(await checkSession('key-2', s, now + 1000), false);
  const [exp, mac] = s.split('.');
  assert.equal(await checkSession('key-1', `${Number(exp) + 3600000}.${mac}`, now), false); // extended expiry
  assert.equal(await checkSession('key-1', `${exp}.${'0'.repeat(64)}`, now), false);
  assert.equal(await checkSession('key-1', 'garbage', now), false);
  assert.equal(await checkSession('', s, now), false);
  assert.equal(SESSION_MS, 8 * 3600 * 1000);
});

test('safeEqual and cookie parsing', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  const req = new Request('https://x/', { headers: { Cookie: 'a=1; memebox_admin=v.w; b=2' } });
  assert.equal(readCookie(req, 'memebox_admin'), 'v.w');
  assert.equal(readCookie(req, 'nope'), null);
});

test('CSV cells are quoted and formulas are neutralised', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell('+1'), "'+1");
  assert.equal(csvCell(null), '');
  assert.match(toCsv([]), /^id,created_at,type,rating,used,wants,message,email,reason,version,site,lang\r\n$/);
});

// ---------- the real Pages Functions ----------

let db;
let realFetch;
const ENV = () => ({ DB: db, TURNSTILE_SITE_KEY: 'site-key', TURNSTILE_SECRET_KEY: 'secret-key', ADMIN_KEY: 'correct horse battery staple', RATE_SALT: 'salt' });

beforeEach(() => {
  db = new D1();
  realFetch = globalThis.fetch;
  // Turnstile: the token "ok" passes, anything else fails. No network.
  globalThis.fetch = async (url, init) => {
    if (String(url) === TURNSTILE_VERIFY) {
      const body = JSON.parse(init.body);
      return Response.json({ success: body.secret === 'secret-key' && body.response === 'ok' });
    }
    throw new Error('unexpected fetch ' + url);
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

const post = (body, { ip = '203.0.113.9', type = 'application/json' } = {}) => new Request('https://memebox.pages.dev/api/feedback', {
  method: 'POST',
  headers: { 'Content-Type': type, 'CF-Connecting-IP': ip, 'User-Agent': 'TestBrowser/1.0' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const call = (handler, request, env = ENV()) => handler({ request, env, params: {}, waitUntil() {} });

test('POST /api/feedback stores only the validated fields (no IP, no user agent)', async () => {
  const res = await call(feedbackApi, post({ ...good(), token: 'ok' }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  const rows = (await db.prepare('SELECT * FROM feedback').all()).results;
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.type, 'feedback');
  assert.equal(r.rating, 4);
  assert.equal(r.used, '["soundboard","clips"]');
  assert.equal(r.version, '0.6.0');
  assert.equal(r.site, 'meet');
  assert.match(r.created_at, /^\d{4}-\d\d-\d\dT/);
  const everything = JSON.stringify((await db.prepare('SELECT * FROM feedback').all()).results) +
    JSON.stringify((await db.prepare('SELECT * FROM rate_limits').all()).results);
  assert.ok(!everything.includes('203.0.113.9'), 'no IP anywhere');
  assert.ok(!everything.includes('TestBrowser'), 'no user agent anywhere');
});

test('POST /api/feedback: uninstall survey goes into the same table', async () => {
  const res = await call(feedbackApi, post({ type: 'uninstall', reason: 'not-funny', version: '0.6.0', token: 'ok' }));
  assert.equal(res.status, 200);
  const row = await db.prepare('SELECT * FROM feedback').first();
  assert.equal(row.type, 'uninstall');
  assert.equal(row.reason, 'not-funny');
});

test('POST /api/feedback rejects bad input, failed Turnstile, and floods', async () => {
  assert.equal((await call(feedbackApi, new Request('https://x/api/feedback'))).status, 405);
  assert.equal((await call(feedbackApi, post(good()), { DB: db })).status, 503); // not configured
  assert.equal((await call(feedbackApi, post('rating=4', { type: 'application/x-www-form-urlencoded' }))).status, 415);
  assert.equal((await call(feedbackApi, post('{not json'))).status, 400);
  assert.equal((await call(feedbackApi, post('x'.repeat(20000)))).status, 413);

  const invalid = await call(feedbackApi, post({ ...good(), token: 'ok', evil: 1 }));
  assert.equal(invalid.status, 400);
  assert.ok((await invalid.json()).errors.includes('evil: unknown field'));

  assert.equal((await call(feedbackApi, post({ ...good(), token: 'wrong' }, { ip: '198.51.100.2' }))).status, 403);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM feedback').first()).n, 0);

  for (let i = 0; i < 5; i++) assert.equal((await call(feedbackApi, post({ ...good(), token: 'ok' }, { ip: '192.0.2.1' }))).status, 200);
  const flood = await call(feedbackApi, post({ ...good(), token: 'ok' }, { ip: '192.0.2.1' }));
  assert.equal(flood.status, 429);
  assert.equal(flood.headers.get('Retry-After'), '3600');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM feedback').first()).n, 5);
});

test('POST /api/feedback: honeypot looks like a success but stores nothing', async () => {
  const res = await call(feedbackApi, post({ ...good(), website: 'spam.example', token: 'ok' }));
  assert.equal(res.status, 200);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM feedback').first()).n, 0);
});

test('GET /api/config gives public settings only, never a secret', async () => {
  const res = await call(configApi, new Request('https://x/api/config'));
  const body = await res.json();
  assert.equal(body.turnstileSiteKey, 'site-key');
  const text = JSON.stringify(body);
  for (const secret of ['secret-key', 'correct horse battery staple', 'salt']) assert.ok(!text.includes(secret), secret);
});

const adminReq = (p, init = {}) => new Request('https://memebox.pages.dev' + p, { ...init, headers: { 'CF-Connecting-IP': '203.0.113.50', ...(init.headers || {}) } });
const loginForm = (key) => adminReq('/admin', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ key }).toString() });

test('admin: sign in with ADMIN_KEY, 8-hour HttpOnly cookie, dashboard, CSV, sign out; always noindex', async () => {
  await call(feedbackApi, post({ ...good(), message: '<script>alert(1)</script>', wants: 'Dark mode', token: 'ok' }));
  await call(feedbackApi, post({ ...good(), rating: 2, wants: 'dark mode ', token: 'ok' }, { ip: '198.51.100.3' }));
  await call(feedbackApi, post({ type: 'uninstall', reason: 'too-hard', token: 'ok' }, { ip: '198.51.100.4' }));

  const responses = [];
  const run = async (h, r) => { const res = await call(h, r); responses.push(res); return res; };

  const anon = await run(adminPage, adminReq('/admin'));
  assert.equal(anon.status, 200);
  assert.match(await anon.text(), /Admin key/);

  assert.equal((await run(adminPage, loginForm('wrong'))).status, 401);
  assert.equal((await run(adminCsv, adminReq('/admin/csv'))).status, 303); // not signed in

  const ok = await run(adminPage, loginForm('correct horse battery staple'));
  assert.equal(ok.status, 303);
  const cookie = ok.headers.get('Set-Cookie');
  assert.match(cookie, /^memebox_admin=\d{13}\.[0-9a-f]{64}; Path=\/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=28800$/);
  const session = cookie.split(';')[0];

  const dash = await run(adminPage, adminReq('/admin', { headers: { Cookie: session } }));
  const html = await dash.text();
  assert.match(html, /3 answers in total/);
  assert.match(html, /dark mode <b>×2<\/b>/); // top requests grouped, case-insensitive
  assert.ok(!html.includes('<script>alert(1)</script>'), 'messages are escaped');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));

  const csv = await run(adminCsv, adminReq('/admin/csv', { headers: { Cookie: session } }));
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('Content-Type'), /^text\/csv/);
  assert.match(csv.headers.get('Content-Disposition'), /attachment; filename="memebox-feedback-\d{4}-\d\d-\d\d\.csv"/);
  const lines = (await csv.text()).trim().split('\r\n');
  assert.equal(lines.length, 4);

  const out = await run(adminLogout, adminReq('/admin/logout', { method: 'POST' }));
  assert.match(out.headers.get('Set-Cookie'), /Max-Age=0/);

  for (const r of responses) assert.equal(r.headers.get('X-Robots-Tag'), 'noindex, nofollow');
});

test('admin: tampered or expired cookies are refused, and sign-in tries are limited', async () => {
  const expired = await makeSession('correct horse battery staple', Date.now() - SESSION_MS - 1000);
  const r1 = await call(adminPage, adminReq('/admin', { headers: { Cookie: `memebox_admin=${expired}` } }));
  assert.match(await r1.text(), /Admin key/);
  const forged = await makeSession('some other key');
  const r2 = await call(adminCsv, adminReq('/admin/csv', { headers: { Cookie: `memebox_admin=${forged}` } }));
  assert.equal(r2.status, 303);

  for (let i = 0; i < 10; i++) await call(adminPage, loginForm('guess' + i));
  const blocked = await call(adminPage, loginForm('correct horse battery staple'));
  assert.equal(blocked.status, 429);
});

test('admin without ADMIN_KEY configured is closed', async () => {
  const res = await call(adminPage, adminReq('/admin'), { DB: db });
  assert.equal(res.status, 503);
});
