// MemeBox site: products, license keys and UPI orders.
// Payment goes straight to your UPI ID. Nothing here talks to a bank: the admin approves an
// order after seeing the money arrive, and that creates (or tops up) a license key.

// Prices in rupees. Change them here and deploy again.
// `usd` is shown on the pricing page (card payment comes with the payment gateway). `proSeconds` / `maxSeconds`
// are the hours of use a time pass gives (see extension/lib/plan.js). `closed`: not sold any more (existing keys keep working).
// Characters bought one by one (kept for ever on the key). Free: cat and dog. Pro has the first group too; Pro Max has all.
export const CHARACTER_PRICES = Object.freeze({
  bunny: { inr: 29, usd: 0.99 }, panda: { inr: 29, usd: 0.99 }, owl: { inr: 29, usd: 0.99 }, fox: { inr: 29, usd: 0.99 },
  penguin: { inr: 39, usd: 1.49 }, lion: { inr: 39, usd: 1.49 }, monkey: { inr: 39, usd: 1.49 }, frog: { inr: 39, usd: 1.49 },
});
const pass = (name, inr, usd, proSeconds, maxSeconds) => Object.freeze({ name, inr, usd, pictureSlots: 0, unlimited: false, proSeconds, maxSeconds, addons: Object.freeze([]) });
const cap = (id) => id[0].toUpperCase() + id.slice(1);
const characterProducts = Object.fromEntries(Object.entries(CHARACTER_PRICES).map(([id, pr]) => [`char_${id}`,
  Object.freeze({ name: `Character: ${cap(id)} (yours for ever)`, inr: pr.inr, usd: pr.usd, pictureSlots: 0, unlimited: false, proSeconds: 0, maxSeconds: 0, addons: Object.freeze([`character:${id}`]) })]));

// Draft cosmetic catalog; closed until the owner selects prices and approves sales.
export const COSMETIC_DRAFTS = Object.freeze({
  filters: Object.freeze(['vintage','cool','noir','dream','sunset','neon','pixel','vhs','glam','sepia','peach','teal','soft','dusk','contrast']),
  outfits: Object.freeze(['hoodie','bow','glasses']),
  maxFilters: Object.freeze(['cyber','comic','matrix','night','film','wave','heat','snow','prism','startrail']),
  maxOutfits: Object.freeze(['astronaut','wizard','superhero']),
});
const cosmeticDrafts = Object.fromEntries(['filter','outfit'].flatMap(type => COSMETIC_DRAFTS[type + 's'].map(id => [type+'_'+id, Object.freeze({ name: `${cap(type)}: ${cap(id)} (yours for ever)`, inr: type === 'filter' ? 19 : 29, usd: .99, pictureSlots: 0, unlimited: false, proSeconds: 0, maxSeconds: 0, addons: Object.freeze([type+':'+id]), closed: true })])));

export const PRODUCTS = Object.freeze({
  pass_pro_30: pass('Pro pass: 30 minutes', 9, 1.49, 1800, 0),
  pass_pro_60: pass('Pro pass: 1 hour', 15, 2.49, 3600, 0),
  pass_pro_120: pass('Pro pass: 2 hours', 25, 3.99, 7200, 0),
  pass_max_60: pass('Pro Max pass: 1 hour', 25, 3.49, 0, 3600),
  pass_max_180: pass('Pro Max pass: 3 hours', 49, 6.49, 0, 10800),
  pass_pro_300: pass('Pro pass: 5 hours', 49, 7.99, 18000, 0),
  pass_max_480: pass('Pro Max pass: 8 hours', 99, 14.99, 0, 28800),
  ...characterProducts,
  ...cosmeticDrafts,
  chars_eight: Object.freeze({ name: 'All 8 purchasable characters (yours for ever)', inr: 199, usd: 4.99, pictureSlots: 0, unlimited: false, proSeconds: 0, maxSeconds: 0, addons: Object.freeze(Object.keys(CHARACTER_PRICES).map((id) => `character:${id}`)) }),
  // Retain closed products so previously created orders can be fulfilled correctly.
  char_unicorn: Object.freeze({ name: 'Character: Unicorn (legacy purchase)', inr: 49, usd: 1.99, pictureSlots: 0, unlimited: false, proSeconds: 0, maxSeconds: 0, addons: Object.freeze(['character:unicorn']), closed: true }),
  char_robot: Object.freeze({ name: 'Character: Robot (legacy purchase)', inr: 49, usd: 1.99, pictureSlots: 0, unlimited: false, proSeconds: 0, maxSeconds: 0, addons: Object.freeze(['character:robot']), closed: true }),
  chars_all: Object.freeze({ name: 'All 10 extra characters (legacy purchase)', inr: 249, usd: 5.99, pictureSlots: 0, unlimited: false, proSeconds: 0, maxSeconds: 0, addons: Object.freeze([...Object.keys(CHARACTER_PRICES), 'unicorn', 'robot'].map((id) => `character:${id}`)), closed: true }),
  pictures5: Object.freeze({ name: '5 more picture memes', inr: 29, pictureSlots: 5, unlimited: false, proSeconds: 0, maxSeconds: 0, addons: Object.freeze([]), closed: true }),
  pro: Object.freeze({ name: 'MemeBox Pro (lifetime): everything unlimited', inr: 99, pictureSlots: 0, unlimited: true, proSeconds: 0, maxSeconds: 0, addons: Object.freeze([]), closed: true }),
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

// Things bought one by one (a character): a list of ids on the key, kept for ever. [{ id, until }] with until 0 = for ever.
export function parseAddons(text) {
  try {
    const a = JSON.parse(text || '[]');
    return Array.isArray(a) ? a.filter((x) => typeof x === 'string' && /^[a-z]+:[a-z0-9-]{1,30}$/.test(x)).slice(0, 80).map((id) => ({ id, until: 0 })) : [];
  } catch { return []; }
}
const addonText = (ids) => JSON.stringify([...new Set(ids)].slice(0, 80));

export function licenseView(row) {
  return {
    key: row.key,
    status: row.status,
    unlimited: row.unlimited === 1,
    pictureSlots: Number(row.picture_slots) || 0,
    proSeconds: Number(row.pro_seconds) || 0,
    maxSeconds: Number(row.max_seconds) || 0,
    addons: parseAddons(row.addons),
  };
}

export async function getLicense(db, key) {
  if (!LICENSE_RE.test(key)) return null;
  return db.prepare('SELECT * FROM licenses WHERE key = ?').bind(key).first();
}

const PASS_CAP = 10 * 24 * 3600; // most seconds of pass a key may hold
const passSecs = (n) => Math.max(0, Math.min(PASS_CAP, Math.floor(Number(n)) || 0));

export async function createLicense(db, { kind = 'gift', unlimited = false, pictureSlots = 0, proSeconds = 0, maxSeconds = 0, note = '', addons = [] } = {}) {
  const key = newLicenseKey();
  await db.prepare(
    'INSERT INTO licenses (key, created_at, kind, unlimited, picture_slots, pro_seconds, max_seconds, status, note, addons) VALUES (?, ?, ?, ?, ?, ?, ?, \'active\', ?, ?)',
  ).bind(key, now(), kind, unlimited ? 1 : 0, Math.max(0, Math.min(10000, Math.floor(pictureSlots) || 0)), passSecs(proSeconds), passSecs(maxSeconds), String(note).slice(0, 200), addonText(addons)).run();
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
  // SQL reads the current balance, even if another device spent time after the caller's read.
  await db.prepare("UPDATE licenses SET pro_seconds = MAX(0, pro_seconds - MAX(0, ? - max_seconds)), max_seconds = MAX(0, max_seconds - ?) WHERE key = ? AND status = 'active'")
    .bind(s, s, row.key).run();
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
  if (!p) return null;
  const existing = order.for_key ? await getLicense(db, order.for_key) : null;
  const key = existing?.status === 'active' ? existing.key : newLicenseKey();
  const marker = crypto.randomUUID(), at = now();
  const guard = "EXISTS (SELECT 1 FROM orders WHERE id = ? AND decided_at = ? AND status = 'approved')";
  const steps = [db.prepare("UPDATE orders SET status = 'approved', license_key = ?, decided_at = ? WHERE id = ? AND status = 'waiting'").bind(key, marker, id)];
  if (existing && existing.status === 'active') {
    steps.push(db.prepare(`UPDATE licenses SET picture_slots = MIN(10000, picture_slots + ?), unlimited = MAX(unlimited, ?),
      pro_seconds = MIN(864000, pro_seconds + ?), max_seconds = MIN(864000, max_seconds + ?),
      addons = (SELECT json_group_array(value) FROM (SELECT value FROM json_each(licenses.addons) UNION SELECT value FROM json_each(?)))
      WHERE key = ? AND status = 'active' AND ${guard}`)
      .bind(p.pictureSlots, p.unlimited ? 1 : 0, p.proSeconds, p.maxSeconds, JSON.stringify(p.addons), key, id, marker));
  } else {
    steps.push(db.prepare(`INSERT INTO licenses (key, created_at, kind, unlimited, picture_slots, pro_seconds, max_seconds, status, note, addons)
      SELECT ?, ?, 'paid', ?, ?, ?, ?, 'active', ?, ? WHERE ${guard}`)
      .bind(key, at, p.unlimited ? 1 : 0, p.pictureSlots, p.proSeconds, p.maxSeconds, `order ${id}`, JSON.stringify(p.addons), id, marker));
  }
  steps.push(db.prepare("UPDATE orders SET status = 'waiting', license_key = '', decided_at = NULL WHERE id = ? AND decided_at = ? AND NOT EXISTS (SELECT 1 FROM licenses WHERE key = ? AND status = 'active')").bind(id, marker, key));
  steps.push(db.prepare('UPDATE orders SET decided_at = ? WHERE id = ? AND decided_at = ?').bind(at, id, marker));
  await db.batch(steps);
  const fresh = await getOrder(db, id);
  return fresh.status === 'approved' ? fresh.license_key : null;
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
