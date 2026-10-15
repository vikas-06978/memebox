-- Optional aggregate product analytics. Never stores call content, captions,
-- filenames, meeting URLs, audio/video, contacts or IP addresses.
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
