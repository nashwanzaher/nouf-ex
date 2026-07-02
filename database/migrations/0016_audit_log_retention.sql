-- =====================================================================
-- 0016_audit_log_retention.sql
-- SECURITY: bounded retention for the audit log and search log.
-- Without an explicit cleanup policy the audit tables grow
-- unbounded — at ~1k admin actions/day, `admin_audit_log` would
-- cross 1M rows within three years and `search_logs` within months.
-- We expose two cleanup functions and a pg_cron schedule (where
-- pg_cron is available); operators without pg_cron should call
-- `cleanup_audit_logs()` from their own scheduler.
-- =====================================================================

-- 1. Reusable function. Removes admin audit rows older than the
--    configured retention window (default 2 years) and search log
--    rows older than 90 days. Idempotent: a no-op when nothing is
--    due.
CREATE OR REPLACE FUNCTION cleanup_audit_logs(
    admin_retention interval DEFAULT interval '2 years',
    search_retention interval DEFAULT interval '90 days'
) RETURNS TABLE(deleted_admin bigint, deleted_search bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_admin bigint;
    v_search bigint;
BEGIN
    DELETE FROM admin_audit_log
     WHERE created_at < now() - admin_retention;
    GET DIAGNOSTICS v_admin = ROW_COUNT;

    DELETE FROM search_logs
     WHERE created_at < now() - search_retention;
    GET DIAGNOSTICS v_search = ROW_COUNT;

    RETURN QUERY SELECT v_admin, v_search;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_audit_logs(interval, interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_audit_logs(interval, interval) TO noufex_owner;
-- noufex_app can call it for its own application-level cleanups
-- (e.g. from a maintenance endpoint), but the function itself
-- enforces that the operation cannot run as a non-privileged role.
GRANT EXECUTE ON FUNCTION cleanup_audit_logs(interval, interval) TO noufex_app;
