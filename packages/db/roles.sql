-- =====================================================================
-- Nouf-ex — Roles & GRANTs
-- =====================================================================
-- Roles (run once by an existing superuser — typically `postgres`).
-- The application NEVER connects as superuser. It uses `noufex_app`.
-- Idempotent: DROP IF EXISTS then CREATE for safe re-runs.
--
-- SECURITY: Passwords are read from psql variables (:OWNER_PASSWORD,
-- :APP_PASSWORD, :RO_PASSWORD) which MUST be passed via -v flags.
-- Example:
--   psql -v OWNER_PASSWORD="$OWNER_PWD" -v APP_PASSWORD="$APP_PWD" \
--        -v RO_PASSWORD="$RO_PWD" -f database/roles.sql
-- NEVER hardcode passwords in version control.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Create roles
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'noufex_owner') THEN
        CREATE ROLE noufex_owner WITH LOGIN PASSWORD :'OWNER_PASSWORD';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'noufex_app') THEN
        CREATE ROLE noufex_app WITH LOGIN PASSWORD :'APP_PASSWORD';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'noufex_readonly') THEN
        CREATE ROLE noufex_readonly WITH LOGIN PASSWORD :'RO_PASSWORD';
    END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 2. Database + schema connect
-- ---------------------------------------------------------------------
GRANT CONNECT ON DATABASE noufex_db TO noufex_app, noufex_readonly, noufex_owner;
GRANT USAGE      ON SCHEMA public     TO noufex_app, noufex_readonly, noufex_owner;

-- ---------------------------------------------------------------------
-- 3. Sequences (IDENTITY columns)
-- ---------------------------------------------------------------------
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO noufex_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO noufex_app;
-- SECURITY (DB-CRITICAL-2): also propagate default sequence
-- privileges for tables created by the migration owner role.
-- Without this, future tables created by `noufex_owner` (the role
-- that runs `npm run db:setup`) wouldn't have their IDENTITY
-- sequences accessible to the app.
ALTER DEFAULT PRIVILEGES FOR ROLE noufex_owner IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO noufex_app;

-- ---------------------------------------------------------------------
-- 4. noufex_app — runtime CRUD on user data
-- ---------------------------------------------------------------------
-- SECURITY (DB-CRITICAL-1): instead of `GRANT … ON ALL TABLES` followed
-- by a hand-maintained `REVOKE` list, we grant explicitly ONLY the
-- tables the application needs. New tables added later (e.g. a future
-- `auth_tokens` or `payment_methods_secret`) are NOT granted by
-- default — a developer must add them here on purpose. The previous
-- GRANT ALL + REVOKE pattern was error-prone: a single forgotten
-- REVOKE would have silently widened privileges.
--
-- Tables the app is allowed to read+write:
DO $$
DECLARE
    t text;
    rw_tables text[] := ARRAY[
        'users',                  -- profile CRUD
        'addresses',              -- shipping/billing addresses
        'stores',                 -- merchant store CRUD
        'categories',             -- read-mostly
        'products',
        'product_variants',
        'product_images',
        'cart_items',             -- server-side cart
        'orders',
        'order_items',
        'reviews',
        'wishlist',
        'notifications',
        'messages',
        'disputes',
        'subscriptions',
        'rate_limit_buckets',
        'coupons',
        'coupon_usage',
        'payments',
        'refunds',
        'store_balance',
        'store_followers',
        'shipping_methods',
        'used_jtis',              -- auth replay-protection
        'webhook_events'          -- webhook idempotency (P1-1)
    ];
    ro_tables text[] := ARRAY[
        -- Read-only: writes happen only via SECURITY DEFINER triggers
        -- or superuser-managed jobs.
        'admin_audit_log',
        'inventory_log',
        'transactions',
        'search_logs'
    ];
BEGIN
    FOREACH t IN ARRAY rw_tables LOOP
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO noufex_app', t);
    END LOOP;
    FOREACH t IN ARRAY ro_tables LOOP
        EXECUTE format('GRANT SELECT ON TABLE public.%I TO noufex_app', t);
    END LOOP;
END
$$;

-- Default privileges for FUTURE tables created by either superuser
-- (postgres) or the migration owner role (noufex_owner). New tables
-- get the read-only tier by default; a developer promoting a new
-- table to read-write must also run an explicit GRANT.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT SELECT ON TABLES TO noufex_app;
ALTER DEFAULT PRIVILEGES FOR ROLE noufex_owner IN SCHEMA public
    GRANT SELECT ON TABLES TO noufex_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO noufex_app;
ALTER DEFAULT PRIVILEGES FOR ROLE noufex_owner IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO noufex_app;

-- ---------------------------------------------------------------------
-- 5. noufex_readonly — analytics / BI
-- ---------------------------------------------------------------------
GRANT SELECT ON ALL TABLES IN SCHEMA public TO noufex_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT SELECT ON TABLES TO noufex_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE noufex_owner IN SCHEMA public
    GRANT SELECT ON TABLES TO noufex_readonly;

-- ---------------------------------------------------------------------
-- 6. noufex_owner — DDL (migrations), owns schema objects
-- ---------------------------------------------------------------------
GRANT CREATE ON DATABASE noufex_db TO noufex_owner;
-- (Default privileges above also flow through the owner role.)

-- ---------------------------------------------------------------------
-- 7. Make noufex_owner the owner of all existing tables for clean ALTER
-- ---------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT tablename FROM pg_tables
         WHERE schemaname = 'public'
           AND tableowner <> 'noufex_owner'
    LOOP
        EXECUTE format('ALTER TABLE public.%I OWNER TO noufex_owner', r.tablename);
    END LOOP;
    FOR r IN
        SELECT sequencename FROM pg_sequences
         WHERE schemaname = 'public'
           AND sequenceowner IS DISTINCT FROM 'noufex_owner'
    LOOP
        EXECUTE format('ALTER SEQUENCE public.%I OWNER TO noufex_owner', r.sequencename);
    END LOOP;
    FOR r IN
        SELECT viewname FROM pg_views
         WHERE schemaname = 'public'
           AND viewowner <> 'noufex_owner'
    LOOP
        EXECUTE format('ALTER VIEW public.%I OWNER TO noufex_owner', r.viewname);
    END LOOP;
END
$$;
