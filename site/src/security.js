// MemeBox site: hashing, rate limiting, Turnstile and the admin session.
// Uses only Web Crypto, so the same code runs on Cloudflare and in Node tests.

const enc = new TextEncoder();

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(s) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function hmacHex(secret, s) {
  return hex(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(s)));
}

// Compares two strings in time that doesn't depend on where they differ.
export function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
  return diff === 0;
}

export const currentHour = (now = Date.now()) => Math.floor(now / 3600000);

// The caller's IP from Cloudflare. It is only ever hashed, never stored.
export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0].trim() || 'unknown';
}

// Counts one hit for (bucket, IP) in this hour and says whether it's allowed.
// Rows from earlier hours are deleted first, so nothing is kept past the hour.
export async function rateLimit(db, { salt, ip, bucket = 'feedback', max = 5, now = Date.now() }) {
  const hour = currentHour(now);
  const key = await sha256Hex(`${salt}|${hour}|${bucket}|${ip}`);
  await db.prepare('DELETE FROM rate_limits WHERE hour < ?').bind(hour).run();
  const row = await db.prepare(
    'INSERT INTO rate_limits (key, hour, count) VALUES (?, ?, 1) ' +
    'ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count',
  ).bind(key, hour).first();
  const count = row ? Number(row.count) : 1;
  return { allowed: count <= max, count };
}

export const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Checks a Turnstile token with Cloudflare. The IP is not sent (it's optional).
export async function verifyTurnstile(secret, token) {
  if (!secret || !token) return false;
  try {
    const res = await fetch(TURNSTILE_VERIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
    });
    const data = await res.json();
    return data && data.success === true;
  } catch {
    return false;
  }
}

// ---------- admin session: "<expires ms>.<hmac>" in an HttpOnly cookie ----------

export const SESSION_COOKIE = 'memebox_admin';
export const SESSION_MS = 8 * 3600 * 1000;

export async function makeSession(adminKey, now = Date.now()) {
  const exp = String(now + SESSION_MS);
  return `${exp}.${await hmacHex(adminKey, 'admin-session|' + exp)}`;
}

export async function checkSession(adminKey, value, now = Date.now()) {
  if (!adminKey || typeof value !== 'string') return false;
  const m = /^(\d{13})\.([0-9a-f]{64})$/.exec(value);
  if (!m) return false;
  if (Number(m[1]) <= now) return false;
  return safeEqual(m[2], await hmacHex(adminKey, 'admin-session|' + m[1]));
}

export function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1);
  }
  return null;
}

export function sessionCookie(value, maxAgeSeconds) {
  return `${SESSION_COOKIE}=${value}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
}

export async function isAdmin(request, env) {
  return checkSession(env.ADMIN_KEY, readCookie(request, SESSION_COOKIE));
}
