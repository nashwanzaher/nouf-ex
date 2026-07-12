-- =====================================================================
-- 0015_subscriptions_unique_active.sql
-- SECURITY: prevent two `active` / `past_due` subscriptions for the
-- same store (DB-CRITICAL-4, audit 2026-06-30). Idempotent: a re-run
-- on a database that already has the index is a no-op.
-- =====================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_active
    ON subscriptions(store_id) WHERE status IN ('active', 'past_due');
