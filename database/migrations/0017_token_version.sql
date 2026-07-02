-- =====================================================================
-- 0017_token_version.sql
-- SECURITY (C-3, audit 2026-06-30): add a `token_version` column
-- to `users` so we can revoke every previously-issued bearer token
-- for a user in a single operation. The token payload carries
-- `ver`; on every authenticated request we look up the user's
-- current `token_version` and reject any request where the
-- payload's `ver` doesn't match. A logout endpoint bumps
-- `token_version` for the calling user; the next request from
-- any old token (stolen laptop, leaked header, ...) hits 401.
--
-- Existing tokens signed before this migration have `ver = null`.
-- We treat `null` payload as `0`, so anyone whose user
-- `token_version = 0` keeps their existing tokens working — but
-- bumping to 1+ invalidates them all.
-- =====================================================================
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0
    CHECK (token_version >= 0);

-- Idempotent: harmless to re-run after the first apply.
UPDATE users SET token_version = 0 WHERE token_version IS NULL;
