-- =====================================================================
-- Nouf-ex — Views (security_invoker, explicit columns)
-- =====================================================================
-- Reference: https://www.postgresql.org/docs/17/sql-createview.html
--   * security_invoker = true → view checks the invoking role's privs,
--     not the view owner's. Safer for least-privilege.
--   * Explicit column lists (no SELECT *) so schema additions don't
--     silently leak into the view.
-- =====================================================================

-- ---------------------------------------------------------------------
-- v_product_with_store — product + store + category, ready for storefront
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_product_with_store
WITH (security_invoker = true) AS
SELECT
    p.id,
    p.store_id,
    p.category_id,
    p.name_ar,
    p.name_en,
    p.name_zh,
    p.description,
    p.description_en,
    p.description_zh,
    p.price,
    p.original_price,
    p.currency,
    p.stock,
    p.moq,
    p.weight,
    p.tax_rate,
    p.is_digital,
    p.main_image,
    p.features,
    p.specifications,
    p.badges,
    p.rating,
    p.review_count,
    p.sold_count,
    p.view_count,
    p.is_active,
    p.is_featured,
    p.deal_discount,
    p.deal_ends_at,
    p.created_at,
    p.updated_at,
    s.slug            AS store_slug,
    s.store_name      AS store_name_ar,
    s.store_name_en   AS store_name_en,
    s.store_name_zh   AS store_name_zh,
    s.logo            AS store_logo,
    s.banner          AS store_banner,
    s.trust_level,
    s.rating          AS store_rating,
    s.review_count    AS store_review_count,
    s.response_rate,
    s.on_time_delivery,
    s.governorate,
    s.commission_rate,
    c.name_ar         AS category_name_ar,
    c.name_en         AS category_name_en,
    c.name_zh         AS category_name_zh,
    c.slug            AS category_slug
FROM products p
JOIN stores     s ON s.id = p.store_id
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.is_active = TRUE
  AND p.deleted_at IS NULL
  AND s.is_active = TRUE
  AND s.deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- v_store_stats — store + aggregated metrics (merchant dashboard)
--
-- SECURITY: Uses denormalized counters on stores table (products_count,
-- review_count, rating, sales_count, followers_count) which are kept
-- in sync by triggers. This avoids expensive scalar subqueries.
-- For real-time analytics, query the source tables directly.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_store_stats
WITH (security_invoker = true) AS
SELECT
    s.id,
    s.owner_id,
    s.slug,
    s.store_name,
    s.store_name_en,
    s.store_name_zh,
    s.logo,
    s.banner,
    s.trust_level,
    s.is_active,
    s.is_verified,
    s.created_at,
    s.products_count     AS total_products,
    s.review_count       AS total_reviews,
    s.rating             AS computed_rating,
    s.sales_count        AS total_orders,
    s.followers_count    AS total_followers,
    -- Compute revenue from orders (not denormalized due to complexity)
    -- Only include paid orders to avoid counting shipped-but-unpaid COD
    (SELECT COALESCE(SUM(total), 0) FROM orders
        WHERE store_id = s.id AND status IN ('delivered','shipped')
          AND payment_status = 'paid')
        AS total_revenue,
    -- Count active products (subset of products_count)
    (SELECT COUNT(*) FROM products
        WHERE store_id = s.id AND deleted_at IS NULL AND is_active = TRUE)::int
        AS active_products
FROM stores s
WHERE s.deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- v_order_summary — order + customer + store + item counts
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_order_summary
WITH (security_invoker = true) AS
SELECT
    o.id,
    o.order_number,
    o.status,
    o.payment_status,
    o.payment_method,
    o.subtotal,
    o.shipping_cost,
    o.discount,
    o.discount_amount,
    o.coupon_code,
    o.total,
    o.currency,
    o.created_at,
    o.updated_at,
    o.customer_id,
    u.full_name  AS customer_name,
    u.email      AS customer_email,
    u.phone      AS customer_phone,
    o.store_id,
    s.store_name AS store_name_ar,
    s.slug       AS store_slug,
    s.logo       AS store_logo,
    s.trust_level,
    COUNT(i.id)        AS items_count,
    SUM(i.quantity)    AS total_qty
FROM orders o
JOIN users  u ON u.id = o.customer_id
JOIN stores s ON s.id = o.store_id
LEFT JOIN order_items i ON i.order_id = o.id
GROUP BY o.id, u.full_name, u.email, u.phone, s.store_name, s.slug, s.logo, s.trust_level;

-- ---------------------------------------------------------------------
-- v_low_stock — ops alert (stock < 10)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_low_stock
WITH (security_invoker = true) AS
SELECT
    p.id            AS product_id,
    p.name_ar,
    p.name_en,
    p.stock,
    p.store_id,
    s.store_name,
    s.owner_id
FROM products p
JOIN stores    s ON s.id = p.store_id
WHERE p.deleted_at IS NULL
  AND p.is_active = TRUE
  AND p.stock < 10;
