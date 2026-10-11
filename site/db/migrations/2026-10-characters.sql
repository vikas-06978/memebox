-- Run once before deploying the character shop:
--   npx wrangler d1 execute memebox-feedback --remote --file=db/migrations/2026-10-characters.sql
ALTER TABLE licenses ADD COLUMN addons TEXT NOT NULL DEFAULT '[]';
