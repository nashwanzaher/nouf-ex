-- =====================================================================
-- Nouf-ex — Migration tracking table
-- =====================================================================
-- Each row = one applied migration file (database/migrations/NNNN_*.sql).
-- db-setup.cjs inserts a row after successfully applying each one.
-- Idempotent: re-running is safe.
-- =====================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version      VARCHAR(100) PRIMARY KEY,
    description  TEXT        NOT NULL,
    applied_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    checksum     TEXT
);
-- Widening ALTER for older deployments where the column was VARCHAR(20)
-- (too narrow for descriptive version names like `0031_delivery_agent_role`).
ALTER TABLE schema_migrations ALTER COLUMN version TYPE VARCHAR(100);

-- On a fresh DB, mark the baseline schema + seed as "applied".
INSERT INTO schema_migrations (version, description)
VALUES
    ('0001', 'baseline schema + seed')
ON CONFLICT (version) DO NOTHING;
