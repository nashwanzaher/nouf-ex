-- =====================================================================
-- Nouf-ex — Trigger definitions
-- =====================================================================
-- Each trigger references a function in functions.sql.
-- All triggers are AFTER/BEFORE per row; idempotent via DROP IF EXISTS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) updated_at maintainer — every table with an updated_at column
-- ---------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT c.table_schema, c.table_name
          FROM information_schema.columns c
         WHERE c.column_name = 'updated_at'
           AND c.table_schema = 'public'
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_%I_set_updated_at ON %I.%I;
             CREATE TRIGGER trg_%I_set_updated_at
                 BEFORE UPDATE ON %I.%I
                 FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();',
            r.table_name, r.table_schema, r.table_name,
            r.table_name, r.table_schema, r.table_name
        );
    END LOOP;
END
$$;

-- ---------------------------------------------------------------------
-- 2) orders state machine + timeline
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_orders_state_machine ON orders;
CREATE TRIGGER trg_orders_state_machine
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION trg_orders_state_machine();

DROP TRIGGER IF EXISTS trg_orders_append_timeline ON orders;
CREATE TRIGGER trg_orders_append_timeline
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION trg_orders_append_timeline();

-- ---------------------------------------------------------------------
-- 3) order_items → stock decrement + inventory log
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_order_items_decrement_stock ON order_items;
CREATE TRIGGER trg_order_items_decrement_stock
    BEFORE INSERT ON order_items
    FOR EACH ROW EXECUTE FUNCTION trg_order_items_decrement_stock();

-- ---------------------------------------------------------------------
-- 4) reviews → products.review_count + products.rating
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_reviews_refresh_rating_ins ON reviews;
CREATE TRIGGER trg_reviews_refresh_rating_ins
    AFTER INSERT ON reviews
    FOR EACH ROW EXECUTE FUNCTION trg_reviews_refresh_rating();

DROP TRIGGER IF EXISTS trg_reviews_refresh_rating_upd ON reviews;
CREATE TRIGGER trg_reviews_refresh_rating_upd
    AFTER UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION trg_reviews_refresh_rating();

DROP TRIGGER IF EXISTS trg_reviews_refresh_rating_del ON reviews;
CREATE TRIGGER trg_reviews_refresh_rating_del
    AFTER DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION trg_reviews_refresh_rating();

-- ---------------------------------------------------------------------
-- 5) products → stores.products_count
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_products_refresh_store_count_ins ON products;
CREATE TRIGGER trg_products_refresh_store_count_ins
    AFTER INSERT ON products
    FOR EACH ROW EXECUTE FUNCTION trg_products_refresh_store_count();

DROP TRIGGER IF EXISTS trg_products_refresh_store_count_upd ON products;
CREATE TRIGGER trg_products_refresh_store_count_upd
    AFTER UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION trg_products_refresh_store_count();

DROP TRIGGER IF EXISTS trg_products_refresh_store_count_del ON products;
CREATE TRIGGER trg_products_refresh_store_count_del
    AFTER DELETE ON products
    FOR EACH ROW EXECUTE FUNCTION trg_products_refresh_store_count();

-- ---------------------------------------------------------------------
-- 6) refunds → payments.status sync
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_refunds_resolve_payments ON refunds;
CREATE TRIGGER trg_refunds_resolve_payments
    BEFORE INSERT OR UPDATE ON refunds
    FOR EACH ROW EXECUTE FUNCTION trg_refunds_resolve_payments();
