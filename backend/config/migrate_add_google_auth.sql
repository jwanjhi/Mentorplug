-- Migration: Add Google OAuth columns and make passwordHash nullable
-- File: backend/config/migrate_add_google_auth.sql

-- ============================================================================
-- UP MIGRATION
-- ============================================================================
BEGIN;

-- 1. Add googleId column for storing verified Google subject ID
ALTER TABLE account ADD COLUMN IF NOT EXISTS "googleId" VARCHAR(255) UNIQUE;

-- 2. Add authProvider column ('local' for email/password, 'google' for OAuth)
ALTER TABLE account ADD COLUMN IF NOT EXISTS "authProvider" VARCHAR(50) DEFAULT 'local';

-- 3. Make passwordHash nullable to accommodate OAuth accounts that do not have passwords
ALTER TABLE account ALTER COLUMN "passwordHash" DROP NOT NULL;

COMMIT;

-- ============================================================================
-- DOWN MIGRATION (ROLLBACK INSTRUCTIONS)
-- Run below queries to revert:
-- ============================================================================
-- BEGIN;
-- -- Note: Before re-adding NOT NULL, ensure all rows have a non-null passwordHash
-- UPDATE account SET "passwordHash" = 'OAUTH_ACCOUNT_NO_PASSWORD' WHERE "passwordHash" IS NULL;
-- ALTER TABLE account ALTER COLUMN "passwordHash" SET NOT NULL;
-- ALTER TABLE account DROP COLUMN IF EXISTS "authProvider";
-- ALTER TABLE account DROP COLUMN IF EXISTS "googleId";
-- COMMIT;
