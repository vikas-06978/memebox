-- Run ONCE on the existing database, before deploying the site that uses these columns:
--   npx wrangler d1 execute memebox-feedback --remote --file=db/migrations/2026-10-platform-device.sql
-- (Fresh databases already get these columns from schema.sql. Running this twice fails harmlessly.)
ALTER TABLE feedback ADD COLUMN platform TEXT NOT NULL DEFAULT '';
ALTER TABLE feedback ADD COLUMN device TEXT NOT NULL DEFAULT '';
