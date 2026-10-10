// MemeBox site: products, license keys and UPI orders.
// Payment goes straight to your UPI ID. Nothing here talks to a bank: the admin approves an
// order after seeing the money arrive, and that creates (or tops up) a license key.

// Prices in rupees. Change them here and deploy again.
// `usd` is shown on the pricing page (card payment comes with the payment gateway). `proSeconds` / `maxSeconds`
// are the hours of use a time pass gives (see extension/lib/plan.js). `closed`: not sold any more (existing keys keep working).
export const PRODUCTS = Object.freeze({
  pass_pro_30: Object.freeze({ name: 'Pro pass: 30 minutes', inr: 9, usd: 1.49, pictureSlots: 0, unlimited: false, proSeconds: 1800, maxSeconds: 0 }),
  pass_pro_60: Object.freeze({ name: 'Pro pass: 1 hour', inr: 15, usd: 2.49, pictureSlots: 0, unlimited: false, proSeconds: 3600, maxSeconds: 0 }),
  pass_pro_120: Object.freeze({ name: 'Pro pass: 2 hours', inr: 25, usd: 3.99, pictureSlots: 0, unlimited: false, proSeconds: 7200, maxSeconds: 0 }),
  pass_max_180: Object.freeze({ name: 'Pro Max pass: 3 hours', inr: 35, usd: 5.49, pictureSlots: 0, unlimited: false, proSeconds: 0, maxSeconds: 10800 }),
  pictures5: Object.freeze({ name: '5 more picture memes', inr: 29, pictureSlots: 5, unlimited: false, proSeconds: 0, maxSeconds: 0, closed: true }),
  pro: Object.freeze({ name: 'MemeBox Pro (lifetime): everything unlimited', inr: 99, pictureSlots: 0, unlimited: true, proSeconds: 0, maxSeconds: 0, closed: true }),
});
export const forSale = () => Object.entries(PRODUCTS).filter(([, p]) => !p.closed);

// No 0/O or 1/I, so keys are easy to read out and type. 32 symbols: unbiased from a byte.
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE = '[A-HJ-NP-Z2-9]';

export function randomCode(n) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map((b) => ALPHA[b % 32]).join('');
}

export const newLicenseKey = () => `MBX-${randomCode(4)}-${randomCode(4)}-${randomCode(4)}`;
export const newOrderId = () => 'MB' + randomCode(10);
export const LICENSE_RE = new RegExp(`^MBX-${CODE}{4}-${CODE}{4}-${CODE}{4}$`);
export const ORDER_RE = new RegExp(`^MB${CODE}{10}$`);
export const UTR_RE = /^\d{12}$/;
export const VPA_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/;

// Upper-case and without spaces, so "mbx-abcd efgh" typed by hand still matches.
export function cleanKey(s) {
  return String(s || '').toUpperCase().replace(/\s+/g, '').slice(0, 40);
}

// upi://pay link, read by every UPI app (and by the QR code). The payee address stays
// unescaped, because some apps don't decode %40.
export function upiLink({ upiId, payee, amount, orderId }) {
  if (!VPA_RE.test(upiId)) throw new Error('UPI_ID is not a valid UPI address');
  return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payee || 'MemeBox')}` +
    `&am=${Number(amount).toFixed(2)}&cu=INR&tn=${encodeURIComponent('MemeBox ' + orderId)}`;
}

const now = () => new Date().toISOString();

export function licenseView(row) {
  return {
    key: row.key,
    status: row.status,
    unlimited: row.unlimited === 1,
    pictureSlots: Number(row.picture_slots) || 0,
    proSeconds: Number(row.pro_seconds) || 0,
    maxSeconds: Number(row.max_seconds) || 0,
  };
}

export async function getLicense(db, key) {
  if (!LICENSE_RE.test(key)) return null;
  return db.prepare('SELECT * FROM licenses WHERE key = ?').bind(key).first();
}

const PASS_CAP = 10 * 24 * 3600; // most seconds of pass a key may hold
const passSecs = (n) => Math.max(0, Math.min(PASS_CAP, Math.floor(Number(n)) || 0));

export async function createLicense(db, { kind = 'gift', unlimited = false, pictureSlots = 0, proSeconds = 0, maxSeconds = 0, note = '' } = {}) {
  const key = newLicenseKey();
  await db.prepare(
    'INSERT INTO licenses (key, created_at, kind, unlimited, picture_slots, pro_seconds, max_seconds, status, note) VALUES (?, ?, ?, ?, ?, ?, ?, \'active\', ?)',
  ).bind(key, now(), kind, unlimited ? 1 : 0, Math.max(0, Math.min(10000, Math.floor(pictureSlots) || 0)), passSecs(proSeconds), passSecs(maxSeconds), String(note).slice(0, 200)).run();
  return key;
}

// Add bought time to a key (never above the cap).
export async function addPassTime(db, key, { proSeconds = 0, maxSeconds = 0 }) {
  await db.prepare('UPDATE licenses SET pro_seconds = MIN(?, pro_seconds + ?), max_seconds = MIN(?, max_seconds + ?) WHERE key = ?')
    .bind(PASS_CAP, passSecs(proSeconds), PASS_CAP, passSecs(maxSeconds), key).run();
}

// The extension reports seconds of pass it used (Pro Max is spent first). At most 10 minutes per report, so one
// call can never drain a key; the answer is the new balance.
export const MAX_SPEND_PER_CALL = 600;
export async function spendPassTime(db, row, seconds) {
  let s = Math.max(0, Math.min(MAX_SPEND_PER_CALL, Math.floor(Number(seconds)) || 0));
  if (!s) return row;
  const fromMax = Math.min(Number(row.max_seconds) || 0, s);
  s -= fromMax;
  const fromPro = Math.min(Number(row.pro_seconds) || 0, s);
  if (fromMax || fromPro) {
    await db.prepare('UPDATE licenses SET max_seconds = MAX(0, max_seconds - ?), pro_seconds = MAX(0, pro_seconds - ?) WHERE key = ?')
      .bind(fromMax, fromPro, row.key).run();
  }
  return getLicense(db, row.key);
}

export async function setLicenseStatus(db, key, status) {
  const r = await db.prepare('UPDATE licenses SET status = ? WHERE key = ?').bind(status, key).run();
  return r.meta.changes > 0;
}

export async function createOrder(db, { product, forKey = '' }) {
  const p = PRODUCTS[product];
  if (!p || p.closed) throw new Error('Unknown product');
  // Unclaimed orders don't need to live long.
  await db.prepare("DELETE FROM orders WHERE status = 'new' AND created_at < ?")
    .bind(new Date(Date.now() - 2 * 86400000).toISOString()).run();
  const id = newOrderId();
  await db.prepare('INSERT INTO orders (id, created_at, product, amount_inr, status, for_key) VALUES (?, ?, ?, ?, \'new\', ?)')
    .bind(id, now(), product, p.inr, forKey).run();
  return { id, product: p, amount: p.inr };
}

export async function getOrder(db, id) {
  if (!ORDER_RE.test(id)) return null;
  return db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
}

// The buyer says they paid and gives the UPI transaction ID. Returns an error text or ''.
export async function claimOrder(db, id, utr) {
  const order = await getOrder(db, id);
  if (!order) return 'Order not found.';
  if (order.status === 'approved' || order.status === 'rejected') return 'This order is already closed.';
  const used = await db.prepare('SELECT id FROM orders WHERE utr = ? AND id <> ?').bind(utr, id).first();
  if (used) return 'This transaction ID was already used for another order.';
  await db.prepare("UPDATE orders SET status = 'waiting', utr = ?, claimed_at = ? WHERE id = ?").bind(utr, now(), id).run();
  return '';
}

// Admin approved: top up the buyer's key (picture slots) or make a new paid key.
export async function approveOrder(db, id) {
  const order = await getOrder(db, id);
  if (!order || order.status !== 'waiting') return null;
  const p = PRODUCTS[order.product];
  let key = '';
  const existing = order.for_key ? await getLicense(db, order.for_key) : null;
  if (existing && existing.status === 'active') {
    await db.prepare('UPDATE licenses SET picture_slots = picture_slots + ?, unlimited = MAX(unlimited, ?) WHERE key = ?')
      .bind(p.pictureSlots, p.unlimited ? 1 : 0, existing.key).run();
    if (p.proSeconds || p.maxSeconds) await addPassTime(db, existing.key, { proSeconds: p.proSeconds, maxSeconds: p.maxSeconds });
    key = existing.key;
  } else {
    key = await createLicense(db, { kind: 'paid', unlimited: p.unlimited, pictureSlots: p.pictureSlots, proSeconds: p.proSeconds, maxSeconds: p.maxSeconds, note: `order ${order.id}` });
  }
  await db.prepare("UPDATE orders SET status = 'approved', license_key = ?, decided_at = ? WHERE id = ?").bind(key, now(), id).run();
  return key;
}

export async function rejectOrder(db, id) {
  const r = await db.prepare("UPDATE orders SET status = 'rejected', decided_at = ? WHERE id = ? AND status IN ('new', 'waiting')")
    .bind(now(), id).run();
  return r.meta.changes > 0;
}

export async function loadShop(db) {
  const waiting = (await db.prepare("SELECT * FROM orders WHERE status = 'waiting' ORDER BY claimed_at").all()).results;
  const recent = (await db.prepare("SELECT * FROM orders WHERE status IN ('approved', 'rejected') ORDER BY decided_at DESC LIMIT 20").all()).results;
  const licenses = (await db.prepare('SELECT * FROM licenses ORDER BY created_at DESC LIMIT 100').all()).results;
  const earned = await db.prepare("SELECT COALESCE(SUM(amount_inr), 0) AS inr, COUNT(*) AS n FROM orders WHERE status = 'approved'").first();
  const week = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const count = async (where, ...args) => Number((await db.prepare(`SELECT COUNT(*) AS n FROM licenses WHERE ${where}`).bind(...args).first()).n);
  return {
    waiting, recent, licenses, earnedInr: Number(earned.inr), paidOrders: Number(earned.n),
    proPaid: await count("kind = 'paid' AND unlimited = 1 AND status = 'active'"),
    proGift: await count("kind <> 'paid' AND unlimited = 1 AND status = 'active'"),
    proActive: await count("unlimited = 1 AND status = 'active' AND last_seen >= ?", week),
    pictureBuyers: await count("kind = 'paid' AND unlimited = 0 AND status = 'active'"),
  };
}
