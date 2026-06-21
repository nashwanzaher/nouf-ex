-- =====================================================================
-- Nouf-ex — PL/pgSQL Functions (used by triggers)
-- =====================================================================
-- Reference: https://www.postgresql.org/docs/17/triggers.html
--   * Trigger functions MUST be in a procedural language.
--   * PG 17 requires safe search_path for stored generated columns and
--     expression indexes — set search_path = pg_catalog, public on
--     every CREATE FUNCTION.
-- =====================================================================

-- ---------------------------------------------------------------------
-- trg_set_updated_at — universal updated_at maintainer
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END
$$;

-- ---------------------------------------------------------------------
-- trg_orders_state_machine — enforces allowed status transitions
--   pending    → confirmed | cancelled | refunded
--   confirmed  → processing | cancelled
--   processing → shipped   | cancelled
--   shipped    → delivered
--   delivered  → refunded
--   cancelled  → (terminal)
--   refunded   → (terminal)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_orders_state_machine()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    transition_ok boolean := FALSE;
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        transition_ok := (OLD.status || '→' || NEW.status) IN (
            'pending→confirmed',
            'pending→cancelled',
            'pending→refunded',
            'confirmed→processing',
            'confirmed→cancelled',
            'processing→shipped',
            'processing→cancelled',
            'shipped→delivered',
            'delivered→refunded'
        );

        IF NOT transition_ok THEN
            RAISE EXCEPTION
                'illegal orders.status transition: % → %',
                OLD.status, NEW.status
                USING ERRCODE = 'check_violation';
        END IF;

        -- Side effects per transition
        IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
            NEW.cancelled_at := now();
        ELSIF NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN
            NEW.delivered_at := now();
        END IF;
    END IF;

    RETURN NEW;
END
$$;

-- ---------------------------------------------------------------------
-- trg_orders_append_timeline — append-only audit log of status changes
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_orders_append_timeline()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        NEW.timeline := NEW.timeline ||
            jsonb_build_array(jsonb_build_object(
                'status',    NEW.status,
                'at',        now(),
                'payment',   NEW.payment_status
            ));
    END IF;
    RETURN NEW;
END
$$;

-- ---------------------------------------------------------------------
-- trg_order_items_decrement_stock — atomic stock decrement + inventory log
--   Validates stock availability BEFORE insert; decrements product.stock
--   and product_variants.stock on success; appends to inventory_log.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_order_items_decrement_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
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
END
$$;

-- ---------------------------------------------------------------------
-- trg_reviews_refresh_rating — keeps products.review_count / rating fresh
--   Counts only visible reviews.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_reviews_refresh_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_product_id int;
    v_count       int;
    v_avg         numeric(2,1);
BEGIN
    v_product_id := COALESCE(NEW.product_id, OLD.product_id);

    SELECT COUNT(*), COALESCE(AVG(rating), 0)
      INTO v_count, v_avg
      FROM reviews
     WHERE product_id = v_product_id
       AND is_visible = TRUE;

    UPDATE products
       SET review_count = v_count,
           rating       = v_avg
     WHERE id = v_product_id;

    RETURN COALESCE(NEW, OLD);
END
$$;

-- ---------------------------------------------------------------------
-- trg_products_refresh_store_count — stores.products_count sync
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_products_refresh_store_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_store_id int;
BEGIN
    v_store_id := COALESCE(NEW.store_id, OLD.store_id);

    UPDATE stores
       SET products_count = (
            SELECT COUNT(*) FROM products
             WHERE store_id = v_store_id
               AND deleted_at IS NULL
               AND is_active = TRUE
           )
     WHERE id = v_store_id;

    RETURN COALESCE(NEW, OLD);
END
$$;

-- ---------------------------------------------------------------------
-- trg_refunds_resolve_payments — keep payments.status synced on refund
--   Fires on INSERT OR UPDATE so refunds created directly with
--   status='processed' (e.g. by an admin tool) also flip the payment.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_refunds_resolve_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW.status = 'processed'
       AND COALESCE(OLD.status, '') IS DISTINCT FROM 'processed' THEN
        IF TG_OP = 'UPDATE' THEN
            NEW.resolved_at := now();
        END IF;

        UPDATE payments
           SET status = 'refunded',
               refunded_at = COALESCE(refunded_at, now())
         WHERE order_id = NEW.order_id
           AND status = 'completed';
    END IF;
    RETURN NEW;
END
$$;
