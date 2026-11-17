-- MemeBox: how many people reach the buy page, how many start checkout, how many finish.
-- Run once:
--   npx wrangler d1 execute memebox-feedback --remote --file=db/migrations/2026-11-funnel.sql
--
-- Counts only. No IP address, no cookie, no visitor id, nothing that identifies a person:
-- one row per page per day with a number on it, which is all a funnel needs.
CREATE TABLE IF NOT EXISTS page_hits (
  day  TEXT    NOT NULL,              -- YYYY-MM-DD, UTC
  page TEXT    NOT NULL,              -- 'buy' for now
  n    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, page)
);
