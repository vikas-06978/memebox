-- Run ONCE on the existing database, before deploying the site that uses these columns:
--   npx wrangler d1 execute memebox-feedback --remote --file=db/migrations/2026-10-time-pass.sql
-- (Fresh databases already get these columns from schema.sql. Running this twice fails harmlessly.)
ALTER TABLE licenses ADD COLUMN pro_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE licenses ADD COLUMN max_seconds INTEGER NOT NULL DEFAULT 0;
