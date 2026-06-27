-- =============================================================================
-- 0013_inventory_log_trigger_definer.sql — fix order placement 500
-- =============================================================================
-- Problem: the trigger function trg_order_items_decrement_stock() inserts
--          into inventory_log on every order_item. roles.sql REVOKEs
--          INSERT on inventory_log from noufex_app (so the app can't
--          forge stock movements). Without SECURITY DEFINER, the trigger
--          runs as the calling user (noufex_app) and the INSERT fails
--          with `permission denied for table inventory_log`. Order
--          placement then crashes with a 500.
--
-- Fix: recreate the trigger function with SECURITY DEFINER. It still
--      runs in the context of the table owner (noufex_owner), so the
--      INSERT works; the application cannot bypass it to forge entries
--      because it doesn't have INSERT privilege on inventory_log.
--
--      No data is changed. Only the function definition is replaced.
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_order_items_decrement_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_product_stock     int;
    v_variant_stock     int;
    v_store_id          int;
BEGIN
    -- Lock the product row to avoid race conditions.
    SELECT stock, store_id
      INTO v_product_stock, v_store_id
      FROM products
     WHERE id = NEW.product_id
       FOR UPDATE;

    IF v_product_stock IS NULL THEN
        RAISE EXCEPTION 'order_items.product_id % does not exist', NEW.product_id;
    END IF;

    -- Variant stock check (if specified)
    IF NEW.variant_id IS NOT NULL THEN
        SELECT stock INTO v_variant_stock
          FROM product_variants
         WHERE id = NEW.variant_id
           AND product_id = NEW.product_id
           FOR UPDATE;

        IF v_variant_stock IS NULL THEN
            RAISE EXCEPTION 'order_items.variant_id % does not belong to product %',
                NEW.variant_id, NEW.product_id;
        END IF;
        IF v_variant_stock < NEW.quantity THEN
            RAISE EXCEPTION
                'insufficient stock for variant % (have %, need %)',
                NEW.variant_id, v_variant_stock, NEW.quantity;
        END IF;

        UPDATE product_variants
           SET stock = stock - NEW.quantity
         WHERE id = NEW.variant_id;
    END IF;

    IF v_product_stock < NEW.quantity THEN
        RAISE EXCEPTION
            'insufficient stock for product % (have %, need %)',
            NEW.product_id, v_product_stock, NEW.quantity;
    END IF;

    UPDATE products
       SET stock = stock - NEW.quantity,
           sold_count = sold_count + NEW.quantity
     WHERE id = NEW.product_id;

    INSERT INTO inventory_log (product_id, store_id, change_amount,
                               reason, reference_type, reference_id)
    VALUES (NEW.product_id, v_store_id, -NEW.quantity,
            'order_placed', 'order', NEW.order_id);

    RETURN NEW;
END;
$$;

-- Function ownership stays with noufex_owner (set during baseline).
-- No GRANT changes — the trigger fires automatically on order_items insert.
