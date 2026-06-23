-- =====================================================================
-- Migration 0004 — rate_limit_buckets + consume_rate_limit()
-- ----------------------------------------------------------------------------
-- Move the in-memory rate limiter from server/index.ts to the database so
-- the limit is shared across instances and survives restarts. The API
-- now calls consume_rate_limit() per request; the app still does the
-- scheduling but no longer keeps state in process memory.
--
-- consume_rate_limit() atomically:
--   1. Inserts a new row (bucket, key) with count=1, reset_at=now+window
--   2. If the row already exists and the window has not expired,
--      increments count.
--   3. If the row already exists but the window HAS expired, resets
--      count=1, reset_at=now+window.
--   4. Returns (allowed=true, retry_after=0) if count<=max, else
--      (allowed=false, retry_after=ms until window reset).
--
-- cleanup_rate_limits() removes expired rows; the app calls it on a
-- 1-minute interval to keep the table small.
-- =====================================================================

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    bucket    TEXT        NOT NULL,
    key       TEXT        NOT NULL,
    count     INTEGER     NOT NULL DEFAULT 0,
    reset_at  TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (bucket, key)
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_reset_at ON rate_limit_buckets(reset_at);

CREATE OR REPLACE FUNCTION consume_rate_limit(
    p_bucket    TEXT,
    p_key       TEXT,
    p_window_ms INTEGER,
    p_max       INTEGER
) RETURNS TABLE(allowed BOOLEAN, retry_after_ms INTEGER)
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_now       TIMESTAMPTZ := now();
    v_count     INTEGER;
    v_reset_at  TIMESTAMPTZ;
    v_retry_ms  INTEGER := 0;
    v_allowed   BOOLEAN := FALSE;
BEGIN
    INSERT INTO rate_limit_buckets (bucket, key, count, reset_at)
    VALUES (p_bucket, p_key, 1, v_now + (p_window_ms::TEXT || ' milliseconds')::interval)
    ON CONFLICT (bucket, key) DO UPDATE
      SET count = CASE
                    WHEN rate_limit_buckets.reset_at < v_now
                    THEN 1
                    ELSE rate_limit_buckets.count + 1
                  END,
          reset_at = CASE
                       WHEN rate_limit_buckets.reset_at < v_now
                       THEN v_now + (p_window_ms::TEXT || ' milliseconds')::interval
                       ELSE rate_limit_buckets.reset_at
                     END
    RETURNING rate_limit_buckets.count, rate_limit_buckets.reset_at
      INTO v_count, v_reset_at;

    v_allowed := v_count <= p_max;
    IF NOT v_allowed THEN
        v_retry_ms := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_reset_at - v_now)) * 1000))::INTEGER;
    END IF;

    RETURN QUERY SELECT v_allowed, v_retry_ms;
END
$$;

CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM rate_limit_buckets WHERE reset_at < now();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END
$$;
