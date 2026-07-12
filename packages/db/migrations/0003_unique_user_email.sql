-- =====================================================================
-- Migration 0003 — users.email UNIQUE
-- ----------------------------------------------------------------------------
-- The original users table declared email as CITEXT NOT NULL but did NOT
-- add a UNIQUE constraint, so two users could share the same email
-- (the seed data avoided this only by using explicit IDs). Email is
-- the login identifier and MUST be unique; an UPSERT on email also
-- requires a unique index to support the ON CONFLICT (email) clause
-- used by scripts/gen-seed-hashes.cjs --apply.
--
-- Idempotent: only adds the constraint if it does not already exist.
-- =====================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_email_key'
          AND conrelid = 'users'::regclass
    ) THEN
        -- Defensive: if duplicates already exist (data drift), fix them
        -- by keeping the lowest id per email before adding the constraint.
        UPDATE users u
        SET deleted_at = NOW()
        WHERE id NOT IN (
            SELECT MIN(id) FROM users WHERE email IS NOT NULL GROUP BY email
        )
          AND deleted_at IS NULL;
        ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
    END IF;
END $$;

-- Replace the non-unique helper index with the constraint-backed one.
DROP INDEX IF EXISTS idx_users_email;
