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
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  note          TEXT NOT NULL DEFAULT '',
  last_seen     TEXT                              -- day of the last check, no IP or device
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
