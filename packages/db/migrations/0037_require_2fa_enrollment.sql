-- =====================================================================
-- 0037_require_2fa_enrollment.sql — gate 2FA by policy, not by TOTP state
-- =====================================================================
-- RATIONALE
--   Before this migration, `users.two_factor_enabled` was a single
--   boolean. The bootstrap script set it to TRUE when the env var
--   `BOOTSTRAP_ADMIN_REQUIRE_2FA=true`, but at provision time there
--   is NO totp_secret yet — a forced TRUE here would mean
--   `two_factor_enabled=true` AND `totp_secret=NULL`, which the
--   sanity check in migration 0008 rejects with an exception. We
--   need TWO orthogonal flags:
--
--     require_2fa_enrollment  — admin / corporate POLICY (set at
--                                  provision). When TRUE, the user MUST
--                                  complete TOTP enrolment before they
--                                  can access privileged endpoints.
--     two_factor_enabled       — current TOTP STATE. Only flips TRUE
--                                  AFTER the user confirms their first
--                                  TOTP code (see auth-2fa.ts:
--                                  confirm2FA()).
--
--   The existing `trg_sync_users_two_factor_enabled` trigger
--   (migration 0024 + 0026) already enforces:
--     two_factor_enabled := (totp_enabled_at IS NOT NULL)
--   so we don't need to touch that.
--
-- NEW COLUMN
--   require_2fa_enrollment BOOLEAN NOT NULL DEFAULT TRUE
--
-- WHY DEFAULT TRUE?
--   Operators (super_admin + the four functional roles) are
--   privileged. The safer default is "require enrolment" rather
--   than "don't require". This matches OWASP ASVS V2.5.4 (multi-
--   factor authentication for privileged accounts).
--
-- =====================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS require_2fa_enrollment BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN users.require_2fa_enrollment IS
    'Admin policy: TRUE forces the user to complete TOTP enrolment '
    'before they can access /api/admin/* (Tier 7 R-SUPER-1).';

-- Backfill: existing super_admin / store_reviewer / catalog_moderator /
-- finance_admin / support_agent rows should require 2FA by default.
-- merchant / customer / delivery_agent rows are not required (their
-- access is already gated by the role itself).
UPDATE users
   SET require_2fa_enrollment = TRUE
 WHERE role IN ('super_admin',
                'store_reviewer',
                'catalog_moderator',
                'finance_admin',
                'support_agent');

-- Audit log: record the migration itself so audit-log viewers can
-- see the policy-change timestamp.
INSERT INTO admin_audit_log (
    user_id, action, entity_type, entity_id,
    old_values, new_values, ip_address, user_agent
) VALUES (
    NULL,
    'migration.require_2fa_enrollment',
    'users',
    'schema',
    NULL,
    '{"added_column":"require_2fa_enrollment","default":true}',
    NULL,
    'database/0037'
);
