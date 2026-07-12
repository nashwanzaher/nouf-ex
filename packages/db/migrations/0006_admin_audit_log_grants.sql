-- =====================================================================
-- Migration 0006 — noufex_app INSERT/UPDATE on admin_audit_log
-- ----------------------------------------------------------------------------
-- The mutating admin endpoints (PATCH /api/admin/*) write to
-- admin_audit_log on every successful mutation. Without INSERT
-- permission the writes fail with `permission denied for table
-- admin_audit_log` (PG code 42501) and the user sees a 500.
--
-- noufex_owner already has full privileges — this migration only
-- fixes the gap for the runtime app role. noufex_readonly is
-- intentionally left as SELECT-only.
--
-- Idempotent: GRANT is a no-op if the privilege already exists.
-- =====================================================================

GRANT INSERT, UPDATE ON admin_audit_log TO noufex_app;
GRANT USAGE ON SEQUENCE admin_audit_log_id_seq TO noufex_app;
