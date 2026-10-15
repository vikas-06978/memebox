-- MemeBox feedback database (Cloudflare D1, name "memebox-feedback", bound as DB).
-- Apply with:  npx wrangler d1 execute memebox-feedback --remote --file=db/schema.sql

-- Feedback form answers and uninstall survey answers (type = 'feedback' or 'uninstall').
-- Only what the person typed or picked, plus the extension version, call site and page language.
-- No IP address, no user agent, no cookies.
CREATE TABLE IF NOT EXISTS feedback (
  id         TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,                 -- ISO 8601, UTC
  type       TEXT NOT NULL CHECK (type IN ('feedback', 'uninstall')),
  rating     INTEGER CHECK (rating BETWEEN 1 AND 4), -- 1 😞 2 😐 3 🙂 4 😍 (feedback only)
  used       TEXT NOT NULL DEFAULT '[]',    -- JSON array of feature ids
  wants      TEXT NOT NULL DEFAULT '',      -- "What should we add?"
  message    TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',      -- optional, only if the person typed it
  reason     TEXT NOT NULL DEFAULT '',      -- uninstall survey answer
  platform   TEXT NOT NULL DEFAULT '',      -- where they used it (picked from a list)
  device     TEXT NOT NULL DEFAULT '',      -- which device (picked from a list)
  version    TEXT NOT NULL DEFAULT '',
  site       TEXT NOT NULL DEFAULT '',
  lang       TEXT NOT NULL DEFAULT 'en'
);
CREATE INDEX IF NOT EXISTS feedback_created ON feedback (created_at);
CREATE INDEX IF NOT EXISTS feedback_type ON feedback (type, created_at);

-- Rate limiting: key = SHA-256(salt | hour | IP), so the IP itself is never stored.
-- Rows from earlier hours are deleted on every request.
CREATE TABLE IF NOT EXISTS rate_limits (
  key   TEXT PRIMARY KEY,
  hour  INTEGER NOT NULL,
  count INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_hour ON rate_limits (hour);

-- License keys (MBX-XXXX-XXXX-XXXX). Made by the admin (owner and gift keys) or when an
-- order is approved (paid keys). unlimited = full Pro. picture_slots = extra picture memes.
CREATE TABLE IF NOT EXISTS licenses (
  key           TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('owner', 'gift', 'paid')),
  unlimited     INTEGER NOT NULL DEFAULT 0,
  picture_slots INTEGER NOT NULL DEFAULT 0,
  pro_seconds   INTEGER NOT NULL DEFAULT 0,       -- time pass left: seconds of Pro use (no expiry date)
  max_seconds   INTEGER NOT NULL DEFAULT 0,       -- seconds of Pro Max use, spent first
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  note          TEXT NOT NULL DEFAULT '',
  last_seen     TEXT,                             -- day of the last check, no IP or device
  addons        TEXT NOT NULL DEFAULT '[]'        -- things bought one by one and kept for ever, e.g. ["character:bunny"]
);

-- UPI orders. The buyer pays by UPI, types the transaction ID (UTR), and the admin approves
-- it after checking the bank app. Unclaimed orders are deleted after 2 days.
CREATE TABLE IF NOT EXISTS orders (
  id          TEXT PRIMARY KEY,                   -- MB + 10 letters/digits, also in the UPI note
  created_at  TEXT NOT NULL,
  product     TEXT NOT NULL,
  amount_inr  INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'waiting', 'approved', 'rejected')),
  utr         TEXT UNIQUE,
  for_key     TEXT NOT NULL DEFAULT '',           -- existing key to add picture slots to
  license_key TEXT NOT NULL DEFAULT '',
  claimed_at  TEXT,
  decided_at  TEXT
);
CREATE INDEX IF NOT EXISTS orders_status ON orders (status, created_at);

-- Packs: music and memes you upload at /admin/packs. Audio files live in the R2 bucket (binding PACKS), the rest here.
-- Nothing is shown to users until a pack AND its item are "live", and an item can only go live once it is marked as cleared
-- (you own it or have written permission to share it) and has a licence line.
CREATE TABLE IF NOT EXISTS packs (
  id          TEXT PRIMARY KEY,                   -- a short name made of a-z, 0-9 and -
  title       TEXT NOT NULL,
  kind        TEXT NOT NULL,                      -- music | memes | pictures
  region      TEXT NOT NULL DEFAULT 'common',     -- common (everyone), in (India), global, or another short code
  tier        TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'max')),
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live')),
  sort        INTEGER NOT NULL DEFAULT 100,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pack_items (
  id          TEXT PRIMARY KEY,
  pack_id     TEXT NOT NULL,
  title       TEXT NOT NULL,
  kind        TEXT NOT NULL,                      -- audio (a sound file) | image (a meme picture) | line (a text meme the voice engine speaks)
  file_key    TEXT NOT NULL DEFAULT '',           -- the object in R2 (audio only)
  mime        TEXT NOT NULL DEFAULT '',
  bytes       INTEGER NOT NULL DEFAULT 0,
  text        TEXT NOT NULL DEFAULT '',           -- the line (text memes)
  lang        TEXT NOT NULL DEFAULT '',           -- en, hi, hinglish... or empty for any
  tags        TEXT NOT NULL DEFAULT '',
  explicit    INTEGER NOT NULL DEFAULT 0,         -- strong language: shown only to people who switch it on
  licence     TEXT NOT NULL DEFAULT '',           -- own work, CC0, licensed (who), CC BY...
  source      TEXT NOT NULL DEFAULT '',
  credit      TEXT NOT NULL DEFAULT '',
  cleared     INTEGER NOT NULL DEFAULT 0,         -- 1 = you own it or have written permission to share it
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live')),
  sort        INTEGER NOT NULL DEFAULT 100,
  downloads   INTEGER NOT NULL DEFAULT 0,         -- only a count, no information about who
  created_at  TEXT NOT NULL,
  tier        TEXT NOT NULL DEFAULT ''            -- '' = the pack's plan, else free | pro | max for this item only
);
CREATE INDEX IF NOT EXISTS pack_items_pack ON pack_items (pack_id, sort);
-- Apply only when the owner authorizes deployment. Separate from legacy UPI orders.
CREATE TABLE IF NOT EXISTS gateway_orders (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  product TEXT NOT NULL,
  currency TEXT NOT NULL CHECK(currency IN ('INR', 'USD')),
  amount INTEGER NOT NULL CHECK(amount > 0),
  snapshot TEXT NOT NULL,
  recovery_hash TEXT NOT NULL,
  gateway_id TEXT UNIQUE,
  payment_id TEXT UNIQUE,
  for_key TEXT NOT NULL DEFAULT '',
  license_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'fulfilled', 'refunded', 'review')),
  claim TEXT NOT NULL DEFAULT '',
  fulfilled_at TEXT,
  refunded_amount INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS gateway_orders_created ON gateway_orders(created_at);
CREATE TABLE IF NOT EXISTS gateway_refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount > 0),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pass_sessions (
  id TEXT PRIMARY KEY,
  license_key TEXT NOT NULL,
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  billed INTEGER NOT NULL DEFAULT 0,
  delta INTEGER NOT NULL DEFAULT 0,
  claim TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS pass_sessions_expiry ON pass_sessions(expires_at);

-- Optional, privacy-limited product counters. The extension sends these only after
-- the user opts in. No captions, filenames, meeting URLs, audio, video or contacts.
CREATE TABLE IF NOT EXISTS usage_daily (
  day TEXT NOT NULL,
  subject TEXT NOT NULL,
  license_key TEXT NOT NULL DEFAULT '',
  feature TEXT NOT NULL,
  item TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day, subject, feature, item)
);
CREATE INDEX IF NOT EXISTS usage_daily_feature ON usage_daily(day, feature, item);
CREATE INDEX IF NOT EXISTS usage_daily_license ON usage_daily(license_key, day);
