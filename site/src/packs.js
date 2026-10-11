// MemeBox site: music and meme packs (what the admin uploads at /admin/packs, and what the extension later downloads).
// Audio files live in an R2 bucket (binding PACKS); everything else is in D1 (tables packs and pack_items).
import { cleanKey, getLicense, LICENSE_RE } from './shop.js';

export const KINDS = ['music', 'memes', 'pictures'];
export const TIERS = ['free', 'pro', 'max'];
export const REGIONS = { common: 'Common (everyone)', in: 'India', global: 'Global / English' };
export const LICENCES = {
  own: 'Own work',
  cc0: 'CC0 / public domain',
  licensed: 'Licensed to me in writing (say by whom)',
  ccby: 'CC BY (credit required)',
  free: 'Copyright-free / royalty-free (paste the link that says so in Source)',
  other: 'Other (explain)',
};
export const LANGS = { '': 'Any language', en: 'English', hi: 'Hindi', hinglish: 'Hinglish' };
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
// How much the packs may hold in total (MB). Cloudflare's free R2 storage is 10 GB: stay well under it. PACKS_MAX_MB in Cloudflare changes it.
export const DEFAULT_STORAGE_MB = 5000;
export const storageLimitBytes = (env) => (Number(env && env.PACKS_MAX_MB) > 0 ? Number(env.PACKS_MAX_MB) : DEFAULT_STORAGE_MB) * 1048576;
export async function storageUsed(db) {
  const row = await db.prepare('SELECT COALESCE(SUM(bytes), 0) AS n FROM pack_items').first();
  return Number(row && row.n) || 0;
}
const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp' };
const IMAGE_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
// The plan of one item: its own (free / pro / max) if you set one, else the pack's.
export const itemTier = (item, pack) => (TIERS.includes(item.tier) ? item.tier : pack.tier);
export const cleanItemTier = (t) => (TIERS.includes(t) ? t : '');
const AUDIO_TYPES = {
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/opus': 'opus',
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/webm': 'webm', 'audio/flac': 'flac', 'audio/x-flac': 'flac',
};
const EXT_TYPES = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', webm: 'audio/webm', flac: 'audio/flac' };

const now = () => new Date().toISOString();
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
export const PACK_ID_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;
export const ITEM_ID_RE = /^i-[a-z0-9]{10}$/;

export function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

export function newItemId() {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789', b = crypto.getRandomValues(new Uint8Array(10));
  return 'i-' + Array.from(b, (x) => a[x % a.length]).join('');
}

export const cleanRegion = (r) => (Object.hasOwn(REGIONS, r) ? r : /^[a-z]{2,10}$/.test(String(r)) ? String(r) : 'common');
const cleanLang = (l) => (Object.hasOwn(LANGS, l) ? l : '');

// An item may go live only when it is cleared (you may share it) and says under which licence.
export const canPublish = (item) => Number(item.cleared) === 1 && clip(item.licence, 300).length > 0 && !/not cleared/i.test(item.licence);

export function licenceText(kind, note) {
  if (!Object.hasOwn(LICENCES, kind)) return clip(note, 300);
  const label = kind === 'free' ? 'Copyright-free' : kind === 'licensed' ? 'Licensed' : kind === 'ccby' ? 'CC BY' : kind === 'cc0' ? 'CC0' : kind === 'own' ? 'Own work' : 'Other';
  return clip(note ? `${label}: ${note}` : label, 300);
}

// ---------- packs ----------

export async function listPacks(db) {
  return (await db.prepare(
    `SELECT p.*, COUNT(i.id) AS items, COALESCE(SUM(CASE WHEN i.status = 'live' THEN 1 ELSE 0 END), 0) AS live_items, COALESCE(SUM(i.bytes), 0) AS bytes
       FROM packs p LEFT JOIN pack_items i ON i.pack_id = p.id GROUP BY p.id ORDER BY p.sort, p.title`,
  ).all()).results;
}

export async function getPack(db, id) {
  return PACK_ID_RE.test(id) ? db.prepare('SELECT * FROM packs WHERE id = ?').bind(id).first() : null;
}

export async function createPack(db, { title, kind, region, tier, description }) {
  const t = clip(title, 80);
  if (!t) throw new Error('Give the pack a name.');
  let id = slugify(t);
  if (!PACK_ID_RE.test(id)) throw new Error('The name needs a few letters or digits.');
  if (await getPack(db, id)) id = `${id}-${Math.random().toString(36).slice(2, 5)}`.slice(0, 41);
  const ts = now();
  await db.prepare('INSERT INTO packs (id, title, kind, region, tier, description, status, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, \'draft\', 100, ?, ?)')
    .bind(id, t, KINDS.includes(kind) ? kind : 'music', cleanRegion(region), TIERS.includes(tier) ? tier : 'free', clip(description, 400), ts, ts).run();
  return id;
}

export async function updatePack(db, id, { title, region, tier, description, status, sort }) {
  const t = clip(title, 80);
  if (!t) throw new Error('The pack needs a name.');
  await db.prepare('UPDATE packs SET title = ?, region = ?, tier = ?, description = ?, status = ?, sort = ?, updated_at = ? WHERE id = ?')
    .bind(t, cleanRegion(region), TIERS.includes(tier) ? tier : 'free', clip(description, 400), status === 'live' ? 'live' : 'draft', Math.max(0, Math.min(9999, Math.floor(Number(sort)) || 100)), now(), id).run();
}

export async function deletePack(db, bucket, id) {
  const items = (await db.prepare('SELECT file_key FROM pack_items WHERE pack_id = ?').bind(id).all()).results;
  const keys = items.map((i) => i.file_key).filter(Boolean);
  if (bucket && keys.length) await bucket.delete(keys);
  await db.prepare('DELETE FROM pack_items WHERE pack_id = ?').bind(id).run();
  await db.prepare('DELETE FROM packs WHERE id = ?').bind(id).run();
}

// ---------- items ----------

export async function listItems(db, packId) {
  return (await db.prepare('SELECT * FROM pack_items WHERE pack_id = ? ORDER BY sort, created_at, title').bind(packId).all()).results;
}

export async function getItem(db, id) {
  return ITEM_ID_RE.test(id) ? db.prepare('SELECT * FROM pack_items WHERE id = ?').bind(id).first() : null;
}

function audioType(file) {
  const t = String(file.type || '').toLowerCase().split(';')[0];
  if (AUDIO_TYPES[t]) return { mime: t === 'audio/mp3' ? 'audio/mpeg' : t, ext: AUDIO_TYPES[t] };
  const ext = (/\.([a-z0-9]{2,5})$/i.exec(file.name || '') || [])[1];
  return ext && EXT_TYPES[ext.toLowerCase()] ? { mime: EXT_TYPES[ext.toLowerCase()], ext: ext.toLowerCase() } : null;
}

const titleFromName = (name) => clip(String(name || 'Untitled').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' '), 80) || 'Untitled';

// "Copyright-free" needs proof: the link where it says so (a licence page, the artist's page...). Without it the item stays a draft.
const needsSource = (meta) => meta.licenceKind === 'free' && !clip(meta.source, 200);

// Upload audio files (or, for a pictures pack, images) into a pack. Each becomes an item; it goes live right away only if "cleared" is ticked
// and there is a licence line. Returns { added, skipped: [reason...] }.
export async function addAudio(db, bucket, packId, files, meta = {}, limitBytes = Infinity) {
  let used = await storageUsed(db);
  const pack = await getPack(db, packId);
  const pictures = !!pack && pack.kind === 'pictures';
  const out = { added: 0, skipped: [] };
  const licence = licenceText(meta.licenceKind, meta.licenceNote);
  const cleared = meta.cleared ? 1 : 0;
  for (const file of files) {
    if (!file || typeof file.arrayBuffer !== 'function' || !file.size) continue;
    let type, max;
    if (pictures) {
      const t = String(file.type || '').toLowerCase().split(';')[0];
      const ext = (/\.([a-z0-9]{2,5})$/i.exec(file.name || '') || [])[1];
      type = IMAGE_TYPES[t] ? { mime: t === 'image/jpg' ? 'image/jpeg' : t, ext: IMAGE_TYPES[t] } : ext && IMAGE_EXT[ext.toLowerCase()] ? { mime: IMAGE_EXT[ext.toLowerCase()], ext: ext.toLowerCase() === 'jpeg' ? 'jpg' : ext.toLowerCase() } : null;
      max = MAX_IMAGE_BYTES;
      if (!type) { out.skipped.push(`${file.name}: not a picture (png, jpg, webp)`); continue; }
    } else {
      type = audioType(file); max = MAX_AUDIO_BYTES;
      if (!type) { out.skipped.push(`${file.name}: not an audio file (mp3, m4a, ogg, opus, wav, webm, flac, aac)`); continue; }
    }
    if (file.size > max) { out.skipped.push(`${file.name}: over ${Math.round(max / 1048576)} MB`); continue; }
    if (used + file.size > limitBytes) { out.skipped.push(`${file.name}: the storage budget (${Math.round(limitBytes / 1048576)} MB) is full`); continue; }
    used += file.size;
    const id = newItemId(), key = `packs/${packId}/${id}.${type.ext}`;
    await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: type.mime } });
    const item = { cleared: needsSource(meta) ? 0 : cleared, licence };
    await db.prepare(
      'INSERT INTO pack_items (id, pack_id, title, kind, file_key, mime, bytes, lang, tags, explicit, licence, source, credit, cleared, status, sort, created_at, tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100, ?, ?)',
    ).bind(id, packId, titleFromName(file.name), pictures ? 'image' : 'audio', key, type.mime, file.size, cleanLang(meta.lang), clip(meta.tags, 120), meta.explicit ? 1 : 0, licence, clip(meta.source, 200), clip(meta.credit, 120), cleared, canPublish(item) ? 'live' : 'draft', now(), cleanItemTier(meta.tier)).run();
    out.added++;
  }
  return out;
}

// Text memes, one per line:  text | lang | strong   (lang and "strong" are optional; "strong" marks strong language)
export async function addLines(db, packId, text, meta = {}) {
  const licence = licenceText(meta.licenceKind, meta.licenceNote), cleared = meta.cleared ? 1 : 0;
  let added = 0;
  for (const raw of String(text || '').split(/\r?\n/).slice(0, 300)) {
    const [line, lang, flag] = raw.split('|').map((x) => x.trim());
    if (!line) continue;
    const explicit = /^(strong|explicit|18|y|yes|1)$/i.test(flag || '') ? 1 : meta.explicit ? 1 : 0;
    const item = { cleared: needsSource(meta) ? 0 : cleared, licence };
    await db.prepare(
      'INSERT INTO pack_items (id, pack_id, title, kind, text, lang, tags, explicit, licence, source, credit, cleared, status, sort, created_at, tier) VALUES (?, ?, ?, \'line\', ?, ?, ?, ?, ?, ?, ?, ?, ?, 100, ?, ?)',
    ).bind(newItemId(), packId, clip(line, 80), clip(line, 200), cleanLang(lang !== undefined && lang !== '' ? lang : meta.lang), clip(meta.tags, 120), explicit, licence, clip(meta.source, 200), clip(meta.credit, 120), cleared, canPublish(item) ? 'live' : 'draft', now(), cleanItemTier(meta.tier)).run();
    added++;
  }
  return added;
}

// Save an item. Returns { status, note }: "live" is refused (kept as a draft) unless it is cleared and has a licence.
export async function updateItem(db, id, f) {
  const item = await getItem(db, id);
  if (!item) throw new Error('Unknown item.');
  const next = { cleared: f.cleared ? 1 : 0, licence: clip(f.licence, 300) };
  let status = f.status === 'live' ? 'live' : 'draft', note = '';
  if (status === 'live' && !canPublish(next)) { status = 'draft'; note = 'Kept as a draft: tick "I may share this" and write the licence first.'; }
  await db.prepare('UPDATE pack_items SET title = ?, text = ?, lang = ?, tags = ?, explicit = ?, licence = ?, source = ?, credit = ?, cleared = ?, status = ?, sort = ?, tier = ? WHERE id = ?')
    .bind(clip(f.title, 80) || item.title, item.kind === 'line' ? clip(f.text, 200) || item.text : item.text, cleanLang(f.lang), clip(f.tags, 120), f.explicit ? 1 : 0, next.licence, clip(f.source, 200), clip(f.credit, 120), next.cleared, status, Math.max(0, Math.min(9999, Math.floor(Number(f.sort)) || 100)), cleanItemTier(f.tier), id).run();
  return { status, note };
}

// Set the plan of several items at once ('' = follow the pack). Only items of this pack are touched.
export async function setItemsTier(db, packId, ids, tier) {
  let n = 0;
  for (const id of ids.slice(0, 500)) {
    if (!ITEM_ID_RE.test(id)) continue;
    const r = await db.prepare('UPDATE pack_items SET tier = ? WHERE id = ? AND pack_id = ?').bind(cleanItemTier(tier), id, packId).run();
    n += Number(r.meta && r.meta.changes) || 0;
  }
  return n;
}

export async function deleteItem(db, bucket, id) {
  const item = await getItem(db, id);
  if (!item) return;
  if (item.file_key && bucket) await bucket.delete(item.file_key);
  await db.prepare('DELETE FROM pack_items WHERE id = ?').bind(id).run();
}

// ---------- what users get ----------

// Live packs with their live items (no file addresses: the extension asks /api/pack-file for each file).
export async function publicCatalog(db) {
  const packs = (await db.prepare("SELECT * FROM packs WHERE status = 'live' ORDER BY sort, title").all()).results;
  const items = (await db.prepare("SELECT i.* FROM pack_items i JOIN packs p ON p.id = i.pack_id WHERE p.status = 'live' AND i.status = 'live' ORDER BY i.sort, i.created_at, i.title").all()).results;
  return packs.map((p) => {
    const mine = items.filter((i) => i.pack_id === p.id);
    return {
      id: p.id, title: p.title, kind: p.kind, region: p.region, tier: p.tier, description: p.description,
      bytes: mine.reduce((a, i) => a + Number(i.bytes || 0), 0),
      items: mine.map((i) => ({
        id: i.id, title: i.title, kind: i.kind, mime: i.mime, bytes: Number(i.bytes) || 0, text: i.text, lang: i.lang, tags: i.tags, tier: itemTier(i, p),
        explicit: Number(i.explicit) === 1, credit: i.credit, licence: i.licence,
      })),
    };
  }).filter((p) => p.items.length);
}

// May this key use a pack of this tier? Free is open to everyone; Pro needs Pro time or the unlimited key; Pro Max needs Pro Max time (or unlimited).
export function tierAllows(tier, license) {
  if (tier === 'free') return true;
  if (!license || license.status !== 'active') return false;
  const unlimited = Number(license.unlimited) === 1, max = Number(license.max_seconds) > 0, pro = Number(license.pro_seconds) > 0;
  return tier === 'pro' ? unlimited || max || pro : unlimited || max;
}

export { cleanKey, getLicense, LICENSE_RE };
