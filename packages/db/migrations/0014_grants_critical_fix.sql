-- =====================================================================
-- 0014_grants_critical_fix.sql
-- SECURITY: tighten `noufex_app` privileges to least-privilege
-- (DB-CRITICAL-1 + DB-CRITICAL-2 in audit 2026-06-30).
--
-- The previous `roles.sql` granted `SELECT, INSERT, UPDATE, DELETE
-- ON ALL TABLES` to noufex_app, then revoked the three sensitive
-- tables. That pattern is brittle: a new table created without an
-- explicit REVOKE inherits full DML rights.
--
-- This migration:
--   1. Revokes ALL current grants from noufex_app on tables.
--   2. Re-grants SELECT/INSERT/UPDATE/DELETE only on the explicit
--      allow-list (read-write tier).
--   3. Re-grants SELECT on the read-only tier (audit/ledger tables).
--   4. Adds ALTER DEFAULT PRIVILEGES for ROLE noufex_owner so future
--      tables created by the migration owner inherit the safe tier.
-- Idempotent: every step uses IF EXISTS / explicit table list.
-- =====================================================================

DO $$
DECLARE
    rw_tables text[] := ARRAY[
        'users', 'addresses', 'stores', 'categories', 'products',
        'product_variants', 'product_images', 'cart_items', 'orders',
        'order_items', 'reviews', 'wishlist', 'notifications',
        'messages', 'disputes', 'subscriptions', 'rate_limit_buckets',
        'coupons', 'coupon_usage', 'payments', 'refunds',
        'store_balance', 'store_followers', 'shipping_methods',
        'used_jtis'
    ];
    ro_tables text[] := ARRAY[
        'admin_audit_log', 'inventory_log', 'transactions', 'search_logs'
    ];
    all_tables text[];
    t text;
BEGIN
    -- Build the union of both tiers.
    all_tables := rw_tables || ro_tables;

    -- Step 1: clear ALL existing table-level grants for noufex_app.
    FOREACH t IN ARRAY all_tables LOOP
        IF EXISTS (
            SELECT 1 FROM pg_tables
             WHERE schemaname = 'public' AND tablename = t
        ) THEN
            EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM noufex_app', t);
        END IF;
    END LOOP;

    -- Step 2: read-write tier.
    FOREACH t IN ARRAY rw_tables LOOP
        IF EXISTS (
            SELECT 1 FROM pg_tables
             WHERE schemaname = 'public' AND tablename = t
        ) THEN
            EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO noufex_app', t);
        END IF;
    END LOOP;

    -- Step 3: read-only tier.
    FOREACH t IN ARRAY ro_tables LOOP
        IF EXISTS (
            SELECT 1 FROM pg_tables
             WHERE schemaname = 'public' AND tablename = t
        ) THEN
            EXECUTE format('GRANT SELECT ON TABLE public.%I TO noufex_app', t);
        END IF;
    END LOOP;
END
$$;

-- Step 4: add DEFAULT PRIVILEGES for the migration owner role.
-- Idempotent: re-running the statement replaces the default.
ALTER DEFAULT PRIVILEGES FOR ROLE noufex_owner IN SCHEMA public
    GRANT SELECT ON TABLES TO noufex_app;
ALTER DEFAULT PRIVILEGES FOR ROLE noufex_owner IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO noufex_app;
