-- Run once before deploying the packs pages:
--   npx wrangler d1 execute memebox-feedback --remote --file=db/migrations/2026-10-packs.sql

-- Packs: music and memes you upload at /admin/packs. Audio files live in the R2 bucket (binding PACKS), the rest here.
-- Nothing is shown to users until a pack AND its item are "live", and an item can only go live once it is marked as cleared
-- (you own it or have written permission to share it) and has a licence line.
CREATE TABLE IF NOT EXISTS packs (
  id          TEXT PRIMARY KEY,                   -- a short name made of a-z, 0-9 and -
  title       TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('music', 'memes')),
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
  kind        TEXT NOT NULL CHECK (kind IN ('audio', 'line')),   -- an audio file, or a text meme the voice engine speaks
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
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pack_items_pack ON pack_items (pack_id, sort);
