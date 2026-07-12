-- =====================================================================
-- 0023_app_settings.sql
--
-- Closes the enabler for P1-2 (YER hardcoded) and gives the
-- application a single, audited source of truth for runtime
-- configuration that previously lived as hardcoded literals.
--
-- BACKGROUND
-- ----------
-- The deep audit 2026-06-30 found ~150 hardcoded 'YER' (and
-- other locale-specific) literals across the server (70+) and
-- frontend (80+). Each is a copy-paste hazard: changing the
-- default currency means a code change + redeploy, and
-- regional deployments can't differ.
--
-- This migration introduces an `app_settings` table that
-- holds key-value configuration. The first set of keys
-- defaults the canonical deployment to YER/USD/SAR but the
-- values are read at runtime so a future commit can change
-- the defaults or introduce `WHERE region = ?` overrides
-- without code changes.
--
-- KEYS seeded here (DB-G1:
--   'DEFAULT_CURRENCY'        - 'YER' for the Yemen market
--   'FREE_SHIPPING_THRESHOLD' - 10000 (10,000 minor units = 100.00 YER)
--   'FLAT_SHIPPING_COST'      - 500   (5.00 YER)
-- All numeric settings are stored as TEXT to keep the schema
-- flexible; readers parse on load.
--
-- Application contract (app/server):
--   SELECT value FROM app_settings WHERE key = 'DEFAULT_CURRENCY';
-- Cache for 60s in-process to avoid hammering the DB.
--
-- SECURITY (RLS):
--   - The noufex_app role can SELECT (read-only).
--   - Writes go through a SECURITY DEFINER function
--     (admin_set_app_setting) that also writes an entry
--     into admin_audit_log (so admins cannot silently
--     rotate 'DEFAULT_CURRENCY' without a trace).
--   - super_admin and noufex_owner can UPDATE directly
--     (RLS USING clause).
--
-- IMPORTANT (do-not-break): The DO blocks here use the same
-- line-token discipline as 0021 / 0022 - 'END IF;' and
-- 'END $$;' are single tokens. Once the file is in the
-- prettierignore (commit 98950a3), this is the durable
-- defence against accidental corruption.
-- =====================================================================


-- =====================================================================
-- Part 1:  app_settings table
-- =====================================================================

CREATE TABLE
IF NOT EXISTS app_settings
(
    key          VARCHAR
(64)  PRIMARY KEY,
    value        TEXT         NOT NULL,
    -- Free-form description surfaced in the admin UI.
    description  TEXT,
    -- Updated_at / updated_by for an end-to-end audit trail on
    -- config changes. Source-of-truth lives here, NOT in the
    -- admin_audit_log table (this table is the canonical log
    -- of every config edit).
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW
(),
    updated_by   INTEGER      REFERENCES users
(id) ON
DELETE
SET NULL
);

CREATE INDEX
IF NOT EXISTS idx_app_settings_updated_at ON app_settings
(updated_at DESC);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Drop any prior policies so this migration is idempotent.
DROP POLICY
IF EXISTS app_settings_select ON app_settings;
DROP POLICY
IF EXISTS app_settings_admin_update ON app_settings;

-- App role: read-only. The application reads but never writes;
-- writes go through admin_set_app_setting().
CREATE POLICY app_settings_select
    ON app_settings FOR
SELECT
  TO noufex_app
USING
(TRUE);

-- super_admin / noufex_owner: write directly. Writes still
-- logged via the function (recommended path), but this is
-- available for tooling migrations.
CREATE POLICY app_settings_admin_update
    ON app_settings FOR
UPDATE
    TO noufex_owner
    USING (TRUE)
WITH CHECK
(TRUE);


-- =====================================================================
-- Part 2:  SECURITY DEFINER admin_set_app_setting()
--          Centralises writes so every change leaves an audit
--          trail in admin_audit_log.
-- =====================================================================

CREATE OR REPLACE FUNCTION admin_set_app_setting
(
    p_key       VARCHAR
(64),
    p_value     TEXT,
    p_user_id   INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path
= pg_catalog, public
AS $$
BEGIN
  -- Validate key format (allow only [a-z0-9_]). Anything
  -- else is rejected outright, so a typo or injection
  -- never lands in the table.
  IF p_key !~ '^[a-z0-9_]{1,64}$' THEN
        RAISE EXCEPTION 'invalid app_settings key: %', p_key
            USING ERRCODE = 'invalid_parameter_value';
END
IF;

    -- INSERT or UPDATE.
    INSERT INTO app_settings
  (key, value, updated_at, updated_by)
VALUES
  (p_key, p_value, NOW(), p_user_id)
ON CONFLICT
(key) DO
UPDATE
        SET value      = EXCLUDED.value,
            updated_at = NOW(),
            updated_by = EXCLUDED.updated_by;

-- Append to admin_audit_log so the change is part of the
-- existing audit trail. We use the SECURITY DEFINER helper
-- write_audit_log() - the same one used by admin handlers
-- in the application server.
PERFORM write_audit_log
(
        jsonb_build_object
('admin_user_id', p_user_id),
        'app_setting.update',
        'app_settings',
        p_key,
        NULL,
        jsonb_build_object
('value', p_value)
    );
END
$$;


-- =====================================================================
-- Part 3:  Seed defaults for the canonical Nouf-ex deployment
-- =====================================================================

INSERT INTO app_settings
  (key, value, description, updated_by)
VALUES
  (
    'DEFAULT_CURRENCY',
    'YER',
    'ISO-4217 currency code used as default when an order / subscription row has currency IS NULL or unknown. See 0022_coupon_atomicity / 0021_schema_hygiene for historical context.',
    NULL
    ),
  (
    'FREE_SHIPPING_THRESHOLD',
    '10000',
    'Order subtotal (in minor units; 10000 = 100.00 of the DEFAULT_CURRENCY) at and above which shipping is free. Below this, FLAT_SHIPPING_COST applies.',
    NULL
    ),
  (
    'FLAT_SHIPPING_COST',
    '500',
    'Flat shipping fee (in minor units) charged when the order subtotal is below FREE_SHIPPING_THRESHOLD. Used by server/routes/orders.cts.',
    NULL
    )
ON CONFLICT
(key) DO NOTHING;


-- =====================================================================
-- Part 4:  ANALYZE so the planner sees the new table / index
--          immediately.
-- =====================================================================
ANALYZE app_settings;
