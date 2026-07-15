-- =====================================================================
-- Migration 0008 — TOTP columns on users (P0-5: 2FA)
-- ----------------------------------------------------------------------------
-- Adds the columns needed to support time-based one-time passwords
-- (TOTP, RFC 6238) as a second authentication factor.
--
-- Schema notes
--   * totp_secret         : the 160-bit secret, base32-encoded WITHOUT
--                            padding. Stored as TEXT (not BYTEA) for
--                            portability — the value is small (~32
--                            chars) and base32 is lossless. The
--                            app-side helper (lib/totp.ts) handles
--                            the encode/decode.
--   * totp_backup_codes    : array of scrypt HASHES (never plaintext).
--                            Each code is a single-use 10-char
--                            recovery code; once consumed, the row
--                            is removed from the array. Regenerating
--                            the codes replaces the entire array.
--   * totp_enabled_at      : when the user confirmed enrollment. NULL
--                            means enrollment was started (secret
--                            exists) but not confirmed. This lets us
--                            surface "complete your 2FA setup" UI
--                            to the user without relying on the
--                            existing two_factor_enabled boolean.
--
-- The existing `two_factor_enabled` column on `users` is kept as the
-- public, "is 2FA on?" flag. The application sets it to TRUE only
-- after a successful `/api/auth/2fa/enable` confirmation.
--
-- All columns are nullable — most users in the system don't have 2FA
-- enabled and we don't want to enforce a value for them.
-- =====================================================================
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS totp_secret TEXT,
    ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ;

-- Sanity check: every row with two_factor_enabled=true must have a
-- secret (we maintain this invariant in the app, but the check
-- exists to surface drift if the app is ever bypassed).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM users
         WHERE two_factor_enabled = TRUE
           AND (totp_secret IS NULL OR totp_enabled_at IS NULL)
    ) THEN
        RAISE EXCEPTION 'users.two_factor_enabled=true requires totp_secret and totp_enabled_at';
    END IF;
END
$$;
