-- =====================================================================
-- Nouf-ex — Roles & GRANTs
-- =====================================================================
-- Roles (run once by an existing superuser — typically `postgres`).
-- The application NEVER connects as superuser. It uses `noufex_app`.
-- Idempotent: DROP IF EXISTS then CREATE for safe re-runs.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Create roles
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'noufex_owner') THEN
        CREATE ROLE noufex_owner WITH LOGIN PASSWORD 'CHANGE_ME_OWNER';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'noufex_app') THEN
        CREATE ROLE noufex_app WITH LOGIN PASSWORD 'CHANGE_ME_APP';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'noufex_readonly') THEN
        CREATE ROLE noufex_readonly WITH LOGIN PASSWORD 'CHANGE_ME_RO';
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

-- ---------------------------------------------------------------------
-- 4. noufex_app — runtime CRUD on user data
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE
    ON ALL TABLES IN SCHEMA public
    TO noufex_app;

-- But the app must NOT directly touch audit trail or wallet ledger:
REVOKE INSERT, UPDATE, DELETE ON admin_audit_log FROM noufex_app;
REVOKE INSERT, UPDATE, DELETE ON inventory_log     FROM noufex_app;
REVOKE INSERT, UPDATE, DELETE ON transactions      FROM noufex_app;
-- (Only PG triggers / superuser write to these tables.)

GRANT SELECT ON admin_audit_log, inventory_log, transactions TO noufex_app;

-- Default privileges for future tables created by the owner role.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO noufex_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO noufex_app;

-- ---------------------------------------------------------------------
-- 5. noufex_readonly — analytics / BI
-- ---------------------------------------------------------------------
GRANT SELECT ON ALL TABLES IN SCHEMA public TO noufex_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
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
