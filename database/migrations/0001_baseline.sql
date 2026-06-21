-- =====================================================================
-- Nouf-ex — Migration tracking table
-- =====================================================================
-- Each row = one applied migration file (database/migrations/NNNN_*.sql).
-- db-setup.cjs inserts a row after successfully applying each one.
-- Idempotent: re-running is safe.
-- =====================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version      VARCHAR(20) PRIMARY KEY,
    description  TEXT        NOT NULL,
    applied_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    checksum     TEXT
);

-- On a fresh DB, mark the baseline schema + seed as "applied".
INSERT INTO schema_migrations (version, description)
VALUES
    ('0001', 'baseline schema + seed')
ON CONFLICT (version) DO NOTHING;
