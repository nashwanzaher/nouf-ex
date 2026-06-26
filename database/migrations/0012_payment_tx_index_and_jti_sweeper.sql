-- =============================================================================
-- 0012_payment_tx_index_and_jti_sweeper.sql
-- =============================================================================
-- Two operations packaged together for efficiency:
--   1. Add an index on payments.transaction_id so the webhook handler
--      `UPDATE payments SET status = ? WHERE transaction_id = ?` is a
--      single-row lookup instead of a sequential scan on a growing
--      payments table. Partial index — only rows with a non-null
--      transaction_id are indexed (the ones we'd actually look up).
--   2. Add a cleanup_used_jtis() PL/pgSQL function and wire it into
--      db-setup. The used_jtis table grows with every 2FA login and
--      has no retention otherwise. We keep rows for 24 hours after
--      they expire (covers any clock skew between server + DB).
-- =============================================================================

-- 1) Index for webhook lookups (column name in payments is provider_txn_id)
CREATE INDEX IF NOT EXISTS idx_payments_provider_txn_id
    ON payments (provider_txn_id)
    WHERE provider_txn_id IS NOT NULL;

-- 2) JTI sweeper function (mirrors cleanup_rate_limits)
CREATE OR REPLACE FUNCTION cleanup_used_jtis()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM used_jtis
    WHERE expires_at < NOW() - INTERVAL '24 hours';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION cleanup_used_jtis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_used_jtis() TO noufex_app;
