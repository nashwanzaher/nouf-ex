-- =====================================================================
-- agent_db — Roles & GRANTs (least-privilege separation)
-- =====================================================================
-- Mirrors database/roles.sql. The application NEVER connects as
-- superuser; it uses `agent_app` for reads/writes on knowledge tables
-- and `agent_readonly` for analytics.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Create roles (idempotent)
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agent_owner') THEN
        CREATE ROLE agent_owner WITH LOGIN PASSWORD 'CHANGE_ME_OWNER';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agent_app') THEN
        CREATE ROLE agent_app WITH LOGIN PASSWORD 'CHANGE_ME_APP';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agent_readonly') THEN
        CREATE ROLE agent_readonly WITH LOGIN PASSWORD 'CHANGE_ME_RO';
    END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 2. Database + schema connect
-- ---------------------------------------------------------------------
GRANT CONNECT ON DATABASE agent_db TO agent_app, agent_readonly, agent_owner;
GRANT USAGE      ON SCHEMA public   TO agent_app, agent_readonly, agent_owner;

-- ---------------------------------------------------------------------
-- 3. Sequences (IDENTITY columns)
-- ---------------------------------------------------------------------
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO agent_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO agent_app;

-- ---------------------------------------------------------------------
-- 4. agent_app — runtime CRUD on knowledge tables
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE
    ON ALL TABLES IN SCHEMA public
    TO agent_app;

-- Revoke writes to the append-only history table.
REVOKE INSERT, UPDATE, DELETE ON knowledge_entry_revisions FROM agent_app;
-- The app must NOT edit the history directly — the trigger inserts it.
GRANT SELECT ON knowledge_entry_revisions TO agent_app;

-- Default privileges for future tables
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO agent_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO agent_app;

-- ---------------------------------------------------------------------
-- 5. agent_readonly — analytics / BI
-- ---------------------------------------------------------------------
GRANT SELECT ON ALL TABLES IN SCHEMA public TO agent_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT SELECT ON TABLES TO agent_readonly;

-- ---------------------------------------------------------------------
-- 6. agent_owner — DDL (migrations), owns schema objects
-- ---------------------------------------------------------------------
GRANT CREATE ON DATABASE agent_db TO agent_owner;

-- Make agent_owner the owner of all existing tables/sequences/views
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables
              WHERE schemaname = 'public' AND tableowner <> 'agent_owner'
    LOOP
        EXECUTE format('ALTER TABLE public.%I OWNER TO agent_owner', r.tablename);
    END LOOP;
    FOR r IN SELECT sequencename FROM pg_sequences
              WHERE schemaname = 'public' AND sequenceowner IS DISTINCT FROM 'agent_owner'
    LOOP
        EXECUTE format('ALTER SEQUENCE public.%I OWNER TO agent_owner', r.sequencename);
    END LOOP;
    FOR r IN SELECT viewname FROM pg_views
              WHERE schemaname = 'public' AND viewowner <> 'agent_owner'
    LOOP
        EXECUTE format('ALTER VIEW public.%I OWNER TO agent_owner', r.viewname);
    END LOOP;
END
$$;
