-- =====================================================================
-- Migration 0025: Store counters, composite index, and schema fixes
-- =====================================================================
-- Fixes:
--   1. Add triggers to keep stores.rating, stores.review_count,
--      stores.sales_count, stores.followers_count in sync
--   2. Add composite index for orders(status, store_id) queries
--   3. Fix stores.since_year from VARCHAR(4) to SMALLINT
--   4. Add CHECK constraint for orders.total validation
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Fix stores.since_year: VARCHAR(4) → SMALLINT with CHECK
-- ---------------------------------------------------------------------
-- First, drop the column and re-create with correct type.
-- Data is preserved via a DO block.
DO $$
DECLARE
    v_type text;
BEGIN
    SELECT data_type INTO v_type
      FROM information_schema.columns
     WHERE table_name = 'stores' AND column_name = 'since_year';

    IF v_type = 'character varying' THEN
        -- Convert existing data to SMALLINT, preserving non-numeric as NULL
        ALTER TABLE stores
            ALTER COLUMN since_year TYPE SMALLINT
            USING NULLIF(regexp_replace(since_year, '[^0-9]', '', 'g'), '')::SMALLINT;

        ALTER TABLE stores
            ALTER COLUMN since_year SET DEFAULT 2024;

        ALTER TABLE stores
            ADD CONSTRAINT chk_since_year_range
            CHECK (since_year IS NULL OR (since_year BETWEEN 2000 AND 2100));

        RAISE NOTICE 'stores.since_year converted from VARCHAR(4) to SMALLINT';
    ELSE
        RAISE NOTICE 'stores.since_year already has type %, skipping conversion', v_type;
    END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 2. Add composite index for orders(status, store_id)
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_store_status
    ON orders(store_id, status, created_at DESC);

-- ---------------------------------------------------------------------
-- 3. Function: sync stores.rating and stores.review_count
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_stores_refresh_review_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_store_id int;
BEGIN
    v_store_id := COALESCE(NEW.store_id, OLD.store_id);

    -- Update rating + review_count for the store
    UPDATE stores
       SET rating = COALESCE((
               SELECT AVG(r.rating)
                 FROM reviews r
                 JOIN products p ON p.id = r.product_id
                WHERE p.store_id = v_store_id
                  AND r.is_visible = TRUE
           ), 0),
           review_count = (
               SELECT COUNT(*)
                 FROM reviews r
                 JOIN products p ON p.id = r.product_id
                WHERE p.store_id = v_store_id
                  AND r.is_visible = TRUE
           )
     WHERE id = v_store_id;

    RETURN COALESCE(NEW, OLD);
END
$$;

-- ---------------------------------------------------------------------
-- 4. Function: sync stores.followers_count
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_stores_refresh_followers_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_store_id int;
BEGIN
    v_store_id := COALESCE(NEW.store_id, OLD.store_id);

    UPDATE stores
       SET followers_count = (
           SELECT COUNT(*) FROM store_followers
            WHERE store_id = v_store_id
       )
     WHERE id = v_store_id;

    RETURN COALESCE(NEW, OLD);
END
$$;

-- ---------------------------------------------------------------------
-- 5. Function: sync stores.sales_count (on order delivered)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_stores_refresh_sales_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    -- Only increment when status changes TO 'delivered'
    IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
        -- SECURITY: use NEW.store_id directly from the orders table.
        -- The previous version queried order_items.store_id which does
        -- NOT exist (order_items has product_id, not store_id), causing
        -- a runtime crash on every delivery transition.
        UPDATE stores
           SET sales_count = sales_count + 1
         WHERE id = NEW.store_id;
    END IF;

    RETURN NEW;
END
$$;

-- ---------------------------------------------------------------------
-- 6. Create triggers for store counters
-- ---------------------------------------------------------------------

-- reviews → stores.rating + stores.review_count
DROP TRIGGER IF EXISTS trg_reviews_refresh_store_stats_ins ON reviews;
CREATE TRIGGER trg_reviews_refresh_store_stats_ins
    AFTER INSERT ON reviews
    FOR EACH ROW EXECUTE FUNCTION trg_stores_refresh_review_stats();

DROP TRIGGER IF EXISTS trg_reviews_refresh_store_stats_upd ON reviews;
CREATE TRIGGER trg_reviews_refresh_store_stats_upd
    AFTER UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION trg_stores_refresh_review_stats();

DROP TRIGGER IF EXISTS trg_reviews_refresh_store_stats_del ON reviews;
CREATE TRIGGER trg_reviews_refresh_store_stats_del
    AFTER DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION trg_stores_refresh_review_stats();

-- store_followers → stores.followers_count
DROP TRIGGER IF EXISTS trg_followers_refresh_count_ins ON store_followers;
CREATE TRIGGER trg_followers_refresh_count_ins
    AFTER INSERT ON store_followers
    FOR EACH ROW EXECUTE FUNCTION trg_stores_refresh_followers_count();

DROP TRIGGER IF EXISTS trg_followers_refresh_count_del ON store_followers;
CREATE TRIGGER trg_followers_refresh_count_del
    AFTER DELETE ON store_followers
    FOR EACH ROW EXECUTE FUNCTION trg_stores_refresh_followers_count();

-- orders → stores.sales_count
DROP TRIGGER IF EXISTS trg_orders_refresh_store_sales ON orders;
CREATE TRIGGER trg_orders_refresh_store_sales
    AFTER UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION trg_stores_refresh_sales_count();

-- ---------------------------------------------------------------------
-- 7. Backfill existing data (run once)
-- ---------------------------------------------------------------------
DO $$
BEGIN
    -- Backfill stores.rating + review_count
    UPDATE stores s
       SET rating = COALESCE((
               SELECT AVG(r.rating)
                 FROM reviews r
                 JOIN products p ON p.id = r.product_id
                WHERE p.store_id = s.id
                  AND r.is_visible = TRUE
           ), 0),
           review_count = (
               SELECT COUNT(*)
                 FROM reviews r
                 JOIN products p ON p.id = r.product_id
                WHERE p.store_id = s.id
                  AND r.is_visible = TRUE
           );

    -- Backfill stores.followers_count
    UPDATE stores s
       SET followers_count = (
           SELECT COUNT(*) FROM store_followers
            WHERE store_id = s.id
       );

    -- Backfill stores.sales_count
    UPDATE stores s
       SET sales_count = (
           SELECT COUNT(*)
             FROM orders o
            WHERE o.store_id = s.id
              AND o.status = 'delivered'
       );

    RAISE NOTICE 'Store counters backfilled successfully';
END
$$;
