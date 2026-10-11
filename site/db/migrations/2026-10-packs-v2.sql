-- Run once, AFTER 2026-10-packs.sql, before deploying the new packs pages:
--   npx wrangler d1 execute memebox-feedback --remote --file=db/migrations/2026-10-packs-v2.sql
--
-- Per-item plans (an item can be Free, Pro or Pro Max whatever its pack's plan is: you decide which tracks are the free ones) and
-- picture items (meme pictures). SQLite cannot change a CHECK, so both tables are rebuilt; nothing is lost.

CREATE TABLE packs_new (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  kind        TEXT NOT NULL,                      -- music | memes | pictures
  region      TEXT NOT NULL DEFAULT 'common',
  tier        TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'max')),
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live')),
  sort        INTEGER NOT NULL DEFAULT 100,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
INSERT INTO packs_new (id, title, kind, region, tier, description, status, sort, created_at, updated_at)
  SELECT id, title, kind, region, tier, description, status, sort, created_at, updated_at FROM packs;
DROP TABLE packs;
ALTER TABLE packs_new RENAME TO packs;

CREATE TABLE pack_items_new (
  id          TEXT PRIMARY KEY,
  pack_id     TEXT NOT NULL,
  title       TEXT NOT NULL,
  kind        TEXT NOT NULL,                      -- audio | image | line
  file_key    TEXT NOT NULL DEFAULT '',
  mime        TEXT NOT NULL DEFAULT '',
  bytes       INTEGER NOT NULL DEFAULT 0,
  text        TEXT NOT NULL DEFAULT '',
  lang        TEXT NOT NULL DEFAULT '',
  tags        TEXT NOT NULL DEFAULT '',
  explicit    INTEGER NOT NULL DEFAULT 0,
  licence     TEXT NOT NULL DEFAULT '',
  source      TEXT NOT NULL DEFAULT '',
  credit      TEXT NOT NULL DEFAULT '',
  cleared     INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live')),
  sort        INTEGER NOT NULL DEFAULT 100,
  downloads   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  tier        TEXT NOT NULL DEFAULT ''            -- '' = the pack's plan, else free | pro | max for this item only
);
INSERT INTO pack_items_new (id, pack_id, title, kind, file_key, mime, bytes, text, lang, tags, explicit, licence, source, credit, cleared, status, sort, downloads, created_at)
  SELECT id, pack_id, title, kind, file_key, mime, bytes, text, lang, tags, explicit, licence, source, credit, cleared, status, sort, downloads, created_at FROM pack_items;
DROP TABLE pack_items;
ALTER TABLE pack_items_new RENAME TO pack_items;
CREATE INDEX IF NOT EXISTS pack_items_pack ON pack_items (pack_id, sort);
