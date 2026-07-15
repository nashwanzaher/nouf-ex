-- =============================================================================
-- 0010_used_jtis.sql — replay protection for partial 2FA tokens
-- =============================================================================
-- Mirrors the in-memory Map that used to live in apps/api/src/lib/partial-token.ts.
-- Moving it to Postgres lets multiple server replicas share the "already-used"
-- set so a partial_token cannot be replayed across instances (the previous
-- in-memory Map was per-process — two replicas behind a load balancer would
-- have allowed the same partial_token to be spent twice, once on each replica).
--
-- We use the jti as a primary key so the INSERT ... ON CONFLICT DO NOTHING
-- pattern is atomic: a parallel verify() racing against itself will either
-- both succeed (and the second one is a no-op due to conflict) or one will
-- fail, never both succeeding independently.
--
-- The expires_at index lets a periodic sweeper (added to db-setup or
-- a future maintenance endpoint) drop rows past their TTL cheaply.
-- =============================================================================

CREATE TABLE IF NOT EXISTS used_jtis (
    jti         TEXT        PRIMARY KEY,
    user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_used_jtis_expires_at ON used_jtis(expires_at);
