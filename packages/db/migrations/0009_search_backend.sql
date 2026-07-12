-- =====================================================================
-- Migration 0009 — P1-1: full-text search backend
-- ----------------------------------------------------------------------------
-- The previous FTS index (idx_products_search, from 0001_baseline) only
-- covered the three name columns. That misses description text — the
-- highest-signal field for relevance. A search for "incense" via the
-- old index returned 1 product; the same query against a description-
-- aware index returns 2 (verified manually before this migration).
--
-- This migration:
--   1. Drops the partial-coverage FTS index.
--   2. Creates a new GIN index that covers all 6 text fields
--      (name_ar / name_en / name_zh + description / description_en
--      / description_zh) using the 'simple' config. The 'simple'
--      config handles Arabic / Chinese text better than 'english'
--      (which would strip Arabic diacritics and split Chinese
--      characters on whitespace boundaries that don't exist).
--   3. Creates a `search_logs` table for analytics — every
--      /api/search request records the query, the user (if signed
--      in), the result count, and a timestamp. This is the data
--      the P1-1 search-analytics dashboard will eventually read.
-- =====================================================================

DROP INDEX IF EXISTS idx_products_search;

-- The new index uses a STORED generated column (search_tsv) that
-- concatenates all six text fields with a space separator. The
-- 'simple' text-search config is language-agnostic enough for
-- Arabic + English + Chinese; we can swap to 'arabic' for a
-- future iteration once we want Arabic stemming.
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS search_tsv tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(name_ar, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(name_en, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(name_zh, '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(description, '')), 'D') ||
        setweight(to_tsvector('simple', coalesce(description_en, '')), 'D') ||
        setweight(to_tsvector('simple', coalesce(description_zh, '')), 'D')
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_products_search_tsv
    ON products USING GIN (search_tsv)
    WHERE is_active = TRUE AND deleted_at IS NULL;

-- =========================================================================
-- search_logs — analytics for the search endpoint
-- =========================================================================
CREATE TABLE IF NOT EXISTS search_logs (
    id              BIGSERIAL   PRIMARY KEY,
    query           TEXT        NOT NULL,
    query_normalized TEXT       NOT NULL,    -- lowercased + trimmed
    result_count    INTEGER     NOT NULL DEFAULT 0,
    duration_ms     INTEGER     NOT NULL DEFAULT 0,
    user_id         INTEGER     REFERENCES users(id) ON DELETE SET NULL,
    request_id      VARCHAR(64),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- The (query_normalized, created_at) index powers the "popular
-- searches today" dashboard. Partial index because the table
-- grows fast and we never query pre-2026 rows.
CREATE INDEX IF NOT EXISTS idx_search_logs_normalized_time
    ON search_logs (query_normalized, created_at DESC)
    WHERE created_at > '2026-01-01';

-- The (created_at) BRIN index backs the "all searches in the last
-- hour" admin view. BRIN is the right shape for time-series
-- append-only data and is much smaller than a btree.
CREATE INDEX IF NOT EXISTS idx_search_logs_created_brin
    ON search_logs USING BRIN (created_at);
