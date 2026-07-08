-- =====================================================================
-- Migration 0026 — Critical fixes (audit 2026-07-09)
-- =====================================================================
-- Fixes:
--   1. Re-create partial unique index on users.email (lost by 0003+0024)
--   2. Fix trg_stores_refresh_sales_count (references non-existent column)
--   3. Fix trg_refunds_resolve_payments (refund ALL payments, not specific)
--   4. Fix trg_sync_users_two_factor_enabled (contradicts 2FA enrollment)
--   5. Re-create partial unique index on users.phone (not soft-delete-aware)
-- =====================================================================

-- ── 1. users.email: re-create partial unique index ────────────────────
-- Migration 0003 dropped idx_users_email (the partial index).
-- Migration 0024 dropped users_email_key (the full-table constraint).
-- Result: zero unique protection on email. This fixes it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
    ON users(email) WHERE deleted_at IS NULL;

-- ── 2. Fix trg_stores_refresh_sales_count ─────────────────────────────
-- The old version referenced oi.store_id which does NOT exist on
-- order_items. Use NEW.store_id from the orders table instead.
CREATE OR REPLACE FUNCTION trg_stores_refresh_sales_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
        UPDATE stores
           SET sales_count = sales_count + 1
         WHERE id = NEW.store_id;
    END IF;

    RETURN NEW;
END
$$;

-- ── 3. Fix trg_refunds_resolve_payments ───────────────────────────────
-- The old version marked ALL completed payments for an order as refunded.
-- Fix: filter by payment_id when available.
CREATE OR REPLACE FUNCTION trg_refunds_resolve_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW.status = 'processed'
       AND COALESCE(OLD.status, '') IS DISTINCT FROM 'processed' THEN
        IF TG_OP = 'UPDATE' THEN
            NEW.resolved_at := now();
        END IF;

        UPDATE payments
           SET status = 'refunded',
               refunded_at = COALESCE(refunded_at, now())
         WHERE order_id = NEW.order_id
           AND status = 'completed'
           AND (NEW.payment_id IS NULL OR id = NEW.payment_id);
    END IF;
    RETURN NEW;
END
$$;

-- ── 4. Fix trg_sync_users_two_factor_enabled ──────────────────────────
-- The old version treated a non-empty totp_secret as sufficient to
-- enable 2FA. But the enrollment flow creates the secret BEFORE
-- the user confirms with a TOTP code. Only totp_enabled_at should
-- count as confirmed 2FA.
CREATE OR REPLACE FUNCTION trg_sync_users_two_factor_enabled()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    -- Only totp_enabled_at being NOT NULL means enrollment is confirmed.
    -- Having a totp_secret alone is not enough (user hasn't verified yet).
    NEW.two_factor_enabled := (NEW.totp_enabled_at IS NOT NULL);
    RETURN NEW;
END
$$;

-- ── 5. users.phone: re-create partial unique index ────────────────────
-- Migration 0019 created users_phone_key (full-table UNIQUE).
-- A soft-deleted user's phone blocks re-registration with the same
-- number. Fix: create a partial index (NULLs are already ignored by
-- UNIQUE + WHERE).
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone
    ON users(phone) WHERE deleted_at IS NULL AND phone IS NOT NULL;
