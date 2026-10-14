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
