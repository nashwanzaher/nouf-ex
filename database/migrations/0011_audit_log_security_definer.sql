-- =============================================================================
-- 0011_audit_log_security_definer.sql — fix audit log permission conflict
-- =============================================================================
-- Problem: roles.sql REVOKEs INSERT on admin_audit_log FROM noufex_app
--          (so the app can't forge audit entries). But writeAuditLog()
--          in app/server/lib/shared.cts does INSERT directly. With the
--          noufex_app role, every admin operation would fail to log.
--
-- Fix: route the INSERT through a SECURITY DEFINER function owned by
--       noufex_owner. The app gets EXECUTE on the function (not INSERT
--       on the table), so it can write audit entries but cannot bypass
--       the function to forge them.
-- =============================================================================

CREATE OR REPLACE FUNCTION write_audit_log(
    p_user_id        INTEGER,
    p_action         TEXT,
    p_entity_type    TEXT,
    p_entity_id      TEXT,
    p_old_values     JSONB,
    p_new_values     JSONB,
    p_ip_address     INET,
    p_user_agent     TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO admin_audit_log (
        user_id, action, entity_type, entity_id,
        old_values, new_values, ip_address, user_agent
    ) VALUES (
        p_user_id, p_action, p_entity_type, p_entity_id,
        p_old_values, p_new_values, p_ip_address, p_user_agent
    )
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- Lock down: only noufex_owner owns the function. noufex_app can
-- EXECUTE it but cannot see the table.
REVOKE ALL ON FUNCTION write_audit_log(INTEGER, TEXT, TEXT, TEXT, JSONB, JSONB, INET, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION write_audit_log(INTEGER, TEXT, TEXT, TEXT, JSONB, JSONB, INET, TEXT) TO noufex_app;
