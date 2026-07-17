-- =====================================================================
-- 0036_extend_role_enum.sql — split `admin` into granular roles
-- =====================================================================
-- Rationale
--   The single `admin` role is too coarse for an enterprise platform:
--   a store-reviewer needs read-only on stores + write on review
--   decisions, while a finance admin needs read on transactions +
--   write on refunds, etc. Splitting `admin` into named operator
--   roles lets us apply least-privilege per function (OWASP ASVS 1.4)
--   without forcing every operator to have full super-admin power.
--
-- Backward compatibility
--   - Existing rows with role='admin' are migrated to
--     'super_admin' (the operator with the most privileges).
--     A separate migration (0037_role_rationalisation.sql, future)
--     will let admins pick a more granular role from the admin UI.
--   - The CHECK constraint is dropped + recreated to allow the new
--     values. The drop is idempotent.
--   - `delivery_agent` is unchanged.
--
-- Standards applied
--   - W3C role vocabulary (Role-Based Access Control, RBAC)
--   - OWASP ASVS V1.4 (Access Control), V2.5 (Role Definitions)
--
-- Author: Noufex platform team (Tier 7 — R-SUPER-3)
-- =====================================================================

-- 1. Drop the existing CHECK constraint.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Migrate any legacy `admin` rows to `super_admin`. New INSERTs
--    will use the broader enum below.
UPDATE users SET role = 'super_admin' WHERE role = 'admin';

-- 3. Re-add the CHECK constraint with the extended enum.
ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN (
        'super_admin',
        'store_reviewer',
        'catalog_moderator',
        'support_agent',
        'finance_admin',
        'merchant',
        'customer',
        'delivery_agent'
    ));

-- 4. Document the new role vocabulary for future readers.
COMMENT ON CONSTRAINT users_role_check ON users IS
    'Roles: super_admin (platform owner), store_reviewer (KYC), '
    'catalog_moderator (content), support_agent (L1), '
    'finance_admin (refunds/commissions), merchant (store owner), '
    'customer (buyer), delivery_agent (courier).';

-- 5. Idempotency: if a future migration narrows the enum, the
--    constraint above is the single source of truth.
