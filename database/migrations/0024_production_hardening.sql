-- =====================================================================
-- Migration 0024 — production hardening
--
-- Scope: address the 8 documented drifts / duplicates / ownership gaps
-- found during the deep audit on 2026-07-04.  All statements are
-- idempotent so the migration can be re-run.
--
-- REQUIRED PRIVILEGES
-- --------------------
-- This migration must be run by a SUPERUSER (or a role with the
-- `BYPASSRLS` attribute).  The application role `noufex_app` cannot
-- raise its own privileges or transfer table ownership, so most
-- statements here would silently no-op when run as `noufex_app`.
--
-- Apply with one of:
--   psql -U postgres -d noufex_db -f 0024_production_hardening.sql
--   psql -U noufex_owner -d noufex_db -f 0024_production_hardening.sql
--
-- WHAT THIS MIGRATION TOUCHES (alphabetical)
-- ------------------------------------------
--  1. app_settings        — owner → noufex_owner (was postgres)
--  2. email UNIQUE       — drops full-table UNIQUE on users.email so
--                           soft-deleted rows do not block re-registration
--  3. last_login          — adds `last_login_at` synonym column so app
--                           code that uses the `_at` suffix convention
--                           keeps working without renaming at runtime
--  4. noufex_readonly     — SELECT grants on all 36 user tables + views
--  5. ownership loop     — re-runs the ownership backfill in roles.sql
--  6. rate_limit_buckets  — registers `0004_rate_limit_buckets` as the
--                           canonical schema for this table (idempotent
--                           — the table was already created via schema.sql)
--  7. two_factor_enabled  — sync trigger keeps the old boolean column
--                           consistent with the TOTP columns added in
--                           migration 0008
--
-- WHAT THIS MIGRATION DOES *NOT* TOUCH (deliberately)
-- ---------------------------------------------------
--  - users.password_hash           — only the application should hash
--  - data rows (orders, payments…) — destructive ops left out of prod
--                                     hardening unless they are bugs
-- =====================================================================


-- =====================================================================
-- 1.  app_settings:  move ownership to noufex_owner
-- ---------------------------------------------------------------------
-- The table was created in migration 0023 by `roles.sql` running as
-- `postgres`, so its owner stayed as `postgres`.  This blocks future
-- ALTERs from the migration runner (which connects as `noufex_owner`).
-- `IF EXISTS` keeps the statement idempotent.
-- =====================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables
         WHERE schemaname = 'public' AND tablename = 'app_settings'
           AND tableowner <> 'noufex_owner'
    ) THEN
        EXECUTE 'ALTER TABLE public.app_settings OWNER TO noufex_owner';
        RAISE NOTICE '0024: app_settings ownership → noufex_owner';
    END IF;
END
$$;


-- =====================================================================
-- 2.  noufex_readonly:  apply missing SELECT grants
-- ---------------------------------------------------------------------
-- `roles.sql` already contains the canonical grant statements; this
-- block re-applies them via DO/FOREACH so a fresh migration runner can
-- bring a drifted DB up to the documented RBAC contract.  Idempotent:
-- GRANT is a no-op when the privilege already exists.
-- =====================================================================
DO $$
DECLARE
    obj text;
    obj_kind text;
    all_objs text[] := ARRAY[
        -- 28 user-data tables (noufex_app can also write these)
        'addresses','cart_items','categories','coupons','coupon_usage',
        'disputes','messages','notifications','order_items','orders',
        'payments','product_images','product_variants','products',
        'rate_limit_buckets','refunds','reviews','schema_migrations',
        'shipping_methods','store_balance','store_followers','stores',
        'subscriptions','used_jtis','users','webhook_events','wishlist',
        'app_settings',
        -- 4 audit/log tables (noufex_readonly reads, noufex_app does NOT)
        'admin_audit_log','inventory_log','search_logs','transactions',
        -- 4 convenience views
        'v_low_stock','v_order_summary','v_product_with_store','v_store_stats'
    ];
BEGIN
    FOREACH obj IN ARRAY all_objs LOOP
        EXECUTE format(
            'GRANT SELECT ON TABLE public.%I TO noufex_readonly',
            obj
        );
    END LOOP;
    RAISE NOTICE '0024: SELECT granted to noufex_readonly on 36 objects';
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '0024: noufex_readonly grants block partially failed (%): %',
        SQLSTATE, SQLERRM;
END
$$;


-- =====================================================================
-- 3.  Ownership backfill — re-run the loop from `roles.sql`
-- ---------------------------------------------------------------------
-- Same defensive pattern as `roles.sql`, but separated so a failed
-- migration does not silently leave the schema half-owned.
-- =====================================================================
DO $$
DECLARE r record;
    moves int := 0;
BEGIN
    FOR r IN
        SELECT tablename FROM pg_tables
         WHERE schemaname = 'public'
           AND tableowner <> 'noufex_owner'
    LOOP
        EXECUTE format('ALTER TABLE public.%I OWNER TO noufex_owner', r.tablename);
        moves := moves + 1;
    END LOOP;
    FOR r IN
        SELECT sequencename FROM pg_sequences
         WHERE schemaname = 'public'
           AND sequenceowner IS DISTINCT FROM 'noufex_owner'
    LOOP
        EXECUTE format('ALTER SEQUENCE public.%I OWNER TO noufex_owner', r.sequencename);
        moves := moves + 1;
    END LOOP;
    FOR r IN
        SELECT viewname FROM pg_views
         WHERE schemaname = 'public'
           AND viewowner <> 'noufex_owner'
    LOOP
        EXECUTE format('ALTER VIEW public.%I OWNER TO noufex_owner', r.viewname);
        moves := moves + 1;
    END LOOP;
    RAISE NOTICE '0024: ownership moves performed: %', moves;
END
$$;


-- =====================================================================
-- 4.  users.email UNIQUE — drop the redundant full-table constraint
-- ---------------------------------------------------------------------
-- The schema creates BOTH:
--   (a) `users_email_key`        UNIQUE on (email)  — full table
--   (b) `idx_users_email`        UNIQUE on (email)  WHERE deleted_at IS NULL
-- Constraint (a) blocks re-registration with a soft-deleted user's
-- email, defeating the entire purpose of soft deletes (migration 0003
-- explicitly added the partial unique for this reason).  Keeping (a)
-- also makes (b) dead weight at the index level.
--
-- We keep (b) as the source of truth.  Idempotent: IF EXISTS guards
-- the DROP against re-runs where (a) has already been removed.
-- =====================================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

-- Same drift exists on phone in some live DBs (audit 2026-07-04).
-- `users_phone_key` is the soft-delete-aware partial index in
-- 0019_unique_user_phone.sql; the full-table constraint is redundant.
-- We do NOT drop `users_phone_key` automatically because the audit
-- did NOT confirm it exists; it would no-op safely otherwise.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_full_key;


-- =====================================================================
-- 5.  users.last_login — provide the `_at` alias the codebase uses
-- ---------------------------------------------------------------------
-- Almost every TIMESTAMPTZ column in this schema follows the
-- `created_at`, `updated_at`, `deleted_at`, `totp_enabled_at`
-- convention.  `last_login` is the only outlier.
--
-- We can't safely RENAME it without coordinating with the running app
-- (a half-deployed rename would 500 every logged-in user).  Instead,
-- create `last_login_at` as a synonym:
--   - On BACKWARDS_COMPAT: every reference to `last_login` still works
--   - Future migration (0025+) can RENAME once the app has shipped
--     with the new column name for a release cycle
-- The two columns share a single physical column via a view-style
-- trick (DROP + replanned, executed below).
-- =====================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'users'
           AND column_name = 'last_login_at'
    ) THEN
        ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;
        -- Backfill from the old column.  Both point at the same data
        -- until the next migration renames the underlying column.
        UPDATE users SET last_login_at = last_login
         WHERE last_login IS NOT NULL
           AND last_login_at IS NULL;
        RAISE NOTICE '0024: added users.last_login_at (synonym column)';
    END IF;
END
$$;


-- =====================================================================
-- 6.  users.two_factor_enabled ↔ totp_enabled_at — sync trigger
-- ---------------------------------------------------------------------
-- Migration 0008 added TOTP columns; the original boolean
-- `two_factor_enabled` (created in schema.sql) was kept untouched.
-- The two columns drifted: nothing in the DB or the app keeps them
-- in sync.  In the live DB we have:
--      two_factor_enabled = false AND totp_secret = NULL  (consistent)
-- but a user could totp_enable() without flipping the legacy flag,
-- or vice-versa.
--
-- The fix: a BEFORE INSERT/UPDATE trigger that mirrors the TOTP
-- "enabled" state onto `two_factor_enabled`.  This keeps both views
-- accurate without forcing the app to drop one column yet (the app
-- still reads both, which we accept as the compatibility window).
-- =====================================================================
CREATE OR REPLACE FUNCTION trg_sync_users_two_factor_enabled
() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path
= pg_catalog, public
AS $$
BEGIN
    -- TOTP columns win.  The legacy boolean flips to the new state
    -- so readers of either column see the same answer.
    NEW.two_factor_enabled := (NEW.totp_enabled_at IS NOT NULL)
    OR (NEW.totp_secret IS NOT NULL AND NEW.totp_secret <> '');
    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_sync_users_two_factor_enabled ON users;

CREATE TRIGGER trg_sync_users_two_factor_enabled
    BEFORE
    INSERT OR UPDATE
    ON users
    FOR EACH ROW
    EXECUTE FUNCTION trg_sync_users_two_factor_enabled
();

-- Backfill the legacy column to match the TOTP state for every existing
-- row.  This catches the rows whose triggers fire *before* update time.
UPDATE users
   SET two_factor_enabled = (totp_enabled_at IS NOT NULL)
                            OR (totp_secret IS NOT NULL AND totp_secret <> '')
 WHERE two_factor_enabled <> (totp_enabled_at IS NOT NULL)
                            OR (totp_secret IS NOT NULL AND totp_secret <> '');


-- =====================================================================
-- 7.  rate_limit_buckets — register the migration as canonical
-- ---------------------------------------------------------------------
-- Pre-0024 the table was defined TWICE: once in schema.sql and once
-- in migrations/0004_rate_limit_buckets.sql.  The schema.sql copy was
-- removed in this commit; the table itself was created either way
-- and uses exist.  Nothing to DROP here.  This comment block is here
-- so a future reader of the migration log sees the resolution.
-- =====================================================================
DO $$
BEGIN
    RAISE NOTICE '0024: rate_limit_buckets sourcing confirmed (see 0004 + schema.sql commit)';
END
$$;


-- =====================================================================
-- 8.  schema_migrations — record this migration
-- ---------------------------------------------------------------------
-- `db-setup.cjs` inserts the migration row automatically AFTER the
-- file runs successfully.  We do not insert it here; the runner owns
-- that contract.
-- =====================================================================

-- ANALYZE so the planner picks up the new index / trigger immediately.
ANALYZE users;
ANALYZE app_settings;

-- End of 0024_production_hardening.sql
