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
