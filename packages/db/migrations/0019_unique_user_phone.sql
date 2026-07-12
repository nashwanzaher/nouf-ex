-- =====================================================================
-- Migration 0019 — users.phone UNIQUE
-- ----------------------------------------------------------------------------
-- SECURITY (audit 2026-07-03, finding H-1): users.phone is used as a
-- login-recovery vector (forgot-password SMS OTP) but the column has
-- no UNIQUE constraint. Two users sharing a phone breaks the OTP
-- flow — one user receives a code intended for the other — and
-- enables account-takeover: an attacker who registered first can
-- hijack the victim's account via "forgot password → SMS OTP".
--
-- `email` is already constrained by `users_email_key` (CITEXT NOT
-- NULL UNIQUE, see migration 0003). The same pattern is applied to
-- `phone` so the recovery channel is just as safe as the primary
-- login channel.
--
-- Defensive data fix (mirrors 0003):
--   1. If duplicate phones already exist (data drift), keep the
--      oldest user (MIN(id)) per phone and soft-delete the rest
--      (deleted_at = NOW()). Only rows that are still active
--      (deleted_at IS NULL) are touched — historical soft-deleted
--      accounts are never retroactively modified.
--   2. Add a UNIQUE constraint named `users_phone_key` (matches
--      the `users_email_key` convention).
--   3. `phone` stays NULLable. Most users do not supply a phone,
--      and PostgreSQL treats NULLs as distinct in a UNIQUE
--      constraint by default, so multiple NULLs coexist cleanly.
--
-- Idempotent: the ADD CONSTRAINT is guarded by a pg_constraint
-- existence check on conname; the file is wrapped in BEGIN/COMMIT
-- so a partial failure rolls back atomically.
-- =====================================================================

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_phone_key'
          AND conrelid = 'users'::regclass
    ) THEN
        -- Defensive: if duplicate phones already exist (data drift),
        -- keep the lowest id per phone and soft-delete the rest.
        UPDATE users u
        SET deleted_at = NOW()
        WHERE phone IS NOT NULL
          AND deleted_at IS NULL
          AND id NOT IN (
              SELECT MIN(id)
              FROM users
              WHERE phone IS NOT NULL
              GROUP BY phone
          );

        ALTER TABLE users
            ADD CONSTRAINT users_phone_key UNIQUE (phone);
    END IF;
END
$$;

COMMIT;
