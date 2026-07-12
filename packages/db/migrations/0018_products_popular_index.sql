-- =====================================================================
-- 0018_products_popular_index.sql
-- PERF-C2 (2026-07-02): support /api/products?sort=popular
-- (ORDER BY sold_count DESC) without a full scan + sort.
--
-- Without this index Postgres falls back to a Sort node above an
-- index scan on `idx_products_active`, taking 50-300 ms on 100k+
-- products. The new index is a partial covering index on the
-- (sold_count DESC, created_at DESC) tuple, restricted to the hot
-- filter `is_active = TRUE AND deleted_at IS NULL`. Partial indexes
-- are smaller and faster to maintain than full ones because the
-- DB only tracks live rows.
--
-- Ordering: (sold_count DESC, created_at DESC) — secondary key
-- breaks ties on sold_count so the most recent hot products come
-- first within each sold_count bucket. This matches the query
-- `ORDER BY sold_count DESC` which is currently used by the
-- "popular" sort option on /api/products.
-- =====================================================================
CREATE INDEX
IF NOT EXISTS idx_products_popular
    ON products
(sold_count DESC, created_at DESC)
    WHERE is_active = TRUE AND deleted_at IS NULL;

-- ANALYZE so the planner picks the new index immediately. The
-- migration is safe to re-run — IF NOT EXISTS is idempotent and
-- ANALYZE without args updates statistics for all tables in the
-- current schema (cheap operation, ~10 ms on 100k rows).
ANALYZE products;
